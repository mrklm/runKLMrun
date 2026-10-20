import { localCoachV2Reference } from '../core/coach/local-reference-v2';
import { coachV2Perspectives, type CoachV2Perspective } from '../core/coach/perspectives-v2';
import { reusableActiveOccurrenceV2 } from '../core/coach/presentation-identity-v2';
import type { CoachV2ReadonlyResult } from '../core/coach/application-adapter-v2';
import type { PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import { calculateCoachV2Readonly } from '../storage/coach-v2-readonly';
import { createSuggestionV2Repository } from '../storage/coach-suggestions-v2';

export interface CoachV2Projection {
  result: CoachV2ReadonlyResult;
  occurrence?: PersistableOccurrenceV2;
  perspectives: CoachV2Perspective[];
}

/** Projection commune, strictement en lecture seule : aucune présentation ni occurrence n’est créée. */
export async function readCoachV2Projection(): Promise<CoachV2Projection> {
  const reference = localCoachV2Reference();
  const result = await calculateCoachV2Readonly(reference);
  const occurrence = reusableActiveOccurrenceV2(await createSuggestionV2Repository().listAll(), result, reference.date);
  return { result, occurrence, perspectives: coachV2Perspectives(result, occurrence) };
}
