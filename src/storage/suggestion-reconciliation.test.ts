import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { createSuggestionRepository } from './coach-suggestions';
import { startSuggestionReconciliation } from './suggestion-reconciliation';
import { createSessionRepository } from './database';
import { storageChanges } from './changes';
import { openDatabase } from './database-connection';
import { matchingDate, suggestionAssociations } from '../core/coach/suggestion-matching';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { createBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import type { RunningSession } from '../types/session';
const names: string[] = [], stops: (() => void)[] = [];
const now = () => new Date('2026-10-20T12:00:00Z');
const input = { date: '2026-10-18', kind: 'endurance' as const, durationSeconds: 2100 };
const run = (patch: Partial<RunningSession> = {}): RunningSession => ({ id: 'run', date: input.date, title: 'Synthétique', durationSeconds: 2520, sport: 'RUNNING', ...patch });
function setup() {
  const name = `matching-${crypto.randomUUID()}`; names.push(name);
  return { name, suggestions: createSuggestionRepository(name, now), sessions: createSessionRepository(name) };
}
afterEach(async () => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks(); await Promise.all(names.splice(0).map(name => deleteDB(name))); });
it('même jour, durée différente : association persistante, sans changer résumé, détails ou identité', async () => {
  const { name, suggestions, sessions } = setup(); const original = await suggestions.recordPresented(input);
  await sessions.addImported(run(), { id: 'run', altitude: [{ timeSeconds: 1, value: 12 }] });
  const before = await readBackupSnapshot(name);
  expect(await suggestions.reconcileActivities()).toBe(1);
  const linked = (await suggestions.list())[0]; expect(linked).toEqual({ ...original, activityId: 'run', revision: 2 });
  const after = await readBackupSnapshot(name); expect(after.sessions).toEqual(before.sessions); expect(after.details).toEqual(before.details);
  const notify = vi.spyOn(storageChanges, 'committed');
  expect(await suggestions.reconcileActivities()).toBe(0); expect(notify).not.toHaveBeenCalled();
});
it('sortie sans suggestion mémorisée : aucun enregistrement fabriqué', async () => {
  const { suggestions, sessions } = setup(); await sessions.save(run());
  expect(await suggestions.reconcileActivities()).toBe(0); expect(await suggestions.list()).toEqual([]);
});
it.each(['deux activités', 'deux suggestions', 'suggestion remplacée'])('%s : aucune association supposée', async mode => {
  const { suggestions, sessions } = setup(); const a = await suggestions.recordPresented(input); await sessions.save(run());
  if (mode === 'deux activités') await sessions.save(run({ id: 'other' }));
  if (mode === 'deux suggestions') await suggestions.recordPresented({ ...input, durationSeconds: 1800 });
  if (mode === 'suggestion remplacée') await suggestions.markObsolete(a.id, 1);
  expect(await suggestions.reconcileActivities()).toBe(0); expect((await suggestions.list()).every(s => !s.activityId)).toBe(true);
});
it('une nouvelle ambiguïté retire le lien ; les identités remplacées comptent aussi', async () => {
  const { suggestions, sessions } = setup(); await suggestions.recordPresented(input); await sessions.save(run()); await suggestions.reconcileActivities();
  const other = await suggestions.recordPresented({ ...input, durationSeconds: 1800 }); await suggestions.markObsolete(other.id, 1);
  expect(await suggestions.reconcileActivities()).toBe(1); expect((await suggestions.list()).every(s => !s.activityId)).toBe(true);
});
it('import tardif : les suggestions encore stockées sont rapprochables, même expirées', async () => {
  const { name, suggestions, sessions } = setup(); await suggestions.recordPresented(input); await sessions.addImported(run());
  expect(await createSuggestionRepository(name, () => new Date('2026-11-01')).reconcileActivities()).toBe(1);
});
it('suppression puis remplacement : lien orphelin retiré, nouvel identifiant seulement si unique', async () => {
  const { name, suggestions, sessions } = setup(); const a = await suggestions.recordPresented(input); await sessions.save(run()); await suggestions.reconcileActivities();
  const db = await openDatabase(name); await db.delete('sessions', 'run'); db.close();
  expect(await suggestions.reconcileActivities()).toBe(1); expect((await suggestions.list())[0]).toMatchObject({ id: a.id, revision: 3 });
  expect((await suggestions.list())[0].activityId).toBeUndefined();
  await sessions.save(run({ id: 'replacement' })); await suggestions.reconcileActivities();
  expect((await suggestions.list())[0]).toMatchObject({ id: a.id, activityId: 'replacement', revision: 4 });
});
it('une date modifiée ou un autre sport retire un lien devenu invalide', async () => {
  const { suggestions, sessions } = setup(); await suggestions.recordPresented(input); await sessions.save(run()); await suggestions.reconcileActivities();
  await sessions.save(run({ date: '2026-10-19' })); expect(await suggestions.reconcileActivities()).toBe(1);
  await sessions.save(run({ sport: 'CYCLING' })); expect(await suggestions.reconcileActivities()).toBe(0);
});
it('l’API explicite empêche deux associations concurrentes à la même activité', async () => {
  const { suggestions, sessions } = setup(); const a = await suggestions.recordPresented(input), b = await suggestions.recordPresented({ ...input, durationSeconds: 1800 });
  await sessions.save(run());
  const results = await Promise.allSettled([suggestions.associateActivity(a.id, 'run', 1), suggestions.associateActivity(b.id, 'run', 1)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
});
it('liens contradictoires restaurés : retrait sans choisir arbitrairement une suggestion', async () => {
  const { suggestions, sessions } = setup(); const a = await suggestions.recordPresented(input), b = await suggestions.recordPresented({ ...input, durationSeconds: 1800 });
  await sessions.save(run()); const records = [{ ...a, activityId: 'run' }, { ...b, activityId: 'run' }];
  expect([...suggestionAssociations(records, [run()]).values()]).toEqual([undefined, undefined]);
});
it.each([
  ['2026-10-18T00:10:00+02:00', '2026-10-18'],
  ['2026-10-18T23:50:00-03:00', '2026-10-18'],
  ['2026-10-18T23:50:00Z', '2026-10-18'],
  ['2026-10-18T00:10:00', '2026-10-18'],
])('minuit et fuseaux : conserve la date civile source de %s', (startTime, expected) => {
  expect(matchingDate(run({ startTime }))).toBe(expected);
});
it('dates incertaines ou contradictoires et sports inconnus exclus ; résumés historiques sans sport admis', () => {
  for (const patch of [{ date: '2026-02-30' }, { date: '' }, { startTime: 'invalide' }, { startTime: '2026-10-19T00:00:00Z' }, { sport: 'UNKNOWN' }]) expect(matchingDate(run(patch))).toBeUndefined();
  expect(matchingDate(run({ sport: undefined }))).toBe(input.date);
});
it('deux onglets réconcilient sans double écriture ni révision perdue', async () => {
  const { name, suggestions, sessions } = setup(); await suggestions.recordPresented(input); await sessions.save(run());
  const notify = vi.spyOn(storageChanges, 'committed');
  const results = await Promise.all([suggestions.reconcileActivities(), createSuggestionRepository(name, now).reconcileActivities()]);
  expect(results.sort()).toEqual([0, 1]); expect((await suggestions.list())[0].revision).toBe(2); expect(notify).toHaveBeenCalledTimes(1);
});
it('échec transactionnel : aucun changement ni notification ; reprise possible', async () => {
  const { suggestions, sessions } = setup(); const original = await suggestions.recordPresented(input); await sessions.save(run());
  const notify = vi.spyOn(storageChanges, 'committed'); const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('Synthétique'); });
  await expect(suggestions.reconcileActivities()).rejects.toThrow(); put.mockRestore(); expect(await suggestions.list()).toEqual([original]); expect(notify).not.toHaveBeenCalled();
  expect(await suggestions.reconcileActivities()).toBe(1);
});
it('point central : import groupé, réimport sans doublon, save et suppression notifiée ; pas de boucle', async () => {
  const { name, suggestions, sessions } = setup(); await suggestions.recordPresented(input);
  const reconcile = vi.fn(() => suggestions.reconcileActivities()); stops.push(startSuggestionReconciliation(name, reconcile));
  await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  const end = sessions.beginImportBatch!(); await sessions.addImported(run()); await sessions.addImported(run());
  expect((await suggestions.list())[0].activityId).toBeUndefined(); end();
  await vi.waitFor(async () => expect((await suggestions.list())[0].activityId).toBe('run'));
  await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(3)); // commit + notification de lien, puis arrêt car aucune écriture
  await new Promise(resolve => setTimeout(resolve, 20)); expect(reconcile).toHaveBeenCalledTimes(3);
  await sessions.save(run({ id: 'second' })); await vi.waitFor(async () => expect((await suggestions.list())[0].activityId).toBeUndefined());
  const db = await openDatabase(name); await db.delete('sessions', 'second'); db.close(); storageChanges.committed(name, ['sessions']);
  await vi.waitFor(async () => expect((await suggestions.list())[0].activityId).toBe('run'));
});
it('présentation après l’activité et réexécution au démarrage', async () => {
  const { name, suggestions, sessions } = setup(); await sessions.save(run()); stops.push(startSuggestionReconciliation(name, () => suggestions.reconcileActivities()));
  await suggestions.recordPresented(input); await vi.waitFor(async () => expect((await suggestions.list())[0].activityId).toBe('run'));
});
it.each(['replace', 'merge'] as const)('restauration %s puis rapprochement central, sauvegarde du lien compatible', async mode => {
  const source = setup(), dest = setup(); await source.suggestions.recordPresented(input); await source.sessions.save(run());
  const data = await readBackupSnapshot(source.name);
  const file = new Blob([JSON.stringify(await createBackup(data, '0.6.1'))]);
  const service = createBackupService({ export: d => exportGzip(d, '0.6.1'), parse: f => readBackupFile(f), prepare: (p, o) => prepareNative(p, o, now()) }, dest.name);
  stops.push(startSuggestionReconciliation(dest.name, () => dest.suggestions.reconcileActivities()));
  await service.restore(await service.preview(file), { mode, profile: 'keep' });
  await vi.waitFor(async () => expect((await dest.suggestions.list())[0].activityId).toBe('run'));
  const exported = await service.exportData(); const restored = await readBackupFile(exported.file);
  expect(restored.data.coachSuggestions?.[0].activityId).toBe('run'); expect(restored.data.sessions).toEqual(data.sessions);
});
it('Polar puis TCX doublon : une seule activité et un seul lien', async () => {
  const { parsePolar } = await import('../importers/polar');
  const { parseTcx } = await import('../importers/tcx');
  const { DOMParser } = await import('@xmldom/xmldom');
  const { name, suggestions, sessions } = setup(); await suggestions.recordPresented(input);
  stops.push(startSuggestionReconciliation(name, () => suggestions.reconcileActivities()));
  const polar = parsePolar(JSON.stringify({ exercises: [{ sport: 'RUNNING', startTime: '2026-10-18T10:00:00Z', duration: 'PT42M', distance: 6000 }] }), 'training-session_synthetic.json')!;
  await sessions.addImported(polar.session, polar.details);
  await vi.waitFor(async () => expect((await suggestions.list())[0].activityId).toBe(polar.session.id));
  const tcx = await parseTcx('<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="2026-10-18T10:00:00Z"><TotalTimeSeconds>2520</TotalTimeSeconds><DistanceMeters>6000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>', text => new DOMParser().parseFromString(text, 'application/xml') as unknown as Document);
  expect(await sessions.addImported(tcx!.session, tcx!.details)).toBe(false); expect(await sessions.list()).toHaveLength(1);
  expect((await suggestions.list())[0]).toMatchObject({ activityId: polar.session.id, revision: 2 });
});
it('erreur du service : signal générique, pas de boucle, reprise au prochain commit', async () => {
  const { name } = setup(), onError = vi.fn();
  const reconcile = vi.fn().mockRejectedValueOnce(new Error('Message privé jamais transmis')).mockResolvedValue(0);
  stops.push(startSuggestionReconciliation(name, reconcile, onError));
  await vi.waitFor(() => expect(onError).toHaveBeenCalledWith());
  await new Promise(resolve => setTimeout(resolve, 20)); expect(reconcile).toHaveBeenCalledTimes(1);
  storageChanges.committed(name, ['profile']); await new Promise(resolve => setTimeout(resolve, 20)); expect(reconcile).toHaveBeenCalledTimes(1);
  storageChanges.committed(name, ['sessions']); await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
});
it('un changement pendant le rapprochement entraîne une relecture, jamais deux exécutions locales simultanées', async () => {
  const { name } = setup(); let release!: (value: number) => void;
  const reconcile = vi.fn().mockImplementationOnce(() => new Promise<number>(resolve => { release = resolve; })).mockResolvedValue(0);
  stops.push(startSuggestionReconciliation(name, reconcile)); await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  storageChanges.committed(name, ['sessions']); storageChanges.committed(name, ['sessions']);
  await new Promise(resolve => setTimeout(resolve, 20)); expect(reconcile).toHaveBeenCalledTimes(1);
  release(0); await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
});
it('une ancienne révision ne peut écraser le rapprochement et une écriture échouée ne déclenche rien', async () => {
  const { name, suggestions, sessions } = setup(); const a = await suggestions.recordPresented(input); await sessions.save(run());
  await suggestions.reconcileActivities(); await expect(suggestions.markObsolete(a.id, 1)).rejects.toThrow(/changé/);
  const notify = vi.spyOn(storageChanges, 'committed');
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('Synthétique'); });
  await expect(sessions.save(run({ id: 'failure' }))).rejects.toThrow(); put.mockRestore();
  expect(notify).not.toHaveBeenCalled(); expect((await readBackupSnapshot(name)).sessions).toHaveLength(1);
});
it('informations lues dans un instantané : import tardif puis suppression, uniquement après rapprochement', async () => {
  const { name, suggestions, sessions } = setup(); const original = await suggestions.recordPresented(input);
  expect(await suggestions.pastInformation('2026-10-20')).toEqual([original]);
  await sessions.save(run()); expect(await suggestions.pastInformation('2026-10-20')).toEqual([]);
  await suggestions.reconcileActivities(); expect(await suggestions.pastInformation('2026-10-20')).toEqual([]);
  const db = await openDatabase(name); await db.delete('sessions', 'run'); db.close();
  expect(await suggestions.pastInformation('2026-10-20')).toEqual([]);
  await suggestions.reconcileActivities(); expect(await suggestions.pastInformation('2026-10-20')).toHaveLength(1);
});
it('état de préparation : indisponible pendant le calcul et après erreur', async () => {
  const { reconciliationReady } = await import('./suggestion-reconciliation');
  const { name } = setup(); let release!: (value: number) => void;
  const reconcile = vi.fn().mockImplementationOnce(() => new Promise<number>(resolve => { release = resolve; })).mockRejectedValue(new Error('Synthétique'));
  const stop = startSuggestionReconciliation(name, reconcile, () => {}); stops.push(stop);
  expect(reconciliationReady(name)).toBe(false);
  await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1)); expect(reconciliationReady(name)).toBe(false);
  release(0); await vi.waitFor(() => expect(reconciliationReady(name)).toBe(true));
  storageChanges.committed(name, ['sessions']); await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
  expect(reconciliationReady(name)).toBe(false);
});
