import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { createEvolvingCoachRepository } from './evolving-coach';
import { openDatabase } from './database-connection';
import { ProfileConflictError } from './coach-profile';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { createBackup, canonicalJson, sha256 } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import { fixture } from '../backup/test-fixture';
import type { BackupData } from '../types/backup';
import type { EvolvingCoachValues, EvolvingCoachRecord } from '../types/evolving-coach';
import { canActivateStructuredPlanning, structuredPlanningPolicy } from '../core/coach/foundations';

const names: string[] = [];
const name = () => { const n = `evolving-test-${crypto.randomUUID()}`; names.push(n); return n; };
const time = () => new Date('2026-10-15T12:00:00.000Z');
const values: EvolvingCoachValues = { goal: { model: 'evolving', kind: 'race', distanceMeters: 10000, eventDate: '2027-01-01' }, experience: 'observe' };
const record: EvolvingCoachRecord = { id: 'local', configuration: values, revision: 1, createdAt: time().toISOString(), updatedAt: time().toISOString() };
const empty = (): BackupData => ({ sessions: [], details: [], coachProfile: null });
function service(n: string) {
  return createBackupService({ export: data => exportGzip(data, '0.6.0'), parse: file => readBackupFile(file),
    prepare: (preview, options) => prepareNative(preview, options, time()) }, n);
}
const json = async (data: BackupData) => new Blob([JSON.stringify(await createBackup(data, '0.6.0'))]);
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(names.splice(0).map(n => deleteDB(n))); });

it('absence, création, modification, suppression et recréation sans activation implicite', async () => {
  const n = name(), repo = createEvolvingCoachRepository(n, time);
  expect(await repo.get()).toBeUndefined();
  const a = await repo.save(values, undefined);
  expect(await createEvolvingCoachRepository(n).get()).toEqual(a);
  expect(canActivateStructuredPlanning(structuredPlanningPolicy(a.configuration!.goal), a.configuration!.structuredPlanningPreference)).toBe(false);
  const b = await repo.save({ ...values, structuredPlanningPreference: 'declined' }, a.revision);
  expect(b.revision).toBe(2);
  const removed = await repo.remove(b.revision);
  expect(removed.configuration).toBeNull(); expect(removed.revision).toBe(3);
  await expect(repo.save(values, b.revision)).rejects.toBeInstanceOf(ProfileConflictError);
  const recreated = await repo.save(values, removed.revision);
  expect(recreated.revision).toBe(4);
  await expect(repo.save(values, a.revision)).rejects.toBeInstanceOf(ProfileConflictError);
  await expect(repo.remove(a.revision)).rejects.toBeInstanceOf(ProfileConflictError);
});
it('sérialise deux créations concurrentes et copie les valeurs avant le premier await', async () => {
  const repo = createEvolvingCoachRepository(name(), time), input = structuredClone(values);
  const first = repo.save(input, undefined); input.experience = 'experienced';
  const results = await Promise.allSettled([first, repo.save(values, undefined)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await repo.get())?.configuration?.experience).toBe('observe');
});
it.each([
  { ...values, goal: { model: 'legacy', value: { kind: 'regular' } } },
  { ...values, goal: { model: 'evolving', kind: 'race', distanceMeters: 0 } },
  { ...values, experience: 'expert' }, { ...values, experience: ['observe'] },
  { ...values, structuredPlanningPreference: 'trainer' }, { ...values, availability: {} },
  { ...values, observations: [] }, null,
])('refuse les configurations invalides sans écriture : %j', async invalid => {
  const repo = createEvolvingCoachRepository(name(), time), before = await repo.save(values, undefined);
  await expect(repo.save(invalid as EvolvingCoachValues, before.revision)).rejects.toThrow();
  expect(await repo.get()).toEqual(before);
});
it('migration v5 additive : préserve chaque magasin historique sans conversion', async () => {
  const n = name(), old = await openDB(n, 5, { upgrade(db) {
    for (const store of ['sessions','details','coachProfile','shoes','shoeSettings']) db.createObjectStore(store, { keyPath: 'id' });
    db.createObjectStore('shoeAssignments', { keyPath: 'sessionId' });
  } });
  const data = fixture();
  const entries = { sessions: data.sessions, details: data.details, coachProfile: [data.coachProfile], shoes: [{ id: 'shoe', note: 'synthétique' }], shoeSettings: [{ id: 'local', revision: 2 }], shoeAssignments: [{ sessionId: data.sessions[0].id, shoeId: 'shoe' }] };
  for (const [store, rows] of Object.entries(entries)) for (const row of rows) await old.put(store, row);
  old.close();
  const db = await openDatabase(n);
  expect(db.version).toBe(7);
  for (const [store, rows] of Object.entries(entries)) expect(await db.getAll(store as keyof typeof entries)).toEqual(rows);
  expect(await db.getAll('evolvingCoach')).toEqual([]); db.close();
});
it('export sans configuration conserve le format ancien et ne crée pas de configuration', async () => {
  const n = name(), s = service(n), doc = await readBackupFile((await s.exportData()).file);
  expect(doc.data).toEqual(empty()); expect(doc.formatVersion).toBe(1);
  expect(await createEvolvingCoachRepository(n).get()).toBeUndefined();
});
it.each(['json','gzip'] as const)('export et restauration %s du nouvel état', async format => {
  const source = name(), target = name();
  await createEvolvingCoachRepository(source, time).save(values, undefined);
  const data = await readBackupSnapshot(source);
  const file = format === 'gzip' ? (await service(source).exportData()).file : await json(data);
  expect((await readBackupFile(file)).formatVersion).toBe(3);
  const s = service(target); await s.restore(await s.preview(file), { mode: 'replace', profile: 'restore' });
  expect(await createEvolvingCoachRepository(target).get()).toEqual(record);
});
it('fusion ancienne préserve le nouveau Coach ; remplacement ancien retire uniquement sa configuration', async () => {
  const n = name(), repo = createEvolvingCoachRepository(n, time), s = service(n);
  const before = await repo.save(values, undefined), old = await json(fixture());
  await s.restore(await s.preview(old), { mode: 'merge', profile: 'keep' });
  expect(await repo.get()).toEqual(before);
  await s.restore(await s.preview(old), { mode: 'replace', profile: 'restore' });
  expect((await repo.get())?.configuration).toBeNull();
  expect((await readBackupSnapshot(n)).coachProfile).toEqual(fixture().coachProfile);
  await expect(repo.save(values, before.revision)).rejects.toBeInstanceOf(ProfileConflictError);
});
it('fusion nouvelle garde le choix local, y compris le refus et la suppression', async () => {
  const n = name(), repo = createEvolvingCoachRepository(n, time), s = service(n);
  const accepted = { ...record, configuration: { ...values, structuredPlanningPreference: 'accepted' as const } };
  const incoming = await json({ ...empty(), evolvingCoach: accepted });
  const local = await repo.save({ ...values, structuredPlanningPreference: 'declined' }, undefined);
  const preview = await s.preview(incoming);
  expect(preview.mergeReport?.warnings.join(' ')).toContain('Coach évolutif');
  await s.restore(preview, { mode: 'merge', profile: 'keep' }); expect(await repo.get()).toEqual(local);
  const deleted = await repo.remove(local.revision);
  await s.restore(await s.preview(incoming), { mode: 'merge', profile: 'keep' }); expect(await repo.get()).toEqual(deleted);
});
it('fusion nouvelle vers base vide importe le choix exact ; remplacement invalide les anciennes révisions', async () => {
  const n = name(), s = service(n), repo = createEvolvingCoachRepository(n, time);
  const file = await json({ ...empty(), evolvingCoach: record });
  await s.restore(await s.preview(file), { mode: 'merge', profile: 'keep' }); expect(await repo.get()).toEqual(record);
  await s.restore(await s.preview(file), { mode: 'replace', profile: 'restore' }); expect((await repo.get())?.revision).toBe(2);
  await expect(repo.remove(1)).rejects.toBeInstanceOf(ProfileConflictError);
});
it('refuse toute modification du Coach depuis l’aperçu', async () => {
  const n = name(), s = service(n), repo = createEvolvingCoachRepository(n, time);
  const preview = await s.preview(await json(empty()));
  const saved = await repo.save(values, undefined);
  await expect(s.restore(preview, { mode: 'replace', profile: 'restore' })).rejects.toThrow('changé');
  expect(await repo.get()).toEqual(saved);
});
it('refuse configuration malformée signée et empreinte altérée sans écrire', async () => {
  const n = name(), s = service(n), repo = createEvolvingCoachRepository(n, time);
  await repo.save(values, undefined); const before = await readBackupSnapshot(n);
  const doc = await createBackup({ ...empty(), evolvingCoach: record }, '0.6.0');
  doc.data.evolvingCoach!.configuration!.experience = 'experienced';
  await expect(s.preview(new Blob([JSON.stringify(doc)]))).rejects.toThrow('intégrité');
  const { integrity: _integrity, ...payload } = doc;
  payload.data.evolvingCoach!.configuration!.experience = 'invalide' as 'observe';
  const malformed = { ...payload, integrity: { algorithm: 'SHA-256', digest: await sha256(canonicalJson(payload)) } };
  await expect(s.preview(new Blob([JSON.stringify(malformed)]))).rejects.toThrow('Coach évolutif');
  expect(await readBackupSnapshot(n)).toEqual(before);
});
it.each(['merge','replace'] as const)('annule toutes les écritures si le nouveau magasin échoue en %s', async mode => {
  const n = name(), s = service(n), before = await readBackupSnapshot(n);
  const preview = await s.preview(await json({ ...fixture(), evolvingCoach: record }));
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args) {
    if (this.name === 'evolvingCoach') throw new Error('Échec synthétique du Coach');
    return put.apply(this, args);
  });
  await expect(s.restore(preview, { mode, profile: 'restore' })).rejects.toThrow('Échec synthétique');
  expect(await readBackupSnapshot(n)).toEqual(before);
});
it.each(['accepted', 'declined', 'unexpressed'] as const)('conserve exactement la préférence %s et le chrono facultatif', async preference => {
  const n = name(), repo = createEvolvingCoachRepository(n, time);
  const configuration: EvolvingCoachValues = { goal: { model: 'evolving', kind: 'race', distanceMeters: 12000, eventDate: '2027-02-01', targetSeconds: 5000 }, experience: 'experienced', structuredPlanningPreference: preference };
  const saved = await repo.save(configuration, undefined);
  expect((await readBackupFile((await service(n).exportData()).file)).data.evolvingCoach).toEqual(saved);
});
it('sauvegarde une suppression explicite et la restaure sans ressusciter les choix', async () => {
  const source = name(), repo = createEvolvingCoachRepository(source, time);
  const removed = await repo.remove(undefined), target = name(), s = service(target);
  const file = (await service(source).exportData()).file;
  await s.restore(await s.preview(file), { mode: 'replace', profile: 'restore' });
  expect(await createEvolvingCoachRepository(target).get()).toEqual(removed);
  await expect(repo.save(values, undefined)).rejects.toBeInstanceOf(ProfileConflictError);
});
it('ne masque pas une configuration stockée corrompue et refuse son export', async () => {
  const n = name(), db = await openDatabase(n);
  await db.put('evolvingCoach', { ...record, revision: 0 }); db.close();
  await expect(createEvolvingCoachRepository(n).get()).rejects.toThrow('Métadonnées');
  await expect(service(n).exportData()).rejects.toThrow('Métadonnées');
});
it('refuse un état malformé de sauvegarde et préserve le document signé', async () => {
  const n = name(), s = service(n), data = { ...empty(), evolvingCoach: record };
  const preview = await s.preview(await json(data)), before = structuredClone(preview.backup);
  await s.restore(preview, { mode: 'replace', profile: 'restore' });
  expect(preview.backup).toEqual(before);
  const aborted = new AbortController(); aborted.abort();
  await expect(s.preview(await json(data), aborted.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
