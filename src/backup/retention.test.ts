import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { canonicalJson, createBackup, sha256, verifyBackup } from './format';
import { exportGzip, readBackupFile } from './compression';
import { prepareRestore } from './merge';
import { fixture } from './test-fixture';
import { createBackupService, prepareNative, readBackupSnapshot } from '../storage/backup';
import { openDatabase } from '../storage/database-connection';
import type { BackupData, BackupDocument, BackupSourceData, RestoreOptions } from '../types/backup';

const reference = new Date('2026-10-13T12:00:00Z');
const empty = (): BackupData => ({ sessions: [], details: [], coachProfile: null });
const names: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(names.splice(0).map(name => deleteDB(name))); });
function data(): BackupSourceData {
  const base = fixture();
  const session = base.sessions[0], detail = base.details[0];
  return {
    sessions: [
      { ...session, id: 'old', date: '2026-01-01', startTime: '2026-01-01T10:00:00Z' },
      { ...session, id: 'recent' },
      { ...session, id: 'invalid-date', date: '2026-02-30', startTime: undefined },
      { ...session, id: 'missing-date', date: undefined, startTime: undefined },
      { ...session, id: 'summary-only' },
    ],
    details: ['old', 'recent', 'invalid-date', 'missing-date'].map(id => ({ ...structuredClone(detail), id })),
    coachProfile: base.coachProfile,
  };
}
async function signed(source = data()): Promise<BackupDocument> {
  const payload = { format: 'runKLMrun-backup' as const, formatVersion: 1 as const, exportedAt: '2026-10-01T12:00:00Z', appVersion: '0.4.0', data: source };
  return JSON.parse(JSON.stringify({ ...payload, integrity: { algorithm: 'SHA-256', digest: await sha256(canonicalJson(payload)) } }));
}
async function file(document: BackupDocument, compressed: boolean) {
  const blob = new Blob([JSON.stringify(document)]);
  return compressed ? new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob() : blob;
}
function service(clock = () => reference) {
  const name = `backup-retention-${crypto.randomUUID()}`; names.push(name);
  const processor = {
    export: (value: BackupData) => exportGzip(value, '0.4.0'),
    parse: (file: Blob) => readBackupFile(file),
    prepare: (preview: Parameters<typeof prepareNative>[0], options: RestoreOptions) => prepareNative(preview, options, clock()),
  };
  return { name, service: createBackupService(processor, name) };
}

describe('sauvegardes et conservation glissante', () => {
  it('exporte les résumés sans détails, les détails présents même anciens et le profil, sans reconstruction', async () => {
    const source = fixture();
    source.sessions.push({ ...source.sessions[0], id: 'without-details' });
    source.sessions[0].date = '2020-01-01'; source.sessions[0].startTime = '2020-01-01T10:00:00Z';
    const { name, service: s } = service();
    const db = await openDatabase(name), tx = db.transaction(['sessions', 'details', 'coachProfile'], 'readwrite');
    for (const session of source.sessions) await tx.objectStore('sessions').put(session);
    await tx.objectStore('details').put(source.details[0]);
    await tx.objectStore('coachProfile').put(source.coachProfile!); await tx.done; db.close();
    const exported = await readBackupFile((await s.exportData()).file);
    expect(exported.formatVersion).toBe(1);
    expect(exported.data).toEqual(source);
    expect(await verifyBackup(exported)).toEqual(exported);
    expect(await readBackupSnapshot(name)).toEqual(source);
  });
  it.each([false, true])('exporte et relit les détails récents avec ou sans gzip (%s)', async compressed => {
    const source = fixture(); source.sessions.push({ ...source.sessions[0], id: 'summary-only' });
    const document = await createBackup(source, '0.4.0');
    expect((await readBackupFile(await file(document, compressed))).data).toEqual(source);
  });
  for (const compressed of [false, true]) it.each(['merge', 'replace'] as const)(`restaure %s après SHA-256, avec filtrage et dates incertaines (gzip=${compressed})`, async mode => {
    const { name, service: s } = service();
    const original = await signed(), before = canonicalJson(original);
    const preview = await s.preview(await file(original, compressed));
    expect(preview.mergeReport?.retention).toEqual({ recentDetails: 1, ignoredDetails: 1, uncertainDetails: 2, uncertainSessions: 2 });
    expect(await readBackupSnapshot(name)).toEqual(empty());
    // Annuler à ce stade consiste à abandonner l’aperçu : aucune écriture.
    expect(canonicalJson(preview.backup)).toBe(before);
    const report = await s.restore(preview, { mode, profile: 'restore' });
    const restored = await readBackupSnapshot(name);
    expect(restored.sessions).toHaveLength(5);
    expect(restored.details.map(d => d.id).sort()).toEqual(['invalid-date', 'missing-date', 'recent']);
    expect(restored.sessions.find(s => s.id === 'missing-date')?.date).toBe('');
    expect(restored.sessions.find(s => s.id === 'invalid-date')?.date).toBe('2026-02-30');
    expect(restored.coachProfile).toEqual(original.data.coachProfile);
    expect(report.detailsAdded).toBe(3);
    expect(canonicalJson(preview.backup)).toBe(before);
    await expect(verifyBackup(preview.backup)).resolves.toEqual(original);
    // Une sauvegarde de l’état restauré reste lisible, même avec dates incertaines.
    expect((await readBackupFile((await s.exportData()).file)).data).toEqual(restored);
  });
  it.each([false, true])('refuse un ancien détail altéré AVANT de pouvoir l’ignorer (gzip=%s)', async compressed => {
    const { name, service: s } = service();
    const document = await signed(); document.data.details[0].heartRate![0].value = 199;
    await expect(s.preview(await file(document, compressed))).rejects.toThrow('intégrité');
    expect(await readBackupSnapshot(name)).toEqual(empty());
  });
  it('revalide les détails anciens modifiés après aperçu sans écrire', async () => {
    const { name, service: s } = service();
    const preview = await s.preview(await file(await signed(), false));
    preview.backup.data.details[0].heartRate![0].value = 199;
    await expect(s.restore(preview, { mode: 'replace', profile: 'restore' })).rejects.toThrow('intégrité');
    expect(await readBackupSnapshot(name)).toEqual(empty());
  });
  it('conserve les détails locaux même anciens et les conflits, sans ajouter des détails anciens absents', () => {
    const incoming = data();
    const local: BackupData = {
      sessions: incoming.sessions.filter(s => ['old', 'recent'].includes(s.id)) as BackupData['sessions'],
      details: [structuredClone(incoming.details[0]), structuredClone(incoming.details[1])], coachProfile: fixture().coachProfile,
    };
    local.details[1].speed = [{ timeSeconds: 0, value: 3 }];
    const before = structuredClone(local);
    const merged = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, reference.toISOString());
    expect(merged.data.details.find(d => d.id === 'old')).toEqual(local.details[0]);
    expect(merged.data.details.find(d => d.id === 'recent')).toEqual(local.details[1]);
    expect(merged.report.conflicts).toBe(1);
    expect(local).toEqual(before);
    local.details = [];
    const filled = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, reference.toISOString());
    expect(filled.data.details.some(d => d.id === 'old')).toBe(false);
    expect(filled.data.details.some(d => d.id === 'recent')).toBe(true);
  });
  it('préserve le couple local lors d’un conflit de résumé', () => {
    const local = fixture(), incoming = fixture(); incoming.sessions[0].title = 'Résumé moins complet'; incoming.sessions[0].distanceMeters = undefined;
    const result = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, reference.toISOString());
    expect(result.data).toEqual(local); expect(result.report.conflicts).toBe(1);
  });
  it('maintient la frontière exacte et exige un nouvel aperçu si elle est franchie avant confirmation', async () => {
    let clock = new Date('2026-10-31T10:00:00Z');
    const { name, service: s } = service(() => clock);
    const preview = await s.preview(await file(await createBackup(fixture(), '0.4.0'), false));
    expect(preview.mergeReport?.retention.ignoredDetails).toBe(0);
    clock = new Date(clock.getTime() + 1);
    await expect(s.restore(preview, { mode: 'replace', profile: 'restore' })).rejects.toThrow('30 jours');
    expect(await readBackupSnapshot(name)).toEqual(empty());
    const updated = await s.preview(await file(await createBackup(fixture(), '0.4.0'), false));
    expect((await s.restore(updated, { mode: 'replace', profile: 'restore' })).retention.ignoredDetails).toBe(1);
  });
});

it.each(['merge', 'replace'] as const)('annule aussi les résumés anciens sans détails si une écriture échoue en mode %s', async mode => {
  const { name, service: s } = service();
  const db = await openDatabase(name);
  await db.put('sessions', { id: 'local', title: 'Locale', date: '2026-10-01', durationSeconds: 60 }); db.close();
  const before = await readBackupSnapshot(name);
  const preview = await s.preview(await file(await signed(), false));
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === 'details') throw new Error('Échec synthétique');
    return add.apply(this, args);
  });
  await expect(s.restore(preview, { mode, profile: 'restore' })).rejects.toThrow('Échec synthétique');
  expect(await readBackupSnapshot(name)).toEqual(before);
});
