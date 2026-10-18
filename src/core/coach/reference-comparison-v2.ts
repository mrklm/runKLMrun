import type { ProposalPolicy } from '../../types/coach-proposal';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { validSessionDate } from '../analysis/session-summary';
import { applyAssociationContributionPolicy } from './simulation/association-policy-v2';
import { habitualReferenceValidityV2,type ReferenceValiditySnapshot } from './simulation/reference-validity-v2';
import type { ReferenceObservation } from './simulation/habitual-reference-v2';
import { proposalEvidence } from './proposals';
import { matchingDate,suggestionAssociations } from './suggestion-matching';
import { suggestionExpiry,validateStoredSuggestion } from './suggestions';

export type ReferenceObservationExclusionReason=
  |'invalid-session'|'future-session'|'ambiguous-association'|'association-unknown'|'invalid-suggestion';
export interface ReferenceObservationExclusion {
  entity:'session'|'suggestion';
  id:string;
  reason:ReferenceObservationExclusionReason;
}
export interface ReferenceObservationAdaptation {
  observations:ReferenceObservation[];
  excluded:ReferenceObservationExclusion[];
}
export interface ReferenceComparisonV2 {
  v1ReferenceSeconds:number|null;
  v2ReferenceSeconds:number|null;
  v2Available:boolean;
  v2Validity:ReferenceValiditySnapshot['validity'];
  divergenceReasons:string[];
  observations:ReferenceObservation[];
  excluded:ReferenceObservationExclusion[];
}

/** Adaptateur conservateur : l'absence d'une ancienne suggestion ne prouve pas
 * l'indépendance, car cette suggestion a pu expirer et être supprimée. */
export function adaptReferenceObservations(
  sessions:readonly RunningSession[],suggestions:readonly StoredSuggestion[],referenceDate:string,
):ReferenceObservationAdaptation {
  if(!validSessionDate(referenceDate)) throw new Error('Date de comparaison V2 invalide.');
  const excluded:ReferenceObservationExclusion[]=[],validSuggestions:StoredSuggestion[]=[];
  for(const suggestion of suggestions) {
    try { validateStoredSuggestion(suggestion);validSuggestions.push(suggestion); }
    catch { excluded.push({entity:'suggestion',id:typeof suggestion.id==='string'?suggestion.id:'inconnu',reason:'invalid-suggestion'}); }
  }
  const associations=suggestionAssociations(validSuggestions,sessions);
  const observations:ReferenceObservation[]=[];
  for(const session of sessions) {
    const date=matchingDate(session);
    if(!date||!Number.isSafeInteger(session.durationSeconds)||session.durationSeconds<=0) {
      excluded.push({entity:'session',id:session.id,reason:'invalid-session'});continue;
    }
    if(date>referenceDate) { excluded.push({entity:'session',id:session.id,reason:'future-session'});continue; }
    const sameDay=validSuggestions.filter(suggestion=>suggestion.date===date);
    const linked=sameDay.find(suggestion=>associations.get(suggestion.id)===session.id);
    if(linked) { observations.push({id:session.id,date,durationSeconds:session.durationSeconds,role:'suggestion-linked'});continue; }
    if(sameDay.length) { excluded.push({entity:'session',id:session.id,reason:'ambiguous-association'});continue; }
    if(suggestionExpiry(date)<=referenceDate) {
      excluded.push({entity:'session',id:session.id,reason:'association-unknown'});continue;
    }
    observations.push({id:session.id,date,durationSeconds:session.durationSeconds,role:'independent-unknown'});
  }
  observations.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  return {observations,excluded};
}

/** Comparaison isolée : le résultat V2 n'entre jamais dans proposeSuggestions. */
export function compareHabitualReferences(input:{sessions:readonly RunningSession[];suggestions:readonly StoredSuggestion[];
  referenceDate:string;policy:ProposalPolicy}):ReferenceComparisonV2 {
  const v1=proposalEvidence(input.sessions,input.referenceDate,input.policy).medianDurationSeconds;
  const adapted=adaptReferenceObservations(input.sessions,input.suggestions,input.referenceDate);
  const bounded=applyAssociationContributionPolicy(adapted.observations,'bounded');
  const v2=habitualReferenceValidityV2(bounded,input.referenceDate);
  const available=v2.referenceSeconds!==null&&(v2.validity==='valid-revisable'||v2.validity==='valid-retained');
  const reasons:string[]=[];
  if(adapted.excluded.some(value=>value.reason==='association-unknown'))
    reasons.push('Des activités anciennes sont écartées car leur absence d’association ne prouve pas leur indépendance.');
  if(adapted.excluded.some(value=>value.reason==='ambiguous-association'))
    reasons.push('Des associations ambiguës sont écartées de la référence V2.');
  if(!available) reasons.push('La référence V2 ne dispose pas de preuves admissibles suffisantes ou actuelles.');
  else if(v1!==v2.referenceSeconds) reasons.push('Les fenêtres et règles de contribution V1 et V2 retiennent des preuves différentes.');
  else reasons.push('Les références V1 et V2 coïncident avec les preuves admissibles actuelles.');
  return {v1ReferenceSeconds:v1,v2ReferenceSeconds:available?v2.referenceSeconds:null,v2Available:available,
    v2Validity:v2.validity,divergenceReasons:reasons,observations:bounded,excluded:adapted.excluded};
}
