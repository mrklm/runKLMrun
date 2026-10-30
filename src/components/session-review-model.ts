import type { RunningSession, DocumentedActivityType } from '../types/session';
import { isDocumentedActivityType } from '../types/session';
import type { PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import type { RealizationResult } from '../core/analysis/session-review';
import { feelingFromFields, sameFeeling } from '../core/analysis/session-feeling';
import type { SessionReviewPatch, SessionReviewSnapshot } from '../storage/session-review';
import type { AssociationInspectionV2 } from '../storage/coach-suggestions-v2';
import { matchingDate } from '../core/coach/suggestion-matching';

export interface ReviewCandidate { occurrence: PersistableOccurrenceV2; inspection: AssociationInspectionV2 }
export interface ReviewDraft {
  effort: string; comment: string;
  trainingType: DocumentedActivityType | '' | 'other';
  description: string;
  result: RealizationResult | '';
  associateOnly: boolean;
}
export function reviewDraft(session: RunningSession, occurrence?: PersistableOccurrenceV2): ReviewDraft {
  return { effort: session.feeling?.effort ?? '', comment: session.feeling?.comment ?? '',
    trainingType: session.trainingType ?? (session.trainingDescription ? 'other' : ''), description: session.trainingDescription ?? '',
    result: occurrence?.realization?.result ?? '', associateOnly: false };
}
export function relevantReviewOccurrence(occurrence: PersistableOccurrenceV2, session: RunningSession): boolean {
  if (occurrence.state === 'obsolete') return occurrence.associationInvalidation?.activityId === session.id
    || occurrence.realization !== undefined && occurrence.opportunity.suggestedFor === matchingDate(session);
  return occurrence.opportunity.suggestedFor === matchingDate(session);
}
export function availableReviewCandidate(candidate: ReviewCandidate, sessionId: string): boolean {
  return (candidate.inspection.status !== 'associated' && candidate.inspection.status !== 'invalid-association')
    || candidate.inspection.activityId === sessionId;
}
/** Seuls les champs modifiés sont envoyés. Changer de recommandation ne touche pas au type réel. */
export function reviewPatch(snapshot: SessionReviewSnapshot, draft: ReviewDraft): SessionReviewPatch {
  const patch: SessionReviewPatch = {}, session = snapshot.session;
  const feeling = feelingFromFields(draft.effort, draft.comment);
  if (!sameFeeling(feeling, session.feeling)) patch.feeling = feeling ?? null;
  const type = draft.trainingType === '' || draft.trainingType === 'other' ? undefined : draft.trainingType;
  if (type !== undefined && !isDocumentedActivityType(type)) throw new Error('Type d’entraînement invalide.');
  if (type !== session.trainingType) patch.trainingType = type ?? null;
  const description = draft.description.trim() ? draft.description : undefined;
  if (description !== session.trainingDescription) patch.trainingDescription = description ?? null;
  if (draft.result !== (snapshot.occurrence?.realization?.result ?? '')) {
    patch.realization = draft.result ? { result: draft.result, proposalOrigin: 'manual', confirmedBy: 'user' } : null;
  }
  if (draft.associateOnly && !draft.result) patch.association = 'associate';
  return patch;
}
