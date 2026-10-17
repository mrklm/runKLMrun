import type { StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { suggestionFollowUp } from './suggestions';
import { suggestionAssociations } from './suggestion-matching';

/** Affichage uniquement : ni mutation ni nouvelle interprétation du rapprochement. */
export function pastSuggestionInformation(records: readonly StoredSuggestion[], sessions: readonly RunningSession[], today: string): StoredSuggestion[] {
  const expected = suggestionAssociations(records, sessions);
  if (records.some(s => s.activityId !== expected.get(s.id))) return [];
  return records.filter(s => suggestionFollowUp(s, today) === 'past-unmatched'
    && records.filter(other => other.date === s.date).length === 1
    // Même une activité inutilisable pour le rapprochement rend l’absence incertaine.
    && !sessions.some(activity => activity.date === s.date || activity.startTime?.slice(0, 10) === s.date))
    .sort((a, b) => b.date.localeCompare(a.date));
}
