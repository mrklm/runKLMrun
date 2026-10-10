import type { RunningSession, Sample, SessionDetails } from '../types/session';
const TCX = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';
const EXT = 'http://www.garmin.com/xmlschemas/ActivityExtension/v2';
export const MAX_TCX_BYTES = 16 * 1024 * 1024;
export type XmlReader = (text: string) => Document;
const invalid = () => new Error('Fichier TCX invalide ou structure non prise en charge.');
function children(parent: Element, name: string, namespace = TCX): Element[] {
  return Array.from(parent.childNodes).filter((n): n is Element => n.nodeType === 1)
    .filter(n => n.localName === name && n.namespaceURI === namespace);
}
function child(parent: Element, name: string, namespace = TCX): Element | undefined {
  const nodes = children(parent, name, namespace);
  if (nodes.length > 1) throw invalid();
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
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) throw invalid();
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || new Date(`${text.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== text.slice(0, 10)) throw invalid();
  return { text, ms };
}
function heart(parent: Element, name: string): number | undefined {
  const node = child(parent, name); return node ? numberValue(child(node, 'Value')) : undefined;
}
function coordinate(parent: Element | undefined, name: string, max: number): number | null {
  if (!parent) return null;
  try { const value = numberValue(child(parent, name), true); return value !== undefined && Math.abs(value) <= max ? value : null; } catch { return null; }
}
/** DOMParser natif en production ; lecteur XML injecté pour les tests Node. */
export async function parseTcx(text: string, readXml: XmlReader = value => new DOMParser().parseFromString(value, 'application/xml')): Promise<{ session: RunningSession; details: SessionDetails } | null> {
  if (new TextEncoder().encode(text).length > MAX_TCX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(text)) throw invalid();
  const document = readXml(text);
  if (document.getElementsByTagNameNS('*', 'parsererror').length) throw invalid();
  const root = document.documentElement;
  if (!root || root.localName !== 'TrainingCenterDatabase' || root.namespaceURI !== TCX) throw invalid();
  const activities = child(root, 'Activities');
  if (!activities || children(activities, 'MultiSportSession').length) throw invalid();
  const activityList = children(activities, 'Activity');
  if (activityList.length !== 1) throw invalid();
  const activity = activityList[0];
  if (activity.getAttribute('Sport') !== 'Running') return null;
  const lapNodes = children(activity, 'Lap');
  if (!lapNodes.length) throw invalid();
  const laps = lapNodes.map(lap => {
    const start = time(lap.getAttribute('StartTime'));
    const durationSeconds = numberValue(child(lap, 'TotalTimeSeconds'));
    if (durationSeconds === undefined) throw invalid();
    return { startTime: start.text, durationSeconds, distanceMeters: numberValue(child(lap, 'DistanceMeters')) };
  });
  const start = time(laps[0].startTime);
  let previousLap = start.ms;
  for (const lap of laps) { const ms = time(lap.startTime).ms; if (ms < previousLap) throw invalid(); previousLap = ms; }
  const durationSeconds = laps.reduce((sum, lap) => sum + lap.durationSeconds, 0);
  const distanceMeters = laps.every(lap => lap.distanceMeters !== undefined) ? laps.reduce((sum, lap) => sum + lap.distanceMeters!, 0) : undefined;
  if (!Number.isFinite(durationSeconds) || (distanceMeters !== undefined && !Number.isFinite(distanceMeters)) || (durationSeconds === 0 && (distanceMeters ?? 0) > 0)) throw invalid();
  const averages = lapNodes.map(lap => heart(lap, 'AverageHeartRateBpm'));
  const maxima = lapNodes.map(lap => heart(lap, 'MaximumHeartRateBpm'));
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
      if (timeSeconds < 0 || timeSeconds < previousTime) throw invalid();
      previousTime = timeSeconds;
      if (first && trackCount > 0) {
        for (const series of Object.values(streams)) series.push({ timeSeconds, value: null });
        gps.push({ timeSeconds, latitude: null, longitude: null });
      }
      first = false;
      const extensions = child(point, 'Extensions');
      const tpx = extensions ? child(extensions, 'TPX', EXT) : undefined;
      const position = child(point, 'Position');
      const altitude = numberValue(child(point, 'AltitudeMeters'), true);
      const cadence = tpx ? numberValue(child(tpx, 'RunCadence', EXT)) : undefined;
      const values = {
        heartRate: heart(point, 'HeartRateBpm'), altitude,
        speed: tpx ? numberValue(child(tpx, 'Speed', EXT)) : undefined,
        cadence: cadence ?? numberValue(child(point, 'Cadence')),
        distance: numberValue(child(point, 'DistanceMeters')),
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
  return { session, details };
}
