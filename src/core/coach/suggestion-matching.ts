import type { RunningSession } from '../../types/session';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import { RUNNING_SPORTS } from '../../importers/polar-sports';
import { validSessionDate } from '../analysis/session-summary';

/** Date civile source, comme l’historique : aucune conversion de fuseau.
 * Les anciens résumés et la saisie via save peuvent ne pas avoir de sport ;
 * le magasin sessions est historiquement réservé aux courses. */
export function matchingDate(session: RunningSession): string | undefined {
  if (!session.id || !validSessionDate(session.date)
    || (session.sport !== undefined && !RUNNING_SPORTS.includes(session.sport))) return;
  if (session.startTime !== undefined && (!Number.isFinite(Date.parse(session.startTime))
    || session.startTime.slice(0, 10) !== session.date)) return;
  return session.date;
}

/** Décision factuelle, sans durée/distance/intensité. Inclut les anciennes
 * identités remplacées dans l’ambiguïté ; ne les associe pas nouvellement.
 * Les liens devenus ambigus ou orphelins sont retirés. Entrées inchangées. */
export function suggestionAssociations(suggestions: readonly StoredSuggestion[], sessions: readonly RunningSession[]): Map<string, string | undefined> {
  const days = new Map<string, StoredSuggestion[]>(), runs = new Map<string, RunningSession[]>();
  const claims = new Map<string, number>();
  for (const suggestion of suggestions) {
    const group = days.get(suggestion.date) ?? []; group.push(suggestion); days.set(suggestion.date, group);
    if (suggestion.activityId) claims.set(suggestion.activityId, (claims.get(suggestion.activityId) ?? 0) + 1);
  }
  for (const session of sessions) {
    const date = matchingDate(session);
    if (date) { const group = runs.get(date) ?? []; group.push(session); runs.set(date, group); }
  }
  const result = new Map<string, string | undefined>();
  for (const suggestion of suggestions) {
    const candidates = runs.get(suggestion.date) ?? [];
    const activity = candidates.length === 1 ? candidates[0] : undefined;
    // Une revendication contradictoire est d’abord retirée, jamais arbitrée.
    const owners = activity ? suggestions.filter(s => s.activityId === activity.id) : [];
    const compatible = activity && days.get(suggestion.date)?.length === 1
      && (claims.get(activity.id) ?? 0) <= 1 && owners.every(s => s.id === suggestion.id)
      && (suggestion.state === 'current' || suggestion.activityId === activity.id);
    result.set(suggestion.id, compatible ? activity.id : undefined);
  }
  return result;
}
