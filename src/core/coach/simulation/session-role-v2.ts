import type { StoredSuggestion } from '../../../types/coach-suggestion';
import type { RunningSession } from '../../../types/session';
import { matchingDate, suggestionAssociations } from '../suggestion-matching';
import type { ReferenceObservation } from './habitual-reference-v2';

export type SessionRoleClassification =
  | 'reliable-suggestion-match'
  | 'independent-unknown'
  | 'ambiguous'
  | 'invalid';

export interface ClassifiedSessionRole {
  sessionId: string;
  classification: SessionRoleClassification;
  timing: 'same-day' | 'late' | 'unknown';
  suggestedKind?: StoredSuggestion['kind'];
  usableForHabitualReference: boolean;
}

/** Classification factuelle du prototype : une association ne transfère jamais
 * le type de la suggestion à la course. Une course indépendante peut documenter
 * la pratique observée, sans être qualifiée de facile, longue ou soutenue. */
export function classifySessionRoles(
  sessions: readonly RunningSession[],
  suggestions: readonly StoredSuggestion[],
  recordedOn: Readonly<Record<string, string | undefined>> = {},
): ClassifiedSessionRole[] {
  const associations = suggestionAssociations(suggestions, sessions);
  return sessions.map(session => {
    const date = matchingDate(session);
    const timing = !date || !recordedOn[session.id] ? 'unknown'
      : recordedOn[session.id]! > date ? 'late' : 'same-day';
    if (!date || !Number.isSafeInteger(session.durationSeconds) || session.durationSeconds <= 0)
      return {sessionId:session.id,classification:'invalid',timing,usableForHabitualReference:false};
    const sameDay = suggestions.filter(suggestion => suggestion.date === date);
    const linked = sameDay.find(suggestion => associations.get(suggestion.id) === session.id);
    if (linked) return {sessionId:session.id,classification:'reliable-suggestion-match',timing,
      suggestedKind:linked.kind,usableForHabitualReference:false};
    if (sameDay.length === 0) return {sessionId:session.id,classification:'independent-unknown',timing,
      usableForHabitualReference:true};
    return {sessionId:session.id,classification:'ambiguous',timing,usableForHabitualReference:false};
  });
}

export function referenceObservationsFromSessions(
  sessions: readonly RunningSession[],
  suggestions: readonly StoredSuggestion[],
  recordedOn: Readonly<Record<string, string | undefined>> = {},
): ReferenceObservation[] {
  const classifications = new Map(classifySessionRoles(sessions,suggestions,recordedOn).map(value=>[value.sessionId,value]));
  return sessions.flatMap(session => {
    const classification=classifications.get(session.id)?.classification;
    if (classification==='invalid') return [];
    const role:ReferenceObservation['role']=classification==='independent-unknown' ? 'independent-unknown'
      : classification==='reliable-suggestion-match' ? 'suggestion-linked' : 'ambiguous';
    return [{id:session.id,date:session.date,durationSeconds:session.durationSeconds,role}];
  });
}
