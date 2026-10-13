import { shouldKeepDetails } from '../core/analysis/detail-retention';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { SessionRepository } from '../storage/contracts';
import { parsePolar } from './polar';
import { IMPORT_REASONS, PolarImportError, type ImportReason } from './polar-errors';

import { emptyReport, type ImportReport } from './import-report';
const MAX_FILE_BYTES = 64 * 1024 * 1024;
export async function importPolarArchive(file: Blob, repository: SessionRepository, progress: (report: ImportReport) => void, reference = new Date(), onAdded?: (id: string) => void): Promise<ImportReport> {
  const report = emptyReport();
  // BlobReader performs random-access reads; the archive is never read as one ArrayBuffer.
  const reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
  const emit = () => progress({ ...report, reasons: { ...report.reasons }, issues: [...report.issues] });
  const countReason = (reason: ImportReason) => { report.reasons[reason] = (report.reasons[reason] ?? 0) + 1; };
  try {
    const entries = (await reader.getEntries()).filter(e => !e.directory && /(?:^|\/)training-session[_-][^/]+\.json$/i.test(e.filename));
    report.total = entries.length;
    emit();
    for (const entry of entries) {
      if (entry.directory) continue;
      let parsed: ReturnType<typeof parsePolar>;
      let reading = true;
      let oversized = false;
      try {
        if (entry.encrypted) throw new PolarImportError('encrypted');
        if (entry.uncompressedSize > MAX_FILE_BYTES) throw new PolarImportError('oversized');
        const text = await entry.getData!(new TextWriter(), { checkSignature: true, onprogress: size => { if (size > MAX_FILE_BYTES) { oversized = true; throw new PolarImportError('oversized'); } } });
        reading = false;
        parsed = parsePolar(text, entry.filename, true, session => shouldKeepDetails(session, reference));
      } catch (error) {
        const reason = oversized ? 'oversized' : error instanceof PolarImportError ? error.reason : reading ? 'decompression' : 'unsupportedStructure';
        report.invalid++;
        countReason(reason);
        if (report.issues.length < 20) report.issues.push(`Fichier d’entraînement n°${report.processed + 1} : ${IMPORT_REASONS[reason]}.`);
        report.processed++; emit(); continue;
      }
      if (parsed === null) { report.ignored++; countReason('otherSport'); }
      else {
        try {
          if (await repository.addImported(parsed.session, shouldKeepDetails(parsed.session, reference) ? parsed.details : undefined)) { report.imported++; onAdded?.(parsed.session.id); }
          else report.duplicates++;
        } catch {
          report.error = 'Import interrompu : stockage local indisponible ou plein. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer sans doublons.';
          break;
        }
      }
      report.processed++; emit();
    }
  } catch {
    report.error = 'Impossible de lire cette archive ZIP. Vérifiez qu’elle est complète et non chiffrée.';
  } finally { await reader.close(); }
  emit();
  return report;
}
