import type { ImportReason } from './polar-errors';
export interface ImportReport {
  processed: number;
  total: number;
  imported: number;
  duplicates: number;
  ignored: number;
  invalid: number;
  reasons: Partial<Record<ImportReason, number>>;
  issues: string[];
  error?: string;
}
export const emptyReport = (): ImportReport => ({ processed: 0, total: 0, imported: 0, duplicates: 0, ignored: 0, invalid: 0, reasons: {}, issues: [] });
