import type { CoachProfileValues,Weekday } from '../../types/coach-profile';
import type { CoachTemperament, EvolvingCoachValues } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
import type { CoachPlanning } from '../../types/coach-planning';
import type { PersistableOccurrenceV2,TemporalAnchorV2 } from './persistence-foundations-v2';
import { associationEvidenceMatchesV2,civilDate,validateOccurrenceShapeV2 } from './persistence-foundations-v2';
import { proposeExperimentalCatalogFromReferenceV2,type ExperimentalCatalogV2Result } from './catalog-integration-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import { matchingDate } from './suggestion-matching';
import { applyAssociationContributionPolicy } from './simulation/association-policy-v2';
import { EXPERIMENTAL_REFERENCE_PARAMETERS,type ReferenceObservation } from './simulation/habitual-reference-v2';
import { habitualReferenceValidityV2 } from './simulation/reference-validity-v2';
import { orchestratePrototypeSession,type SessionOrchestratorResult,type RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import type { PrototypeSession,PrototypeSessionType } from './simulation/session-strategies-v2';
import { validSessionDate } from '../analysis/session-summary';
import { resolveCoachV2Reference,type CoachV2Reference } from './local-reference-v2';

export interface CoachV2ApplicationSnapshot {
  coachTemperament?:CoachTemperament;
  sessions:readonly RunningSession[];
  configuration?:EvolvingCoachValues|null;
  profile?:CoachProfileValues;
  occurrences:readonly PersistableOccurrenceV2[];
  planning?:CoachPlanning;
  /** Date civile issue de la création persistée de la configuration. */
  configurationCreatedOn?:string;
  /** Uniquement des rôles établis par une source explicite ; le stockage actuel n'en fournit aucun. */
  documentedActivityTypes?:Readonly<Record<string,PrototypeSessionType|undefined>>;
}
export interface CoachV2ReadonlyResult {
  coachTemperament:CoachTemperament;
  mode:'v2-readonly';reference:ReferenceBootstrapResult;catalog:ExperimentalCatalogV2Result;
  candidate:PrototypeSession|null;
  reason:SessionOrchestratorResult['reason']|'catalog-unavailable'|'missing-temporal-anchor'|'no-available-date'|'no-admissible-date';
  selectedDate:string|null;dailyMaximumSeconds:number|null;temporalAnchor:TemporalAnchorV2|null;temporalAnchorReason:string|null;
  facts:{sessionIds:string[];occurrenceIds:string[]};
  declarations:{goal:EvolvingCoachValues['goal']|null;availability:CoachProfileValues['availability']|null};
  uncertainties:string[];
  /** Compatibilité calculée en mémoire, jamais persistée : séances admissibles par date examinée. */
  admissibleSessionsByDate:Record<string,PrototypeSession[]>;
  /** Activités réelles connues à la consultation, avec ressenti facultatif, jamais persistées ici. */
  activityEvidence:RecordedActivityEvidence[];
}

const DAY=86400000,day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/DAY;
export const DATE_SELECTION_HORIZON_DAYS=7;
const WEEKDAYS:readonly Weekday[]=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const addCivilDays=(value:string,offset:number)=>new Date(Date.parse(`${value}T12:00:00Z`)+offset*DAY).toISOString().slice(0,10);
const weekdayOf=(value:string)=>WEEKDAYS[new Date(`${value}T12:00:00Z`).getUTCDay()];
const median=(values:readonly number[])=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:sorted[middle-1]/2+sorted[middle]/2;};
const unavailable=(reason:string,sourceIds:string[]=[],freshness:ReferenceBootstrapResult['freshness']='insufficient'):ReferenceBootstrapResult=>
  ({policy:'hybrid',available:false,confidence:'unavailable',freshness,referenceSeconds:null,sourceIds,
    reasons:[reason],excluded:[],artificialDecreaseRisk:false});

/** Référence hybride fondée uniquement sur des activités et occurrences V2.
 * Une provenance confirmée conserve le repère existant ; un épisode réel
 * cohérent sans lien avec des suggestions peut confirmer le repère initial. */
export function habitualReferenceFromOccurrencesV2(snapshot:CoachV2ApplicationSnapshot,referenceDate:string):ReferenceBootstrapResult {
  if(!validSessionDate(referenceDate))throw new Error('Date de référence V2 invalide.');
  snapshot.occurrences.forEach(validateOccurrenceShapeV2);
  const sessions=snapshot.sessions.filter(session=>matchingDate(session)!==undefined&&session.date<=referenceDate
    &&Number.isSafeInteger(session.durationSeconds)&&session.durationSeconds>0);
  const byId=new Map(sessions.map(session=>[session.id,session]));
  const confirmedSources=new Set(snapshot.occurrences.filter(value=>value.provenance.referenceConfidence==='confirmed')
    .flatMap(value=>value.provenance.referenceSourceIds).filter(id=>byId.has(id)));
  const linked=new Map(snapshot.occurrences.flatMap(value=>value.state==='associated'&&value.activityId&&byId.has(value.activityId)
    &&matchingDate(byId.get(value.activityId)!)===value.opportunity.suggestedFor&&associationEvidenceMatchesV2(value,byId.get(value.activityId)!)
    ?[[value.activityId,value] as const]:[]));
  const suggestedDates=new Set<string>(snapshot.occurrences.filter(value=>value.presentation.presentedOn<=referenceDate)
    .map(value=>value.opportunity.suggestedFor));
  const observations:ReferenceObservation[]=[],unknown:RunningSession[]=[];
  for(const session of sessions) {
    if(linked.has(session.id))observations.push({id:session.id,date:session.date,durationSeconds:session.durationSeconds,role:'suggestion-linked'});
    else if(confirmedSources.has(session.id))observations.push({id:session.id,date:session.date,durationSeconds:session.durationSeconds,role:'independent-unknown'});
    else if(suggestedDates.has(session.date))observations.push({id:session.id,date:session.date,durationSeconds:session.durationSeconds,role:'ambiguous'});
    else unknown.push(session);
  }
  observations.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const bounded=applyAssociationContributionPolicy(observations,'bounded');
  const validity=habitualReferenceValidityV2(bounded,referenceDate);
  const exclusions=observations.filter(value=>value.role==='ambiguous').map(value=>({entity:'session' as const,id:value.id,reason:'ambiguous-association' as const}));
  if(validity.referenceSeconds!==null&&(validity.validity==='valid-revisable'||validity.validity==='valid-retained'))return {
    policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',referenceSeconds:Math.round(validity.referenceSeconds),
    sourceIds:[...validity.sourceIds],reasons:[validity.validity==='valid-retained'
      ?'Référence confirmée conservée par des activités associées fiables, sans révision automatique.'
      :'Référence confirmée par les provenances V2 persistées.'],excluded:exclusions,artificialDecreaseRisk:false,
  };

  const candidates=[...unknown,...sessions.filter(session=>confirmedSources.has(session.id))]
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const episode:RunningSession[]=[];
  for(const session of candidates) {
    if(episode.length&&day(session.date)-day(episode.at(-1)!.date)>EXPERIMENTAL_REFERENCE_PARAMETERS.expiryDays)episode.length=0;
    episode.push(session);
  }
  const ids=episode.map(value=>value.id);
  if(!episode.length)return unavailable('Aucune durée réelle admissible pour la référence V2.');
  if(day(referenceDate)-day(episode.at(-1)!.date)>EXPERIMENTAL_REFERENCE_PARAMETERS.expiryDays)
    return unavailable('Les durées réelles admissibles sont trop anciennes.',ids,'expired');
  if(episode.length<EXPERIMENTAL_REFERENCE_PARAMETERS.confirmationCount)
    return unavailable('Le nombre de durées réelles admissibles est insuffisant.',ids);
  const medianValue=median(episode.map(session=>session.durationSeconds));
  const spread=(Math.max(...episode.map(session=>session.durationSeconds))-Math.min(...episode.map(session=>session.durationSeconds)))/medianValue;
  if(spread>0.5)return unavailable('Les durées réelles admissibles sont trop dispersées.',ids);
  const value=Math.round(medianValue);
  // Ne promouvoir que les courses réelles sans suggestion à leur date et sans
  // association déclarée, même si cette association est devenue incorrecte.
  // Les contrôles d'épisode ci-dessus et la médiane restent identiques.
  const associatedIds=new Set(snapshot.occurrences.flatMap(occurrence=>occurrence.activityId?[occurrence.activityId]:[]));
  const initialConfirmation=episode.every(session=>unknown.includes(session)&&!associatedIds.has(session.id));
  return {policy:'hybrid',available:true,confidence:initialConfirmation?'confirmed':'provisional',freshness:'current',referenceSeconds:value,sourceIds:ids,
    reasons:[initialConfirmation?'Référence initiale confirmée par un épisode de courses réelles cohérentes, récentes et sans lien avec une suggestion connue.'
      :'Estimation provisoire issue de durées réelles cohérentes ; leur indépendance historique n’est pas établie.'],
    excluded:exclusions,artificialDecreaseRisk:false};
}

function dailyMaximumSeconds(profile:CoachProfileValues|undefined,date:string):number|null {
  const availability=profile?.availability,weekday=weekdayOf(date);
  if(!availability?.days?.includes(weekday)||availability.sessionsPerWeek===0)return null;
  const minutes=availability.durationMode==='custom'?availability.maxMinutesByDay?.[weekday]:availability.minutesPerSession;
  return Number.isInteger(minutes)&&minutes!>0?minutes!*60:null;
}

/** Dernier événement persistant connu. Une activité prime en cas d'égalité civile. */
export function temporalAnchorFromSnapshotV2(snapshot:CoachV2ApplicationSnapshot,referenceDate:string):TemporalAnchorV2|null {
  if(!validSessionDate(referenceDate))throw new Error('Date de référence V2 invalide.');
  const activities=snapshot.sessions.flatMap(session=>{const date=matchingDate(session);
    return date&&date<=referenceDate?[{kind:'activity' as const,id:session.id,date}]:[];})
    .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const presentations=snapshot.occurrences.filter(value=>value.presentation.presentedOn<=referenceDate)
    .map(value=>({kind:'presentation' as const,id:value.id,date:value.presentation.presentedOn}))
    .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const activity=activities[0],presentation=presentations[0];
  if(!activity&&!presentation) {
    const created=snapshot.configurationCreatedOn;
    if(snapshot.configuration?.goal.kind==='begin'&&created&&validSessionDate(created)&&created<=referenceDate)
      return {kind:'bootstrap',referenceDate:civilDate(created)};
    return null;
  }
  if(activity&&(!presentation||activity.date>=presentation.date))return {...activity,date:civilDate(activity.date)};
  return presentation!;
}

function profileForDate(profile:CoachProfileValues|undefined,maximumSeconds:number):CoachProfileValues|undefined {
  if(!profile)return undefined;
  return {...profile,availability:{...profile.availability,durationMode:'simple',minutesPerSession:maximumSeconds/60}};
}

/** Pipeline applicatif pur : recherche le premier jour admissible dans sept jours
 * civils, avec son plafond propre. Il ne crée ni identité, génération, présentation ou écriture. */
export function adaptCoachV2Readonly(snapshot:CoachV2ApplicationSnapshot,referenceTime:CoachV2Reference):CoachV2ReadonlyResult {
  const {date:referenceDate,minuteOfDay}=resolveCoachV2Reference(referenceTime);
  const reference=habitualReferenceFromOccurrencesV2(snapshot,referenceDate);
  // Une association établit un lien, jamais la réalisation du type conseillé.
  const reliableActivityTypes=Object.fromEntries(snapshot.sessions.flatMap(session=>{
    const date=matchingDate(session),type=session.trainingType??snapshot.documentedActivityTypes?.[session.id];
    return date!==undefined&&date<=referenceDate&&type?[[session.id,type]]:[];
  }));
  const activityType=(id:string)=>reliableActivityTypes[id];
  let catalog=proposeExperimentalCatalogFromReferenceV2({sessions:snapshot.sessions,reference,
    referenceDate,configuration:snapshot.configuration,historicalProfile:snapshot.profile,documentedActivityTypes:reliableActivityTypes});
  const facts={sessionIds:snapshot.sessions.flatMap(session=>matchingDate(session)?[session.id]:[]),
    occurrenceIds:snapshot.occurrences.map(value=>value.id)};
  const declarations={goal:snapshot.configuration?.goal??null,availability:snapshot.profile?.availability??null};
  const uncertainties=['Une sélection calculée ne constitue ni une consultation enregistrée ni une présentation effective.'];
  if(!snapshot.sessions.some(session=>session.trainingType!==undefined)&&!snapshot.documentedActivityTypes)
    uncertainties.push('Aucun type de séance fiable n’est renseigné sur les activités réelles.');
  const activities:RecordedActivityEvidence[]=snapshot.sessions.flatMap(session=>{
    const date=matchingDate(session);if(!date)return [];
    const documentedType=activityType(session.id);
    // Une activité datée après la consultation ne fournit pas encore de ressenti exploitable.
    const effort=date<=referenceDate?session.feeling?.effort:undefined;
    return [{date,...(documentedType?{documentedType}:{}),...(effort?{effort}:{})}];
  });
  const admissibleSessionsByDate:Record<string,PrototypeSession[]>={};
  const temporalAnchor=temporalAnchorFromSnapshotV2(snapshot,referenceDate),base={coachTemperament:snapshot.coachTemperament??'pas-a-pas',mode:'v2-readonly' as const,reference,facts,declarations,uncertainties,admissibleSessionsByDate,activityEvidence:activities};
  if(!temporalAnchor)return {...base,catalog,candidate:null,reason:'missing-temporal-anchor',selectedDate:null,
    dailyMaximumSeconds:null,temporalAnchor:null,temporalAnchorReason:'Aucune activité ou présentation V2 persistée ne fournit une ancre fiable.'};
  const presented=snapshot.occurrences.filter(value=>value.presentation.presentedOn<=referenceDate)
    .map(value=>({date:value.presentation.presentedOn,type:value.content.type}));
  const catalogs=new Map<string,ExperimentalCatalogV2Result>();
  const catalogForDate=(date:string,maximumSeconds:number)=>{
    let value=catalogs.get(date);
    if(!value){
      value=proposeExperimentalCatalogFromReferenceV2({sessions:snapshot.sessions,reference,referenceDate:date,
        configuration:snapshot.configuration,historicalProfile:profileForDate(snapshot.profile,maximumSeconds),
        documentedActivityTypes:reliableActivityTypes});
      catalogs.set(date,value);
      const input=value.adaptedInput;
      admissibleSessionsByDate[date]=input?value.sessions.filter(candidate=>orchestratePrototypeSession({
        referenceDate:date,goal:input.goal,habitualReferenceSeconds:input.habitualReferenceSeconds,
        availabilitySeconds:maximumSeconds,candidates:[candidate],activities,presented}).selected!==null):[];
    }
    return value;
  };
  // Examiner seulement les dates des occurrences réutilisables, même après 18 h aujourd'hui.
  for(const occurrence of snapshot.occurrences){
    const date=occurrence.opportunity.suggestedFor,offset=day(date)-day(referenceDate);
    if(occurrence.state!=='active'||occurrence.opportunity.goal!==snapshot.configuration?.goal.kind
      ||offset<0||offset>=DATE_SELECTION_HORIZON_DAYS)continue;
    const maximumSeconds=dailyMaximumSeconds(snapshot.profile,date);
    if(maximumSeconds!==null)catalogForDate(date,maximumSeconds);
  }
  let availableDates=0,cataloguedDates=0;
  let veryHardRecoveryDate:string|undefined;
  let first:CoachV2ReadonlyResult|undefined;
  // À partir de 18 h locales, seul aujourd'hui est exclu ; la fin de l'horizon reste inchangée.
  for(let offset=minuteOfDay>=18*60?1:0;offset<DATE_SELECTION_HORIZON_DAYS;offset++) {
    const selectedDate=addCivilDays(referenceDate,offset),maximumSeconds=dailyMaximumSeconds(snapshot.profile,selectedDate);
    if(maximumSeconds===null)continue;
    availableDates++;
    catalog=catalogForDate(selectedDate,maximumSeconds);
    if(!catalog.adaptedInput||!catalog.sessions.length)continue;
    cataloguedDates++;
    const orchestrated=orchestratePrototypeSession({referenceDate:selectedDate,goal:catalog.adaptedInput.goal,
      habitualReferenceSeconds:catalog.adaptedInput.habitualReferenceSeconds,availabilitySeconds:maximumSeconds,
      candidates:catalog.sessions,activities,presented,coachTemperament:snapshot.coachTemperament});
    if(orchestrated.reason==='very-hard-recovery'&&!veryHardRecoveryDate)veryHardRecoveryDate=selectedDate;
    if(orchestrated.selected&&!first){
      const candidate=veryHardRecoveryDate?{...orchestrated.selected,rationale:{...orchestrated.selected.rationale,designChoices:[
        ...orchestrated.selected.rationale.designChoices,
        `Une séance exigeante n’est pas proposée le ${veryHardRecoveryDate.split('-').reverse().join('/')} après un ressenti très difficile récent ; la prochaine date admissible est retenue.`
      ]}}:orchestrated.selected;
      first={...base,catalog,candidate,reason:orchestrated.reason,selectedDate,
      dailyMaximumSeconds:maximumSeconds,temporalAnchor,temporalAnchorReason:null};
    }
  }
  if(first)return first;
  const reason=availableDates===0?'no-available-date':cataloguedDates===0?'catalog-unavailable':'no-admissible-date';
  return {...base,catalog,candidate:null,reason,selectedDate:null,dailyMaximumSeconds:null,temporalAnchor,temporalAnchorReason:null};
}
