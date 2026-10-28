import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { DATABASE_NAME, openDatabase, ProfileDatabaseUnavailableError } from './database-connection';
import { PROFILE_REGISTRY_NAME, createRunnerProfile, markRunnerProfileDeleting, readProfileRegistry, writeProfileRegistry } from './profile-registry';
import { bootstrapProfiles, selectProfile } from './profile-bootstrap';
import { createSuggestionRepository } from './coach-suggestions';

const names = new Set<string>([PROFILE_REGISTRY_NAME, DATABASE_NAME]);
afterEach(async () => { await Promise.all([...names].map(name => deleteDB(name))); names.clear(); names.add(PROFILE_REGISTRY_NAME); names.add(DATABASE_NAME); });
const databases = async () => [...names].map(name => ({ name }));
it('initialise un profil vide sans créer de base historique', async () => {
  const result = await bootstrapProfiles({ databases });
  expect(result.active.displayName).toBe('Profil principal');
  expect(result.active.databaseName).toMatch(/^runklmrun-user-/);
  expect((await readProfileRegistry())?.migration).toBe('complete');
  names.add(result.active.databaseName);
});
it('copie chaque store historique, conserve la source et reprend sans doublon', async () => {
  const source = await openDatabase(DATABASE_NAME);
  await source.put('sessions', { id: 'same', title: 'Course', sport: 'RUNNING', date: '2026-01-01', durationSeconds: 1800 });
  await source.put('details', { id: 'same', gps: [{ latitude: 48, longitude: 2, timeSeconds: 0 }] });
  await source.put('shoes', { id: 'shoe', name: 'Paire', firstUseDate: '2026-01-01', status: 'active', revision: 1, isDefault: true });
  await source.put('shoeAssignments', { sessionId: 'same', shoeId: 'shoe' });
  await source.put('coachProfile', { id: 'local', goal: {}, availability: {}, preferences: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01', revision: 1 });
  source.close();
  const first = await bootstrapProfiles({ databases }); names.add(first.active.databaseName);
  const destination = await openDatabase(first.active.databaseName);
  expect(await destination.count('sessions')).toBe(1); expect(await destination.get('details', 'same')).toBeTruthy();
  expect(await destination.get('shoeAssignments', 'same')).toEqual({ sessionId: 'same', shoeId: 'shoe' }); destination.close();
  const legacy = await openDatabase(DATABASE_NAME); expect(await legacy.count('sessions')).toBe(1); legacy.close();
  expect((await bootstrapProfiles({ databases })).active.databaseName).toBe(first.active.databaseName);
});
it('migre les suggestions V1 sans conversion vers les occurrences V2', async () => {
  const now = () => new Date('2026-10-17T12:00:00.000Z');
  const legacySuggestions = createSuggestionRepository(DATABASE_NAME, now);
  const suggestion = await legacySuggestions.recordPresented({ date: '2026-10-20', kind: 'endurance', durationSeconds: 1800 });

  const first = await bootstrapProfiles({ databases }); names.add(first.active.databaseName);
  const migratedSuggestions = createSuggestionRepository(first.active.databaseName, now);
  expect(await migratedSuggestions.list()).toEqual([suggestion]);
  const migrated = await openDatabase(first.active.databaseName);
  expect(await migrated.count('coachSuggestionsV2')).toBe(0); migrated.close();
  expect(await legacySuggestions.list()).toEqual([suggestion]);
});
it('isole deux profils, y compris des identifiants de séance identiques', async () => {
  const first = await bootstrapProfiles({ databases }); names.add(first.active.databaseName);
  const second = await createRunnerProfile({ displayName: 'Deuxième' }); names.add(second.databaseName);
  const one = await openDatabase(first.active.databaseName), two = await openDatabase(second.databaseName);
  await one.put('sessions', { id: 'same', title: 'A', sport: 'RUNNING', date: '2026-01-01', durationSeconds: 1 });
  await two.put('sessions', { id: 'same', title: 'B', sport: 'RUNNING', date: '2026-01-01', durationSeconds: 2 });
  expect((await one.get('sessions', 'same'))?.title).toBe('A'); expect((await two.get('sessions', 'same'))?.title).toBe('B'); one.close(); two.close();
  expect((await selectProfile(second.id)).id).toBe(second.id);
});
it('isole les suggestions V1, y compris lors de leur modification ou suppression', async () => {
  const now = () => new Date('2026-10-17T12:00:00.000Z');
  const first = await bootstrapProfiles({ databases }); names.add(first.active.databaseName);
  const second = await createRunnerProfile({ displayName: 'Deuxième' }); names.add(second.databaseName);
  const input = { date: '2026-10-20', kind: 'endurance' as const, durationSeconds: 1800 };
  const firstSuggestions = createSuggestionRepository(first.active.databaseName, now);
  const secondSuggestions = createSuggestionRepository(second.databaseName, now);
  const fromFirst = await firstSuggestions.recordPresented(input);
  const fromSecond = await secondSuggestions.recordPresented(input);

  expect(await firstSuggestions.list()).toEqual([fromFirst]);
  expect(await secondSuggestions.list()).toEqual([fromSecond]);
  await firstSuggestions.markObsolete(fromFirst.id, fromFirst.revision);
  expect(await secondSuggestions.list()).toEqual([fromSecond]);
  expect(await firstSuggestions.deleteExpired('2026-10-28')).toBe(1);
  expect(await firstSuggestions.list()).toEqual([]);
  expect(await secondSuggestions.list()).toEqual([fromSecond]);
});
it('reprend un état copying sans activer une copie incomplète', async () => {
  const source = await openDatabase(DATABASE_NAME);
  await source.put('sessions', { id: 'run', title: 'A', sport: 'RUNNING', date: '2026-01-01', durationSeconds: 12 }); source.close();
  const id = crypto.randomUUID(), databaseName = `runklmrun-user-${id}`; names.add(databaseName);
  await writeProfileRegistry({ migration: 'copying', lastUsedProfileId: id, profiles: [{ id, displayName: 'Profil principal', databaseName, createdAt: '2026-01-01', updatedAt: '2026-01-01' }] });
  const partial = await openDatabase(databaseName); await partial.put('sessions', { id: 'run', title: 'Altéré', sport: 'RUNNING', date: '2026-01-01', durationSeconds: 1 }); partial.close();
  const result = await bootstrapProfiles({ databases });
  expect(result.state.migration).toBe('complete');
  const target = await openDatabase(databaseName); expect((await target.get('sessions', 'run'))?.title).toBe('A'); target.close();
  const legacy = await openDatabase(DATABASE_NAME); expect((await legacy.get('sessions', 'run'))?.title).toBe('A'); legacy.close();
});
it('refuse une base de profil deleting ou absente du registre',async()=>{
 const first=await bootstrapProfiles({databases});names.add(first.active.databaseName);const second=await createRunnerProfile({displayName:'B'});names.add(second.databaseName);
 await markRunnerProfileDeleting(first.active.id,second.id,1);await expect(openDatabase(first.active.databaseName)).rejects.toBeInstanceOf(ProfileDatabaseUnavailableError);
 const state=(await readProfileRegistry())!;await writeProfileRegistry({...state,profiles:state.profiles.filter(profile=>profile.id!==second.id)});await expect(openDatabase(second.databaseName)).rejects.toBeInstanceOf(ProfileDatabaseUnavailableError);const historical=await openDatabase(DATABASE_NAME);historical.close();
});
it('démarre sur un profil actif sans attendre une suppression en reprise',async()=>{
 const first=await bootstrapProfiles({databases}),second=await createRunnerProfile({displayName:'B'});names.add(first.active.databaseName);names.add(second.databaseName);await markRunnerProfileDeleting(first.active.id,second.id,1);
 const result=await bootstrapProfiles({databases});expect(result.active.id).toBe(second.id);expect(result.state.profiles.some(profile=>profile.id===first.active.id)).toBe(true);
});
