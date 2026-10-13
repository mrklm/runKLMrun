import { estimateAscent } from '../core/analysis/ascent';
import type { RunningSession, Sample, SessionDetails } from '../types/session';
const TCX = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';
const EXT = 'http://www.garmin.com/xmlschemas/ActivityExtension/v2';
export const MAX_TCX_BYTES = 16 * 1024 * 1024;
export type XmlReader = (text: string) => Document;
export class TcxError extends Error {
  constructor(public readonly kind: 'invalid' | 'unsupported' | 'technical', message: string) { super(message); this.name = 'TcxError'; }
}
const invalid = (message = 'Structure TCX invalide.') => new TcxError('invalid', message);
const unsupported = (message: string) => new TcxError('unsupported', message);
function children(parent: Element, name: string, namespace = TCX): Element[] {
  return Array.from(parent.childNodes).filter((n): n is Element => n.nodeType === 1)
    .filter(n => n.localName === name && n.namespaceURI === namespace);
}
function child(parent: Element, name: string, namespace = TCX): Element | undefined {
  const nodes = children(parent, name, namespace);
  if (nodes.length > 1) throw invalid(`Élément ${name} présent plusieurs fois à un emplacement unique.`);
  return nodes[0];
}
function numberValue(element?: Element, negative = false): number | undefined {
  if (!element) return undefined;
  const text = element.textContent?.trim() ?? '';
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw invalid();
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (!negative && value < 0)) throw invalid();
  return value;
}
function time(value: string | null | undefined): { text: string; ms: number } {
  const text = value?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) throw invalid('Horodatage absent ou invalide : date et heure avec fuseau attendues.');
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || new Date(`${text.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== text.slice(0, 10)) throw invalid('Horodatage absent ou invalide : date et heure avec fuseau attendues.');
  return { text, ms };
}
function coordinate(parent: Element | undefined, name: string, max: number): number | null {
  if (!parent) return null;
  try { const value = numberValue(child(parent, name), true); return value !== undefined && Math.abs(value) <= max ? value : null; } catch { return null; }
}
/** DOMParser natif en production ; lecteur XML injecté pour les tests Node. */
async function parseContent(text: string, readXml: XmlReader, warn: (message: string) => void): Promise<{ session: RunningSession; details: SessionDetails } | null> {
  if (new TextEncoder().encode(text).length > MAX_TCX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(text)) throw invalid();
  let document: Document;
  try { document = readXml(text); } catch { throw invalid('XML illisible ou mal formé.'); }
  const optional = (parent: Element, name: string, negative = false, namespace = TCX): number | undefined => {
    const node = child(parent, name, namespace);
    try { return numberValue(node, negative); } catch {
      warn(`Mesure facultative ${name} inutilisable : valeur ignorée.`); return undefined;
    }
  };
  const optionalHeart = (parent: Element, name: string) => {
    const node = child(parent, name); return node ? optional(node, 'Value') : undefined;
  };
  if (document.getElementsByTagNameNS('*', 'parsererror').length) throw invalid();
  const root = document.documentElement;
  if (!root || root.localName !== 'TrainingCenterDatabase' || root.namespaceURI !== TCX) throw unsupported('Racine ou espace de noms incompatible : TCX Garmin v2 attendu.');
  const activities = child(root, 'Activities');
  if (!activities) throw unsupported('Aucune liste d’activités TCX.');
  if (children(activities, 'MultiSportSession').length) throw unsupported('Les activités multisports ne sont pas prises en charge.');
  const activityList = children(activities, 'Activity');
  if (activityList.length !== 1) throw unsupported('Une seule activité par fichier est prise en charge.');
  const activity = activityList[0];
  if (activity.getAttribute('Sport') !== 'Running') return null;
  const lapNodes = children(activity, 'Lap');
  if (!lapNodes.length) throw invalid('Aucun tour dans l’activité.');
  const laps = lapNodes.map(lap => {
    const start = time(lap.getAttribute('StartTime'));
    let durationSeconds: number | undefined;
    try { durationSeconds = numberValue(child(lap, 'TotalTimeSeconds')); } catch { throw invalid('Durée de tour invalide.'); }
    if (durationSeconds === undefined) throw invalid('Durée de tour absente.');
    return { startTime: start.text, durationSeconds, distanceMeters: optional(lap, 'DistanceMeters') };
  });
  const start = time(laps[0].startTime);
  let previousLap = start.ms;
  for (const lap of laps) { const ms = time(lap.startTime).ms; if (ms < previousLap) throw invalid('Débuts de tours non chronologiques.'); previousLap = ms; }
  const durationSeconds = laps.reduce((sum, lap) => sum + lap.durationSeconds, 0);
  const distanceMeters = laps.every(lap => lap.distanceMeters !== undefined) ? laps.reduce((sum, lap) => sum + lap.distanceMeters!, 0) : undefined;
  if (!Number.isFinite(durationSeconds) || (distanceMeters !== undefined && !Number.isFinite(distanceMeters)) || (durationSeconds === 0 && (distanceMeters ?? 0) > 0)) throw invalid();
  const averages = lapNodes.map(lap => optionalHeart(lap, 'AverageHeartRateBpm'));
  const maxima = lapNodes.map(lap => optionalHeart(lap, 'MaximumHeartRateBpm'));
  const session: RunningSession = {
    id: '', source: 'tcx', sport: 'RUNNING', title: 'Course à pied', startTime: start.text, date: start.text.slice(0, 10),
    durationSeconds, distanceMeters,
    averagePaceSecondsPerKm: distanceMeters && durationSeconds > 0 ? durationSeconds * 1000 / distanceMeters : undefined,
    averageHeartRate: durationSeconds > 0 && averages.every(v => v !== undefined) ? averages.reduce<number>((sum, v, i) => sum + v! * laps[i].durationSeconds, 0) / durationSeconds : undefined,
    maximumHeartRate: maxima.every(v => v !== undefined) ? maxima.reduce<number>((max, v) => Math.max(max, v!), 0) : undefined,
  };
  if (session.averagePaceSecondsPerKm !== undefined && !Number.isFinite(session.averagePaceSecondsPerKm)) throw invalid();
  const streams: Record<'heartRate' | 'speed' | 'altitude' | 'cadence' | 'distance', Sample[]> = { heartRate: [], speed: [], altitude: [], cadence: [], distance: [] };
  const gps: NonNullable<SessionDetails['gps']> = [];
  let previousTime = -1, trackCount = 0;
  const details: SessionDetails = { id: '', laps, cadenceUnit: 'source' };
  for (const lap of lapNodes) for (const track of children(lap, 'Track')) {
    const points = children(track, 'Trackpoint');
    if (!points.length) continue;
    let first = true;
    for (const point of points) {
      const stamp = time(child(point, 'Time')?.textContent);
      const timeSeconds = (stamp.ms - start.ms) / 1000;
      if (timeSeconds < 0 || timeSeconds < previousTime) throw invalid('Horodatage de point antérieur au début ou à un point précédent.');
      previousTime = timeSeconds;
      if (first && trackCount > 0) {
        for (const series of Object.values(streams)) series.push({ timeSeconds, value: null });
        gps.push({ timeSeconds, latitude: null, longitude: null });
      }
      first = false;
      const extensions = child(point, 'Extensions');
      const tpx = extensions ? child(extensions, 'TPX', EXT) : undefined;
      const position = child(point, 'Position');
      const altitude = optional(point, 'AltitudeMeters', true);
      const cadence = tpx ? optional(tpx, 'RunCadence', false, EXT) : undefined;
      const values = {
        heartRate: optionalHeart(point, 'HeartRateBpm'), altitude,
        speed: tpx ? optional(tpx, 'Speed', false, EXT) : undefined,
        cadence: cadence ?? optional(point, 'Cadence'),
        distance: optional(point, 'DistanceMeters'),
      };
      for (const key of Object.keys(streams) as (keyof typeof streams)[]) streams[key].push({ timeSeconds, value: values[key] ?? null });
      gps.push({ timeSeconds, latitude: coordinate(position, 'LatitudeDegrees', 90), longitude: coordinate(position, 'LongitudeDegrees', 180), altitudeMeters: altitude });
    }
    trackCount++;
  }
  for (const key of Object.keys(streams) as (keyof typeof streams)[]) if (streams[key].some(point => point.value !== null)) details[key] = streams[key];
  if (gps.some(p => p.latitude !== null && p.longitude !== null)) { details.gps = gps; details.gpsStartTime = start.text; }
  // Empreinte du contenu normalisé, indépendante du nom de fichier et du formatage XML.
  // L'Id TCX est généralement une date, donc insuffisant pour identifier à lui seul une sortie.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ session, details })));
  const id = `tcx:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  session.id = id; details.id = id;
  // Enrichissement après l’empreinte historique : identifiants inchangés.
  const estimate = estimateAscent(details.altitude);
  if (estimate) { session.ascentMeters = estimate.meters; session.ascentEstimate = estimate; }
  return { session, details };
}

/** Les erreurs techniques ne doivent pas être présentées comme du XML invalide. */
export async function parseTcx(text: string, readXml: XmlReader = value => new DOMParser().parseFromString(value, 'application/xml'), warn: (message: string) => void = () => {}) {
  try { return await parseContent(text, readXml, warn); }
  catch (error) {
    if (error instanceof TcxError) throw error;
    throw new TcxError('technical', 'Erreur technique interne pendant la lecture TCX ou le calcul de son identifiant.');
  }
}
