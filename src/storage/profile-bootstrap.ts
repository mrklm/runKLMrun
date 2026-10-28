import { openDatabase, DATABASE_NAME } from './database-connection';
import { isProfileActive, profileDatabaseName, readProfileRegistry, resumePendingProfileDeletions, writeProfileRegistry } from './profile-registry';
import type { ProfileRegistryState, RunnerProfile } from '../types/runner-profile';
import { RETENTION_KEY, retentionKeyForDatabase } from './detail-retention';

const stores = ['sessions', 'details', 'coachProfile', 'shoes', 'shoeAssignments', 'shoeSettings', 'evolvingCoach', 'coachPlanning', 'coachSuggestions', 'coachSuggestionsV2'] as const;
type Store = typeof stores[number];
type DatabaseList = { name?: string }[];
export type ProfileBootstrap = { state: ProfileRegistryState; active: RunnerProfile };

async function databaseExists(name: string, databases: () => Promise<DatabaseList>) {
  return (await databases()).some(database => database.name === name);
}
async function hasData(name: string) {
  const db = await openDatabase(name);
  try { return (await Promise.all(stores.map(store => db.count(store)))).some(Boolean); } finally { db.close(); }
}
async function copyAndVerify(source: string, destination: string) {
  const from = await openDatabase(source);
  let snapshot: Record<Store, unknown[]>;
  try {
    const tx = from.transaction(stores, 'readonly');
    snapshot = Object.fromEntries(await Promise.all(stores.map(async store => [store, await tx.objectStore(store).getAll()]))) as Record<Store, unknown[]>;
    await tx.done;
  } finally { from.close(); }
  const to = await openDatabase(destination);
  try {
    const tx = to.transaction(stores, 'readwrite');
    for (const store of stores) { await tx.objectStore(store).clear(); for (const value of snapshot[store]) await tx.objectStore(store).put(value as never); }
    await tx.done;
    const verify = to.transaction(stores, 'readonly');
    for (const store of stores) {
      const copied = await verify.objectStore(store).getAll();
      const key = (value: unknown) => String((value as { id?: string; sessionId?: string }).id ?? (value as { sessionId?: string }).sessionId);
      const canonical = (values: unknown[]) => values.map(value => [key(value), JSON.stringify(value)]).sort((a, b) => a[0].localeCompare(b[0]));
      if (JSON.stringify(canonical(copied)) !== JSON.stringify(canonical(snapshot[store]))) throw new Error(`Copie du store ${store} incomplète ou altérée.`);
    }
    await verify.done;
  } finally { to.close(); }
}
function newProfile(now: Date, id = crypto.randomUUID()): RunnerProfile {
  return { id, displayName: 'Profil principal', databaseName: profileDatabaseName(id), createdAt: now.toISOString(), updatedAt: now.toISOString(), revision: 1, status: 'active' };
}
/** Bootstrap sans ouverture de la base historique absente. La copie ne touche jamais la source. */
export async function bootstrapProfiles(options: { databases?: () => Promise<DatabaseList>; now?: () => Date } = {}): Promise<ProfileBootstrap> {
  const databases = options.databases ?? (() => indexedDB.databases());
  const now = options.now ?? (() => new Date());
  const initial = await readProfileRegistry();
  if (initial?.profiles.some(profile => !isProfileActive(profile))) void resumePendingProfileDeletions();
  const current = await readProfileRegistry();
  if (current?.migration === 'complete' && current.profiles.some(isProfileActive)) {
    const active = current.profiles.find(profile => profile.id === current.lastUsedProfileId && isProfileActive(profile)) ?? current.profiles.find(isProfileActive)!;
    return { state: current, active };
  }
  const profile = current?.profiles[0] ?? newProfile(now());
  const historical = await databaseExists(DATABASE_NAME, databases) && await hasData(DATABASE_NAME);
  const copying: ProfileRegistryState = { profiles: [profile], lastUsedProfileId: profile.id, migration: 'copying' };
  await writeProfileRegistry(copying);
  if (historical) await copyAndVerify(DATABASE_NAME, profile.databaseName);
  if (historical) {
    try {
      const value = localStorage.getItem(RETENTION_KEY);
      if (value !== null) localStorage.setItem(retentionKeyForDatabase(profile.databaseName), value);
    } catch { /* La migration des données IndexedDB reste valide sans préférence navigateur. */ }
  }
  const complete = { ...copying, migration: 'complete' as const };
  await writeProfileRegistry(complete);
  return { state: complete, active: profile };
}
export async function selectProfile(id: string): Promise<RunnerProfile> {
  const state = await readProfileRegistry();
  const profile = state?.profiles.find(value => value.id === id && isProfileActive(value));
  if (!state || !profile) throw new Error('Profil introuvable.');
  await writeProfileRegistry({ ...state, lastUsedProfileId: id });
  return profile;
}
