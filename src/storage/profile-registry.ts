import { openDB, type DBSchema } from 'idb';
import type { ProfileRegistryState, RunnerProfile } from '../types/runner-profile';

export const PROFILE_REGISTRY_NAME = 'runklmrun-profiles';
const VERSION = 1;
interface RegistryDatabase extends DBSchema {
  profiles: { key: string; value: RunnerProfile };
  state: { key: string; value: ProfileRegistryState & { id: string } };
}
const STATE_KEY = 'state';
const listeners = new Set<() => void>();
const channelName = 'runklmrun-profiles-changed';
let channel: BroadcastChannel | undefined;
const source = crypto.randomUUID();
function notify() { listeners.forEach(listener => listener()); }
function emit() { notify(); if (typeof BroadcastChannel !== 'undefined') { const broadcast = new BroadcastChannel(channelName); broadcast.postMessage({ source }); broadcast.close(); } }
function ensureChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(channelName); channel.onmessage = event => { if (event.data?.source !== source) notify(); };
}
export function subscribeProfileRegistry(listener: () => void) {
  listeners.add(listener); ensureChannel();
  return () => { listeners.delete(listener); if (!listeners.size) { channel?.close(); channel = undefined; } };
}
export async function openProfileRegistry() {
  return openDB<RegistryDatabase>(PROFILE_REGISTRY_NAME, VERSION, { upgrade(db) {
    if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'id' });
  } });
}
export async function readProfileRegistry(): Promise<ProfileRegistryState | undefined> {
  const db = await openProfileRegistry();
  try { const value = await db.get('state', STATE_KEY); return value && { profiles: value.profiles, lastUsedProfileId: value.lastUsedProfileId, migration: value.migration }; } finally { db.close(); }
}
export async function writeProfileRegistry(state: ProfileRegistryState): Promise<void> {
  const db = await openProfileRegistry();
  try {
    const tx = db.transaction(['profiles', 'state'], 'readwrite');
    await tx.objectStore('profiles').clear();
    for (const profile of state.profiles) await tx.objectStore('profiles').put(profile);
    await tx.objectStore('state').put({ ...state, id: STATE_KEY });
    await tx.done;
    emit();
  } finally { db.close(); }
}
export function profileDatabaseName(id: string) { return `runklmrun-user-${id}`; }
export function profileRevision(profile: RunnerProfile) { return profile.revision ?? 1; }
export function profileStatus(profile: RunnerProfile) { return profile.status ?? 'active'; }
export function isProfileActive(profile: RunnerProfile) { return profileStatus(profile) === 'active'; }
export function replacementProfile(state: ProfileRegistryState, unavailableId: string) {
  const unavailable=state.profiles.find(profile=>profile.id===unavailableId);
  const destination=unavailable?.deletion?.destinationProfileId;
  return state.profiles.find(profile=>profile.id===destination&&isProfileActive(profile))
    ?? state.profiles.find(profile=>profile.id!==unavailableId&&isProfileActive(profile));
}
export class RunnerProfileDeletionError extends Error {}
export class RunnerProfileDeletionBlockedError extends RunnerProfileDeletionError { constructor() { super('La suppression attend la fermeture d’une connexion à cette base.'); } }
export class RunnerProfileDeletionDatabaseError extends RunnerProfileDeletionError { constructor() { super('La base du profil n’a pas pu être supprimée.'); } }
export class RunnerProfileDeletionCoordinationError extends RunnerProfileDeletionError { constructor() { super('La coordination inter-onglets est indisponible. La suppression reste en attente.'); } }
function deleteDatabase(name:string,onBlocked?:()=>void) { return new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(new RunnerProfileDeletionDatabaseError());request.onblocked=()=>onBlocked?.();}); }
const resuming = new Set<string>();
export async function withProfileDatabaseLock<T>(databaseName:string, action:()=>Promise<T>, requireWebLock=false) {
 const locks=typeof navigator!=='undefined' ? (navigator as Navigator & { locks?: { request<T>(name:string,callback:()=>Promise<T>):Promise<T> } }).locks : undefined;
 if(!locks&&requireWebLock)throw new RunnerProfileDeletionCoordinationError();
 return locks ? locks.request(`runklmrun-profile-database-${databaseName}`,action) : action();
}
export async function createRunnerProfile(values: Pick<RunnerProfile, 'displayName' | 'birthDate' | 'heightCm' | 'weightKg'>, now = new Date()): Promise<RunnerProfile> {
  const state = await readProfileRegistry();
  if (!state || state.migration !== 'complete') throw new Error('Les profils ne sont pas encore initialisés.');
  const id = crypto.randomUUID();
  const profile: RunnerProfile = { id, databaseName: profileDatabaseName(id), displayName: values.displayName, ...(values.birthDate ? { birthDate: values.birthDate } : {}), ...(values.heightCm === undefined ? {} : { heightCm: values.heightCm }), ...(values.weightKg === undefined ? {} : { weightKg: values.weightKg }), createdAt: now.toISOString(), updatedAt: now.toISOString(), revision: 1, status: 'active' };
  await writeProfileRegistry({ ...state, profiles: [...state.profiles, profile] });
  return profile;
}
export class RunnerProfileConflictError extends Error { constructor() { super('Ce profil a été modifié dans un autre onglet. Rechargez-le avant de réessayer.'); } }
export async function markRunnerProfileDeleting(id:string,destinationProfileId:string,expectedRevision:number,now=new Date(),operationId=crypto.randomUUID()) {
 const db=await openProfileRegistry();try { const tx=db.transaction(['profiles','state'],'readwrite'),state=await tx.objectStore('state').get(STATE_KEY),current=await tx.objectStore('profiles').get(id);
  if(!state||!current)throw new RunnerProfileDeletionError('Profil introuvable.');if(!isProfileActive(current)||profileRevision(current)!==expectedRevision)throw new RunnerProfileConflictError();
  const destination=await tx.objectStore('profiles').get(destinationProfileId),active=state.profiles.filter(isProfileActive);
  if(id===destinationProfileId||!destination||!isProfileActive(destination)||active.length<2)throw new RunnerProfileDeletionError('Suppression impossible.');
  const updated:RunnerProfile={...current,status:'deleting',deletion:{operationId,destinationProfileId,startedAt:now.toISOString()},revision:profileRevision(current)+1,updatedAt:now.toISOString()};
  await tx.objectStore('profiles').put(updated);await tx.objectStore('state').put({...state,profiles:state.profiles.map(profile=>profile.id===id?updated:profile)});await tx.done;emit();return updated;
 } finally {db.close();}
}
export async function finalizeRunnerProfileDeletion(id:string,operationId:string) {
 const db=await openProfileRegistry();try {const tx=db.transaction(['profiles','state'],'readwrite'),state=await tx.objectStore('state').get(STATE_KEY),current=await tx.objectStore('profiles').get(id);
  if(!state||!current||profileStatus(current)!=='deleting'||current.deletion?.operationId!==operationId)throw new RunnerProfileDeletionError('Finalisation refusée.');
  const remaining=state.profiles.filter(profile=>profile.id!==id),destination=remaining.find(profile=>profile.id===current.deletion?.destinationProfileId&&isProfileActive(profile));if(!destination||!remaining.some(isProfileActive))throw new RunnerProfileDeletionError('Destination indisponible.');
  await tx.objectStore('profiles').delete(id);await tx.objectStore('state').put({...state,profiles:remaining,lastUsedProfileId:state.lastUsedProfileId===id?destination.id:state.lastUsedProfileId});await tx.done;emit();
 } finally {db.close();}
}
async function deleteRunnerProfileDatabaseUnderLock(id:string,operationId:string,onBlocked?:()=>void) {
 const state=await readProfileRegistry(),profile=state?.profiles.find(value=>value.id===id);
 if(!profile||profileStatus(profile)!=='deleting'||profile.deletion?.operationId!==operationId||profile.databaseName=== 'runklmrun')throw new RunnerProfileDeletionError('Suppression refusée.');
 await deleteDatabase(profile.databaseName,onBlocked);await finalizeRunnerProfileDeletion(id,operationId);
}
export async function deleteRunnerProfileDatabase(id:string,operationId:string,onBlocked?:()=>void) {
 const state=await readProfileRegistry(),profile=state?.profiles.find(value=>value.id===id);
 if(!profile)throw new RunnerProfileDeletionError('Suppression refusée.');
 return withProfileDatabaseLock(profile.databaseName,()=>deleteRunnerProfileDatabaseUnderLock(id,operationId,onBlocked),true);
}
export async function resumePendingProfileDeletions() {
 const state=await readProfileRegistry(),pending=(state?.profiles??[]).filter(profile=>profileStatus(profile)==='deleting'&&profile.deletion?.operationId&&profile.deletion.destinationProfileId);
 await Promise.all(pending.map(async profile=>{
  const resume=async()=>{if(resuming.has(profile.id))return;resuming.add(profile.id);try {await deleteRunnerProfileDatabase(profile.id,profile.deletion!.operationId);} catch { /* Le marqueur durable permet une nouvelle tentative. */ } finally {resuming.delete(profile.id);} };
  await resume();
 }));
}
export async function updateRunnerProfile(id: string, values: Pick<RunnerProfile, 'displayName' | 'birthDate' | 'heightCm' | 'weightKg'>, expectedRevision: number, now = new Date()): Promise<RunnerProfile> {
  const db=await openProfileRegistry();
  try { const tx=db.transaction(['profiles','state'],'readwrite'), state=await tx.objectStore('state').get(STATE_KEY), current=await tx.objectStore('profiles').get(id);
    if(!state||!current) throw new Error('Profil introuvable.'); if(profileRevision(current)!==expectedRevision) throw new RunnerProfileConflictError();
    const updated:RunnerProfile={...current,...values,birthDate:values.birthDate||undefined,heightCm:values.heightCm,weightKg:values.weightKg,updatedAt:now.toISOString(),revision:profileRevision(current)+1};
    await tx.objectStore('profiles').put(updated);await tx.objectStore('state').put({...state,profiles:state.profiles.map(profile=>profile.id===id?updated:profile)});await tx.done;emit();return updated;
  } catch(error){try{db.close();}catch{}throw error;} finally { db.close(); }
}
