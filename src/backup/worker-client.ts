import { memoryError } from './errors';
import BackupWorker from './worker?worker&inline';
import type { BackupJob } from './worker';
import { BackupError } from './validation';

export function runBackupWorker<T>(job: BackupJob, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Annulé', 'AbortError')); return; }
    const worker = new BackupWorker();
    const finish = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new DOMException('Annulé', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      finish();
      if (event.data.ok) resolve(event.data.value as T);
      else reject(new BackupError(event.data.message));
    };
    worker.onerror = event => { finish(); reject(memoryError(new Error(event.message)) ?? new BackupError('Le traitement de la sauvegarde est indisponible. Réessayez dans votre navigateur.')); };
    try { worker.postMessage(job); } catch (error) { finish(); reject(error); }
  });
}
