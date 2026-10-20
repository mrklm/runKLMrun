import { coachV2Perspectives,type CoachV2Perspective } from '../core/coach/perspectives-v2';
import { reusableActiveOccurrenceV2 } from '../core/coach/presentation-identity-v2';
import { resolveCoachV2Reference } from '../core/coach/local-reference-v2';
import { adaptCoachV2Readonly, type CoachV2ApplicationSnapshot, type CoachV2ReadonlyResult } from '../core/coach/application-adapter-v2';
import { compareCoachVersionsReadonly } from '../core/coach/comparison-v1-v2';
import type { PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import { formatCoachDuration, formatCoachDurationText } from './coach-planning-display';
import type { CoachV2Reference } from '../core/coach/local-reference-v2';

export const coachV2Labels={type:{'easy-endurance':'Endurance facile','endurance-variations':'Endurance à variations modérées','long-run':'Sortie longue','steady-run':'Sortie soutenue',intervals:'Fractionné',hills:'Côtes',recovery:'Récupération'},
  intensity:{'very-easy':'Très facile',easy:'Facile',steady:'Soutenue','controlled-hard':'Effort contrôlé'},terrain:{flat:'Plat',rolling:'Vallonné',hills:'Côtes'}} as const;
const labels:Record<string,string>={...coachV2Labels.type,...coachV2Labels.intensity,...coachV2Labels.terrain,
  discovery:'Sortie de découverte',endurance:'Sortie d’endurance',selected:'Sélectionnée',
  'not-enabled':'Non activé',possible:'Possible',cautious:'Prudence', 'insufficient-data':'Données insuffisantes',unavailable:'Indisponible',
  'no-candidate':'Aucune suggestion admissible','recent-activity':'Activité trop récente','very-hard-recovery':'Récupération après ressenti très difficile','recent-presentation':'Suggestion présentée récemment',
  'catalog-unavailable':'Aucune séance disponible','missing-temporal-anchor':'Repère temporel manquant',
  'no-available-date':'Aucun jour disponible','no-admissible-date':'Aucune date admissible',
  road:'Route',trail:'Chemins',treadmill:'Tapis',none:'Aucune préférence'};
export const coachValueLabel=(value:string)=>labels[value]??value;
export function coachExplanationText(text:string):string {
  return formatCoachDurationText(text).replace(/Surface déclarée « (road|trail|treadmill|none) »/g,
    (_match,value:string)=>`Surface déclarée « ${coachValueLabel(value)} »`);
}
export const coachExplanationLines=(lines:readonly string[])=>[...new Set(lines.map(coachExplanationText).filter(Boolean))];
export interface CoachV2Explanation { reasons:string[];limitations:string[] }
const dateLabel=(date:string)=>date.split('-').reverse().join('/');

/** Projection des traces existantes : aucun seuil ni arbitrage n'est recalculé. */
export function coachV2Explanation(result:CoachV2ReadonlyResult):CoachV2Explanation {
  const session=result.candidate,reasons:string[]=[],limitations=[...result.uncertainties];
  if(!session)return {reasons:coachExplanationLines(result.catalog.reasons),limitations:coachExplanationLines(limitations)};
  if(result.reason==='selected'&&result.selectedDate)reasons.push(
    `Le ${dateLabel(result.selectedDate)} est le premier jour disponible où une séance est admissible dans la période examinée.`);
  const reference=result.catalog.adaptedInput?.habitualReferenceSeconds;
  if(reference!=null) {
    reasons.push(`Durée de référence utilisée : ${formatCoachDuration(reference)}.`);
    if(reference===result.reference.referenceSeconds)reasons.push(...result.reference.reasons);
  }
  if(result.dailyMaximumSeconds!==null)reasons.push(`Temps disponible ce jour : ${formatCoachDuration(result.dailyMaximumSeconds)} maximum.`);
  const progressionState=result.catalog.adaptedInput?.progressionState;
  const progressive=progressionState==='progression-possible'&&reference!=null&&session.type==='easy-endurance'
    &&session.totalDurationSeconds>reference&&session.changedDimensions.includes('duration');
  if(progressive)reasons.push(`Durée légèrement augmentée de ${formatCoachDuration(session.totalDurationSeconds-reference)} à partir d’une pratique réelle régulière.`);
  else if(progressionState==='maintien'&&reference!=null&&session.type==='easy-endurance'&&session.totalDurationSeconds===reference)
    reasons.push('La durée habituelle est conservée : les preuves actuelles ne justifient pas une progression.');
  if(progressionState==='recuperation'&&result.reference.confidence==='confirmed'&&result.catalog.adaptedInput?.intervalIntroduction?.eligible)
    reasons.push('Une activité récente ressentie comme très difficile conduit à conserver une séance facile.');
  if(session.type==='endurance-variations')reasons.push('Séance d’endurance à allure modulée, sans fractionné rapide.');
  if(!session.structure)reasons.push(...result.catalog.reasons.filter(text=>text.startsWith('Référence provisoire :')||text.startsWith('Débuter :')));
  // Les motifs du candidat sont les seules traces détaillées du type, de l'intensité et du terrain.
  reasons.push(...session.rationale.observedFacts.filter(text=>reference==null||!text.startsWith('Référence fournie : ')),
    ...session.rationale.runnerDeclarations,...session.rationale.designChoices);
  limitations.push(...session.rationale.uncertainties);
  if(result.reference.confidence==='provisional')limitations.push('La référence de durée reste provisoire.');
  return {reasons:coachExplanationLines(reasons),limitations:coachExplanationLines(limitations)};
}

/** Une occurrence ne conserve pas la trace complète du calcul : ne pas lui attribuer celle du calcul actuel. */
export function storedCoachV2Explanation(occurrence:PersistableOccurrenceV2):CoachV2Explanation {
  const reasons=[`Date retenue lors de la proposition : ${dateLabel(occurrence.opportunity.suggestedFor)}.`];
  const maximum=occurrence.opportunity.availability.maximumSeconds;
  if(maximum!==undefined)reasons.push(`Temps disponible enregistré pour ce jour : ${formatCoachDuration(maximum)} maximum.`);
  const limitations=['Les justifications détaillées du calcul initial ne sont pas conservées avec cette suggestion.'];
  if(occurrence.provenance.referenceConfidence==='provisional')limitations.push('La référence de durée était provisoire lors de la proposition.');
  if(occurrence.provenance.limitationCodes.length)limitations.push('Des limites supplémentaires ont été enregistrées sans explication textuelle disponible.');
  return {reasons,limitations};
}

export function coachV2PerspectiveExplanation(value:CoachV2Perspective):CoachV2Explanation {
  const rationale='rationale' in value.session?value.session.rationale:undefined;
  return {
    reasons:coachExplanationLines(['Cette date disponible respecte les espacements avec les activités connues et les séances envisagées précédentes.',
      ...(rationale?[...rationale.observedFacts,...rationale.runnerDeclarations,...rationale.designChoices]:[])]),
    limitations:coachExplanationLines(['Perspective indicative et révisable : elle n’est pas une activité réalisée.',
      ...(rationale?.uncertainties??[])]),
  };
}

/** Les deux lectures de calcul partagent le même instantané ; aucun dépôt d'écriture. */
export function coachComparisonDisplay(snapshot:CoachV2ApplicationSnapshot,date:CoachV2Reference) {
  const comparison=compareCoachVersionsReadonly(snapshot,date),result=adaptCoachV2Readonly(snapshot,date);
  const retained=reusableActiveOccurrenceV2(snapshot.occurrences,result,resolveCoachV2Reference(date).date);
  const plan=coachV2Perspectives(result,retained);
  const explanation=retained?storedCoachV2Explanation(retained):coachV2Explanation(result);
  return {...comparison,v2:{...comparison.v2,...explanation,
    suggestions:comparison.v2.suggestions.map((suggestion,index)=>({...suggestion,
      ...(index===0?explanation:coachV2PerspectiveExplanation(plan[index]))}))}};
}
