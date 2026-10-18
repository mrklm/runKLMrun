import type { CoachTemperament, OptionalSessionFeeling } from '../../../types/evolving-coach';
import type { PrototypeGoal,PrototypeSession,PrototypeSessionType } from './session-strategies-v2';
import { validSessionDate } from '../../analysis/session-summary';

export interface RecordedActivityEvidence {
  date:string;
  /** Présent uniquement si le type provient d'une source fiable indépendante. */
  documentedType?:PrototypeSessionType;
  /** Ressenti déclaré d'une activité réelle ; absence = inconnu. */
  effort?:OptionalSessionFeeling['effort'];
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
  coachTemperament?:CoachTemperament;
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
/** Fenêtre éditoriale temporaire, pas une estimation physiologique de récupération. */
export const FEELING_PREFERENCE_WINDOW_DAYS=7;
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
  const easy=candidates.find(value=>!structured(value.type)&&value.type!=='long-run');
  // Classement après les filtres sportifs communs ; aucun candidat supplémentaire.
  const admissible=candidates.filter(value=>specialized.includes(value)||!structured(value.type)&&value.type!=='long-run');
  const baseline=easy??specialized[0]??null;
  let selected=baseline;
  const temperament=input.coachTemperament??'pas-a-pas';
  if(temperament==='evolution-active'){
    const previous=[...input.activities.map(value=>({date:value.date,type:value.documentedType})),...envisaged]
      .filter(value=>value.date<=input.referenceDate)
      .sort((a,b)=>b.date.localeCompare(a.date)||(a.type??'').localeCompare(b.type??''))[0];
    if(previous?.type)selected=[...admissible].filter(value=>value.type!==previous.type)
      .sort((a,b)=>a.totalDurationSeconds-b.totalDurationSeconds)[0]??baseline;
  }else if(temperament==='rentre-dedans'){
    selected=[...(specialized.length?specialized:admissible)]
      .sort((a,b)=>b.totalDurationSeconds-a.totalDurationSeconds)[0]??null;
  }
  const difficult=input.activities.filter(value=>(value.effort==='hard'||value.effort==='very-hard')
    &&value.date<=input.referenceDate&&today-day(value.date)<FEELING_PREFERENCE_WINDOW_DAYS)
    .sort((a,b)=>b.date.localeCompare(a.date)||(a.effort===b.effort?0:a.effort==='very-hard'?-1:1))[0];
  // Préférence seulement : ne crée aucun candidat, ne change aucun seuil et
  // ne retire pas l'admissibilité d'une occurrence déjà présentée.
  if(selected&&selected!==easy&&easy&&difficult){
    const label=difficult.effort==='very-hard'?'très difficile':'difficile';
    return {reason:'selected',selected:{...easy,rationale:{...easy.rationale,
      designChoices:[...easy.rationale.designChoices,
        `Séance facile privilégiée plutôt qu’une séance exigeante : la course du ${difficult.date.split('-').reverse().join('/')} a été ressentie comme ${label}, dans la fenêtre de sept jours examinée.`]}}};
  }
  if(selected&&selected!==baseline){
    const explanation=temperament==='evolution-active'
      ? 'Évolution Active : une alternative admissible est privilégiée pour varier le type de séance, avec la durée la plus mesurée parmi ces alternatives.'
      : specialized.length
        ? 'Rentre dedans : priorité à une option exigeante admissible, puis à la durée la plus haute parmi les options retenues.'
        : 'Rentre dedans : durée la plus haute parmi les séances admissibles.';
    selected={...selected,rationale:{...selected.rationale,designChoices:[...selected.rationale.designChoices,explanation]}};
  }
  return selected?{selected,reason:'selected'}:{selected:null,reason:'no-candidate'};
}
