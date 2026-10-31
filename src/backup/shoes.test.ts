import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { fixture } from './test-fixture';
import { createBackup, verifyBackup } from './format';
import { exportGzip, readBackupFile } from './compression';
import { validateBackupData } from './validation';
import { prepareRestore } from './merge';
import { createBackupService, prepareNative, readBackupSnapshot } from '../storage/backup';
import { createShoeRepository } from '../storage/shoes';
import { openDatabase } from '../storage/database-connection';
import { shoeMileage } from '../core/shoes/shoes';
import type { BackupData } from '../types/backup';
const reference = new Date('2026-10-13T12:00:00Z');
const names: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(names.splice(0).map(n => deleteDB(n))); });
function data(): BackupData {
  return { ...fixture(), shoes: [{ id: 'shoe-a', name: 'Paire synthétique', firstUseDate: '2025-02-07', purchaseDate: '2025-01-20', status: 'active', isDefault: true, limitKm: 800, warningKm: 100, revision: 1 }], shoeAssignments: [{ sessionId: 'polar:synthetic', shoeId: 'shoe-a' }] };
}
function service() {
  const name = `shoe-backup-${crypto.randomUUID()}`; names.push(name);
  return { name, service: createBackupService({ export: d => exportGzip(d, '0.4.0'), parse: f => readBackupFile(f), prepare: (p, o) => prepareNative(p, o, reference) }, name) };
}
const file = async (d: BackupData) => new Blob([JSON.stringify(await createBackup(d, '0.4.0'))]);
it.each([false, true])('conserve les dates et associations en JSON/gzip v2 (%s)', async gzip => {
  const source = data();
  const document = await readBackupFile(gzip ? (await exportGzip(source, '0.4.0')).file : await file(source));
  expect(document.formatVersion).toBe(2); expect(document.data).toEqual(source);
  await expect(verifyBackup(document)).resolves.toEqual(document);
  document.data.shoes![0].firstUseDate = '2025-02-08';
  await expect(verifyBackup(document)).rejects.toThrow('intégrité');
});
it.each(['merge', 'replace'] as const)('restaure chaussures et associations atomiquement en mode %s', async mode => {
  const { name, service: s } = service(), source = data();
  const preview = await s.preview(await file(source));
  expect(preview.mergeReport).toMatchObject({ shoesAdded: 1, assignmentsAdded: 1 });
  expect((await readBackupSnapshot(name)).sessions).toEqual([]);
  await s.restore(preview, { mode, profile: 'restore' });
  expect(await readBackupSnapshot(name)).toEqual(source);
  expect((await readBackupFile((await s.exportData()).file)).data).toEqual(source);
});
it('préserve une association même si ses mesures anciennes ne sont pas restaurées', async () => {
  const { name, service: s } = service(), source = data();
  source.sessions[0].date = '2020-01-01'; source.sessions[0].startTime = '2020-01-01T10:00:00Z';
  await s.restore(await s.preview(await file(source)), { mode: 'replace', profile: 'restore' });
  const actual = await readBackupSnapshot(name); expect(actual.details).toEqual([]); expect(actual.shoeAssignments).toEqual(source.shoeAssignments);
});
it('lit v1, garde les chaussures en fusion et les retire uniquement en remplacement confirmé', async () => {
  const { name, service: s } = service();
  await s.restore(await s.preview(await file(data())), { mode: 'replace', profile: 'restore' });
  const oldFile = await file(fixture()); expect((await readBackupFile(oldFile)).formatVersion).toBe(1);
  await s.restore(await s.preview(oldFile), { mode: 'merge', profile: 'keep' });
  expect((await readBackupSnapshot(name)).shoes).toHaveLength(1);
  await s.restore(await s.preview(oldFile), { mode: 'replace', profile: 'restore' });
  expect((await readBackupSnapshot(name)).shoes).toBeUndefined();
});
it('garde les paires, associations et défaut locaux en cas de conflit', () => {
  const local = data(), incoming = data(); incoming.shoes![0].name = 'Autre nom';
  incoming.shoes!.push({ ...incoming.shoes![0], id: 'shoe-b', isDefault: false });
  incoming.shoeAssignments![0].shoeId = 'shoe-b';
  const merged = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, reference.toISOString());
  expect(merged.data.shoes![0]).toEqual(local.shoes![0]); expect(merged.data.shoeAssignments).toEqual(local.shoeAssignments); expect(merged.report.conflicts).toBe(2);
  const other = data(); other.shoes![0].id = 'new-default'; other.shoeAssignments = [];
  const result = prepareRestore(local, other, { mode: 'merge', profile: 'keep' }, reference.toISOString());
  expect(result.data.shoes!.filter(s => s.isDefault).map(s => s.id)).toEqual(['shoe-a']);
});
it.each(['shoes', 'shoeAssignments'] as const)('détecte les modifications concurrentes dans %s', async store => {
  const { name, service: s } = service(); await s.restore(await s.preview(await file(data())), { mode: 'replace', profile: 'restore' });
  const preview = await s.preview(await file(data())), db = await openDatabase(name);
  if (store === 'shoeAssignments') await db.delete(store, 'polar:synthetic');
  else { const shoe = (await db.get(store, 'shoe-a'))!; await db.put(store, { ...shoe, firstUseDate: '2025-02-08' }); }
  db.close();
  await expect(s.restore(preview, { mode: 'replace', profile: 'restore' })).rejects.toThrow('changé');
});
it.each(['shoes', 'shoeAssignments'] as const)('annule toutes les écritures si %s échoue', async store => {
  const { name, service: s } = service();
  const preview = await s.preview(await file(data()));
  const original = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === store) throw new Error('Échec synthétique');
    return original.apply(this, args);
  });
  await expect(s.restore(preview, { mode: 'replace', profile: 'restore' })).rejects.toThrow('Échec synthétique');
  expect((await readBackupSnapshot(name)).sessions).toEqual([]); expect((await createShoeRepository(name).list()).shoes).toEqual([]);
});
it('rejette références incohérentes, associations multiples et défauts multiples', () => {
  const orphan = data(); orphan.shoeAssignments![0].shoeId = 'missing'; expect(() => validateBackupData(orphan)).toThrow();
  const session = data(); session.shoeAssignments![0].sessionId = 'missing'; expect(() => validateBackupData(session)).toThrow();
  const multiple = data(); multiple.shoeAssignments!.push(multiple.shoeAssignments![0]); expect(() => validateBackupData(multiple)).toThrow();
  const defaults = data(); defaults.shoes!.push({ ...defaults.shoes![0], id: 'another' }); expect(() => validateBackupData(defaults)).toThrow();
});

it.each(['manual', 'automatic'] as const)('sauvegarde et restaure le mode %s en v2', async mode => {
  const { name, service: s } = service(), source = data();
  source.shoeSettings = { id: 'local', mode, revision: 1 };
  const compressed = await exportGzip(source, '0.4.0');
  expect((await readBackupFile(compressed.file)).formatVersion).toBe(2);
  await s.restore(await s.preview(compressed.file), { mode: 'replace', profile: 'restore' });
  expect((await readBackupSnapshot(name)).shoeSettings?.mode).toBe(mode);
});
it('conserve le mode local et les associations lors d’une fusion', () => {
  const local = data(), incoming = data();
  local.shoeSettings = { id: 'local', mode: 'manual', revision: 1 };
  incoming.shoeSettings = { id: 'local', mode: 'automatic', revision: 1 };
  const result = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, reference.toISOString());
  expect(result.data.shoeSettings?.mode).toBe('manual'); expect(result.data.shoeAssignments).toEqual(local.shoeAssignments);
});
it('une ancienne v2 sans mode reste compatible avec le suivi manuel', async () => {
  const { name, service: s } = service();
  await s.restore(await s.preview(await file(data())), { mode: 'replace', profile: 'restore' });
  expect((await createShoeRepository(name).list()).settings?.mode ?? 'manual').toBe('manual');
});
it('inclut le mode dans la détection des changements concurrents', async () => {
  const { name, service: s } = service(); const preview = await s.preview(await file(data()));
  await createShoeRepository(name).setMode('automatic');
  await expect(s.restore(preview, { mode: 'replace', profile: 'restore' })).rejects.toThrow('changé');
});

it.each(['merge', 'replace'] as const)('restaure une ancienne marge sans alerte et préserve les données (%s)', async mode => {
  const { name, service: s } = service(), source = data();
  source.shoes![0].limitKm = 1500; source.shoes![0].warningKm = 1500;
  source.sessions[0].distanceMeters = 26000;
  await s.restore(await s.preview(await file(source)), { mode, profile: 'restore' });
  const restored = await readBackupSnapshot(name);
  expect(restored).toEqual(source);
  expect(shoeMileage(restored.shoes![0], restored.sessions, restored.shoeAssignments!)).toMatchObject({ km: 26, state: 'normal' });
  const repository = createShoeRepository(name), shoe = restored.shoes![0];
  await repository.save({ ...shoe, limitKm: undefined }, shoe.revision);
  const exported = await s.exportData(), document = await readBackupFile(exported.file);
  expect(document.formatVersion).toBe(2);
  expect(document.data.shoes![0]).toMatchObject({ name: shoe.name, warningKm: 1500, firstUseDate: shoe.firstUseDate });
  expect(document.data.shoes![0].limitKm).toBeUndefined();
  const destination = service();
  await destination.service.restore(await destination.service.preview(exported.file), { mode: 'replace', profile: 'restore' });
  expect(await readBackupSnapshot(destination.name)).toEqual(document.data);
});
