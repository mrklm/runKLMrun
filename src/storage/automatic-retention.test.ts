import { it, expect, vi } from 'vitest';
import { maintainAfterImport } from './automatic-retention';
import { withRestoreLock, retentionLockName } from './operation-lock';
import { browserRetentionLock } from './detail-retention';
it('entretient uniquement après ajout réussi et absorbe une erreur de maintenance', async () => {
  const maintain = vi.fn().mockRejectedValue(new Error('synthetic'));
  await maintainAfterImport({ imported: 0 }, maintain);
  await maintainAfterImport({ imported: 1, error: 'échec' }, maintain);
  expect(maintain).not.toHaveBeenCalled();
  await expect(maintainAfterImport({ imported: 1 }, maintain)).resolves.toBeUndefined();
  expect(maintain).toHaveBeenCalledTimes(1);
  await maintainAfterImport({ imported: 0, duplicates: 1 }, maintain);
  expect(maintain).toHaveBeenCalledTimes(2);
});
it('partage le verrou de restauration avec le nettoyage et le libère après erreur', async () => {
  let busy = false, release!: () => void;
  vi.stubGlobal('navigator', { locks: { request: vi.fn(async (name, options, callback) => {
    expect(name).toBe(retentionLockName('synthetic'));
    if (typeof options === 'function') { busy = true; try { return await options(); } finally { busy = false; } }
    return callback(busy ? null : {});
  }) } });
  try {
    const pending = withRestoreLock('synthetic', () => new Promise<void>((_, reject) => { release = () => reject(new Error('synthetic')); }));
    const task = vi.fn(async () => ({ deleted: 0, scanned: 0, interrupted: false }));
    expect(await browserRetentionLock('synthetic')(task)).toBeUndefined(); expect(task).not.toHaveBeenCalled();
    release(); await expect(pending).rejects.toThrow('synthetic');
    await browserRetentionLock('synthetic')(task); expect(task).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});
