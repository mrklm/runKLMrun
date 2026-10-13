import { BackupError } from './errors';
const MIB = 1024 * 1024;
const JSON_BYTES = 384 * MIB;
// Le plus petit échantillon sérialisé est {"timeSeconds":0,"value":0} (27 octets),
// plus une virgule. Deux primitives au maximum pour ces 28 octets.
// Un point GPS contient 3 ou 4 primitives, mais coûte davantage d’octets par primitive.
export const MIN_SAMPLE_BYTES = '{"timeSeconds":0,"value":0},'.length;
export interface BackupLimits {
  compressedBytes: number;
  jsonBytes: number;
  structuralNodes: number;
  primitiveValues: number;
  measurementPoints: number;
  measurementPrimitives: number;
  objectProperties: number;
  depth: number;
  stringCharacters: number;
  expansionRatio: number;
  expansionAllowanceBytes: number;
}
export const BACKUP_LIMITS: Readonly<BackupLimits> = Object.freeze({
  compressedBytes: 128 * MIB,
  jsonBytes: JSON_BYTES,
  structuralNodes: 8_000_000,
  primitiveValues: 40_000_000,
  measurementPoints: Math.floor(JSON_BYTES / MIN_SAMPLE_BYTES),
  measurementPrimitives: 2 * Math.floor(JSON_BYTES / MIN_SAMPLE_BYTES),
  objectProperties: 64,
  depth: 32,
  stringCharacters: MIB,
  expansionRatio: 1000,
  expansionAllowanceBytes: MIB,
});
export interface JsonInspection {
  bytes: number;
  maxDepth: number;
  structuralNodes: number;
  primitiveValues: number;
  measurementPoints: number;
  measurementPrimitives: number;
  properties: number;
  maxObjectProperties: number;
}
type LimitCode = 'jsonBytes' | 'compressedBytes' | 'depth' | 'structuralNodes' | 'primitiveValues'
  | 'measurementPoints' | 'measurementPrimitives' | 'objectProperties' | 'stringCharacters';
const labels: Record<LimitCode, string> = {
  jsonBytes: 'Taille du contenu JSON excessive en octets',
  compressedBytes: 'Taille du fichier gzip excessive en octets',
  depth: 'Profondeur JSON excessive',
  structuralNodes: 'Trop grand nombre de nœuds structurels JSON hors échantillons',
  primitiveValues: 'Trop grand nombre de valeurs primitives JSON hors échantillons',
  measurementPoints: 'Trop grand nombre d’échantillons de mesure',
  measurementPrimitives: 'Trop grand nombre de valeurs primitives dans les mesures',
  objectProperties: 'Trop grand nombre de propriétés dans un objet JSON',
  stringCharacters: 'Chaîne JSON trop longue',
};
export class BackupLimitError extends BackupError {
  constructor(public readonly code: LimitCode, public readonly observed: number, public readonly limit: number) {
    super(`${labels[code]} : ${observed} ; limite : ${limit}.`);
  }
}
function check(code: LimitCode, value: number, limit: number) {
  if (value > limit) throw new BackupLimitError(code, value, limit);
}
export const sizeLabel = (bytes: number) => bytes < MIB
  ? `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Kio`
  : `${(bytes / MIB).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mio`;
export const jsonSizeError = (limits: BackupLimits, observed?: number) => observed === undefined
  ? new BackupError(`Le contenu JSON dépasse la limite de ${sizeLabel(limits.jsonBytes)} avant ou après décompression.`)
  : new BackupLimitError('jsonBytes', observed, limits.jsonBytes);
export const compressedSizeError = (limits: BackupLimits, observed?: number) => observed === undefined
  ? new BackupError(`Le fichier gzip dépasse la limite de ${sizeLabel(limits.compressedBytes)}.`)
  : new BackupLimitError('compressedBytes', observed, limits.compressedBytes);
export function expansionLimit(size: number, limits: BackupLimits): number {
  return Math.max(limits.expansionAllowanceBytes, size * limits.expansionRatio);
}
export function checkExpandedSize(size: number, compressedSize: number, limits: BackupLimits) {
  if (size > limits.jsonBytes) throw jsonSizeError(limits, size);
  if (size > expansionLimit(compressedSize, limits)) throw new BackupError('La sauvegarde présente une expansion gzip anormalement élevée. Décompression arrêtée par sécurité.');
}
type Context = 'root' | 'data' | 'details' | 'detail' | 'measurements' | 'point' | 'other';
interface Frame { array: boolean; context: Context; key?: string; expectsKey: boolean; properties: number }
const streams = new Set(['heartRate', 'speed', 'cadence', 'altitude', 'distance', 'gps']);
function contextFor(parent: Frame | undefined, array: boolean, root: boolean): Context {
  if (!parent) return root && !array ? 'root' : 'other';
  if (parent.context === 'root' && parent.key === 'data' && !array) return 'data';
  if (parent.context === 'data' && parent.key === 'details' && array) return 'details';
  if (parent.context === 'details' && !array) return 'detail';
  if (parent.context === 'detail' && streams.has(parent.key ?? '') && array) return 'measurements';
  if (parent.context === 'measurements' && !array) return 'point';
  return 'other';
}
/** Un seul passage lexical : octets UTF-8, profondeur, conteneurs, clés et primitives.
 * Seuls les objets directs des tableaux data.details[*].<série> ont un budget de
 * mesures. Leurs objets/tableaux imbriqués restent structurels. Le schéma complet
 * est toujours validé ensuite ; cette inspection ne rend aucun champ admissible. */
export function inspectJsonStats(text: string, limits: BackupLimits = BACKUP_LIMITS): JsonInspection {
  const stats: JsonInspection = { bytes: 0, maxDepth: 0, structuralNodes: 0, primitiveValues: 0, measurementPoints: 0, measurementPrimitives: 0, properties: 0, maxObjectProperties: 0 };
  const stack: Frame[] = [];
  let quoted = false, escaped = false, stringLength = 0, literal = false, root = true;
  let keyFrame: Frame | undefined, keyStart = 0, keyEscaped = false;
  const primitive = () => {
    if (stack.at(-1)?.context === 'point') check('measurementPrimitives', ++stats.measurementPrimitives, limits.measurementPrimitives);
    else check('primitiveValues', ++stats.primitiveValues, limits.primitiveValues);
  };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    stats.bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xdc00 && c <= 0xdfff && i > 0 && text.charCodeAt(i - 1) >= 0xd800 && text.charCodeAt(i - 1) <= 0xdbff ? 1 : 3;
    check('jsonBytes', stats.bytes, limits.jsonBytes);
    if (quoted) {
      if (!escaped && c === 34) {
        quoted = false;
        if (keyFrame && ['root', 'data', 'detail'].includes(keyFrame.context)) {
          // Aucun décodage/allocation de clé pour les millions d’objets de mesure.
          try { keyFrame.key = keyEscaped ? JSON.parse(text.slice(keyStart - 1, i + 1)) : text.slice(keyStart, i); }
          catch { throw new BackupError('Le fichier ne contient pas un JSON valide.'); }
        }
        continue;
      }
      check('stringCharacters', ++stringLength, limits.stringCharacters);
      if (escaped) escaped = false;
      else if (c === 92) { escaped = true; keyEscaped = true; }
      continue;
    }
    const parent = stack.at(-1);
    if (c === 34) {
      quoted = true; stringLength = 0; literal = false; keyEscaped = false; keyStart = i + 1;
      keyFrame = parent && !parent.array && parent.expectsKey ? parent : undefined;
      if (keyFrame) {
        stats.properties++; keyFrame.properties++; keyFrame.expectsKey = false;
        stats.maxObjectProperties = Math.max(stats.maxObjectProperties, keyFrame.properties);
        check('objectProperties', keyFrame.properties, limits.objectProperties);
      } else primitive();
    } else if (c === 123 || c === 91) {
      const array = c === 91, context = contextFor(parent, array, root); root = false;
      if (context === 'point') check('measurementPoints', ++stats.measurementPoints, limits.measurementPoints);
      else check('structuralNodes', ++stats.structuralNodes, limits.structuralNodes);
      stack.push({ array, context, expectsKey: !array, properties: 0 });
      stats.maxDepth = Math.max(stats.maxDepth, stack.length);
      check('depth', stack.length, limits.depth); literal = false;
    } else if (c === 125 || c === 93) {
      if (!parent || parent.array !== (c === 93)) throw new BackupError('Le fichier ne contient pas un JSON valide.');
      stack.pop(); literal = false;
    } else if (c === 44) { if (parent && !parent.array) parent.expectsKey = true; literal = false; }
    else if (c === 58 || c === 32 || c === 10 || c === 13 || c === 9) literal = false;
    else if (!literal) { primitive(); literal = true; }
  }
  return stats;
}
export const inspectJson = (text: string, limits: BackupLimits = BACKUP_LIMITS) => inspectJsonStats(text, limits).bytes;
/** Coût exact des champs integrity ajoutés après empreinte, sans reparcourir le JSON. */
export function checkIntegrityEnvelope(stats: JsonInspection, limits: BackupLimits) {
  check('structuralNodes', stats.structuralNodes + 1, limits.structuralNodes);
  check('primitiveValues', stats.primitiveValues + 2, limits.primitiveValues);
  check('objectProperties', Math.max(stats.maxObjectProperties, 6), limits.objectProperties);
  check('stringCharacters', 64, limits.stringCharacters);
  check('depth', Math.max(stats.maxDepth, 2), limits.depth);
}
