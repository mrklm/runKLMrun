import type { RunningSession } from '../../types/session';
import { sumMeasure, validSessionDate, type Measure } from './session-summary';

export type TrainingWeeks = 4 | 8 | 12;
export interface CoveredMeasure extends Measure {
  missing: number;
  invalid: number;
  weeklyAverage: number | null;
}
export interface TrainingHistory {
  weeks: TrainingWeeks;
  startDate: string;
  referenceDate: string;
  sessionCount: number;
  activeDays: number;
  days: { date: string; sessions: number; durationSeconds: number | null }[];
  activeWeeks: number;
  sessionsPerWeek: number;
  distance: CoveredMeasure;
  duration: CoveredMeasure;
  longest?: { id: string; date: string; distanceMeters: number; durationSeconds: number | null };
  latest?: { id: string; date: string; daysAgo: number };
  excluded: { invalidDates: number; futureDates: number };
}
const DAY = 86400000;
// Arithmétique sur les dates civiles source, sans convertir les instants des séances.
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const usable = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function covered(sessions: readonly RunningSession[], field: 'distanceMeters' | 'durationSeconds', weeks: TrainingWeeks): CoveredMeasure {
  const sum = sumMeasure(sessions, field);
  let missing = 0, invalid = 0;
  for (const session of sessions) {
    const value = session[field];
    if (value === undefined || value === null) missing++;
    else if (!usable(value)) invalid++;
  }
  return { ...sum, missing, invalid, weeklyAverage: sum.value === null ? null : sum.value / weeks };
}
/** Lecture seule des résumés ; la date de référence est une date civile YYYY-MM-DD. */
export function analyzeTrainingHistory(sessions: readonly RunningSession[], weeks: TrainingWeeks, referenceDate: string): TrainingHistory {
  if (![4, 8, 12].includes(weeks) || !validSessionDate(referenceDate)) throw new Error('Période ou date de référence invalide.');
  const end = dayNumber(referenceDate), start = end - weeks * 7 + 1;
  const startDate = new Date(start * DAY).toISOString().slice(0, 10);
  const selected: RunningSession[] = [], days = new Set<string>(), blocks = new Set<number>();
  const excluded = { invalidDates: 0, futureDates: 0 };
  let latest: RunningSession | undefined, longest: RunningSession | undefined;
  for (const session of sessions) {
    if (!validSessionDate(session.date)) { excluded.invalidDates++; continue; }
    if (session.date > referenceDate) { excluded.futureDates++; continue; }
    // Départage stable des égalités, indépendant de l'ordre d'importation.
    if (!latest || session.date > latest.date || (session.date === latest.date && session.id < latest.id)) latest = session;
    const day = dayNumber(session.date);
    if (day < start) continue;
    selected.push(session); days.add(session.date); blocks.add(Math.floor((day - start) / 7));
    if (usable(session.distanceMeters) && (!longest || session.distanceMeters > longest.distanceMeters!
      || (session.distanceMeters === longest.distanceMeters && (session.date > longest.date || (session.date === longest.date && session.id < longest.id))))) longest = session;
  }
  const daily = new Map<string, RunningSession[]>();
  for (const session of selected) daily.set(session.date, [...(daily.get(session.date) ?? []), session]);
  return {
    days: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({ date, sessions: entries.length,
      durationSeconds: entries.every(s => usable(s.durationSeconds)) ? entries.reduce((sum, s) => sum + s.durationSeconds, 0) : null })),
    weeks, startDate, referenceDate, sessionCount: selected.length, activeDays: days.size, activeWeeks: blocks.size,
    sessionsPerWeek: selected.length / weeks, distance: covered(selected, 'distanceMeters', weeks), duration: covered(selected, 'durationSeconds', weeks),
    longest: longest ? { id: longest.id, date: longest.date, distanceMeters: longest.distanceMeters!, durationSeconds: usable(longest.durationSeconds) ? longest.durationSeconds : null } : undefined,
    latest: latest ? { id: latest.id, date: latest.date, daysAgo: end - dayNumber(latest.date) } : undefined,
    excluded,
  };
}
