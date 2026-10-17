import { memoryError } from './errors';
import type { BackupData, BackupDocument, BackupPayload } from '../types/backup';
import { BACKUP_LIMITS, inspectJson, type BackupLimits } from './limits';
import { BackupError, validateBackup, validateBackupData } from './validation';

/** Ordre lexicographique des clés, ordre des tableaux conservé, règles JSON pour undefined. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]]));
    }
    return item;
  });
}
export async function sha256Bytes(input: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new BackupError('La vérification de sauvegarde nécessite un navigateur avec Web Crypto (HTTPS ou localhost).');
  const bytes = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export const sha256 = (text: string) => sha256Bytes(new TextEncoder().encode(text));
export async function createBackup(data: BackupData, appVersion: string, exportedAt = new Date().toISOString()): Promise<BackupDocument> {
  validateBackupData(data);
  // Le résultat n’est pas lié aux objets d’entrée ; les champs facultatifs undefined sont omis.
  const serialized = canonicalJson({ format: 'runKLMrun-backup', formatVersion: data.coachSuggestions !== undefined ? 5 : data.coachPlanning !== undefined ? 4 : data.evolvingCoach !== undefined ? 3 : data.shoes !== undefined || data.shoeAssignments !== undefined || data.shoeSettings !== undefined ? 2 : 1, exportedAt, appVersion, data });
  inspectJson(serialized);
  const payload: BackupPayload = JSON.parse(serialized);
  return { ...payload, integrity: { algorithm: 'SHA-256', digest: await sha256(serialized) } };
}
export async function verifyBackup(value: unknown): Promise<BackupDocument> {
  validateBackup(value);
  const { integrity, ...payload } = value;
  if (await sha256(canonicalJson(payload)) !== integrity.digest) throw new BackupError('L’intégrité du fichier est incorrecte. La sauvegarde a été altérée ou endommagée.');
  return value;
}
export async function parseBackup(text: string, limits: BackupLimits = BACKUP_LIMITS): Promise<BackupDocument> {
  inspectJson(text, limits);
  let value: unknown;
  try { value = JSON.parse(text); } catch (error) { throw memoryError(error) ?? new BackupError('Le fichier ne contient pas un JSON valide.'); }
  return verifyBackup(value);
}
