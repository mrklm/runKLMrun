import { evaluateRecoveryV2,RECOVERY_TIMING_V2 as SESSION_ORCHESTRATOR_EXPERIMENT,isStructuredRecoveryTypeV2 as structured,type RecoveryTimingV2 } from '../recovery-policy-v2';
import { selectContinuityV2,type ContinuityDecisionV2 } from '../continuity-selection-v2';
import type { RecommendationContinuityV2 } from '../recommendation-continuity-v2';
import type { CoachTemperament, OptionalSessionFeeling } from '../../../types/evolving-coach';
import type { PrototypeGoal,PrototypeSession,PrototypeSessionType } from './session-strategies-v2';
import { validSessionDate } from '../../analysis/session-summary';
import { applyLoadAdaptationV2,type LoadAdaptationDecisionV2 } from '../load-adaptation-selection-v2';

export interface RecordedActivityEvidence {
  /** Métadonnées facultatives pour les appelants de simulation historiques.
   * D1 les transporte seulement : aucun calcul de charge ni règle ne les utilise. */
  id?:string;
  durationSeconds?:number;
  distanceMeters?:number;
  /** Confirmation positive explicitement liée ; une réponse négative n'a pas de lien d'activité. */
  confirmedRealization?:{occurrenceId:string;result:'completed'|'partial'};
  date:string;
  /** Présent uniquement si le type provient d'une source fiable indépendante. */
  documentedType?:PrototypeSessionType;
  /** Ressenti déclaré d'une activité réelle ; absence = inconnu. */
  effort?:OptionalSessionFeeling['effort'];
}
export interface PresentedSessionEvidence { date:string;type:PrototypeSessionType }
export type SessionOrchestratorPolicy=RecoveryTimingV2;
export interface SessionOrchestratorInput {
  continuity?:RecommendationContinuityV2;
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
  /** Classement des perspectives uniquement ; ne fournit aucune preuve sportive. */
  complementaryTo?:readonly Pick<PrototypeSession,'type'|'totalDurationSeconds'|'intensity'|'terrain'>[];
  coachTemperament?:CoachTemperament;
  policy?:SessionOrchestratorPolicy;
  /** Politique déjà calculée à referenceDate par l'adaptateur applicatif. */
  loadPolicy?:LoadAdaptationDecisionV2;
}
export interface SessionOrchestratorResult {
  continuityDecision?:ContinuityDecisionV2;
  selected:PrototypeSession|null;
  reason:'selected'|'no-candidate'|'recent-activity'|'very-hard-recovery';
}

/** Choix éditoriaux expérimentaux, sans valeur physiologique universelle. */
export { RECOVERY_TIMING_V2 as SESSION_ORCHESTRATOR_EXPERIMENT,FEELING_PREFERENCE_WINDOW_DAYS } from '../recovery-policy-v2';
const DAY=86400000;
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/DAY;
// Pertinence éditoriale uniquement : aucun effet sur les preuves ou les filtres.
const goalPriority=(goal:PrototypeGoal,type:PrototypeSessionType)=>{
  const order:readonly PrototypeSessionType[]=goal==='speed'
    ? ['intervals','steady-run','endurance-variations','hills','long-run']
    : goal==='race'?['long-run','hills','steady-run','endurance-variations','intervals']
      : ['long-run','endurance-variations','steady-run','intervals','hills'];
  const index=order.indexOf(type);
  return index<0?order.length:index;
};
/** Sélectionne au plus un candidat sans lui attribuer de date future, sans
 * dette et sans considérer les présentations comme des réalisations. */
export function orchestratePrototypeSession(input:SessionOrchestratorInput):SessionOrchestratorResult {
  if(input.loadPolicy&&input.loadPolicy.referenceDate!==input.referenceDate)throw new Error('Politique de charge périmée.');
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
  const recovery=evaluateRecoveryV2({referenceDate:input.referenceDate,activities:input.activities,intentions:envisaged,parameters:policy});
  if(recovery.spacing.all.status==='deferred')return {selected:null,reason:'recent-activity'};
  let specialized=candidates.filter(value=>structured(value.type)
    ?recovery.spacing.structured.status!=='deferred'
    :value.type==='long-run'&&recovery.spacing.longRun.status!=='deferred');
  let easy=candidates.find(value=>!structured(value.type)&&value.type!=='long-run');
  const veryHard=recovery.protections.some(value=>value.code==='very-hard-protection');
  // Même fenêtre que la préférence de ressenti existante : une activité réelle
  // très difficile ne permet pas de conserver une option exigeante faute de facile.
  if(veryHard&&!easy)return {selected:null,reason:'very-hard-recovery'};
  // Classement après les filtres sportifs communs ; aucun candidat supplémentaire.
  const admissible=applyLoadAdaptationV2(candidates.filter(value=>specialized.includes(value)||!structured(value.type)&&value.type!=='long-run'),
    input.loadPolicy,input.habitualReferenceSeconds);
  const finish=(selected:PrototypeSession):SessionOrchestratorResult=>{
    if(!input.continuity)return {selected,reason:'selected'};
    const choice=selectContinuityV2({selected,candidates:admissible,memory:input.continuity,date:input.referenceDate});
    return {selected:{...choice.selected,rationale:{...choice.selected.rationale,
      designChoices:[...choice.selected.rationale.designChoices,...choice.decision.reasons]}},reason:'selected',continuityDecision:choice.decision};
  };
  specialized=specialized.filter(value=>admissible.includes(value));
  easy=admissible.find(value=>!structured(value.type)&&value.type!=='long-run');
  const baseline=easy??specialized[0]??null;
  let selected=baseline;
  const temperament=input.coachTemperament??'pas-a-pas';
  if(temperament==='evolution-active'){
    const previous=[...input.activities.map(value=>({date:value.date,type:value.documentedType})),...envisaged]
      .filter(value=>value.date<=input.referenceDate)
      .sort((a,b)=>b.date.localeCompare(a.date)||(a.type??'').localeCompare(b.type??''))[0];
    if(previous?.type)selected=[...admissible].filter(value=>value.type!==previous.type||value.changedDimensions.includes('duration'))
      .sort((a,b)=>a.totalDurationSeconds-b.totalDurationSeconds
        ||goalPriority(input.goal,a.type)-goalPriority(input.goal,b.type))[0]??baseline;
  }else if(temperament==='rentre-dedans'){
    const history=input.complementaryTo??[];
    const repeatedType=(value:PrototypeSession)=>Number(history.some(previous=>previous.type===value.type));
    const repeatedVariant=(value:PrototypeSession)=>Number(history.some(previous=>previous.type===value.type
      &&previous.totalDurationSeconds===value.totalDurationSeconds&&previous.intensity===value.intensity&&previous.terrain===value.terrain));
    selected=[...(specialized.length?specialized:admissible)]
      .sort((a,b)=>repeatedType(a)-repeatedType(b)||repeatedVariant(a)-repeatedVariant(b)
        ||goalPriority(input.goal,a.type)-goalPriority(input.goal,b.type)
        ||b.totalDurationSeconds-a.totalDurationSeconds)[0]??null;
  }
  const difficult=recovery.preference.latest;
  const difficultExplanation=recovery.preference.latestExplanation??undefined;
  // Repli historique sans politique de charge : préférence seulement, sans nouveau seuil.
  if(selected&&selected!==easy&&easy&&difficult){
    return finish({...easy,rationale:{...easy.rationale,
      designChoices:[...easy.rationale.designChoices,difficultExplanation!]}});
  }
  if(selected&&selected!==baseline){
    const explanation=temperament==='evolution-active'
      ? selected.type===baseline?.type&&selected.changedDimensions.includes('duration')
        ? 'Évolution Active : une durée supérieure déjà admissible est privilégiée à partir de la pratique réelle régulière.'
        : 'Évolution Active : une alternative admissible est privilégiée pour varier le type de séance, avec la durée la plus mesurée, puis la priorité liée à l’objectif.'
      : input.complementaryTo?.length
        ? 'Rentre dedans : priorité aux options stimulantes admissibles, puis à un type ou une variante absent des intentions précédentes, puis à la pertinence pour l’objectif et à la durée la plus haute.'
        : specialized.length
        ? 'Rentre dedans : priorité à une option exigeante admissible, puis à la pertinence pour l’objectif et à la durée la plus haute parmi les options retenues.'
        : 'Rentre dedans : durée la plus haute parmi les séances admissibles.';
    selected={...selected,rationale:{...selected.rationale,designChoices:[...selected.rationale.designChoices,explanation]}};
  }
  if(selected&&input.loadPolicy&&(input.loadPolicy.decisions.preference!=='unchanged')){
    const explanations=input.loadPolicy.reasons.map(value=>value.code==='difficult-effort'&&difficultExplanation?difficultExplanation:value.explanation);
    if(explanations.length)selected={...selected,rationale:{...selected.rationale,
      designChoices:[...selected.rationale.designChoices,...explanations]}};
  }
  return selected?finish(selected):{selected:null,reason:'no-candidate'};
}
