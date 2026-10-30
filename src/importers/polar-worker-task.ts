import { importPolarArchive } from './archive';
import { emptyReport, type ImportReport } from './import-report';
import type { SessionRepository } from '../storage/contracts';
export interface PolarWorkerRequest { file: Blob; database: string; batchId: string }
export type PolarWorkerMessage =
  | { type: 'progress'; batchId: string; report: ImportReport }
  | { type: 'done' | 'error'; batchId: string; report: ImportReport; importedIds: string[] };
/** Un message terminal récupérable contient tous les identifiants confirmés, même si la fermeture ZIP échoue. */
export async function runPolarWorkerImport(request: PolarWorkerRequest, repository: SessionRepository,
  post: (message: PolarWorkerMessage) => void, importer = importPolarArchive) {
  const importedIds: string[] = [];
  let report = emptyReport();
  try {
    report = await importer(request.file, repository, value => { report = value; post({ type: 'progress', batchId: request.batchId, report }); },
      new Date(), id => { importedIds.push(id); });
    post({ type: 'done', batchId: request.batchId, report, importedIds });
  } catch {
    post({ type: 'error', batchId: request.batchId, importedIds,
      report: { ...report, imported: importedIds.length, error: 'Import interrompu. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.' } });
  }
}
