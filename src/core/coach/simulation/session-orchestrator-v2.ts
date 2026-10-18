import type { PrototypeGoal,PrototypeSession,PrototypeSessionType } from './session-strategies-v2';
import { validSessionDate } from '../../analysis/session-summary';

export interface RecordedActivityEvidence {
  date:string;
  /** Présent uniquement si le type provient d'une source fiable indépendante. */
  documentedType?:PrototypeSessionType;
}
export interface PresentedSessionEvidence { date:string;type:PrototypeSessionType }
export interface SessionOrchestratorPolicy {
  minimumDaysAfterActivity:number;
  structuredActivityGapDays:number;
  longActivityGapDays:number;
}
export interface SessionOrchestratorInput {
  referenceDate:string;
  goal:PrototypeGoal;
  habitualReferenceSeconds:number|null;
  availabilitySeconds:number;
  candidates:readonly PrototypeSession[];
  activities:readonly RecordedActivityEvidence[];
  /** Historique conservé pour les appelants ; ne contraint pas l'admissibilité sportive. */
  presented:readonly PresentedSessionEvidence[];
  /** Intentions de ce calcul uniquement : aucune preuve d'activité ni progression acquise. */
  envisaged?:readonly PresentedSessionEvidence[];
  policy?:SessionOrchestratorPolicy;
}
export interface SessionOrchestratorResult {
  selected:PrototypeSession|null;
  reason:'selected'|'no-candidate'|'recent-activity';
}

/** Choix éditoriaux expérimentaux, sans valeur physiologique universelle. */
export const SESSION_ORCHESTRATOR_EXPERIMENT:Readonly<SessionOrchestratorPolicy>=Object.freeze({
  minimumDaysAfterActivity:2,
  structuredActivityGapDays:14,
  longActivityGapDays:10,
});
const DAY=86400000;
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/DAY;
const structured=(type:PrototypeSessionType)=>type==='intervals'||type==='steady-run'||type==='hills';
const latestDate=(values:readonly {date:string}[],referenceDate:string,predicate:((value:any)=>boolean)=()=>true)=>
  values.filter(value=>value.date<=referenceDate&&predicate(value)).map(value=>day(value.date)).sort((a,b)=>b-a)[0];
const tooRecent=(latest:number|undefined,today:number,gap:number)=>latest!==undefined&&today-latest<gap;

/** Sélectionne au plus un candidat sans lui attribuer de date future, sans
 * dette et sans considérer les présentations comme des réalisations. */
export function orchestratePrototypeSession(input:SessionOrchestratorInput):SessionOrchestratorResult {
  const today=day(input.referenceDate);
  const policy=input.policy??SESSION_ORCHESTRATOR_EXPERIMENT;
  if(!validSessionDate(input.referenceDate)||!Number.isFinite(today)||!Number.isSafeInteger(input.availabilitySeconds)||input.availabilitySeconds<=0
    ||input.habitualReferenceSeconds!==null&&(!Number.isSafeInteger(input.habitualReferenceSeconds)||input.habitualReferenceSeconds<=0)
    ||Object.values(policy).some(value=>!Number.isSafeInteger(value)||value<0)
    ||[...input.activities,...input.presented,...(input.envisaged??[])].some(value=>!validSessionDate(value.date)||!Number.isFinite(day(value.date))))
    throw new Error('Entrée d’orchestration V2 invalide.');
  const candidates=input.candidates.filter(value=>value.totalDurationSeconds<=input.availabilitySeconds);
  if(!candidates.length) return {selected:null,reason:'no-candidate'};
  const envisaged=input.envisaged??[];
  if(tooRecent(latestDate(input.activities,input.referenceDate),today,policy.minimumDaysAfterActivity)
    ||tooRecent(latestDate(envisaged,input.referenceDate),today,policy.minimumDaysAfterActivity))
    return {selected:null,reason:'recent-activity'};
  const latestStructured=latestDate(input.activities,input.referenceDate,
    value=>value.documentedType!==undefined&&structured(value.documentedType));
  const latestLong=latestDate(input.activities,input.referenceDate,value=>value.documentedType==='long-run');
  const specialized=candidates.filter(value=>structured(value.type)
    ? !tooRecent(latestStructured,today,policy.structuredActivityGapDays)
      &&!tooRecent(latestDate(envisaged,input.referenceDate,value=>structured(value.type)),today,policy.structuredActivityGapDays)
    : value.type==='long-run'?!tooRecent(latestLong,today,policy.longActivityGapDays)
      &&!tooRecent(latestDate(envisaged,input.referenceDate,value=>value.type==='long-run'),today,policy.longActivityGapDays):false);
  const selected=specialized[0]??candidates.find(value=>!structured(value.type)&&value.type!=='long-run')??null;
  return selected?{selected,reason:'selected'}:{selected:null,reason:'no-candidate'};
}
