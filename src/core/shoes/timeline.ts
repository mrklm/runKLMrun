import type { Shoe, ShoeAssignment } from '../../types/shoe';
import type { RunningSession } from '../../types/session';
import { validSessionDate } from '../analysis/session-summary';
const DAY = 86400000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export function shoeTimeline(shoes: readonly Shoe[], sessions: readonly RunningSession[], today: string) {
  const issues: string[] = [];
  const dates = new Set<string>();
  for (const shoe of shoes) {
    if (!shoe.firstUseDate || !validSessionDate(shoe.firstUseDate)) issues.push(`${shoe.name} : renseignez une date de première utilisation valide.`);
    else if (dates.has(shoe.firstUseDate)) issues.push(`Plusieurs paires commencent le ${shoe.firstUseDate.split('-').reverse().join('/')}. Corrigez leurs dates.`);
    else dates.add(shoe.firstUseDate);
  }
  if (!validSessionDate(today)) issues.push('La date de référence est invalide.');
  const sorted = shoes.filter(s => s.firstUseDate && validSessionDate(s.firstUseDate)).slice().sort((a, b) => a.firstUseDate!.localeCompare(b.firstUseDate!));
  const current = issues.length ? undefined : sorted.filter(s => s.firstUseDate! <= today).at(-1)?.id;
  const periods = sorted.map((shoe, index) => ({ shoe, start: shoe.firstUseDate!, end: sorted[index + 1] ? iso(Date.parse(`${sorted[index + 1].firstUseDate}T00:00:00Z`) - DAY) : undefined, current: shoe.id === current, future: shoe.firstUseDate! > today }));
  const assignments: ShoeAssignment[] = [], seen = new Set<string>();
  let invalidDates = 0;
  if (!issues.length) for (const session of sessions) {
    if (seen.has(session.id)) continue; seen.add(session.id);
    if (!validSessionDate(session.date)) { invalidDates++; continue; }
    if (session.date > today) continue;
    const period = periods.find(p => session.date >= p.start && (!p.end || session.date <= p.end));
    if (period) assignments.push({ sessionId: session.id, shoeId: period.shoe.id });
  }
  return { assignments, periods, current, issues, invalidDates };
}
/** Durée calendaire inclusive, la fin déduite est la veille du début suivant. */
export function usageDuration(start: string, end: string): string {
  if (!validSessionDate(start) || !validSessionDate(end) || end < start) return '—';
  const from = new Date(`${start}T00:00:00Z`), until = new Date(Date.parse(`${end}T00:00:00Z`) + DAY);
  let months = (until.getUTCFullYear() - from.getUTCFullYear()) * 12 + until.getUTCMonth() - from.getUTCMonth();
  const anchor = (count: number) => {
    const first = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + count, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(from.getUTCDate(), lastDay));
  };
  if (anchor(months) > until.getTime()) months--;
  const days = Math.round((until.getTime() - anchor(months)) / DAY);
  return `${months} mois et ${days} jour(s)`;
}
