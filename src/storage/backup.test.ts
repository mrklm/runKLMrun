import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { createBackup } from '../backup/format';
import { fixture } from '../backup/test-fixture';
import { openDatabase } from './database-connection';
import { createCoachProfileRepository, ProfileConflictError } from './coach-profile';
import { BACKUP_LIMITS } from '../backup/limits';
import { exportGzip, readBackupFile } from '../backup/compression';
import type { BackupData } from '../types/backup';

const names: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(names.splice(0).map(name => deleteDB(name))); });
function service() {
  const name = `backup-test-${crypto.randomUUID()}`; names.push(name);
  const processor = { export: (data: BackupData) => exportGzip(data, '0.4.0'), parse: (file: Blob) => readBackupFile(file), prepare: (preview: Parameters<typeof prepareNative>[0], options: Parameters<typeof prepareNative>[1]) => prepareNative(preview, options, new Date('2026-10-13T12:00:00Z')) };
  return { name, service: createBackupService(processor, name) };
}
const file = async (data = fixture()) => new Blob([JSON.stringify(await createBackup(data, '0.4.0'))]);
async function seed(name: string, data = fixture()) {
  const db = await openDatabase(name), tx = db.transaction(['sessions', 'details', 'coachProfile'], 'readwrite');
  for (const s of data.sessions) await tx.objectStore('sessions').put(s);
  for (const d of data.details) await tx.objectStore('details').put(d);
  if (data.coachProfile) await tx.objectStore('coachProfile').put(data.coachProfile);
  await tx.done; db.close();
}
describe('transactions de sauvegarde', () => {
  it('exporte une base vide puis complète sans écrire dans les magasins', async () => {
    const { name, service: s } = service();
    expect((await readBackupFile((await s.exportData()).file)).data).toEqual({ sessions: [], details: [], coachProfile: null });
    await seed(name); const before = await readBackupSnapshot(name);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put'), add = vi.spyOn(IDBObjectStore.prototype, 'add'), clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
    expect((await readBackupFile((await s.exportData()).file)).data).toEqual(before);
    expect(put).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  });
  it('prévisualise sans écriture, remplace et conserve après réouverture', async () => {
    const { name, service: s } = service(); await seed(name);
    const incoming = fixture(); incoming.sessions[0].id = 'polar:new'; incoming.details[0].id = 'polar:new'; incoming.coachProfile = null;
    const before = await readBackupSnapshot(name), p = await s.preview(await file(incoming));
    expect(await readBackupSnapshot(name)).toEqual(before);
    const result = await s.restore(p, { mode: 'replace', profile: 'restore' });
    expect(result.added).toBe(1); expect(await readBackupSnapshot(name)).toEqual(incoming);
    const db = await openDatabase(name); expect(db.version).toBe(9); db.close();
  });
  it('fusionne sans doublons et garde le profil local', async () => {
    const { name, service: s } = service(); await seed(name);
    const incoming = fixture(); incoming.sessions.push({ ...incoming.sessions[0], id: 'new' });
    incoming.coachProfile!.availability.minutesPerSession = 20;
    const p = await s.preview(await file(incoming));
    expect(p.mergeReport).toMatchObject({ added: 1, retained: 1 });
    await s.restore(p, { mode: 'merge', profile: 'keep' });
    expect((await readBackupSnapshot(name)).sessions).toHaveLength(2);
    expect((await readBackupSnapshot(name)).coachProfile).toEqual(fixture().coachProfile);
    const report = await s.restore(await s.preview(await file(incoming)), { mode: 'merge', profile: 'keep' });
    expect(report.added).toBe(0);
  });
  it('restaure le profil sur consentement et bloque un brouillon à ancienne révision', async () => {
    const { name, service: s } = service(); await seed(name);
    const old = (await readBackupSnapshot(name)).coachProfile!;
    const incoming = fixture(); incoming.coachProfile!.availability.maxMinutesByDay!.monday = 90;
    await s.restore(await s.preview(await file(incoming)), { mode: 'merge', profile: 'restore' });
    const profile = (await readBackupSnapshot(name)).coachProfile!;
    expect(profile.availability.maxMinutesByDay!.monday).toBe(90); expect(profile.revision).toBe(2);
    await expect(createCoachProfileRepository(name).save(old, old.revision)).rejects.toBeInstanceOf(ProfileConflictError);
  });
  it('restaure fidèlement les métadonnées du profil si aucun profil local n’existe', async () => {
    const { name, service: s } = service();
    await s.restore(await s.preview(await file()), { mode: 'merge', profile: 'restore' });
    expect((await readBackupSnapshot(name)).coachProfile).toEqual(fixture().coachProfile);
  });
  it('refuse un fichier invalide ou altéré sans écriture et revalide avant restauration', async () => {
    const { name, service: s } = service(); await seed(name); const before = await readBackupSnapshot(name);
    await expect(s.preview(new Blob(['{}']))).rejects.toThrow();
    const p = await s.preview(await file()); p.backup.data.sessions[0].title = 'Altéré';
    await expect(s.restore(p, { mode: 'replace', profile: 'restore' })).rejects.toThrow('intégrité');
    expect(await readBackupSnapshot(name)).toEqual(before);
  });
  it('refuse un fichier trop volumineux avant lecture et une annulation', async () => {
    const { service: s } = service();
    await expect(s.preview({ size: BACKUP_LIMITS.jsonBytes + 1 } as Blob)).rejects.toThrow('contenu JSON');
    const c = new AbortController(); c.abort();
    await expect(s.preview(await file(), c.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it.each(['sessions', 'details', 'coachProfile'] as const)('refuse les changements dans %s depuis la prévisualisation', async store => {
    const { name, service: s } = service(); await seed(name);
    const p = await s.preview(await file()), db = await openDatabase(name);
    await db.clear(store); db.close();
    const before = await readBackupSnapshot(name);
    await expect(s.restore(p, { mode: 'replace', profile: 'restore' })).rejects.toThrow('changé');
    expect(await readBackupSnapshot(name)).toEqual(before);
  });
  it.each(['replace', 'merge'] as const)('annule toutes les écritures après échec partiel en mode %s', async mode => {
    const { name, service: s } = service(); await seed(name);
    const incoming = fixture(); incoming.sessions[0].id = 'new'; incoming.details[0].id = 'new';
    const p = await s.preview(await file(incoming)), before = await readBackupSnapshot(name);
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'details') throw new DOMException('Quota synthétique', 'QuotaExceededError');
      return add.apply(this, args);
    });
    await expect(s.restore(p, { mode, profile: 'restore' })).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await readBackupSnapshot(name)).toEqual(before);
  });
  it('annule les séances et détails si la dernière écriture du profil échoue', async () => {
    const { name, service: s } = service(); await seed(name);
    const p = await s.preview(await file()), before = await readBackupSnapshot(name);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('Interruption synthétique'); });
    await expect(s.restore(p, { mode: 'replace', profile: 'restore' })).rejects.toThrow();
    expect(await readBackupSnapshot(name)).toEqual(before);
  });
});

it('annule une transaction interrompue après l’écriture des détails', async () => {
  const { name, service: s } = service(); await seed(name);
  const incoming = fixture(); incoming.sessions[0].id = 'new'; incoming.details[0].id = 'new';
  const p = await s.preview(await file(incoming)), before = await readBackupSnapshot(name);
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
    const request = add.apply(this, args);
    if (this.name === 'details') request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
  await expect(s.restore(p, { mode: 'replace', profile: 'restore' })).rejects.toThrow();
  expect(await readBackupSnapshot(name)).toEqual(before);
});

it('remonte une erreur de lecture sans produire de sauvegarde ni écrire', async () => {
  const { name, service: s } = service(); await seed(name);
  const spy = vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(() => { throw new Error('Lecture interrompue'); });
  await expect(s.exportData()).rejects.toThrow('Lecture interrompue');
  spy.mockRestore(); expect(await readBackupSnapshot(name)).toEqual(fixture());
});

it.each(['merge', 'replace'] as const)('restaure gzip en mode %s sans modifier les règles métier', async mode => {
  const { name, service: s } = service();
  await seed(name);
  const data = fixture(); data.sessions.push({ id: 'gzip:new', title: 'Synthétique gzip', date: '2026-10-02', durationSeconds: 60 });
  const gzip = await exportGzip(data, '0.4.0');
  const preview = await s.preview(gzip.file);
  await s.restore(preview, { mode, profile: mode === 'merge' ? 'keep' : 'restore' });
  const actual = await readBackupSnapshot(name);
  expect(actual.sessions).toHaveLength(2); expect(actual.details).toEqual(data.details);
  expect(actual.coachProfile!.availability).toEqual(data.coachProfile!.availability);
});

it('refuse un gzip endommagé sans écrire dans les magasins', async () => {
  const { name, service: s } = service(); await seed(name);
  const { file: gzip } = await exportGzip(fixture(), '0.4.0');
  const put = vi.spyOn(IDBObjectStore.prototype, 'put'), add = vi.spyOn(IDBObjectStore.prototype, 'add'), clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
  await expect(s.preview(gzip.slice(0, gzip.size - 8))).rejects.toThrow('gzip');
  expect(put).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  expect(await readBackupSnapshot(name)).toEqual(fixture());
});
