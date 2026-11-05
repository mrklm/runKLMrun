import type { RunningSession } from '../../types/session';
import { recordedActivityEvidenceV2,type ApplicationActivityEvidenceV2 } from './activity-evidence-v2';
import { associationEvidenceMatchesV2,validateOccurrenceShapeV2,validateOccurrenceV2,
  type PersistableOccurrenceV2 } from './persistence-foundations-v2';
import { sportingContentIdentityV2,type SportingIdentityV2 } from './sporting-content-identity-v2';
import { matchingDate } from './suggestion-matching';

export type ContinuityStateV2='unconfirmed-proposal'|'unconfirmed-association'|'completed'|'partial'|'not-completed'|'invalid-link'|'insufficient-data';
export interface ContinuityRecommendationV2 {
  id:string;
  state:ContinuityStateV2;
  /** Absent lorsque l'occurrence ne peut pas être authentifiée par son contrat. */
  presentation?:PersistableOccurrenceV2['presentation'];
  suggestedFor?:string;
  updatedAt?:string;
  lifecycle?:PersistableOccurrenceV2['state'];
  /** Références déclarées de remplacement, pas une reconstruction de chaîne historique. */
  supersedesId?:string;
  supersededById?:string;
  associationInvalidation?:PersistableOccurrenceV2['associationInvalidation'];
  prescription?:SportingIdentityV2;
  /** Uniquement un lien vérifié vers la table unique activities, jamais une copie de charge. */
  activityId?:string;
  associationVerification?:'date-and-id'|'sport-signature';
  confirmation?:PersistableOccurrenceV2['realization'];
}
export interface ContinuityIssueV2 {
  source:'activity'|'occurrence';
  id:string|null;
  code:'invalid-id'|'conflicting-id'|'invalid-data'|'missing-activity'|'ambiguous-association'|'date-mismatch'|'signature-mismatch'|'invalidated-association';
}
export interface ContinuityActivityV2 extends Omit<ApplicationActivityEvidenceV2,'confirmedRealization'> {
  startTime?:string;
}
export interface RecommendationContinuityV2 {
  recommendations:ContinuityRecommendationV2[];
  /** Données réelles uniquement ; aucune mesure issue d'une prescription ou d'un statut. */
  activities:ContinuityActivityV2[];
  issues:ContinuityIssueV2[];
}
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const order=(a:string,b:string)=>a<b?-1:a>b?1:0;

/** Égalité conservatrice des instantanés, indépendante de l'ordre des propriétés.
 * Préserve undefined, NaN et les infinis : ils ne doivent pas devenir un null JSON.
 * Les cycles et objets non documentaires sont refusés, sans analyse de texte libre. */
function snapshotKey(value:unknown,parents=new Set<object>()):string {
  if(value===null)return 'null';
  if(typeof value!=='object') {
    if(!['undefined','string','number','boolean'].includes(typeof value))throw new Error('Non-documentary value');
    return `${typeof value}:${JSON.stringify(String(value))}`;
  }
  if(parents.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))throw new Error('Non-documentary object');
  parents.add(value);
  const result=Array.isArray(value)?`[${Array.from(value,item=>snapshotKey(item,parents)).join(',')}]`
    :`{${Object.keys(value).sort(order).map(key=>`${JSON.stringify(key)}:${snapshotKey((value as Record<string,unknown>)[key],parents)}`).join(',')}}`;
  parents.delete(value);return result;
}
function uniqueRecords(values:readonly unknown[],source:ContinuityIssueV2['source'],issues:ContinuityIssueV2[]) {
  const groups=new Map<string,unknown[]>();
  for(const value of values) {
    if(!record(value)||typeof value.id!=='string'||!value.id.trim()){issues.push({source,id:null,code:'invalid-id'});continue;}
    const group=groups.get(value.id)??[];group.push(value);groups.set(value.id,group);
  }
  return [...groups].sort(([a],[b])=>order(a,b)).map(([id,group])=>{
    try {
      if(new Set(group.map(value=>snapshotKey(value))).size===1)return {id,value:group[0]};
      issues.push({source,id,code:'conflicting-id'});
    } catch {issues.push({source,id,code:'invalid-data'});}
    return {id,value:undefined};
  });
}

/** Mémoire de l'état courant, pas un journal ni une reconstruction à une date passée.
 * Pure et asynchrone uniquement pour vérifier les empreintes existantes (SHA-256).
 * Aucun accès au stockage, à l'horloge ou au moteur de classement.
 * Ne crée aucun lien implicite, même lorsqu'une activité tombe le même jour. */
export async function buildRecommendationContinuityV2(input:{
  sessions:readonly RunningSession[];occurrences:readonly unknown[];
}):Promise<RecommendationContinuityV2> {
  const issues:ContinuityIssueV2[]=[];
  const sessions=new Map<string,RunningSession>();
  for(const {id,value} of uniqueRecords(input.sessions,'activity',issues)) {
    if(!value)continue;
    try {
      const session=value as RunningSession;
      if(!matchingDate(session))throw new Error('Invalid activity date or sport');
      sessions.set(id,session);
    } catch {issues.push({source:'activity',id,code:'invalid-data'});}
  }
  // Inclure les revendications malformées ou contradictoires dans l'ambiguïté.
  // Aucune révision n'est élue arbitrairement lorsqu'un identifiant est dupliqué.
  const claims=new Map<string,Set<unknown>>();
  for(const value of input.occurrences)if(record(value)&&typeof value.activityId==='string') {
    const owners=claims.get(value.activityId)??new Set();
    owners.add(typeof value.id==='string'&&value.id.trim()?value.id:null);claims.set(value.activityId,owners);
  }
  const recommendations:ContinuityRecommendationV2[]=[];
  for(const {id,value} of uniqueRecords(input.occurrences,'occurrence',issues)) {
    const entry:ContinuityRecommendationV2={id,state:'insufficient-data'};
    recommendations.push(entry);
    if(!value)continue;
    try {validateOccurrenceShapeV2(value);await validateOccurrenceV2(value);}
    catch {issues.push({source:'occurrence',id,code:'invalid-data'});continue;}
    const occurrence=value as PersistableOccurrenceV2;
    Object.assign(entry,{
      presentation:structuredClone(occurrence.presentation),suggestedFor:occurrence.opportunity.suggestedFor,
      updatedAt:occurrence.updatedAt,lifecycle:occurrence.state,prescription:sportingContentIdentityV2(occurrence.content),
      ...(occurrence.supersedesId?{supersedesId:occurrence.supersedesId}:{}),
      ...(occurrence.supersededById?{supersededById:occurrence.supersededById}:{}),
    });
    if(occurrence.associationInvalidation) {
      entry.associationInvalidation=structuredClone(occurrence.associationInvalidation);
      entry.state='invalid-link';issues.push({source:'occurrence',id,code:'invalidated-association'});continue;
    }
    if(occurrence.state!=='associated') {
      entry.state=occurrence.realization?.result==='not-completed'?'not-completed':'unconfirmed-proposal';
      if(occurrence.realization)entry.confirmation=structuredClone(occurrence.realization);
      continue;
    }
    const activity=sessions.get(occurrence.activityId!);
    const problem=claims.get(occurrence.activityId!)?.size!==1?'ambiguous-association'
      :!activity?'missing-activity'
      :activity.date!==occurrence.opportunity.suggestedFor?'date-mismatch'
      :!associationEvidenceMatchesV2(occurrence,activity)?'signature-mismatch':undefined;
    if(problem) {entry.state='invalid-link';issues.push({source:'occurrence',id,code:problem});continue;}
    entry.activityId=activity!.id;
    entry.associationVerification=occurrence.associationEvidence?'sport-signature':'date-and-id';
    entry.state=occurrence.realization?.result??'unconfirmed-association';
    if(occurrence.realization)entry.confirmation=structuredClone(occurrence.realization);
  }
  // D1 assainit les mesures/type/ressenti. Pas de confirmation attachée à l'activité :
  // son effort existe indépendamment des occurrences. Pas de date implicite « aujourd'hui ».
  const activities=recordedActivityEvidenceV2({sessions:[...sessions.values()],occurrences:[]},'9999-12-31')
    .map(activity=>({...activity,...(sessions.get(activity.id)!.startTime!==undefined?{startTime:sessions.get(activity.id)!.startTime}:{})}));
  const uniqueIssues=[...new Map(issues.map(issue=>[JSON.stringify(issue),issue])).values()]
    .sort((a,b)=>order(a.source,b.source)||order(a.id??'',b.id??'')||order(a.code,b.code));
  return {recommendations,activities,issues:uniqueIssues};
}
