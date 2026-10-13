import { shouldKeepDetails } from '../core/analysis/detail-retention';
import type { SessionRepository } from '../storage/contracts';
import { MAX_TCX_BYTES, parseTcx, type XmlReader } from './tcx';
export interface TcxReport { total: number; processed: number; imported: number; duplicates: number; invalid: number; unsupported: number; issues: string[]; error?: string }
export const emptyTcxReport = (total: number): TcxReport => ({ total, processed: 0, imported: 0, duplicates: 0, invalid: 0, unsupported: 0, issues: [] });
export async function importTcxFiles(files: readonly File[], repository: SessionRepository, progress: (report: TcxReport) => void, readXml?: XmlReader, reference = new Date(), onAdded?: (id: string) => void): Promise<TcxReport> {
  const selected = [...files];
  const report = emptyTcxReport(selected.length);
  const emit = () => progress({ ...report, issues: [...report.issues] });
  if (!selected.length) {
    report.error = 'Aucun fichier TCX sélectionné. Sélectionnez un ou plusieurs fichiers avant de lancer l’import.';
    emit(); return report;
  }
  emit();
  for (const file of selected) {
    // Permet au navigateur d'afficher la progression entre les fichiers.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    let parsed: Awaited<ReturnType<typeof parseTcx>>;
    let reason = 'Lecture du fichier impossible. Vérifiez que vous pouvez encore accéder au fichier.';
    try {
      if (!/\.tcx$/i.test(file.name)) { reason = 'Extension non prise en charge. Sélectionnez un fichier .tcx ou .TCX.'; throw new Error('invalid'); }
      if (file.size > MAX_TCX_BYTES) { reason = 'Fichier trop volumineux. La limite est de 16 Mio par fichier TCX.'; throw new Error('invalid'); }
      const text = await file.text();
      reason = 'Fichier TCX invalide ou non pris en charge. Vérifiez le XML, la présence d’une seule activité TCX v2 et les durées et horodatages des tours et des points.';
      parsed = await parseTcx(text, readXml);
    } catch {
      if (report.issues.length < 20) report.issues.push(`Fichier n°${report.processed + 1} : ${reason}`);
      report.invalid++; report.processed++; emit(); continue;
    }
    if (!parsed) report.unsupported++;
    else {
      try {
        if (await repository.addImported(parsed.session, shouldKeepDetails(parsed.session, reference) ? parsed.details : undefined)) { report.imported++; onAdded?.(parsed.session.id); }
        else report.duplicates++;
      } catch {
        report.error = 'Import interrompu : stockage local indisponible ou plein. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.';
        emit(); return report;
      }
    }
    report.processed++; emit();
  }
  return { ...report, issues: [...report.issues] };
}
