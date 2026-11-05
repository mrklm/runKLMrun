import type { RecommendationContinuityV2,ContinuityRecommendationV2 } from './recommendation-continuity-v2';
import { sportingContentIdentityV2 } from './sporting-content-identity-v2';
import type { ImmutableSessionContentV2 } from './persistence-foundations-v2';
import { SESSION_STRATEGY_EXPERIMENT } from './simulation/session-strategies-v2';
import { validSessionDate } from '../analysis/session-summary';

/** Fenêtre d'observation éditoriale, jamais un délai d'interdiction. */
export const CONTINUITY_OBSERVATION_DAYS=28;
export interface ContinuityDecisionV2 {
  status:'relevant-repeat'|'avoidable-repeat'|'repeat-without-alternative'|'insufficient-data';
  reasons:string[];
  sources:{occurrenceId:string;date:string;state:ContinuityRecommendationV2['state'];activityId?:string;
    activityDate?:string;actualType?:string;effort?:string}[];
  alternativeKey?:string;
}
/** Départage conservateur : même famille, durée, intensité et terrain déjà
 * admissibles, ou alternatives faciles déjà prévues par le catalogue : terrain
 * plat, ou un palier plus court. Aucune progression ajoutée. */
export function selectContinuityV2<T extends ImmutableSessionContentV2>(input:{
  selected:T;candidates:readonly T[];memory:RecommendationContinuityV2;date:string;
}):{selected:T;decision:ContinuityDecisionV2} {
  if(!validSessionDate(input.date))throw new Error('Date de continuité invalide.');
  const identity=sportingContentIdentityV2(input.selected);
  const age=(date:string)=>(Date.parse(input.date)-Date.parse(date))/86400000;
  const recent=(date:string|undefined):date is string=>!!date&&validSessionDate(date)&&age(date)>=0&&age(date)<CONTINUITY_OBSERVATION_DAYS;
  const records=input.memory.recommendations.filter(value=>value.prescription?.status==='known'
    &&value.presentation&&value.presentation.presentedOn<=input.date
    &&recent(value.suggestedFor)&&value.state!=='invalid-link'&&value.state!=='insufficient-data'
    // Les intentions courantes et leurs remplacements ne doivent pas s'auto-pénaliser.
    &&!(value.lifecycle==='active'&&value.state==='unconfirmed-proposal'&&value.suggestedFor!>=input.date)
    &&!(!!value.supersededById&&value.state==='unconfirmed-proposal'));
  const matches=(key:string)=>records.filter(value=>value.prescription?.status==='known'&&value.prescription.key===key);
  const sources=identity.status==='known'?matches(identity.key).map(value=>{
    const activity=input.memory.activities.find(activity=>activity.id===value.activityId&&recent(activity.date));
    return {occurrenceId:value.id,date:value.suggestedFor!,state:value.state,
      ...(activity?{activityId:activity.id,activityDate:activity.date,actualType:activity.documentedType,effort:activity.effort}:{})};
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.occurrenceId.localeCompare(b.occurrenceId)):[];
  const finish=(status:ContinuityDecisionV2['status'],reason:string,selected=input.selected,alternativeKey?:string)=>({selected,
    decision:{status,reasons:[reason,...sources.map(source=>source.state==='not-completed'
      ? `Non-réalisation explicite du ${source.date.split('-').reverse().join('/')} : proposition passée seulement, aucun entraînement compté.`
      : source.state==='unconfirmed-association'
      ? `Association sans confirmation du ${source.date.split('-').reverse().join('/')} : aucune réalisation de la prescription déduite.`
      : source.state==='partial'
      ? `Réalisation partielle du ${source.date.split('-').reverse().join('/')} : ni échec ni répétitions restantes déduits.`
      : source.state==='completed'
      ? `Réalisation confirmée du ${source.date.split('-').reverse().join('/')} : aucune difficulté déduite du statut.`
      : `Proposition passée du ${source.date.split('-').reverse().join('/')} : aucune réalisation déduite.`)],sources,...(alternativeKey?{alternativeKey}:{})}});
  if(identity.status!=='known'||!sources.length)return finish('insufficient-data','Aucune prescription identique récente exploitable ; classement existant conservé.');
  const alternatives=input.candidates.flatMap(candidate=>{
    const other=sportingContentIdentityV2(candidate);
    return other.status==='known'&&other.key!==identity.key
      &&other.content.type===identity.content.type&&other.content.intensity===identity.content.intensity
      &&(other.content.totalDurationSeconds===identity.content.totalDurationSeconds&&other.content.terrain===identity.content.terrain
        ||identity.content.type==='easy-endurance'&&(
          other.content.totalDurationSeconds===identity.content.totalDurationSeconds&&identity.content.terrain==='rolling'&&other.content.terrain==='flat'
          ||other.content.terrain===identity.content.terrain
            &&identity.content.totalDurationSeconds-other.content.totalDurationSeconds===SESSION_STRATEGY_EXPERIMENT.stepSeconds))
      ?[{candidate,key:other.key}]:[];
  }).sort((a,b)=>a.key.localeCompare(b.key));
  const alternative=alternatives.find(value=>!matches(value.key).length);
  if(alternative)return finish('avoidable-repeat','Alternative comparable déjà admissible : même type et intensité, blocs différents ou option facile de terrain plat ou d’un palier plus court ; aucune hausse de durée.',alternative.candidate,alternative.key);
  return alternatives.length
    ?finish('relevant-repeat','Les variantes comparables ont aussi été proposées récemment ; classement existant conservé.')
    :finish('repeat-without-alternative','Aucune variante comparable admissible ; répétition autorisée sans progression ni dette.');
}
