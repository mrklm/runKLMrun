import type { RunningSession } from '../../types/session';
import { intervalIntroductionEvidence } from './catalog-integration-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import { habitualReferenceV2 } from './simulation/habitual-reference-v2';
import { FEELING_PREFERENCE_WINDOW_DAYS } from './simulation/session-orchestrator-v2';
import { matchingDate } from './suggestion-matching';

export type CoachV2ProgressionState='maintien'|'progression-possible'|'recuperation';
export interface CoachV2ProgressionEvidence {
  state:CoachV2ProgressionState;
  regularity:ReturnType<typeof intervalIntroductionEvidence>;
  observedDurationProgression:boolean;
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
  const veryHard=activities.some(({session,date})=>session.feeling?.effort==='very-hard'
    &&day(input.referenceDate)-day(date)<FEELING_PREFERENCE_WINDOW_DAYS);
  const observations=new Map<string,{id:string;date:string;durationSeconds:number;role:'independent-unknown'}>();
  for(const {session,date} of activities)if(Number.isSafeInteger(session.durationSeconds)&&session.durationSeconds>0) {
    const value={id:session.id,date,durationSeconds:session.durationSeconds,role:'independent-unknown' as const},previous=observations.get(session.id);
    if(!previous||value.date>=previous.date)observations.set(session.id,value);
  }
  const referenceHistory=habitualReferenceV2([...observations.values()],input.referenceDate);
  const regularity=intervalIntroductionEvidence(input.sessions,input.referenceDate);
  const observedDurationProgression=referenceHistory.revisions.some(value=>value.toSeconds>value.fromSeconds);
  const state:CoachV2ProgressionState=veryHard?'recuperation'
    :input.reference.confidence==='confirmed'&&input.reference.freshness==='current'&&regularity.eligible
      ?'progression-possible':'maintien';
  return {state,regularity,observedDurationProgression};
}
