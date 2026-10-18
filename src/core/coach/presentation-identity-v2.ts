import type { CoachProfileValues,Weekday } from '../../types/coach-profile';
import type { CoachV2ReadonlyResult } from './application-adapter-v2';
import { civilDate,selectCandidateV2,type CandidateV2,type PersistableOccurrenceV2,type SelectedSuggestionV2,
  type TemporalAnchorV2,type WeekdayV2 } from './persistence-foundations-v2';
import { validSessionDate } from '../analysis/session-summary';

const DAY=86400000;
const WEEKDAYS:readonly Weekday[]=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const weekday=(date:string)=>WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
const distance=(from:string,to:string)=>(Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/DAY;
const anchorKey=(value:TemporalAnchorV2)=>value.kind==='bootstrap'?`${value.kind}:${value.referenceDate}`:`${value.kind}:${value.id}:${value.date}`;
const capFor=(availability:CoachProfileValues['availability']|null,date:string):number|null=>{
  const day=weekday(date);if(!availability?.days?.includes(day)||availability.sessionsPerWeek===0)return null;
  const minutes=availability.durationMode==='custom'?availability.maxMinutesByDay?.[day]:availability.minutesPerSession;
  return Number.isInteger(minutes)&&minutes!>0?minutes!*60:null;
};

/** Une occurrence active compatible prime sur tout nouveau calcul. */
export function reusableActiveOccurrenceV2(occurrences:readonly PersistableOccurrenceV2[],result:CoachV2ReadonlyResult,
  referenceDate:string):PersistableOccurrenceV2|undefined {
  if(!validSessionDate(referenceDate))throw new Error('Date de référence V2 invalide.');
  const goal=result.catalog.adaptedInput?.goal??result.declarations.goal?.kind;
  return occurrences.filter(value=>value.state==='active'&&value.opportunity.goal===goal
      &&distance(referenceDate,value.opportunity.suggestedFor)>=0&&distance(referenceDate,value.opportunity.suggestedFor)<7
      &&value.opportunity.availability.weekday===weekday(value.opportunity.suggestedFor)
      &&capFor(result.declarations.availability,value.opportunity.suggestedFor)!==null
      &&value.content.totalDurationSeconds<=capFor(result.declarations.availability,value.opportunity.suggestedFor)!
      &&result.admissibleSessionsByDate[value.opportunity.suggestedFor]?.some(candidate=>
        candidate.type===value.content.type&&candidate.intensity===value.content.intensity&&candidate.terrain===value.content.terrain
        &&value.content.totalDurationSeconds<=candidate.totalDurationSeconds))
    .sort((a,b)=>a.opportunity.suggestedFor.localeCompare(b.opportunity.suggestedFor)||a.id.localeCompare(b.id))[0];
}

function sameOccasion(left:PersistableOccurrenceV2,result:CoachV2ReadonlyResult):boolean {
  return !!result.temporalAnchor&&left.opportunity.goal===(result.catalog.adaptedInput?.goal??result.declarations.goal?.kind)
    &&left.opportunity.suggestedFor===result.selectedDate&&anchorKey(left.opportunity.anchor)===anchorKey(result.temporalAnchor)
    &&left.opportunity.availability.weekday===weekday(result.selectedDate!)
    &&left.opportunity.availability.maximumSeconds===result.dailyMaximumSeconds;
}

export function nextGenerationV2(occurrences:readonly PersistableOccurrenceV2[],result:CoachV2ReadonlyResult):number {
  return Math.max(0,...occurrences.filter(value=>sameOccasion(value,result)).map(value=>value.opportunity.generation))+1;
}

/** Transforme une sélection applicative complète en sélection persistable, sans écrire. */
export function selectedApplicationSuggestionV2(result:CoachV2ReadonlyResult,generation:number):SelectedSuggestionV2 {
  if(!result.candidate||!result.selectedDate||!result.temporalAnchor||!result.dailyMaximumSeconds||!result.catalog.adaptedInput)
    throw new Error('Sélection V2 incomplète : aucune présentation ne peut être créée.');
  const session=result.candidate;
  const candidate:CandidateV2={phase:'candidate',content:{type:session.type,totalDurationSeconds:session.totalDurationSeconds,
    intensity:session.intensity,terrain:session.terrain,shortSummary:session.shortSummary,
    ...(session.optionalInstructions?.length?{optionalInstructions:[...session.optionalInstructions]}:{}),
    ...(session.structure?{structure:structuredClone(session.structure)}:{})},opportunity:{contractVersion:1,
    goal:result.catalog.adaptedInput.goal,suggestedFor:civilDate(result.selectedDate),anchor:structuredClone(result.temporalAnchor),
    availability:{weekday:weekday(result.selectedDate) as WeekdayV2,maximumSeconds:result.dailyMaximumSeconds},generation}};
  return selectCandidateV2(candidate);
}
