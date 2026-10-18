import type { CoachProfileValues } from '../../types/coach-profile';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
import type { ProposalPolicy } from '../../types/coach-proposal';
import { matchingDate } from './suggestion-matching';
import { bootstrapHabitualReference,type ReferenceBootstrapResult } from './reference-bootstrap-v2';
import { selectPrototypeSessions,validatePrototypeSession,type PrototypeSession,type PrototypeSessionType,type SessionStrategyInput } from './simulation/session-strategies-v2';

export interface ExperimentalCatalogV2Result {
  mode:'v2-experimental';
  reference:ReferenceBootstrapResult;
  sessions:PrototypeSession[];
  reasons:string[];
  adaptedInput?:SessionStrategyInput;
}
export interface CatalogFromReferenceV2Input {
  sessions:readonly RunningSession[];reference:ReferenceBootstrapResult;configuration?:EvolvingCoachValues|null;
  referenceDate:string;
  historicalProfile?:CoachProfileValues;documentedActivityTypes?:Readonly<Record<string,PrototypeSessionType|undefined>>;
}
export const INTERVAL_INTRODUCTION_EXPERIMENT=Object.freeze({windowDays:28,minimumActivities:6,minimumActiveWeeks:3,minimumSpanDays:14});
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/86400000;
export function intervalIntroductionEvidence(sessions:readonly RunningSession[],referenceDate:string) {
  const end=day(referenceDate),dates=sessions.flatMap(session=>{const value=matchingDate(session),position=value?day(value):NaN;
    return value&&position<=end&&end-position<INTERVAL_INTRODUCTION_EXPERIMENT.windowDays?[value]:[];}).sort();
  const weeks=new Set(dates.map(value=>Math.floor((end-day(value))/7)));
  const spanDays=dates.length>1?day(dates.at(-1)!)-day(dates[0]):0;
  return {activityCount:dates.length,activeWeeks:weeks.size,spanDays,
    eligible:dates.length>=INTERVAL_INTRODUCTION_EXPERIMENT.minimumActivities&&weeks.size>=INTERVAL_INTRODUCTION_EXPERIMENT.minimumActiveWeeks
      &&spanDays>=INTERVAL_INTRODUCTION_EXPERIMENT.minimumSpanDays};
}

function availableSeconds(profile:CoachProfileValues|undefined):number|null {
  const availability=profile?.availability;
  if(!availability?.days?.length)return null;
  if(availability.durationMode==='custom') {
    const values=availability.days.flatMap(day=>{
      const value=availability.maxMinutesByDay?.[day];return value!==undefined&&Number.isFinite(value)&&value>0?[value]:[];
    });
    return values.length?Math.floor(Math.min(...values)*60):null;
  }
  return availability.minutesPerSession!==undefined&&Number.isFinite(availability.minutesPerSession)
    &&availability.minutesPerSession>0?Math.floor(availability.minutesPerSession*60):null;
}
function experience(value:EvolvingCoachValues['experience']):SessionStrategyInput['experience'] {
  return value==='beginner'?'beginner':value==='intermediate'?'regular':value==='experienced'?'experienced':undefined;
}
function maximumDocumentedDistance(sessions:readonly RunningSession[]):number|undefined {
  const values=sessions.flatMap(session=>typeof session.distanceMeters==='number'&&Number.isFinite(session.distanceMeters)
    &&session.distanceMeters>0?[session.distanceMeters]:[]);
  return values.length?Math.max(...values):undefined;
}

/** Sortie expérimentale en mémoire uniquement. Aucun objet V1 ou persistant
 * n'est créé et aucun type de séance n'est déduit des imports. */
export function proposeExperimentalCatalogFromReferenceV2(input:CatalogFromReferenceV2Input):ExperimentalCatalogV2Result {
  const reference=input.reference;
  const reasons=[...reference.reasons];
  if(!input.configuration)return {mode:'v2-experimental',reference,sessions:[],reasons:[...reasons,'Configuration V2 absente.']};
  const availabilitySeconds=availableSeconds(input.historicalProfile);
  if(availabilitySeconds===null)return {mode:'v2-experimental',reference,sessions:[],reasons:[...reasons,'Disponibilité de durée absente ou invalide.']};
  const goal=input.configuration.goal,beginningWithoutReference=goal.kind==='begin'&&!reference.available;
  if((!reference.available||reference.referenceSeconds===null)&&!beginningWithoutReference)
    return {mode:'v2-experimental',reference,sessions:[],reasons:[...reasons,'Référence V2 indisponible : aucun retour vers V1.']};
  const documentedDistanceMeters=maximumDocumentedDistance(input.sessions);
  const observedSessionTypes=[...new Set(input.sessions.flatMap(session=>{
    const type=input.documentedActivityTypes?.[session.id];
    return type==='long-run'||type==='steady-run'||type==='intervals'||type==='hills'?[type]:[];
  }))];
  const adaptedInput:SessionStrategyInput={goal:goal.kind,habitualReferenceSeconds:beginningWithoutReference?null:reference.referenceSeconds,
    evidence:reference.confidence==='confirmed'?'documented':'insufficient',experience:experience(input.configuration.experience),
    availabilitySeconds,observedSessionTypes,intervalIntroduction:intervalIntroductionEvidence(input.sessions,input.referenceDate),
    ...((goal.kind==='distance'||goal.kind==='race')?{targetDistanceMeters:goal.distanceMeters}:{}),
    ...(documentedDistanceMeters===undefined?{}:{documentedDistanceMeters}),
    ...(goal.kind==='race'?{eventDate:goal.eventDate}:{}),
  };
  const sessions=selectPrototypeSessions(adaptedInput);sessions.forEach(validatePrototypeSession);
  reasons.push(beginningWithoutReference?'Débuter : amorçage facile fondé sur la configuration persistée, sans capacité supposée.'
    :reference.confidence==='provisional'
    ? goal.kind==='endurance'||goal.kind==='distance'||goal.kind==='race'
      ? 'Référence provisoire : séance facile proche de la durée réellement observée, sans progression ni structure exigeante.'
      : 'Référence provisoire : séance facile raccourcie, sans structure exigeante.'
    : observedSessionTypes.length?'Référence confirmée avec types documentés fournis explicitement.'
      :'Référence confirmée, sans type de séance observé déduit des imports.');
  const surface=input.historicalProfile?.preferences.terrain;
  reasons.push(!surface||surface==='none'?'Relief préféré inconnu : aucune surface déclarée n’est convertie en relief.'
    :`Surface déclarée « ${surface} » non convertie en relief qualitatif.`);
  return {mode:'v2-experimental',reference,sessions,reasons,adaptedInput};
}

export function proposeExperimentalCatalogV2(input:{sessions:readonly RunningSession[];storedSuggestions:readonly StoredSuggestion[];
  referenceDate:string;proposalPolicy:ProposalPolicy;configuration?:EvolvingCoachValues|null;historicalProfile?:CoachProfileValues;
  /** Types établis par une source fiable explicite. L'absence d'entrée reste inconnue. */
  documentedActivityTypes?:Readonly<Record<string,PrototypeSessionType|undefined>>}):ExperimentalCatalogV2Result {
  const reference=bootstrapHabitualReference({sessions:input.sessions,suggestions:input.storedSuggestions,
    referenceDate:input.referenceDate,proposalPolicy:input.proposalPolicy,bootstrapPolicy:'hybrid'});
  return proposeExperimentalCatalogFromReferenceV2({...input,reference});
}
