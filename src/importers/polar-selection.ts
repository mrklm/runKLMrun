import type { ImportReport } from './import-report';
import type { TcxReport } from './tcx-files';
export type Selection = { format: 'zip' | 'tcx'; files: File[] } | { error: string };
export function selectPolarFiles(files: readonly File[]): Selection {
  if (!files.length) return { error: 'Sélectionnez une archive ZIP ou des fichiers TCX.' };
  if (files.some(f => !/\.(zip|tcx)$/i.test(f.name))) return { error: 'Format non pris en charge. Sélectionnez des fichiers ZIP ou TCX.' };
  const zip = files.filter(f => /\.zip$/i.test(f.name));
  if (zip.length && zip.length !== files.length) return { error: 'Sélectionnez une archive ZIP ou des fichiers TCX, sans mélanger les formats.' };
  if (zip.length > 1) return { error: 'Sélectionnez une seule archive ZIP à la fois.' };
  return { format: zip.length ? 'zip' : 'tcx', files: [...files] };
}
export interface UnifiedReport { format: 'zip' | 'tcx'; processed: number; total: number; imported: number; duplicates: number; ignored: number; invalid: number; issues: string[]; error?: string }
export function zipReport(report: ImportReport): UnifiedReport { return { ...report, format: 'zip' }; }
export function tcxReport(report: TcxReport): UnifiedReport { return { ...report, format: 'tcx', ignored: report.unsupported }; }
