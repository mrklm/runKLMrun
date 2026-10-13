import { it, expect } from 'vitest';
import { deleteDB } from 'idb';
import { createCoachProfileRepository } from '../../storage/coach-profile';
import { emptyProfileValues } from '../../types/coach-profile';
import { draftFrom, valuesFrom } from './profile-draft';
import { createBackup } from '../../backup/format';
import { readBackupFile, exportGzip } from '../../backup/compression';
it('persiste le mode avec le profil, protège la concurrence et interdit Entraîneur', async () => {
  const name = `coach-mode-${crypto.randomUUID()}`;
  try {
    const repo = createCoachProfileRepository(name);
    const first = await repo.save({ ...emptyProfileValues(), goal: { kind: 'endurance' } }, undefined);
    const saved = await repo.save({ ...first, accompanimentMode: 'advisor' }, first.revision);
    expect((await createCoachProfileRepository(name).get())?.accompanimentMode).toBe('advisor');
    expect(saved.goal).toEqual(first.goal);
    await expect(repo.save({ ...first, accompanimentMode: 'advisor' }, first.revision)).rejects.toThrow('autre onglet');
    await expect(repo.save({ ...saved, accompanimentMode: 'trainer' }, saved.revision)).rejects.toThrow('préparation');
    expect(valuesFrom(draftFrom(saved)).accompanimentMode).toBe('advisor');
  } finally { await deleteDB(name); }
});
it('lit les anciennes sauvegardes et conserve le mode dans JSON/gzip avec SHA-256', async () => {
  const profile = { ...emptyProfileValues(), id: 'local' as const, revision: 1, createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };
  const old = { sessions: [], details: [], coachProfile: profile };
  const decoded = await readBackupFile(new Blob([JSON.stringify(await createBackup(old, '0.5.0'))]));
  expect(decoded.data.coachProfile?.accompanimentMode ?? 'advisor').toBe('advisor');
  const data = { ...old, coachProfile: { ...profile, accompanimentMode: 'advisor' as const } };
  for (const file of [new Blob([JSON.stringify(await createBackup(data, '0.5.0'))]), (await exportGzip(data, '0.5.0')).file]) {
    expect((await readBackupFile(file)).data.coachProfile?.accompanimentMode).toBe('advisor');
  }
  const tampered = await createBackup(data, '0.5.0'); delete tampered.data.coachProfile!.accompanimentMode;
  await expect(readBackupFile(new Blob([JSON.stringify(tampered)]))).rejects.toThrow();
});
