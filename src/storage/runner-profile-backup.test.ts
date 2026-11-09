import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import * as registry from './profile-registry';
import { PROFILE_REGISTRY_NAME, readProfileRegistry, writeProfileRegistry } from './profile-registry';
import { createBackupService, prepareNative, RUNNER_PROFILE_RESTORE_WARNING } from './backup';
import { canonicalJson, createBackup, sha256, verifyBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import { fixture } from '../backup/test-fixture';
import type { BackupData, BackupDocument } from '../types/backup';
import type { RunnerProfile } from '../types/runner-profile';

const id = '11111111-1111-4111-8111-111111111111', database = `runklmrun-user-${id}`;
const local: RunnerProfile = { id, displayName: 'Clément', databaseName: database, birthDate: '1980-05-01', heightCm: 177, weightKg: 80,
  restingHeartRate: 55, maxHeartRate: 175, loadCoefficients: 'male', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1, status: 'active' };
const incoming = { displayName: 'Clem', heightCm: 178, weightKg: 76, restingHeartRate: 50, maxHeartRate: 180, loadCoefficients: 'unspecified' as const };
afterEach(async () => { vi.restoreAllMocks(); await deleteDB(database); await deleteDB(PROFILE_REGISTRY_NAME); });
const service = (name = database) => createBackupService({ export: (data: BackupData) => exportGzip(data, '1.4.0'), parse: (file: Blob) => readBackupFile(file),
  prepare: (preview, options) => prepareNative(preview, options, new Date('2026-10-13T12:00:00Z')) }, name);
const fileWith = async (runnerProfile = incoming) => new Blob([JSON.stringify(await createBackup({ ...fixture(), runnerProfile }, '1.4.0'))]);
const stored = async () => (await readProfileRegistry())?.profiles.find(value => value.id === id);

describe('fiche du profil dans les sauvegardes', () => {
  it('exporte la fiche du profil propriétaire de la base au format 10', async () => {
    await writeProfileRegistry({ migration: 'complete', profiles: [local] });
    const document = await readBackupFile((await service().exportData()).file);
    expect(document.formatVersion).toBe(10);
    expect(document.data.runnerProfile).toEqual({ displayName: 'Clément', birthDate: '1980-05-01', heightCm: 177, weightKg: 80, restingHeartRate: 55, maxHeartRate: 175, loadCoefficients: 'male' });
  });
  it('n’ajoute pas de fiche lorsque la base n’appartient à aucun profil', async () => {
    const orphan = `backup-test-${crypto.randomUUID()}`;
    const document = await readBackupFile((await service(orphan).exportData()).file); await deleteDB(orphan);
    expect(document.data.runnerProfile).toBeUndefined(); expect(document.formatVersion).toBeLessThan(10);
  });
  it('reprend la fiche en remplacement sans jamais changer le pseudonyme', async () => {
    await writeProfileRegistry({ migration: 'complete', profiles: [local] });
    const backup = service(), report = await backup.restore(await backup.preview(await fileWith()), { mode: 'replace', profile: 'restore' });
    expect(report.warnings).not.toContain(RUNNER_PROFILE_RESTORE_WARNING);
    const result = await stored();
    expect(result).toMatchObject({ displayName: 'Clément', heightCm: 178, weightKg: 76, restingHeartRate: 50, maxHeartRate: 180, loadCoefficients: 'unspecified', revision: 2 });
    expect(result?.birthDate).toBeUndefined();
  });
  it('conserve la fiche locale en fusion avec profil conservé', async () => {
    await writeProfileRegistry({ migration: 'complete', profiles: [local] });
    const backup = service(); await backup.restore(await backup.preview(await fileWith()), { mode: 'merge', profile: 'keep' });
    expect(await stored()).toEqual(local);
  });
  it('signale un échec de la seconde étape sans annuler les séances restaurées', async () => {
    await writeProfileRegistry({ migration: 'complete', profiles: [local] });
    vi.spyOn(registry, 'updateRunnerProfile').mockRejectedValue(new Error('panne'));
    const backup = service(), report = await backup.restore(await backup.preview(await fileWith()), { mode: 'replace', profile: 'restore' });
    expect(report.warnings).toContain(RUNNER_PROFILE_RESTORE_WARNING); expect(report.added).toBe(1);
    expect(await stored()).toEqual(local);
  });
  it('refuse une fiche dans un format antérieur ou avec des réglages incohérents', async () => {
    const document = await createBackup({ ...fixture(), runnerProfile: incoming }, '1.4.0');
    const resign = async (value: BackupDocument) => { const { integrity: _integrity, ...payload } = value; return { ...payload, integrity: { algorithm: 'SHA-256' as const, digest: await sha256(canonicalJson(payload)) } }; };
    await expect(verifyBackup(await resign({ ...document, formatVersion: 9 }))).rejects.toThrow(/format 10/);
    for (const runnerProfile of [{ ...incoming, restingHeartRate: 190 }, { ...incoming, maxHeartRate: 175.5 }, { ...incoming, loadCoefficients: 'autre' }, { ...incoming, displayName: ' ' }, { ...incoming, inconnu: 1 }])
      await expect(verifyBackup(await resign({ ...document, data: { ...document.data, runnerProfile } as BackupDocument['data'] }))).rejects.toThrow();
  });
});
