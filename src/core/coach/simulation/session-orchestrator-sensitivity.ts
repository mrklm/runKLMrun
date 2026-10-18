import type { CoachTemperament } from '../../../types/evolving-coach';
import {
  orchestratePrototypeSession,
  type PresentedSessionEvidence,
  type RecordedActivityEvidence,
  type SessionOrchestratorPolicy,
} from './session-orchestrator-v2';
import type { PrototypeGoal,PrototypeSession } from './session-strategies-v2';

export interface TemporalConsultation {
  date:string;
  availabilitySeconds:number;
}
export interface TemporalPresentation extends PresentedSessionEvidence { session:PrototypeSession }
export interface TemporalSensitivityInput {
  coachTemperament?:CoachTemperament;
  goal:PrototypeGoal;
  habitualReferenceSeconds:number|null;
  candidates:readonly PrototypeSession[];
  consultations:readonly TemporalConsultation[];
  activities?:readonly RecordedActivityEvidence[];
  /** Indices des présentations que le scénario déclare explicitement réalisées le lendemain. */
  realizedPresentationIndexes?:readonly number[];
  policy:SessionOrchestratorPolicy;
}
export interface TemporalSensitivityResult {
  presentations:TemporalPresentation[];
  activities:RecordedActivityEvidence[];
  zeroSuggestionCount:number;
}

const DAY=86400000;
const nextDay=(date:string)=>new Date(Date.parse(`${date}T00:00:00Z`)+DAY).toISOString().slice(0,10);

/** Banc temporel isolé. Une présentation ne devient une activité que si le
 * scénario la marque explicitement comme réalisée. */
export function simulateTemporalOrchestration(input:TemporalSensitivityInput):TemporalSensitivityResult {
  const presented:PresentedSessionEvidence[]=[],presentations:TemporalPresentation[]=[];
  const activities:RecordedActivityEvidence[]=[...(input.activities??[])];
  let zeroSuggestionCount=0;
  for(const consultation of input.consultations) {
    const result=orchestratePrototypeSession({referenceDate:consultation.date,goal:input.goal,
      habitualReferenceSeconds:input.habitualReferenceSeconds,availabilitySeconds:consultation.availabilitySeconds,
      coachTemperament:input.coachTemperament,candidates:input.candidates,activities,presented,policy:input.policy});
    if(!result.selected) { zeroSuggestionCount++;continue; }
    const presentation={date:consultation.date,type:result.selected.type,session:result.selected};
    const index=presentations.length;
    presentations.push(presentation);presented.push({date:presentation.date,type:presentation.type});
    if(input.realizedPresentationIndexes?.includes(index))
      activities.push({date:nextDay(presentation.date),documentedType:presentation.type});
  }
  return {presentations,activities,zeroSuggestionCount};
}
