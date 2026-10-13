import { memoryError } from './errors';
import { exportGzip, readBackupFile } from './compression';
import { canonicalJson, verifyBackup } from './format';
import { BackupError } from './validation';
import type { BackupData, RestoreOptions, RestorePreview } from '../types/backup';
import { prepareRestore } from './merge';

export type BackupJob =
  | { kind: 'export'; data: BackupData; version: string }
  | { kind: 'parse'; file: Blob }
  | { kind: 'prepare'; preview: RestorePreview; options: RestoreOptions };
export async function executeBackupJob(job: BackupJob) {
  if (job.kind === 'parse') return readBackupFile(job.file);
  if (job.kind === 'export') return exportGzip(job.data, job.version);
  // Nouvelle vérification avant confirmation appliquée ; aucun accès IndexedDB dans le worker.
  await verifyBackup(job.preview.backup);
  return {
    expected: canonicalJson(job.preview.local),
    ...prepareRestore(job.preview.local, job.preview.backup.data, job.options, new Date().toISOString()),
  };
}
self.onmessage = async (event: MessageEvent<BackupJob>) => {
  try { self.postMessage({ ok: true, value: await executeBackupJob(event.data) }); }
  catch (error) { self.postMessage({ ok: false, message: memoryError(error)?.message ?? (error instanceof BackupError ? error.message : 'Le traitement de la sauvegarde a échoué. Aucune restauration n’a été effectuée.') }); }
};
