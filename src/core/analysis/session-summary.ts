import type { RunningSession } from '../../types/session';
export interface Measure { value: number | null; known: number; total: number }
export interface Totals { count: number; distance: Measure; duration: Measure; ascent: Measure }
export interface MonthGroup { key: string; label: string; sessions: RunningSession[]; totals: Totals }
export interface YearGroup { year: string; months: MonthGroup[]; totals: Totals }
export interface Period { key: string; label: string; totals: Totals }
const DAY = 86400000;
const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateText = (d: Date) => d.toISOString().slice(0, 10);
export function validSessionDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(value.getTime()) && dateText(value) === date;
}
export function sumMeasure(sessions: readonly RunningSession[], field: 'distanceMeters' | 'durationSeconds' | 'ascentMeters'): Measure {
  let value = 0, known = 0;
  for (const session of sessions) {
    const n = session[field];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) { value += n; known++; }
  }
  return { value: known || sessions.length === 0 ? value : null, known, total: sessions.length };
}
export function totals(sessions: readonly RunningSession[]): Totals {
  return { count: sessions.length, distance: sumMeasure(sessions, 'distanceMeters'), duration: sumMeasure(sessions, 'durationSeconds'), ascent: sumMeasure(sessions, 'ascentMeters') };
}
export function groupHistory(sessions: readonly RunningSession[]): { years: YearGroup[]; undated: RunningSession[] } {
  const groups = new Map<string, RunningSession[]>(), undated: RunningSession[] = [];
  for (const session of sessions) {
    if (!validSessionDate(session.date)) { undated.push(session); continue; }
    const key = session.date.slice(0, 7);
    const group = groups.get(key) ?? []; group.push(session); groups.set(key, group);
  }
  const years = new Map<string, MonthGroup[]>();
  for (const key of [...groups.keys()].sort().reverse()) {
    const entries = groups.get(key)!.sort((a, b) => (b.startTime ?? b.date).localeCompare(a.startTime ?? a.date));
    const month = { key, label: monthNames[Number(key.slice(5)) - 1], sessions: entries, totals: totals(entries) };
    const year = key.slice(0, 4), months = years.get(year) ?? []; months.push(month); years.set(year, months);
  }
  return { years: [...years].map(([year, months]) => ({ year, months, totals: totals(months.flatMap(m => m.sessions)) })), undated };
}
/** Calcul UTC sur la date civile source : aucun décalage de fuseau du navigateur. */
export function isoWeek(date: string): { key: string; monday: string } {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const monday = dateText(d);
  const thursday = new Date(d.getTime() + 3 * DAY), isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(`${String(isoYear).padStart(4, '0')}-01-04T00:00:00Z`);
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const week = Math.round((d.getTime() - jan4.getTime()) / (7 * DAY)) + 1;
  return { key: `${isoYear}-S${String(week).padStart(2, '0')}`, monday };
}
export function statistics(sessions: readonly RunningSession[], year = 'all') {
  const valid = sessions.filter(s => validSessionDate(s.date));
  const selected = valid.filter(s => year === 'all' || s.date.slice(0, 4) === year);
  const weekly = new Map<string, RunningSession[]>(), monthly = new Map<string, RunningSession[]>();
  for (const session of selected) {
    const week = isoWeek(session.date).monday, month = session.date.slice(0, 7);
    const w = weekly.get(week) ?? []; w.push(session); weekly.set(week, w);
    const m = monthly.get(month) ?? []; m.push(session); monthly.set(month, m);
  }
  const weeks: Period[] = [], months: Period[] = [];
  if (selected.length) {
    const dates = selected.map(s => s.date).sort();
    const first = year === 'all' ? dates[0] : `${year}-01-01`;
    const last = year === 'all' ? dates[dates.length - 1] : `${year}-12-31`;
    const end = new Date(`${last}T00:00:00Z`).getTime();
    for (let t = new Date(`${isoWeek(first).monday}T00:00:00Z`).getTime(); t <= end; t += 7 * DAY) {
      const monday = dateText(new Date(t)), week = isoWeek(monday);
      weeks.push({ key: monday, label: `${week.key} · ${monday} – ${dateText(new Date(t + 6 * DAY))}`, totals: totals(weekly.get(monday) ?? []) });
    }
    const cursor = new Date(`${first.slice(0, 7)}-01T00:00:00Z`);
    while (cursor.getTime() <= end) {
      const key = dateText(cursor).slice(0, 7);
      months.push({ key, label: `${monthNames[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`, totals: totals(monthly.get(key) ?? []) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return { totals: totals(selected), weeks, months, excludedDates: sessions.length - valid.length };
}
export const formatNumber = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
export function formatMeasure(measure: Measure, divisor = 1): string { return measure.value === null ? '—' : formatNumber(measure.value / divisor); }
export function coverage(measure: Measure): string {
  return measure.known < measure.total ? `Données disponibles : ${measure.known}/${measure.total} séances` : 'Toutes les séances renseignées';
}
