import type { RunningSession } from '../../types/session';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import { validSessionDate } from './session-summary';

/** UTC sert uniquement à l’arithmétique des dates civiles, jamais à convertir les activités. */
export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function monthDays(month: string): Array<string | null> {
  if (!validSessionDate(`${month}-01`)) return [];
  const first = new Date(`${month}-01T00:00:00Z`);
  const days: Array<string | null> = Array((first.getUTCDay() + 6) % 7).fill(null);
  const next = shiftMonth(month, 1);
  for (let day = 1; day <= 31; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (!validSessionDate(date) || date >= `${next}-01`) break;
    days.push(date);
  }
  while (days.length % 7) days.push(null);
  return days;
}
export function calendarEvents(sessions: readonly RunningSession[], suggestions: readonly StoredSuggestion[], today: string) {
  const activities = new Map<string, RunningSession[]>();
  const future = new Map<string, StoredSuggestion[]>();
  for (const session of sessions) if (validSessionDate(session.date)) {
    const group = activities.get(session.date) ?? [];
    group.push(session); activities.set(session.date, group);
  }
  for (const group of activities.values()) group.sort((a, b) => (a.startTime ?? a.date).localeCompare(b.startTime ?? b.date) || a.id.localeCompare(b.id));
  for (const suggestion of suggestions) if (validSessionDate(suggestion.date) && suggestion.date >= today && suggestion.expiresOn > today && suggestion.state === 'current' && !suggestion.activityId) {
    const group = future.get(suggestion.date) ?? [];
    group.push(suggestion); future.set(suggestion.date, group);
  }
  return { activities, future };
}
