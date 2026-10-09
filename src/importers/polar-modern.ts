import type { RunningSession, Sample, SessionDetails } from '../types/session';
import { PolarImportError } from './polar-errors';
import { POLAR_SPORT_IDS, RUNNING_SPORTS } from './polar-sports';

type Obj = Record<string, unknown>;
export const object = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const missing = (v: unknown) => v === undefined || v === null;
function numeric(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (missing(v)) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new PolarImportError('invalidNumbers');
  return v;
}
function requiredNumber(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = numeric(v, min, max);
  if (n === undefined) throw new PolarImportError('invalidNumbers');
  return n;
}
export function validStart(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(`${v.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== v.slice(0, 10)) throw new PolarImportError('invalidDate');
  return v;
}
export function polarIdentifier(root: Obj, filename: string): string {
  const value = root.id ?? object(root.identifier).id ?? filename.match(/training-session[_-]([^/]+)\.json$/i)?.[1];
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim() || (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0))) throw new PolarImportError('missingIdentifier');
  return String(value);
}
function list(v: unknown): unknown[] {
  if (missing(v)) return [];
  if (!Array.isArray(v)) throw new PolarImportError('unsupportedStructure');
  return v;
}
function sampleValue(v: unknown, min = 0): number | null {
  // Les positions manquantes sont conservées, sans interpolation ni compression temporelle.
  return v === 'NaN' || v === null ? null : requiredNumber(v, min);
}
const STREAMS = {
  HEART_RATE: { key: 'heartRate', divisor: 1, min: 0 },
  SPEED: { key: 'speed', divisor: 3.6, min: 0 },
  CADENCE: { key: 'cadence', divisor: 1, min: 0 },
  ALTITUDE: { key: 'altitude', divisor: 1, min: -Number.MAX_SAFE_INTEGER },
  DISTANCE: { key: 'distance', divisor: 1, min: 0 },
} as const;

export function parseModernPolar(root: Obj, exercise: Obj, filename: string): { session: RunningSession; details: SessionDetails } | null {
  const sportId = object(exercise.sport).id;
  const sport = typeof sportId === 'string' && Object.hasOwn(POLAR_SPORT_IDS, sportId) ? POLAR_SPORT_IDS[sportId] : undefined;
  if (!sport) throw new PolarImportError('unknownSport');
  if (!RUNNING_SPORTS.includes(sport)) return null;
  const polarId = polarIdentifier(root, filename), id = `polar:${polarId}`;
  const startTime = validStart(exercise.startTime ?? root.startTime);
  const rawDuration = exercise.durationMillis ?? root.durationMillis;
  if (missing(rawDuration)) throw new PolarImportError('missingDuration');
  const durationSeconds = requiredNumber(rawDuration) / 1000;
  const distanceMeters = numeric(exercise.distanceMeters ?? root.distanceMeters);
  if (durationSeconds === 0 && distanceMeters !== undefined && distanceMeters > 0) throw new PolarImportError('invalidNumbers');
  const statistics = list(object(exercise.statistics).statistics).map(object).filter(s => s.type === 'STATISTICS_TYPE_HEART_RATE');
  if (statistics.length > 1) throw new PolarImportError('unsupportedStructure');
  const hr = statistics[0] ?? {};
  const averageHeartRate = numeric(hr.avg ?? exercise.hrAvg ?? root.hrAvg);
  const maximumHeartRate = numeric(hr.max ?? exercise.hrMax ?? root.hrMax);
  if (averageHeartRate !== undefined && maximumHeartRate !== undefined && averageHeartRate > maximumHeartRate) throw new PolarImportError('invalidNumbers');
  const timezoneOffsetMinutes = numeric(exercise.timezoneOffsetMinutes ?? root.timezoneOffsetMinutes, -720, 840);
  if (timezoneOffsetMinutes !== undefined && !Number.isInteger(timezoneOffsetMinutes)) throw new PolarImportError('invalidNumbers');
  const session: RunningSession = {
    id, polarId, polarSportId: sportId as string, sport, title: 'Course à pied',
    date: startTime.slice(0, 10), startTime, timezoneOffsetMinutes,
    durationSeconds, distanceMeters, averageHeartRate, maximumHeartRate,
    ascentMeters: numeric(exercise.ascentMeters), descentMeters: numeric(exercise.descentMeters),
    runningIndex: numeric(exercise.runningIndex),
    // Mesure Polar uniquement : jamais trainingLoad, muscleLoad ou perceivedLoad.
    cardioLoad: numeric(object(exercise.trainingLoadReport).cardioLoad ?? object(root.trainingLoadReport).cardioLoad),
  };
  if (distanceMeters !== undefined && distanceMeters > 0 && durationSeconds > 0) {
    session.averagePaceSecondsPerKm = requiredNumber(durationSeconds / distanceMeters * 1000);
  }
  const groups = list(exercise.zones).map(object).filter(z => z.type === 'ZONE_TYPE_HEART_RATE');
  if (groups.length > 1) throw new PolarImportError('unsupportedStructure');
  if (groups.length) session.heartRateZones = list(groups[0].zones).map(item => {
    const zone = object(item), lower = numeric(zone.lowerLimit), upper = numeric(zone.higherLimit);
    if (lower !== undefined && upper !== undefined && lower > upper) throw new PolarImportError('invalidNumbers');
    const inZoneMillis = numeric(zone.inZone);
    return { lower, upper, durationSeconds: inZoneMillis === undefined ? undefined : inZoneMillis / 1000 };
  });
  const details: SessionDetails = { id };
  for (const item of list(object(exercise.samples).samples)) {
    const stream = object(item);
    if (typeof stream.type !== 'string' || !Object.hasOwn(STREAMS, stream.type)) continue;
    const spec = STREAMS[stream.type as keyof typeof STREAMS];
    if (details[spec.key] !== undefined || !Array.isArray(stream.values)) throw new PolarImportError('unsupportedStructure');
    const interval = requiredNumber(stream.intervalMillis);
    if (interval <= 0) throw new PolarImportError('invalidNumbers');
    details[spec.key] = stream.values.map((v, index): Sample => {
      const value = sampleValue(v, spec.min);
      return { timeSeconds: requiredNumber(index * interval) / 1000, value: value === null ? null : value / spec.divisor };
    });
  }
  const route = object(object(exercise.routes).route);
  if (route.wayPoints !== undefined) {
    // elapsedMillis est relatif à route.startTime, qui est conservé séparément.
    details.gpsStartTime = missing(route.startTime) ? undefined : validStart(route.startTime);
    let previous = -1;
    details.gps = list(route.wayPoints).map(item => {
      const p = object(item), timeSeconds = requiredNumber(p.elapsedMillis) / 1000;
      if (timeSeconds < previous) throw new PolarImportError('invalidNumbers');
      previous = timeSeconds;
      const latitude = sampleValue(p.latitude, -90), longitude = sampleValue(p.longitude, -180);
      if ((latitude !== null && latitude > 90) || (longitude !== null && longitude > 180)) throw new PolarImportError('invalidNumbers');
      return { timeSeconds, latitude, longitude, altitudeMeters: p.altitude === 'NaN' || p.altitude === null ? undefined : numeric(p.altitude, -Number.MAX_SAFE_INTEGER) };
    });
  }
  return { session, details };
}
