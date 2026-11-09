import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import * as registry from './profile-registry';
import { PROFILE_REGISTRY_NAME, readProfileRegistry, writeProfileRegistry } from './profile-registry';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { backupNeedsDestinationChoice, proposedProfileName, restoreIntoNewProfile } from './backup-new-profile';
import { createBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import { fixture } from '../backup/test-fixture';
import type { BackupData, RestorePreview } from '../types/backup';
import type { RunnerProfile } from '../types/runner-profile';

const activeId = '22222222-2222-4222-8222-222222222222';
const active: RunnerProfile = { id: activeId, displayName: 'Clément', databaseName: `runklmrun-user-${activeId}`, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1, status: 'active', heightCm: 177 };
const databases: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const name of databases.splice(0)) await deleteDB(name); await deleteDB(PROFILE_REGISTRY_NAME); });
const serviceFor = (name: string) => { databases.push(name); return createBackupService({ export: (data: BackupData) => exportGzip(data, '1.5.0'), parse: (file: Blob) => readBackupFile(file),
  prepare: (preview, options) => prepareNative(preview, options, new Date('2026-10-13T12:00:00Z')) }, name); };
async function preview(runnerProfile?: BackupData['runnerProfile']): Promise<RestorePreview> {
  databases.push(active.databaseName);
  return { backup: await createBackup({ ...fixture(), ...(runnerProfile ? { runnerProfile } : {}) }, '1.5.0'), local: await readBackupSnapshot(active.databaseName) };
}

describe('restauration dans un nouveau profil', () => {
  it('propose le choix seulement si le nom diffère ou manque', async () => {
    await writeProfileRegistry({ migration: 'complete', lastUsedProfileId: activeId, profiles: [active] });
    expect(backupNeedsDestinationChoice(await preview({ displayName: 'Clément' }), 'Clément')).toBe(false);
    expect(backupNeedsDestinationChoice(await preview({ displayName: 'Clem' }), 'Clément')).toBe(true);
    const old = await preview(); expect(backupNeedsDestinationChoice(old, 'Clément')).toBe(true); expect(proposedProfileName(old)).toBe('Profil importé');
  });
  it('crée le profil avec la fiche et les séances, sans toucher au profil actif', async () => {
    await writeProfileRegistry({ migration: 'complete', lastUsedProfileId: activeId, profiles: [active] });
    const value = await preview({ displayName: 'Clem', weightKg: 75, maxHeartRate: 180, restingHeartRate: 50, loadCoefficients: 'male' });
    const { profile, report } = await restoreIntoNewProfile({ preview: value, displayName: '  Clem  ', fallbackProfileId: activeId, serviceFor });
    expect(profile.displayName).toBe('Clem'); expect(report.added).toBe(1);
    const state = await readProfileRegistry();
    expect(state?.lastUsedProfileId).toBe(activeId);
    expect(state?.profiles.find(p => p.id === activeId)).toEqual(active);
    expect(state?.profiles.find(p => p.id === profile.id)).toMatchObject({ displayName: 'Clem', weightKg: 75, maxHeartRate: 180, status: 'active' });
    expect((await readBackupSnapshot(profile.databaseName)).sessions.map(s => s.id)).toEqual(['polar:synthetic']);
    expect((await readBackupSnapshot(active.databaseName)).sessions).toEqual([]);
  });
  it('refuse un pseudonyme vide sans rien créer', async () => {
    await writeProfileRegistry({ migration: 'complete', lastUsedProfileId: activeId, profiles: [active] });
    await expect(restoreIntoNewProfile({ preview: await preview(), displayName: '   ', fallbackProfileId: activeId, serviceFor })).rejects.toThrow(/obligatoire/);
    expect((await readProfileRegistry())?.profiles).toHaveLength(1);
  });
  it('retire le profil créé si la restauration échoue', async () => {
    await writeProfileRegistry({ migration: 'complete', lastUsedProfileId: activeId, profiles: [active] });
    const failing = (name: string) => ({ ...serviceFor(name), restore: () => Promise.reject(new Error('panne')) });
    await expect(restoreIntoNewProfile({ preview: await preview({ displayName: 'Clem' }), displayName: 'Clem', fallbackProfileId: activeId, serviceFor: failing })).rejects.toThrow('panne');
    const remaining = (await readProfileRegistry())?.profiles.filter(registry.isProfileActive) ?? [];
    expect(remaining.map(p => p.id)).toEqual([activeId]);
  });
});
