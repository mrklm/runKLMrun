import type { ProposalPolicy } from '../../types/coach-proposal';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { matchingDate } from './suggestion-matching';
import { adaptReferenceObservations,compareHabitualReferences,type ReferenceObservationExclusion } from './reference-comparison-v2';

export type ReferenceBootstrapPolicy='strict'|'provisional'|'hybrid';
export type ReferenceConfidence='unavailable'|'provisional'|'confirmed';
export interface ReferenceBootstrapResult {
  policy:ReferenceBootstrapPolicy;
  available:boolean;
  confidence:ReferenceConfidence;
  freshness:'current'|'expired'|'insufficient';
  referenceSeconds:number|null;
  sourceIds:string[];
  reasons:string[];
  excluded:ReferenceObservationExclusion[];
  artificialDecreaseRisk:boolean;
}

/** Paramètres éditoriaux expérimentaux, sans validation scientifique. */
export const REFERENCE_BOOTSTRAP_EXPERIMENT=Object.freeze({
  minimumObservations:4,
  maximumRelativeSpread:0.5,
  maximumAgeDays:42,
});
const DAY=86400000;
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/DAY;
const median=(values:readonly number[])=>{
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:sorted[middle-1]/2+sorted[middle]/2;
};

function provisionalEstimate(sessions:readonly RunningSession[],sourceIds:Set<string>,referenceDate:string) {
  const candidates=sessions.filter(session=>sourceIds.has(session.id)&&matchingDate(session)!==undefined
    && session.date<=referenceDate&&Number.isSafeInteger(session.durationSeconds)&&session.durationSeconds>0)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!candidates.length)return {referenceSeconds:null,sourceIds:[] as string[],reason:'Aucune durée réelle admissible.'};
  const episode:RunningSession[]=[];
  for(const session of candidates) {
    if(episode.length&&day(session.date)-day(episode.at(-1)!.date)>REFERENCE_BOOTSTRAP_EXPERIMENT.maximumAgeDays)episode.length=0;
    episode.push(session);
  }
  if(day(referenceDate)-day(episode.at(-1)!.date)>REFERENCE_BOOTSTRAP_EXPERIMENT.maximumAgeDays)
    return {referenceSeconds:null,sourceIds:[] as string[],reason:'Les durées admissibles sont trop anciennes pour amorcer une référence.'};
  if(episode.length<REFERENCE_BOOTSTRAP_EXPERIMENT.minimumObservations)
    return {referenceSeconds:null,sourceIds:episode.map(value=>value.id),reason:'Le nombre de durées admissibles est insuffisant.'};
  const value=median(episode.map(session=>session.durationSeconds));
  const spread=(Math.max(...episode.map(session=>session.durationSeconds))-Math.min(...episode.map(session=>session.durationSeconds)))/value;
  if(spread>REFERENCE_BOOTSTRAP_EXPERIMENT.maximumRelativeSpread)
    return {referenceSeconds:null,sourceIds:episode.map(session=>session.id),reason:'Les durées admissibles sont trop dispersées pour une estimation provisoire.'};
  return {referenceSeconds:value,sourceIds:episode.map(session=>session.id),reason:'Estimation provisoire issue de durées réelles cohérentes ; leur association historique reste partiellement inconnue.'};
}

/** Prototype en lecture seule. Une estimation provisoire ne devient jamais une
 * observation indépendante et ne modifie pas le moteur B 2G. */
export function bootstrapHabitualReference(input:{sessions:readonly RunningSession[];suggestions:readonly StoredSuggestion[];
  referenceDate:string;proposalPolicy:ProposalPolicy;bootstrapPolicy:ReferenceBootstrapPolicy}):ReferenceBootstrapResult {
  const comparison=compareHabitualReferences({sessions:input.sessions,suggestions:input.suggestions,
    referenceDate:input.referenceDate,policy:input.proposalPolicy});
  if(input.bootstrapPolicy!=='provisional'&&comparison.v2Available)
    return {policy:input.bootstrapPolicy,available:true,confidence:'confirmed',freshness:'current',referenceSeconds:comparison.v2ReferenceSeconds,
      sourceIds:comparison.observations.filter(value=>value.role==='independent-unknown').map(value=>value.id),
      reasons:['Référence confirmée par la politique B 2G.'],excluded:comparison.excluded,artificialDecreaseRisk:false};
  if(input.bootstrapPolicy==='strict')
    return {policy:'strict',available:false,confidence:'unavailable',freshness:comparison.v2Validity==='expired-inactivity'?'expired':'insufficient',referenceSeconds:null,sourceIds:[],
      reasons:['La politique stricte exige une référence confirmée B 2G.'],excluded:comparison.excluded,artificialDecreaseRisk:false};

  const adapted=adaptReferenceObservations(input.sessions,input.suggestions,input.referenceDate);
  const independent=new Set(adapted.observations.filter(value=>value.role==='independent-unknown').map(value=>value.id));
  const unknown=new Set(adapted.excluded.filter(value=>value.entity==='session'&&value.reason==='association-unknown').map(value=>value.id));
  const linked=new Set(adapted.observations.filter(value=>value.role==='suggestion-linked').map(value=>value.id));
  const sources=input.bootstrapPolicy==='hybrid'?new Set([...independent,...unknown]):new Set([...independent,...unknown,...linked]);
  const estimate=provisionalEstimate(input.sessions,sources,input.referenceDate);
  if(estimate.referenceSeconds===null)
    return {policy:input.bootstrapPolicy,available:false,confidence:'unavailable',freshness:estimate.reason.includes('trop anciennes')?'expired':'insufficient',referenceSeconds:null,
      sourceIds:estimate.sourceIds,reasons:[estimate.reason],excluded:comparison.excluded,artificialDecreaseRisk:false};
  const linkedUsed=estimate.sourceIds.some(id=>linked.has(id));
  return {policy:input.bootstrapPolicy,available:true,confidence:'provisional',freshness:'current',referenceSeconds:estimate.referenceSeconds,
    sourceIds:estimate.sourceIds,reasons:[estimate.reason],excluded:comparison.excluded,artificialDecreaseRisk:linkedUsed};
}
