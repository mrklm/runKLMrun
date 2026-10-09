import type { RunningSession, Sample, SessionDetails } from '../types/session';
import { PolarImportError } from './polar-errors';
import { parseModernPolar, polarIdentifier, validStart } from './polar-modern';
import { RUNNING_SPORTS, OTHER_SPORTS } from './polar-sports';
export { RUNNING_SPORTS } from './polar-sports';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const positive = (v: unknown) => { const n = number(v); return n !== undefined && n >= 0 ? n : undefined; };
export function seconds(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^P(?:(\d+(?:\.\d+)?)D)?T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v);
  return m && m.slice(1).some(Boolean) ? Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0) : undefined;
}
function series(v: unknown, factor = 1): Sample[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.flatMap(item => {
    const p = obj(item), time = seconds(p.time), value = p.value === 'NaN' || p.value === null ? null : number(p.value);
    return time !== undefined && value !== undefined ? [{ timeSeconds: time, value: value === null ? null : value * factor }] : [];
  });
}
/** Deux schémas JSON, un seul exercice. Aucun sport n'est déduit du titre.
 * strictSport est activé par l'import ZIP pour distinguer les codes textuels inconnus.
 * Par défaut, le retour null des sports textuels exclus conserve le contrat initial.
 */
export function parsePolar(text: string, filename: string, strictSport = false): { session: RunningSession; details: SessionDetails } | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new PolarImportError('invalidJson'); }
  const root = obj(parsed);
  if (!Array.isArray(root.exercises) || root.exercises.length !== 1) throw new PolarImportError('unsupportedStructure');
  const e = obj(root.exercises[0]);
  if (e.sport && typeof e.sport === 'object' && !Array.isArray(e.sport)) return parseModernPolar(root, e, filename);
  if (typeof e.sport !== 'string') throw new PolarImportError('unknownSport');
  if (!RUNNING_SPORTS.includes(e.sport)) {
    if (strictSport && !OTHER_SPORTS.includes(e.sport)) throw new PolarImportError('unknownSport');
    return null;
  }
  const origin = polarIdentifier(root, filename);
  const start = validStart(e.startTime ?? root.startTime);
  const rawDuration = e.duration ?? root.duration;
  if (rawDuration === undefined || rawDuration === null) throw new PolarImportError('missingDuration');
  const duration = seconds(rawDuration);
  if (duration === undefined || !Number.isFinite(duration)) throw new PolarImportError('invalidNumbers');
  const id = `polar:${origin}`, distance = positive(e.distance), hr = obj(e.heartRate);
  const session: RunningSession = {
    id, polarId: String(origin), title: 'Course à pied', sport: e.sport, date: start.slice(0, 10), startTime: start,
    durationSeconds: duration, distanceMeters: distance,
    averageHeartRate: positive(hr.average), maximumHeartRate: positive(hr.maximum),
    ascentMeters: positive(e.ascent), descentMeters: positive(e.descent),
    averagePaceSecondsPerKm: distance && duration > 0 ? duration * 1000 / distance : undefined,
    runningIndex: positive(obj(e.runningIndex).value ?? e.runningIndex),
    cardioLoad: positive(obj(e.trainingLoadPro).cardioLoad ?? obj(e.trainingLoad).cardioLoad ?? e.cardioLoad),
  };
  const zones = obj(e.zones).heartRate;
  if (Array.isArray(zones)) session.heartRateZones = zones.flatMap(z => {
    const zone = obj(z), durationSeconds = seconds(zone.inZone);
    return durationSeconds === undefined ? [] : [{ lower: positive(zone.lowerLimit), upper: positive(zone.upperLimit), durationSeconds }];
  });
  const samples = obj(e.samples);
  const details: SessionDetails = { id, heartRate: series(samples.heartRate), speed: series(samples.speed, 1 / 3.6), cadence: series(samples.cadence), altitude: series(samples.altitude) };
  if (Array.isArray(e.recordedRoute)) details.gps = e.recordedRoute.flatMap(item => {
    const p = obj(item), timeSeconds = seconds(p.time), latitude = number(p.latitude), longitude = number(p.longitude);
    return timeSeconds !== undefined && latitude !== undefined && longitude !== undefined && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? [{ timeSeconds, latitude, longitude, altitudeMeters: number(p.altitude) }] : [];
  });
  return { session, details };
}
