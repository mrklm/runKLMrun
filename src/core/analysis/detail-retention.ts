import type { RunningSession } from '../../types/session';

export const DETAIL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Pure : conserve les dates incertaines et la frontière exacte des 30 jours.
 * Sans fuseau, utilise la fin de la date civile au fuseau UTC−12 :
 * aucune suppression anticipée selon le fuseau de l’appareil.
 */
export type DetailRetention = 'keep' | 'expired' | 'uncertain';
export function classifyDetails(session: Partial<Pick<RunningSession, 'date' | 'startTime' | 'timezoneOffsetMinutes'>>, reference: Date): DetailRetention {
  const now = reference.getTime();
  const date = session.date;
  if (!Number.isFinite(now) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return 'uncertain';
  const day = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) return 'uncertain';
  let latest = day + 36 * 60 * 60 * 1000;
  if (session.startTime !== undefined) {
    const start = session.startTime;
    if (typeof start !== 'string') return 'uncertain';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(start) || start.slice(0, 10) !== date) return 'uncertain';
    if (Number(start.slice(11, 13)) > 23 || Number(start.slice(14, 16)) > 59 || Number(start.slice(17, 19)) > 59) return 'uncertain';
    const explicit = /(?:Z|[+-]\d{2}:\d{2})$/.test(start);
    const parsed = Date.parse(explicit ? start : `${start}Z`);
    if (!Number.isFinite(parsed)) return 'uncertain';
    const offset = session.timezoneOffsetMinutes;
    if (explicit) latest = parsed;
    else if (offset !== undefined) {
      if (!Number.isInteger(offset) || offset < -720 || offset > 840) return 'uncertain';
      latest = parsed - offset * 60000;
    }
  }
  if (latest > now) return 'keep';
  return now - latest <= DETAIL_RETENTION_MS ? 'keep' : 'expired';
}

export function shouldKeepDetails(session: Parameters<typeof classifyDetails>[0], reference: Date): boolean {
  return classifyDetails(session, reference) !== 'expired';
}
