import type { CoachV2ReadonlyResult } from './application-adapter-v2';
import type { PersistableOccurrenceV2 } from './persistence-foundations-v2';
import type { PrototypeSession } from './simulation/session-strategies-v2';
import { orchestratePrototypeSession,type PresentedSessionEvidence } from './simulation/session-orchestrator-v2';

export interface CoachV2Perspective {
  date:string;
  session:PrototypeSession|PersistableOccurrenceV2['content'];
  indicative:boolean;
}
const progressionCandidate=(session:PrototypeSession|PersistableOccurrenceV2['content'],referenceSeconds:number|null)=>
  session.type==='easy-endurance'&&referenceSeconds!==null&&session.totalDurationSeconds>referenceSeconds
    &&(!('changedDimensions' in session)||session.changedDimensions.includes('duration'));

/** Projection sans écriture, ancrée sur la proposition effectivement retenue.
 * Les catalogues utilisent uniquement les activités réelles et la même référence.
 * Les intentions ne servent qu'à espacer les séances suivantes. */
export function coachV2Perspectives(result:CoachV2ReadonlyResult,retained?:PersistableOccurrenceV2):CoachV2Perspective[] {
  const date=retained?.opportunity.suggestedFor??result.selectedDate;
  const session=retained?.content??result.candidate;
  if(!date||!session)return [];
  const values:CoachV2Perspective[]=[{date,session,indicative:false}];
  const envisaged:PresentedSessionEvidence[]=[{date,type:session.type}];
  let progressionPlanned=progressionCandidate(session,result.reference.referenceSeconds);
  for(const nextDate of Object.keys(result.admissibleSessionsByDate).sort()){
    if(nextDate<=date)continue;
    const candidates=result.admissibleSessionsByDate[nextDate].filter(candidate=>!progressionPlanned
      ||!progressionCandidate(candidate,result.reference.referenceSeconds));
    if(!candidates.length)continue;
    const selected=orchestratePrototypeSession({referenceDate:nextDate,
      goal:retained?.opportunity.goal??result.catalog.adaptedInput!.goal,habitualReferenceSeconds:result.reference.referenceSeconds,
      availabilitySeconds:Math.max(...candidates.map(value=>value.totalDurationSeconds)),
      coachTemperament:result.coachTemperament,candidates,activities:result.activityEvidence,presented:[],envisaged}).selected;
    if(!selected)continue;
    values.push({date:nextDate,session:selected,indicative:true});
    envisaged.push({date:nextDate,type:selected.type});
    progressionPlanned ||= progressionCandidate(selected,result.reference.referenceSeconds);
  }
  return values;
}
