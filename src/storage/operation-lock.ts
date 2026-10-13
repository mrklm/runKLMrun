/** Même verrou que le nettoyage : une restauration attend sa fin et exclut tout nouveau nettoyage. */
export const retentionLockName = (name: string) => `runklmrun-retention:${name}`;
export async function withRestoreLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  // Sans Web Locks, le nettoyage refuse de démarrer ; la restauration reste transactionnelle.
  if (typeof navigator === 'undefined' || !navigator.locks) return task();
  return await navigator.locks.request(retentionLockName(name), task);
}
