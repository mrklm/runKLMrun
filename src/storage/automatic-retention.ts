import { retentionService } from './detail-retention';
/** L’import conserve son résultat même si l’entretien échoue. */
export async function maintainAfterImport(result: { imported: number; duplicates?: number; error?: string }, maintain = () => retentionService.maintain()) {
  if (result.error || result.imported + (result.duplicates ?? 0) < 1) return;
  try { await maintain(); } catch { /* Réessayer au prochain déclenchement, sans bloquer l’import. */ }
}
