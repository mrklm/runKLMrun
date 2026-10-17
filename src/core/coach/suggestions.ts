import { validSessionDate } from '../analysis/session-summary';
import type { PresentedSuggestion, StoredSuggestion, SuggestionFollowUp } from '../../types/coach-suggestion';
export const SUGGESTION_RETENTION_DAYS = 7;
const fail = (): never => { throw new Error('Suggestion conservée invalide.'); };
function fields(v: unknown, allowed: string): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !allowed.split(' ').includes(k))) fail();
}
function content(v: Record<string, unknown>) {
  if (typeof v.date !== 'string' || !validSessionDate(v.date) || !['discovery','easy','endurance'].includes(v.kind as string)
    || !Number.isSafeInteger(v.durationSeconds) || (v.durationSeconds as number) <= 0 || (v.durationSeconds as number) > 86400) fail();
  if (v.terrain !== undefined) {
    fields(v.terrain, 'surface relief');
    if (!['road','trail','treadmill','none'].includes(v.terrain.surface as string) || !['flat-or-gentle','free'].includes(v.terrain.relief as string)) fail();
  }
}
export function validatePresentedSuggestion(v: unknown): asserts v is PresentedSuggestion {
  fields(v, 'date kind durationSeconds terrain'); content(v);
}
/** Pas de timestamp ni de raison variable dans l’identité. Énumérations sans séparateur. */
export function suggestionId(v: PresentedSuggestion): string {
  return `suggestion:v1:${v.date}:${v.kind}:${v.durationSeconds}:${v.terrain?.surface ?? '-'}:${v.terrain?.relief ?? '-'}`;
}
export function suggestionExpiry(date: string): string {
  if (!validSessionDate(date)) fail();
  const result = new Date(Date.parse(`${date}T00:00:00Z`) + (SUGGESTION_RETENTION_DAYS + 1) * 86400000).toISOString().slice(0,10);
  if (!validSessionDate(result)) fail();
  return result;
}
const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export function validateStoredSuggestion(v: unknown): asserts v is StoredSuggestion {
  fields(v, 'id date kind durationSeconds terrain createdAt updatedAt revision expiresOn state activityId'); content(v);
  if (v.id !== suggestionId(v as unknown as PresentedSuggestion) || v.expiresOn !== suggestionExpiry(v.date as string)
    || !timestamp(v.createdAt) || !timestamp(v.updatedAt) || v.updatedAt < v.createdAt
    || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1 || !['current','superseded'].includes(v.state as string)
    || (v.activityId !== undefined && (typeof v.activityId !== 'string' || !v.activityId.trim() || v.activityId.length > 4096 || /[\u0000-\u001f]/.test(v.activityId)))) fail();
}
/** Purement descriptif : aucune activité n’est rapprochée automatiquement. */
export function suggestionFollowUp(v: StoredSuggestion, today: string): SuggestionFollowUp {
  validateStoredSuggestion(v); if (!validSessionDate(today)) fail();
  if (today >= v.expiresOn) return 'expired';
  if (v.activityId !== undefined) return 'associated';
  if (v.state === 'superseded') return 'superseded';
  return v.date < today ? 'past-unmatched' : 'current';
}

/** Préparation 5C : n’appeler qu’avec l’ensemble effectivement présenté, jamais
 * avec chaque carte isolée. Ne modifie aucun enregistrement. Le planning reste
 * à exclure par l’appelant, comme dans le chemin de présentation unique. */
export function replacementCandidates(records: readonly StoredSuggestion[], presented: readonly PresentedSuggestion[], today: string): StoredSuggestion[] {
  if (!validSessionDate(today)) fail();
  presented.forEach(validatePresentedSuggestion);
  const identities = new Set(presented.map(suggestionId));
  if (!identities.size) return [];
  return records.filter(record => {
    validateStoredSuggestion(record);
    return !identities.has(record.id) && record.state === 'current' && !record.activityId && record.date >= today && record.expiresOn > today;
  });
}
