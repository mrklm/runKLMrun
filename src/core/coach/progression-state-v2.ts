import type { RunningSession } from '../../types/session';
import { intervalIntroductionEvidence } from './catalog-integration-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import { habitualReferenceV2 } from './simulation/habitual-reference-v2';
import { evaluateRecoveryV2 } from './recovery-policy-v2';
import { matchingDate } from './suggestion-matching';
import { feelingEffortCategory } from '../analysis/session-feeling';

export type CoachV2ProgressionState='maintien'|'progression-possible'|'recuperation';
export type CoachV2RecentTolerance='favorable-documentee'|'insuffisamment-documentee'|'defavorable-documentee';
export interface CoachV2ProgressionEvidence {
  state:CoachV2ProgressionState;
  regularity:ReturnType<typeof intervalIntroductionEvidence>;
  observedDurationProgression:boolean;
  tolerance:CoachV2RecentTolerance;
}

const DAY=86_400_000;
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/DAY;

/** État purement factuel : activités réelles et référence déjà calculée, sans
 * proposer ni mémoriser de séance. */
export function coachV2ProgressionState(input:{sessions:readonly RunningSession[];reference:ReferenceBootstrapResult;referenceDate:string}):CoachV2ProgressionEvidence {
  const activities=input.sessions.flatMap(session=>{
    const date=matchingDate(session);
    return date!==undefined&&date<=input.referenceDate?[{session,date}]:[];
  });
  const recovery=evaluateRecoveryV2({referenceDate:input.referenceDate,activities:activities.map(({session,date})=>({
    id:session.id,date,documentedType:session.trainingType,effort:feelingEffortCategory(session.feeling)}))});
  const veryHard=recovery.protections.some(value=>value.code==='very-hard-protection');
  const observations=new Map<string,{id:string;date:string;durationSeconds:number;role:'independent-unknown'}>();
  for(const {session,date} of activities)if(Number.isSafeInteger(session.durationSeconds)&&session.durationSeconds>0) {
    const value={id:session.id,date,durationSeconds:session.durationSeconds,role:'independent-unknown' as const},previous=observations.get(session.id);
    if(!previous||value.date>=previous.date)observations.set(session.id,value);
  }
  const referenceHistory=habitualReferenceV2([...observations.values()],input.referenceDate);
  const regularity=intervalIntroductionEvidence(input.sessions,input.referenceDate);
  const recentFeelings=activities.filter(({date})=>day(input.referenceDate)-day(date)<28);
  const unfavorable=recovery.preference.status==='prefer-easy';
  const favorableWeeks=new Set(recentFeelings.flatMap(({session,date})=>['easy','moderate'].includes(feelingEffortCategory(session.feeling)??'')
    ?[Math.floor((day(input.referenceDate)-day(date))/7)]:[]));
  // La régularité existante et deux semaines distinctes empêchent qu’un seul
  // ressenti favorable soit interprété comme une tolérance démontrée.
  const tolerance:CoachV2RecentTolerance=unfavorable?'defavorable-documentee'
    :regularity.eligible&&favorableWeeks.size>=2?'favorable-documentee':'insuffisamment-documentee';
  const observedDurationProgression=referenceHistory.revisions.some(value=>value.toSeconds>value.fromSeconds);
  const state:CoachV2ProgressionState=veryHard?'recuperation'
    :input.reference.confidence==='confirmed'&&input.reference.freshness==='current'&&regularity.eligible&&tolerance==='favorable-documentee'
      ?'progression-possible':'maintien';
  return {state,regularity,observedDurationProgression,tolerance};
}
