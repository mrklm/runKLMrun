import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { PROFILE_REGISTRY_NAME, createRunnerProfile, deleteRunnerProfileDatabase, finalizeRunnerProfileDeletion, markRunnerProfileDeleting, readProfileRegistry, resumePendingProfileDeletions, RunnerProfileConflictError, RunnerProfileDeletionCoordinationError, RunnerProfileDeletionError, subscribeProfileRegistry, updateRunnerProfile, writeProfileRegistry } from './profile-registry';
const profile=(id:string,name:string)=>({id,displayName:name,databaseName:`runklmrun-user-${id}`,createdAt:'2026-01-01',updatedAt:'2026-01-01'});
const operationId='00000000-0000-4000-8000-000000000001';
afterEach(async()=>{await deleteDB(PROFILE_REGISTRY_NAME);});
it('notifie après validation, relit création, renommage et suppression',async()=>{
 const changed=vi.fn(),stop=subscribeProfileRegistry(changed);
 await writeProfileRegistry({migration:'complete',lastUsedProfileId:'a',profiles:[profile('a','A')]});
 expect((await readProfileRegistry())?.profiles.map(value=>value.displayName)).toEqual(['A']);
 await writeProfileRegistry({migration:'complete',lastUsedProfileId:'a',profiles:[profile('a','A renommé'),profile('b','B')]});
 expect((await readProfileRegistry())?.profiles.map(value=>value.displayName)).toEqual(['A renommé','B']);
 await writeProfileRegistry({migration:'complete',lastUsedProfileId:'a',profiles:[profile('a','A renommé')]});
 expect(changed).toHaveBeenCalledTimes(3);stop();
});
it('cesse de notifier après désabonnement',async()=>{const changed=vi.fn(),stop=subscribeProfileRegistry(changed);stop();await writeProfileRegistry({migration:'complete',profiles:[profile('a','A')]});expect(changed).not.toHaveBeenCalled();});
it('crée avec la révision 1 puis incrémente sans changer UUID ni base',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A')]});const created=await createRunnerProfile({displayName:'B',birthDate:'2000-01-02',heightCm:180,weightKg:70});expect(created.databaseName).toBe(`runklmrun-user-${created.id}`);expect(created.revision).toBe(1);
 const updated=await updateRunnerProfile(created.id,{displayName:'B2',heightCm:181},created.revision!,new Date('2026-01-02'));expect(updated.id).toBe(created.id);expect(updated.databaseName).toBe(created.databaseName);expect(updated.birthDate).toBeUndefined();expect(updated.revision).toBe(2);
});
it('refuse une révision obsolète et conserve les données enregistrées',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A')]});const created=await createRunnerProfile({displayName:'B'});await updateRunnerProfile(created.id,{displayName:'B2'},1);
 await expect(updateRunnerProfile(created.id,{displayName:'B3'},1)).rejects.toBeInstanceOf(RunnerProfileConflictError);expect((await readProfileRegistry())?.profiles.find(value=>value.id===created.id)?.displayName).toBe('B2');
});
it('n’accepte qu’une écriture concurrente fondée sur la même révision',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A')]});const created=await createRunnerProfile({displayName:'B'});const results=await Promise.allSettled([updateRunnerProfile(created.id,{displayName:'B2'},1),updateRunnerProfile(created.id,{displayName:'B3'},1)]);
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);expect((await readProfileRegistry())?.profiles.find(value=>value.id===created.id)?.revision).toBe(2);
});
it('initialise une révision pour un profil historique à sa prochaine modification',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A')]});const updated=await updateRunnerProfile('a',{displayName:'A2'},1);expect(updated.revision).toBe(2);expect(updated.id).toBe('a');expect(updated.databaseName).toBe('runklmrun-user-a');
});
it('marque une suppression atomique, conserve ses métadonnées et refuse le dernier profil',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});const marked=await markRunnerProfileDeleting('a','b',1,new Date('2026-01-02'),operationId);expect(marked.status).toBe('deleting');expect(marked.deletion).toEqual({operationId,destinationProfileId:'b',startedAt:'2026-01-02T00:00:00.000Z'});expect((await readProfileRegistry())?.profiles.find(value=>value.id==='a')?.status).toBe('deleting');
 await expect(markRunnerProfileDeleting('b','a',1)).rejects.toBeInstanceOf(RunnerProfileDeletionError);
});
it('refuse destination invalide, révision obsolète et finalisation étrangère',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await expect(markRunnerProfileDeleting('a','missing',1)).rejects.toBeInstanceOf(RunnerProfileDeletionError);await expect(markRunnerProfileDeleting('a','b',2)).rejects.toBeInstanceOf(RunnerProfileConflictError);await markRunnerProfileDeleting('a','b',1,undefined,operationId);await expect(finalizeRunnerProfileDeletion('a','autre')).rejects.toBeInstanceOf(RunnerProfileDeletionError);
});
it('ne marque qu’une fois une même suppression concurrente',async()=>{
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});const results=await Promise.allSettled([markRunnerProfileDeleting('a','b',1),markRunnerProfileDeleting('a','b',1)]);expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect((await readProfileRegistry())?.profiles.filter(profile=>profile.status!=='deleting')).toHaveLength(1);
});
it('reprend une suppression interrompue sans ouvrir la base',async()=>{
 (navigator as any).locks={request:async(_name:string,action:()=>Promise<unknown>)=>action()};
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await markRunnerProfileDeleting('a','b',1,undefined,operationId);await resumePendingProfileDeletions();expect((await readProfileRegistry())?.profiles.map(value=>value.id)).toEqual(['b']);
});
it('conserve deleting si la reprise échoue et ne double pas la tentative locale',async()=>{
 (navigator as any).locks={request:async(_name:string,action:()=>Promise<unknown>)=>action()};
 await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await markRunnerProfileDeleting('a','b',1,undefined,operationId);const original=indexedDB.deleteDatabase;let calls=0;(indexedDB as any).deleteDatabase=()=>{calls++;const request={} as IDBOpenDBRequest;queueMicrotask(()=>request.onerror?.(new Event('error')));return request;};await Promise.all([resumePendingProfileDeletions(),resumePendingProfileDeletions()]);(indexedDB as any).deleteDatabase=original;expect(calls).toBe(1);expect((await readProfileRegistry())?.profiles.find(value=>value.id==='a')?.status).toBe('deleting');
});
it('conserve la requête après blocked, le signale et finalise au succès',async()=>{
 const locks=(navigator as any).locks,original=indexedDB.deleteDatabase;let request={} as IDBOpenDBRequest;
 (navigator as any).locks={request:async(_name:string,action:()=>Promise<unknown>)=>action()};(indexedDB as any).deleteDatabase=()=>request;
 try {
  await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await markRunnerProfileDeleting('a','b',1,undefined,operationId);
  const blocked=vi.fn(),deletion=deleteRunnerProfileDatabase('a',operationId,blocked);let settled=false;void deletion.then(()=>{settled=true;});
  await vi.waitFor(()=>expect(request.onblocked).toBeTypeOf('function'));request.onblocked!(new IDBVersionChangeEvent('blocked'));await Promise.resolve();
  expect(blocked).toHaveBeenCalledTimes(1);expect(settled).toBe(false);expect((await readProfileRegistry())?.profiles.find(value=>value.id==='a')?.status).toBe('deleting');
  request.onsuccess!(new Event('success'));await deletion;expect((await readProfileRegistry())?.profiles.map(value=>value.id)).toEqual(['b']);
 } finally {(indexedDB as any).deleteDatabase=original;(navigator as any).locks=locks;}
});
it('conserve deleting si la requête échoue après blocked',async()=>{
 const locks=(navigator as any).locks,original=indexedDB.deleteDatabase;let request={} as IDBOpenDBRequest;
 (navigator as any).locks={request:async(_name:string,action:()=>Promise<unknown>)=>action()};(indexedDB as any).deleteDatabase=()=>request;
 try {
  await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await markRunnerProfileDeleting('a','b',1,undefined,operationId);
  const blocked=vi.fn(),deletion=deleteRunnerProfileDatabase('a',operationId,blocked);await vi.waitFor(()=>expect(request.onblocked).toBeTypeOf('function'));request.onblocked!(new IDBVersionChangeEvent('blocked'));request.onerror!(new Event('error'));
  await expect(deletion).rejects.toBeInstanceOf(RunnerProfileDeletionError);expect(blocked).toHaveBeenCalledTimes(1);expect((await readProfileRegistry())?.profiles.find(value=>value.id==='a')?.deletion?.operationId).toBe(operationId);
 } finally {(indexedDB as any).deleteDatabase=original;(navigator as any).locks=locks;}
});
it('sérialise deux suppressions avec le même Web Lock',async()=>{
 const locks=(navigator as any).locks,original=indexedDB.deleteDatabase;let request={} as IDBOpenDBRequest,calls=0,queue=Promise.resolve();
 (navigator as any).locks={request:async(_name:string,action:()=>Promise<unknown>)=>{let release!:()=>void;const previous=queue;queue=new Promise<void>(resolve=>{release=resolve;});await previous;try{return await action();}finally{release();}}};(indexedDB as any).deleteDatabase=()=>{calls++;return request;};
 try {
  await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await markRunnerProfileDeleting('a','b',1,undefined,operationId);
  const first=deleteRunnerProfileDatabase('a',operationId),second=deleteRunnerProfileDatabase('a',operationId);await vi.waitFor(()=>expect(calls).toBe(1));request.onsuccess!(new Event('success'));
  const results=await Promise.allSettled([first,second]);expect(calls).toBe(1);expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
 } finally {(indexedDB as any).deleteDatabase=original;(navigator as any).locks=locks;}
});
it('refuse sans Web Locks sans appeler deleteDatabase et conserve deleting',async()=>{
 const locks=(navigator as any).locks;delete (navigator as any).locks;await writeProfileRegistry({migration:'complete',profiles:[profile('a','A'),profile('b','B')]});await markRunnerProfileDeleting('a','b',1,undefined,operationId);const original=indexedDB.deleteDatabase;let calls=0;(indexedDB as any).deleteDatabase=()=>{calls++;return {} as IDBOpenDBRequest;};await expect(deleteRunnerProfileDatabase('a',operationId)).rejects.toBeInstanceOf(RunnerProfileDeletionCoordinationError);await resumePendingProfileDeletions();(indexedDB as any).deleteDatabase=original;(navigator as any).locks=locks;expect(calls).toBe(0);expect((await readProfileRegistry())?.profiles.find(value=>value.id==='a')?.status).toBe('deleting');
});
