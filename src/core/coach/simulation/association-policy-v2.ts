import type { StoredSuggestion } from '../../../types/coach-suggestion';
import type { RunningSession } from '../../../types/session';
import type { ReferenceObservation } from './habitual-reference-v2';
import { referenceObservationsFromSessions } from './session-role-v2';

export type AssociatedContributionPolicy = 'exclude' | 'bounded' | 'complete';

export function applyAssociationContributionPolicy(
  observations:readonly ReferenceObservation[],policy:AssociatedContributionPolicy,
):ReferenceObservation[] {
  if(policy==='exclude') return observations.map(observation=>({...observation}));
  if(policy==='complete') return observations.map(observation=>observation.role==='suggestion-linked'
    ? {...observation,role:'independent-unknown'} : {...observation});

  const result=observations.map(observation=>({...observation}));
  let previousIndependent=-1,pendingLinked:number[]=[];
  for(let index=0;index<result.length;index++) {
    const role=result[index].role;
    if(role==='suggestion-linked') pendingLinked.push(index);
    if(role==='independent-unknown') {
      if(previousIndependent>=0&&pendingLinked.length) result[pendingLinked[0]].role='independent-unknown';
      previousIndependent=index;pendingLinked=[];
    }
    if(role==='ambiguous') pendingLinked=[];
  }
  return result;
}

/** Adaptateur expérimental de provenance. Il ne déduit aucun type sportif.
 * La politique bornée admet au plus une association entre deux courses
 * indépendantes ; une association isolée ne peut donc déplacer le repère. */
export function observationsForAssociationPolicy(
  sessions: readonly RunningSession[],
  suggestions: readonly StoredSuggestion[],
  policy: AssociatedContributionPolicy,
  recordedOn: Readonly<Record<string, string | undefined>> = {},
): ReferenceObservation[] {
  const observations=referenceObservationsFromSessions(sessions,suggestions,recordedOn)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  return applyAssociationContributionPolicy(observations,policy);
}
