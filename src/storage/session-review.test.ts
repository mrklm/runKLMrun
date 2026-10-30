import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { createSessionReviewRepository } from './session-review';
import { createSessionRepository } from './database';
import { createSuggestionV2Repository } from './coach-suggestions-v2';
import { civilDate, ianaTimeZone, instantIso, operationalStatusV2, selectCandidateV2, validateOccurrenceShapeV2 } from '../core/coach/persistence-foundations-v2';
import { validateRealization, validateTrainingDescription, type RealizationResult } from '../core/analysis/session-review';
import { openDatabase } from './database-connection';
import { createBackup, parseBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { validateBackupData } from '../backup/validation';
import { PROFILE_REGISTRY_NAME, writeProfileRegistry } from './profile-registry';

const names: string[] = [];
const name = () => { const value = `review-test-${crypto.randomUUID()}`; names.push(value); return value; };
const run = { id: 'run', title: 'Course synthétique', date: '2026-10-20', sport: 'RUNNING', durationSeconds: 1800 };
const response = (result: RealizationResult) => ({ result, proposalOrigin: 'manual' as const, confirmedBy: 'user' as const });
const moment = { presentedAt: instantIso('2026-10-18T08:00:00.000Z'), presentedOn: civilDate('2026-10-18'),
  timeZone: ianaTimeZone('Europe/Paris'), utcOffsetMinutes: 120, civilDateRule: 'device-local-at-presentation' as const };
async function record(database: string, id = 'occurrence', generation = 1) {
  return (await createSuggestionV2Repository(database).recordPresented({
    selection: selectCandidateV2({ phase: 'candidate', content: { type: 'easy-endurance', totalDurationSeconds: 1800,
      intensity: 'easy', terrain: 'flat', shortSummary: 'Endurance' }, opportunity: { contractVersion: 1, goal: 'endurance',
      suggestedFor: civilDate(run.date), anchor: { kind: 'bootstrap', referenceDate: civilDate('2026-10-18') },
      availability: { weekday: 'tuesday' }, generation } }), moment,
    provenance: { engine: 'coach-v2', contractVersion: 1, referenceConfidence: 'provisional', referenceSourceIds: [], limitationCodes: [] },
    createId: () => id,
  })).occurrence;
}
async function setup(database = name()) {
  const sessions = createSessionRepository(database), repository = createSessionReviewRepository(database);
  await sessions.addImported(run); await record(database);
  return { database, sessions, repository, snapshot: await repository.get(run.id, 'occurrence') };
}
const service = (database: string) => createBackupService({ export: data => exportGzip(data, '0.17.0'),
  parse: file => readBackupFile(file), prepare: (preview, options) => prepareNative(preview, options) }, database);

beforeEach(() => {
  // Interdiction vérifiée avant tout accès, y compris dans les chemins indirects.
  const open = indexedDB.open.bind(indexedDB), remove = indexedDB.deleteDatabase.bind(indexedDB);
  vi.spyOn(indexedDB, 'open').mockImplementation((database, version) => {
    if (database === 'runklmrun') throw new Error('Accès historique interdit');
    return open(database, version);
  });
  vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(database => {
    if (database === 'runklmrun') throw new Error('Suppression historique interdite');
    return remove(database);
  });
});
afterEach(async () => { await Promise.all(names.splice(0).map(database => deleteDB(database))); vi.restoreAllMocks(); });

describe('bilan atomique', () => {
  it('enregistre le lien historique et les annotations dans une transaction sans confirmation', async () => {
    const { repository, snapshot } = await setup();
    const saved = await repository.save(snapshot, { association: 'associate', feeling: { effort: 'easy' } });
    expect(saved.occurrence?.state).toBe('associated'); expect(saved.occurrence?.realization).toBeUndefined();
    expect(saved.session.feeling?.effort).toBe('easy');
    await expect(repository.save(saved, { association: 'associate', realization: response('completed') })).rejects.toThrow(/incohérente/);
    const confirmed = await repository.save(saved, { realization: response('not-completed') });
    await expect(repository.save(confirmed, { association: 'associate' })).rejects.toThrow(/réponse existe/);
  });

  it('enregistre une activité sans recommandation, sans inventer de type', async () => {
    const { repository } = await setup();
    const snapshot = await repository.get(run.id);
    const saved = await repository.save(snapshot, { feeling: { comment: 'Bien' }, trainingDescription: 'Course d’orientation' });
    expect(saved.session.trainingType).toBeUndefined(); expect(saved.occurrence).toBeUndefined();
    await expect(repository.save(saved, { realization: response('completed') })).rejects.toThrow(/recommandation/);
    expect(await repository.get(run.id)).toEqual(saved);
  });
  it('conserve absence, association historique et propriétés non modifiées', async () => {
    const { database, repository, snapshot } = await setup();
    expect(snapshot.occurrence?.realization).toBeUndefined();
    const v2 = createSuggestionV2Repository(database);
    await v2.associateActivity({ occurrenceId: 'occurrence', activityId: run.id, expectedRevision: 1, updatedAt: instantIso('2026-10-20T12:00:00.000Z') });
    const historical = await repository.get(run.id, 'occurrence');
    const saved = await repository.save(historical, { trainingType: 'hills', trainingDescription: 'Escaliers', feeling: { effort: 'moderate' } });
    expect(saved.occurrence).toEqual(historical.occurrence);
    expect(saved.occurrence?.realization).toBeUndefined();
    const cleared = await repository.save(saved, { trainingDescription: null, realization: null });
    expect(cleared.session.trainingDescription).toBeUndefined();
    expect(cleared.session.trainingType).toBe('hills');
    expect(cleared.session.feeling).toEqual({ effort: 'moderate' });
    expect(cleared.occurrence?.state).toBe('associated');
  });
  it.each(['completed', 'partial', 'not-completed'] as const)('enregistre %s sans classification implicite', async result => {
    const { repository, snapshot } = await setup();
    const saved = await repository.save(snapshot, { realization: response(result) });
    expect(saved.occurrence?.realization).toEqual(response(result));
    expect(saved.occurrence?.state).toBe(result === 'not-completed' ? 'active' : 'associated');
    expect(saved.occurrence?.activityId).toBe(result === 'not-completed' ? undefined : run.id);
    expect(saved.session.trainingType).toBeUndefined(); expect(saved.session.trainingDescription).toBeUndefined();
  });
  it('modifie puis efface la réponse et toutes les annotations', async () => {
    const { repository, snapshot } = await setup();
    let saved = await repository.save(snapshot, { realization: response('completed'), trainingType: 'recovery', trainingDescription: 'Footing libre', feeling: { effort: 'easy' } });
    expect(saved.session.trainingType).toBe('recovery');
    saved = await repository.save(saved, { realization: response('partial') });
    expect(saved.occurrence?.realization?.result).toBe('partial');
    saved = await repository.save(saved, { realization: response('not-completed') });
    expect(saved.occurrence?.activityId).toBeUndefined();
    saved = await repository.save(saved, { realization: response('completed') });
    saved = await repository.save(saved, { realization: null, trainingType: null, trainingDescription: null, feeling: null });
    expect(saved.session).toEqual(run); expect(saved.occurrence?.realization).toBeUndefined(); expect(saved.occurrence?.state).toBe('active');
  });
  it('une proposition automatique reste sans confirmation', async () => {
    const { repository, snapshot } = await setup();
    const proposed = await repository.save(snapshot, { realizationProposal: { result: 'partial', origin: 'automatic' } });
    expect(proposed.occurrence?.realization).toBeUndefined(); expect(proposed.occurrence?.activityId).toBeUndefined();
    const confirmed = await repository.save(proposed, { realization: { result: 'partial', proposalOrigin: 'automatic', confirmedBy: 'user' } });
    expect(confirmed.occurrence?.realization?.proposalOrigin).toBe('automatic');
    expect(confirmed.occurrence?.realizationProposal).toEqual(proposed.occurrence?.realizationProposal);
  });
  it('valide strictement descriptions et confirmations', async () => {
    for (const value of ['', '  ', 'a'.repeat(2001), '\u0000', 4]) expect(() => validateTrainingDescription(value)).toThrow();
    for (const value of [{ result: 'partial' }, { ...response('partial'), confirmedBy: 'automatic' }, { ...response('completed'), extra: true }])
      expect(() => validateRealization(value)).toThrow();
    const { repository, snapshot } = await setup();
    await expect(repository.save(snapshot, { trainingDescription: 'a'.repeat(2001), feeling: { effort: 'easy' } })).rejects.toThrow();
    expect(await repository.get(run.id, 'occurrence')).toEqual(snapshot);
  });
  it('refuse les doubles confirmations sans enregistrer le ressenti', async () => {
    const { database, repository, snapshot } = await setup();
    await repository.save(snapshot, { realization: response('partial') }); await record(database, 'other', 2);
    const other = await repository.get(run.id, 'other');
    await expect(repository.save(other, { feeling: { effort: 'hard' }, realization: response('completed') })).rejects.toThrow(/déjà associée/);
    expect(await repository.get(run.id, 'other')).toEqual(other);
  });
  it('annule aussi l’occurrence si l’écriture du résumé échoue', async () => {
    const { repository, snapshot } = await setup();
    const put = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'sessions') throw new Error('Quota synthétique');
      return put.apply(this, args);
    });
    await expect(repository.save(snapshot, { feeling: { effort: 'hard' }, realization: response('partial') })).rejects.toThrow(/Quota/);
    failure.mockRestore();
    expect(await repository.get(run.id, 'occurrence')).toEqual(snapshot);
  });
  it('une réponse négative ne réserve pas l’activité', async () => {
    const { database, repository, snapshot } = await setup();
    await repository.save(snapshot, { realization: response('not-completed') }); await record(database, 'other', 2);
    expect((await repository.save(await repository.get(run.id, 'other'), { realization: response('completed') })).occurrence?.state).toBe('associated');
  });
  it('refuse de confirmer une même recommandation avec une seconde activité', async () => {
    const { repository, sessions, snapshot } = await setup();
    await repository.save(snapshot, { realization: response('completed') });
    await sessions.addImported({ ...run, id: 'second' });
    const other = await repository.get('second', 'occurrence');
    await expect(repository.save(other, { realization: response('partial') })).rejects.toThrow(/autre activité/);
    expect(await repository.get('second', 'occurrence')).toEqual(other);
  });
  it('détecte les conflits simultanés et les révisions périmées', async () => {
    const { repository, snapshot } = await setup();
    const results = await Promise.allSettled([repository.save(snapshot, { realization: response('partial') }), repository.save(snapshot, { realization: response('completed') })]);
    expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
    await expect(repository.save(snapshot, { trainingType: 'hills' })).rejects.toThrow(/changé/);
  });
  it('refuse occurrence obsolète, activité absente et mauvaise date', async () => {
    const { database, sessions, repository, snapshot } = await setup();
    await createSuggestionV2Repository(database).markObsolete('occurrence', 1, instantIso('2026-10-20T12:00:00.000Z'));
    await expect(repository.save(await repository.get(run.id, 'occurrence'), { realization: response('completed') })).rejects.toThrow(/obsolète/);
    await expect(createSuggestionV2Repository(database).associateActivity({ occurrenceId: 'occurrence', activityId: run.id, expectedRevision: 2, updatedAt: instantIso('2026-10-21T12:00:00.000Z') })).rejects.toThrow(/obsolète/);
    await sessions.remove!(run.id); await expect(repository.save(snapshot, { feeling: { effort: 'easy' } })).rejects.toThrow();
    await sessions.addImported({ ...run, date: '2026-10-21' }); await record(database, 'other', 2);
    await expect(repository.save(await repository.get(run.id, 'other'), { realization: response('partial') })).rejects.toThrow(/date/);
  });
  it.each(['modify', 'delete'] as const)('invalide confirmation et proposition après %s', async action => {
    const { repository, sessions, snapshot } = await setup();
    await repository.save(snapshot, { realization: response('partial'), realizationProposal: { result: 'partial', origin: 'automatic' } });
    await sessions.save({ ...run, title: 'Titre corrigé', trainingDescription: 'Description' });
    expect((await repository.get(run.id, 'occurrence')).occurrence?.realization?.result).toBe('partial');
    if (action === 'modify') await sessions.save({ ...run, durationSeconds: 2400 }); else await sessions.remove!(run.id);
    const db = await openDatabase(snapshot.database);
    const occurrence = await db.get('coachSuggestionsV2', 'occurrence'); db.close();
    expect(occurrence?.state).toBe('obsolete'); expect(occurrence?.realization).toBeUndefined(); expect(occurrence?.realizationProposal).toBeUndefined();
  });
  it('conserve une réponse négative hors fenêtre et après obsolescence', async () => {
    const { database, repository, snapshot } = await setup();
    const saved = await repository.save(snapshot, { realization: response('not-completed') });
    expect(operationalStatusV2(saved.occurrence!, '2027-01-01').deletionEligible).toBe(false);
    const obsolete = await createSuggestionV2Repository(database).markObsolete('occurrence', saved.occurrence!.revision, instantIso('2027-01-01T12:00:00.000Z'));
    expect(obsolete.realization?.result).toBe('not-completed');
  });
});

describe('sauvegardes V7', () => {
  it('exporte et restaure JSON et gzip avec une réalisation partielle', async () => {
    const { database, repository, snapshot } = await setup();
    await repository.save(snapshot, { realization: response('partial'), trainingType: 'recovery', trainingDescription: 'Escaliers' });
    const data = await readBackupSnapshot(database), document = await createBackup(data, '0.17.0');
    expect(document.formatVersion).toBe(7); expect((await parseBackup(JSON.stringify(document))).data).toEqual(data);
    const destination = name(), file = (await service(database).exportData()).file;
    await service(destination).restore(await service(destination).preview(file), { mode: 'replace', profile: 'restore' });
    expect(await readBackupSnapshot(destination)).toEqual(data);
    await expect(parseBackup(JSON.stringify({ ...document, formatVersion: 6 }))).rejects.toThrow(/format 7/);
  });
  it('exporte V7 sans occurrence pour une description ou recovery', async () => {
    for (const annotation of [{ trainingDescription: 'Libre' }, { trainingType: 'recovery' as const }]) {
      expect((await createBackup({ sessions: [{ ...run, ...annotation }], details: [], coachProfile: null }, '0.17.0')).formatVersion).toBe(7);
    }
  });
  it('fusionne avec priorité locale et remplace par une ancienne sauvegarde sans confirmation', async () => {
    const { database, repository, snapshot } = await setup();
    const old = await service(database).exportData();
    expect((await readBackupFile(old.file)).formatVersion).toBe(6);
    await repository.save(snapshot, { realization: response('not-completed'), trainingDescription: 'Locale' });
    const before = await readBackupSnapshot(database), svc = service(database);
    const report = await svc.restore(await svc.preview(old.file), { mode: 'merge', profile: 'keep' });
    expect(report.conflicts).toBeGreaterThan(0); expect(report.warnings.length).toBeGreaterThan(0);
    expect(await readBackupSnapshot(database)).toEqual(before);
    await svc.restore(await svc.preview(old.file), { mode: 'replace', profile: 'restore' });
    const restored = await repository.get(run.id, 'occurrence');
    expect(restored.session.trainingDescription).toBeUndefined(); expect(restored.occurrence?.realization).toBeUndefined();
    expect(restored.occurrence!.revision).toBeGreaterThan(before.coachSuggestionsV2![0].revision);
    await expect(repository.save(snapshot, { realization: response('completed') })).rejects.toThrow(/changé/);
  });
  it('refuse références absentes, signatures modifiées et état incohérent', async () => {
    const { database, repository, snapshot } = await setup();
    const saved = await repository.save(snapshot, { realization: response('completed') });
    expect(() => validateOccurrenceShapeV2({ ...saved.occurrence, realization: response('not-completed') })).toThrow();
    const data = await readBackupSnapshot(database);
    expect(() => validateBackupData({ ...data, sessions: [] })).toThrow();
    expect(() => validateBackupData({ ...data, sessions: [{ ...run, durationSeconds: 2400 }] })).toThrow();
  });
});

it('isole deux profils, refuse les instantanés étrangers et le profil supprimé', async () => {
  names.push(PROFILE_REGISTRY_NAME);
  const profiles = ['a', 'b'].map(id => ({ id: `review-${id}`, displayName: id, databaseName: `runklmrun-user-review-${id}`, createdAt: '2026-10-01', updatedAt: '2026-10-01' }));
  names.push(...profiles.map(profile => profile.databaseName));
  await writeProfileRegistry({ migration: 'complete', profiles });
  const a = await setup(profiles[0].databaseName), b = await setup(profiles[1].databaseName);
  await a.repository.save(a.snapshot, { realization: response('completed') });
  expect(await b.repository.get(run.id, 'occurrence')).toEqual(b.snapshot);
  await expect(b.repository.save(a.snapshot, { trainingType: 'hills' })).rejects.toThrow();
  expect(() => createSessionReviewRepository('runklmrun')).toThrow(/explicite/);
  expect(() => createSessionReviewRepository('')).toThrow();
  await writeProfileRegistry({ migration: 'complete', profiles: [profiles[1]] });
  await expect(a.repository.save(a.snapshot, { trainingType: 'hills' })).rejects.toThrow(/profil/);
  expect(vi.mocked(indexedDB.open).mock.calls.some(([database]) => database === 'runklmrun')).toBe(false);
});
