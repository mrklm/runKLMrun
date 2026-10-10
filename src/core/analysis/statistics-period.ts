import type { RunningSession } from '../../types/session';
import { statistics, totals, validSessionDate, type Period } from './session-summary';
export type PeriodMode = 'week' | 'month' | 'year' | 'all';
export interface PeriodSelection { mode: PeriodMode; year: string; month: string }
export function localToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const dateText = (date: Date) => date.toISOString().slice(0, 10);
export function activatePeriod(mode: PeriodMode, today: string): PeriodSelection {
  return { mode, year: today.slice(0, 4), month: today.slice(5, 7) };
}
export function periodStatistics(sessions: readonly RunningSession[], selection: PeriodSelection, today: string) {
  const { mode, year, month } = selection;
  let first = '', last = '';
  if (mode === 'week') {
    last = today;
    const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 6); first = dateText(d);
  } else if (mode === 'month') {
    first = `${year}-${month}-01`;
    const d = new Date(`${first}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); last = dateText(d);
  } else if (mode === 'year') { first = `${year}-01-01`; last = `${year}-12-31`; }
  const valid = sessions.filter(s => validSessionDate(s.date));
  const selected = mode === 'all' ? [...sessions] : valid.filter(s => s.date >= first && s.date <= last);
  const daily = mode === 'week' || mode === 'month';
  const days: Period[] = [];
  if (daily) {
    const groups = new Map<string, RunningSession[]>();
    for (const session of selected) { const group = groups.get(session.date) ?? []; group.push(session); groups.set(session.date, group); }
    for (const d = new Date(`${first}T00:00:00Z`); dateText(d) <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = dateText(d); days.push({ key, label: key.split('-').reverse().join('/'), totals: totals(groups.get(key) ?? []) });
    }
  }
  const grouped = daily ? undefined : statistics(selected, mode === 'year' ? year : 'all');
  const label = mode === 'all' ? 'Tout l’historique' : `${mode === 'week' ? '7 derniers jours' : mode === 'month' ? 'Mois' : 'Année'} : ${first.split('-').reverse().join('/')} – ${last.split('-').reverse().join('/')}`;
  return { totals: totals(selected), label, daily, excludedDates: sessions.length - valid.length,
    distancePeriods: daily ? days : grouped!.weeks, countPeriods: daily ? days : grouped!.months, ascentPeriods: daily ? days : grouped!.weeks };
}
