import { retentionLockName } from './operation-lock';
import { classifyDetails } from '../core/analysis/detail-retention';
import { validateBackupData } from '../backup/validation';
import { DATABASE_NAME, openDatabase } from './database-connection';
import type { RunningSession } from '../types/session';

export interface RetentionReport {
  total: number;
  expired: number;
  kept: number;
  uncertain: number;
  invalidSummary: number;
}
export interface CleanupResult { deleted: number; scanned: number; interrupted: boolean }
export interface CleanupOptions { signal?: AbortSignal; progress?: (result: CleanupResult) => void }
export type RetentionLock = (task: () => Promise<CleanupResult>) => Promise<CleanupResult | undefined>;
export const RETENTION_KEY = 'runklmrun-detail-retention-v1';
const BATCH_SIZE = 25;
const emptyReport = (): RetentionReport => ({ total: 0, expired: 0, kept: 0, uncertain: 0, invalidSummary: 0 });
type Preferences = Pick<Storage, 'getItem' | 'setItem'>;

/** Réutilise le validateur de résumés sans lire ni sérialiser les mesures. */
function category(summary: RunningSession | undefined, key: string, reference: Date): 'expired' | 'kept' | 'uncertain' | 'invalidSummary' {
  if (!summary || summary.id !== key) return 'invalidSummary';
  const eligibility = classifyDetails(summary, reference);
  if (eligibility === 'uncertain') return 'uncertain';
  try { validateBackupData({ sessions: [summary], details: [], coachProfile: null }); }
  catch { return 'invalidSummary'; }
  return eligibility === 'expired' ? 'expired' : 'kept';
}

/** Aucun repli vers un verrou localStorage non atomique. */
export function browserRetentionLock(name: string): RetentionLock {
  return async task => {
    if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('Votre navigateur ne permet pas de verrouiller le nettoyage entre onglets. Aucun détail n’a été supprimé.');
    return navigator.locks.request(retentionLockName(name), { ifAvailable: true }, lock => lock ? task() : undefined);
  };
}

export function createRetentionService(options: {
  name?: string;
  preferences?: Preferences;
  lock?: RetentionLock;
  now?: () => Date;
  pause?: () => Promise<void>;
} = {}) {
  const name = options.name ?? DATABASE_NAME;
  const lock = options.lock ?? browserRetentionLock(name);
  const now = options.now ?? (() => new Date());
  const pause = options.pause ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  const preferences = () => options.preferences ?? localStorage;
  function state(): { enabled: boolean; checkedAt?: number } {
    const raw = preferences().getItem(RETENTION_KEY);
    try {
      const value = JSON.parse(raw ?? 'null');
      return value?.enabled === true ? { enabled: true, checkedAt: typeof value.checkedAt === 'number' && Number.isFinite(value.checkedAt) ? value.checkedAt : undefined } : { enabled: false };
    } catch { return { enabled: false }; }
  }
  function write(checkedAt?: number) { preferences().setItem(RETENTION_KEY, JSON.stringify({ enabled: true, checkedAt })); }

  async function analyze(signal?: AbortSignal): Promise<RetentionReport> {
    const report = emptyReport(), reference = now();
    const db = await openDatabase(name);
    let last: string | undefined;
    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
        const tx = db.transaction(['sessions', 'details'], 'readonly');
        let keys: string[] = [];
        try {
          keys = await tx.objectStore('details').getAllKeys(last === undefined ? undefined : IDBKeyRange.lowerBound(last, true), BATCH_SIZE);
          for (const key of keys) {
            report.total++;
            report[category(await tx.objectStore('sessions').get(key), key, reference)]++;
          }
          await tx.done;
        } catch (error) { await tx.done.catch(() => undefined); throw error; }
        if (keys.length < BATCH_SIZE) return report;
        last = keys.at(-1)!;
        await pause();
      }
    } finally { db.close(); }
  }

  async function clean({ signal, progress }: CleanupOptions = {}): Promise<CleanupResult> {
    const reference = now();
    const result: CleanupResult = { deleted: 0, scanned: 0, interrupted: false };
    const db = await openDatabase(name);
    let last: string | undefined;
    try {
      while (!signal?.aborted) {
        const tx = db.transaction(['sessions', 'details'], 'readwrite');
        let keys: string[] = [], deleted = 0;
        try {
          keys = await tx.objectStore('details').getAllKeys(last === undefined ? undefined : IDBKeyRange.lowerBound(last, true), BATCH_SIZE);
          // Résumé relu sous le même verrou transactionnel que la suppression.
          for (const key of keys) {
            if (category(await tx.objectStore('sessions').get(key), key, reference) === 'expired') {
              await tx.objectStore('details').delete(key); deleted++;
            }
          }
          await tx.done;
        } catch (error) {
          try { tx.abort(); } catch { /* Transaction déjà terminée. */ }
          await tx.done.catch(() => undefined);
          throw error;
        }
        result.scanned += keys.length; result.deleted += deleted;
        progress?.({ ...result });
        if (keys.length < BATCH_SIZE) return result;
        last = keys.at(-1)!;
        await pause();
      }
      return { ...result, interrupted: true };
    } finally { db.close(); }
  }

  async function run(confirmed: boolean, automatic: boolean, options: CleanupOptions = {}) {
    if (!automatic && !confirmed) throw new Error('Confirmez explicitement le nettoyage et l’activation de la politique.');
    return lock(async () => {
      if (options.signal?.aborted) return { deleted: 0, scanned: 0, interrupted: true };
      // Le consentement doit pouvoir être mémorisé avant toute suppression.
      if (!automatic) write();
      const result = await clean(options);
      if (!automatic && !result.interrupted) write(now().getTime());
      return result;
    });
  }
  return {
    analyze,
    isEnabled: () => state().enabled,
    activateAndClean: (confirmed: boolean, options?: CleanupOptions) => run(confirmed, false, options),
    // La politique de 30 jours est désormais automatique, sans préférence d’activation.
    maintain: (options?: CleanupOptions) => run(false, true, options),
  };
}
export const retentionService = createRetentionService();
export type RetentionService = ReturnType<typeof createRetentionService>;
