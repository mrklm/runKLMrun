import { memoryError } from './errors';
import type { BackupData, BackupDocument, BackupExport } from '../types/backup';
import { canonicalJson, parseBackup, sha256Bytes } from './format';
import { BackupError, validateBackupData } from './validation';
import { BACKUP_LIMITS, checkExpandedSize, compressedSizeError, inspectJsonStats, checkIntegrityEnvelope, jsonSizeError, type BackupLimits } from './limits';

const CHUNK = 64 * 1024;
/** Signature gzip réelle ; l’extension et le type MIME ne décident jamais du contenu. */
export async function isGzip(file: Blob): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return header[0] === 0x1f && header[1] === 0x8b;
}
export async function checkBackupFile(file: Blob, limits: BackupLimits = BACKUP_LIMITS): Promise<boolean> {
  if (file.size > limits.jsonBytes) throw jsonSizeError(limits, file.size);
  const gzip = await isGzip(file);
  if (gzip && file.size > limits.compressedBytes) throw compressedSizeError(limits, file.size);
  return gzip;
}
/** Décompression bornée avant accumulation et avant JSON.parse. CRC/troncature vérifiés par l’API native. */
export async function readBackupFile(file: Blob, limits: BackupLimits = BACKUP_LIMITS): Promise<BackupDocument> {
  const gzip = await checkBackupFile(file, limits);
  if (gzip && typeof DecompressionStream === 'undefined') throw new BackupError('Votre navigateur ne permet pas de lire gzip. Utilisez un navigateur compatible ou une sauvegarde JSON non compressée.');
  const stream = gzip ? file.stream().pipeThrough(new DecompressionStream('gzip')) : file.stream();
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (gzip) checkExpandedSize(bytes, file.size, limits);
      else if (bytes > limits.jsonBytes) throw jsonSizeError(limits, bytes);
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (memoryError(error)) throw memoryError(error);
    if (error instanceof BackupError) throw error;
    throw new BackupError(gzip ? 'Le fichier gzip est corrompu, tronqué ou ne contient pas un texte UTF-8 valide.' : 'Le fichier JSON ne contient pas un texte UTF-8 valide.');
  } finally { reader.releaseLock(); }
  const text = parts.join(''); parts.length = 0;
  return parseBackup(text, limits);
}
/** Une seule sérialisation du payload en production, sans copie via JSON.parse.
 * Web Crypto garde toutefois un buffer complet : ce n’est pas un export à mémoire constante. */
export async function exportGzip(data: BackupData, version: string, limits: BackupLimits = BACKUP_LIMITS, exportedAt = new Date().toISOString()): Promise<BackupExport> {
  if (typeof CompressionStream === 'undefined') throw new BackupError('Votre navigateur ne permet pas de créer une sauvegarde gzip. Utilisez un navigateur compatible.');
  validateBackupData(data);
  const bytes = (() => {
    const text = canonicalJson({ format: 'runKLMrun-backup', formatVersion: data.coachSuggestions !== undefined ? 5 : data.coachPlanning !== undefined ? 4 : data.evolvingCoach !== undefined ? 3 : data.shoes !== undefined || data.shoeAssignments !== undefined || data.shoeSettings !== undefined ? 2 : 1, exportedAt, appVersion: version, data });
    const stats = inspectJsonStats(text, limits);
    checkIntegrityEnvelope(stats, limits);
    return new TextEncoder().encode(text);
  })();
  const digest = await sha256Bytes(bytes);
  const suffix = new TextEncoder().encode(`,"integrity":{"algorithm":"SHA-256","digest":"${digest}"}}`);
  const jsonBytes = bytes.length - 1 + suffix.length;
  if (jsonBytes > limits.jsonBytes) throw jsonSizeError(limits, jsonBytes);
  let offset = 0;
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      if (offset < bytes.length - 1) {
        const end = Math.min(offset + CHUNK, bytes.length - 1);
        controller.enqueue(bytes.subarray(offset, end)); offset = end;
      } else { controller.enqueue(suffix); controller.close(); }
    },
  });
  const reader = source.pipeThrough(new CompressionStream('gzip')).getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let compressedBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      compressedBytes += value.byteLength;
      if (compressedBytes > limits.compressedBytes) throw compressedSizeError(limits, compressedBytes);
      chunks.push(value);
    }
    // Ne pas produire un fichier que nos règles de restauration refuseraient.
    checkExpandedSize(jsonBytes, compressedBytes, limits);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw memoryError(error) ?? (error instanceof BackupError ? error : new BackupError('La compression de la sauvegarde a échoué. Aucun fichier complet n’a été produit.'));
  } finally { reader.releaseLock(); }
  return { file: new Blob(chunks, { type: 'application/gzip' }), jsonBytes };
}
