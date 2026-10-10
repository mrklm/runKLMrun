import type { RunningSession } from '../types/session';
import { RUNNING_SPORTS } from './polar-sports';
/** Aucune interprétation selon le fuseau de l'ordinateur. */
export function absoluteStart(session: RunningSession): number | undefined {
  if (!session.startTime) return undefined;
  const explicit = /(?:Z|[+-]\d{2}:\d{2})$/i.test(session.startTime);
  if (!explicit && session.timezoneOffsetMinutes === undefined) return undefined;
  const time = Date.parse(explicit ? session.startTime : `${session.startTime}Z`);
  const offset = explicit ? 0 : session.timezoneOffsetMinutes! * 60000;
  return Number.isFinite(time) && Number.isFinite(offset) ? time - offset : undefined;
}
/** Tolérances cumulatives : 1 s au départ, 2 s de durée, min(5 m, 0,2 %) de distance. */
export function isTcxDuplicate(a: RunningSession, b: RunningSession): boolean {
  if (a.source !== 'tcx' && b.source !== 'tcx') return false;
  if (!a.sport || !b.sport || !RUNNING_SPORTS.includes(a.sport) || !RUNNING_SPORTS.includes(b.sport)) return false;
  const first = absoluteStart(a), second = absoluteStart(b);
  const da = a.distanceMeters, db = b.distanceMeters;
  if (first === undefined || second === undefined || da === undefined || db === undefined) return false;
  if (![da, db, a.durationSeconds, b.durationSeconds].every(v => Number.isFinite(v) && v > 0)) return false;
  return Math.abs(first - second) <= 1000 && Math.abs(a.durationSeconds - b.durationSeconds) <= 2
    && Math.abs(da - db) <= Math.min(5, Math.min(da, db) * .002);
}
