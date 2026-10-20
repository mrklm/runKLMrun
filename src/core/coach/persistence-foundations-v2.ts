import { validSessionDate } from '../analysis/session-summary';
import type { PrototypeGoal } from './simulation/session-strategies-v2';
import type { RunningSession } from '../../types/session';

export type OccurrenceId=string&{readonly __brand:'OccurrenceId'};
export type ContentFingerprint=string&{readonly __brand:'ContentFingerprint'};
export type PresentationKey=string&{readonly __brand:'PresentationKey'};
export type CivilDate=string&{readonly __brand:'CivilDate'};
export type InstantIso=string&{readonly __brand:'InstantIso'};
export type IanaTimeZone=string&{readonly __brand:'IanaTimeZone'};
export type SessionTypeV2='easy-endurance'|'endurance-variations'|'long-run'|'steady-run'|'intervals'|'hills'|'recovery';
export type IntensityV2='very-easy'|'easy'|'steady'|'controlled-hard';
export type TerrainV2='flat'|'rolling'|'hills';
export type PresentationStateV2='active'|'obsolete'|'associated';
export type WeekdayV2='monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';

export interface SessionBlockV2 { readonly repetitions?:number;readonly durationSeconds:number;readonly intensity:IntensityV2;readonly instruction:string }
export interface SessionStructureV2 {
  readonly warmUp?:SessionBlockV2;readonly efforts:readonly SessionBlockV2[];
  readonly recoveries?:readonly SessionBlockV2[];readonly coolDown?:SessionBlockV2;
}
export interface ImmutableSessionContentV2 {
  readonly type:SessionTypeV2;readonly totalDurationSeconds:number;readonly intensity:IntensityV2;readonly terrain:TerrainV2;
  readonly shortSummary:string;readonly optionalInstructions?:readonly string[];readonly structure?:SessionStructureV2;
}
export type TemporalAnchorV2=
  |{readonly kind:'activity';readonly id:string;readonly date:CivilDate}
  |{readonly kind:'presentation';readonly id:OccurrenceId;readonly date:CivilDate}
  |{readonly kind:'bootstrap';readonly referenceDate:CivilDate};
export interface PresentationOpportunityV2 {
  readonly contractVersion:1;readonly goal:PrototypeGoal;readonly suggestedFor:CivilDate;
  readonly anchor:TemporalAnchorV2;readonly availability:{readonly weekday:WeekdayV2;readonly maximumSeconds?:number};
  /** Incrément explicite seulement pour un remplacement ou une nouvelle occurrence légitime. */
  readonly generation:number;
}
export interface CandidateV2 { readonly phase:'candidate';readonly content:ImmutableSessionContentV2;readonly opportunity:PresentationOpportunityV2 }
export interface SelectedSuggestionV2 { readonly phase:'selected';readonly content:ImmutableSessionContentV2;readonly opportunity:PresentationOpportunityV2 }
export interface PresentationMomentV2 {
  readonly presentedAt:InstantIso;readonly presentedOn:CivilDate;readonly timeZone:IanaTimeZone;
  readonly utcOffsetMinutes:number;readonly civilDateRule:'device-local-at-presentation';
}
export interface OccurrenceProvenanceV2 {
  readonly engine:'coach-v2';readonly contractVersion:1;readonly referenceConfidence:'provisional'|'confirmed';
  readonly referenceSourceIds:readonly string[];readonly limitationCodes:readonly string[];
}
export interface AssociationInvalidationV2 {
  readonly activityId:string;readonly invalidatedAt:InstantIso;readonly reason:'activity-missing'|'activity-replaced'|'activity-modified';
}
export interface AssociationEvidenceV2 {readonly sportSignature:string}
export interface PersistableOccurrenceV2 {
  readonly schemaVersion:2;readonly id:OccurrenceId;readonly presentationKey:PresentationKey;
  readonly contentFingerprint:ContentFingerprint;readonly content:ImmutableSessionContentV2;
  readonly opportunity:PresentationOpportunityV2;readonly presentation:PresentationMomentV2;
  readonly provenance:OccurrenceProvenanceV2;
  readonly state:PresentationStateV2;
  readonly revision:number;readonly updatedAt:InstantIso;readonly retainUntil:CivilDate;
  readonly supersedesId?:OccurrenceId;readonly supersededById?:OccurrenceId;readonly activityId?:string;
  readonly associationEvidence?:AssociationEvidenceV2;
  readonly associationInvalidation?:AssociationInvalidationV2;
}
export type ObservePresentationResultV2=
  |{readonly status:'created';readonly occurrence:PersistableOccurrenceV2}
  |{readonly status:'existing';readonly occurrence:PersistableOccurrenceV2}
  |{readonly status:'content-conflict';readonly occurrence:PersistableOccurrenceV2};

const types:readonly SessionTypeV2[]=['easy-endurance','endurance-variations','long-run','steady-run','intervals','hills','recovery'];
const intensities:readonly IntensityV2[]=['very-easy','easy','steady','controlled-hard'];
const terrains:readonly TerrainV2[]=['flat','rolling','hills'];
const weekdays:readonly WeekdayV2[]=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const goals:readonly PrototypeGoal[]=['begin','return','wellbeing','endurance','speed','distance','race'];
const structuredTypes:readonly SessionTypeV2[]=['endurance-variations','steady-run','intervals','hills'];
export const V2_OPERATIONAL_WINDOW_DAYS=42;
function fail(message:string):never {throw new Error(`Contrat de persistance V2 invalide : ${message}`);}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,allowed:readonly string[],label:string)=>{
  const unknown=Object.keys(value).find(key=>!allowed.includes(key));if(unknown)fail(`${label}, propriété inconnue « ${unknown} ».`);
};
const text=(value:unknown,label:string,maximum=1000)=>{
  if(typeof value!=='string'||!value.trim()||value.length>maximum||/[\u0000-\u001f]/.test(value))fail(`${label}.`);
};
const positiveInteger=(value:unknown,label:string,maximum=86400)=>{
  if(!Number.isSafeInteger(value)||(value as number)<=0||(value as number)>maximum)fail(`${label}.`);
};

export function civilDate(value:string):CivilDate {if(!validSessionDate(value))fail('date civile.');return value as CivilDate;}
export function instantIso(value:string):InstantIso {
  if(!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('instant ISO UTC.');return value as InstantIso;
}
export function ianaTimeZone(value:string):IanaTimeZone {
  text(value,'fuseau horaire',100);
  try {new Intl.DateTimeFormat('fr-FR',{timeZone:value}).format(new Date(0));} catch {fail('fuseau horaire IANA.');}
  return value as IanaTimeZone;
}
export function occurrenceId(value:string):OccurrenceId {text(value,'identifiant d’occurrence',200);return value as OccurrenceId;}
/** Signature déterministe des caractéristiques sportives du résumé. Le titre,
 * le ressenti et les chaussures sont volontairement exclus. */
export function activitySportSignatureV2(value:RunningSession):string {
  return JSON.stringify({date:value.date,...(value.startTime===undefined?{}:{startTime:value.startTime}),
    ...(value.polarId===undefined?{}:{polarId:value.polarId}),...(value.source===undefined?{}:{source:value.source}),
    ...(value.sport===undefined?{}:{sport:value.sport}),...(value.polarSportId===undefined?{}:{polarSportId:value.polarSportId}),
    ...(value.timezoneOffsetMinutes===undefined?{}:{timezoneOffsetMinutes:value.timezoneOffsetMinutes}),
    ...(value.distanceMeters===undefined?{}:{distanceMeters:value.distanceMeters}),durationSeconds:value.durationSeconds,
    ...(value.averageHeartRate===undefined?{}:{averageHeartRate:value.averageHeartRate}),
    ...(value.maximumHeartRate===undefined?{}:{maximumHeartRate:value.maximumHeartRate}),
    ...(value.ascentMeters===undefined?{}:{ascentMeters:value.ascentMeters}),
    ...(value.ascentEstimate===undefined?{}:{ascentEstimate:{method:value.ascentEstimate.method,quality:value.ascentEstimate.quality,meters:value.ascentEstimate.meters}}),
    ...(value.descentMeters===undefined?{}:{descentMeters:value.descentMeters}),
    ...(value.averagePaceSecondsPerKm===undefined?{}:{averagePaceSecondsPerKm:value.averagePaceSecondsPerKm}),
    ...(value.heartRateZones===undefined?{}:{heartRateZones:value.heartRateZones.map(zone=>({
      ...(zone.lower===undefined?{}:{lower:zone.lower}),...(zone.upper===undefined?{}:{upper:zone.upper}),
      ...(zone.durationSeconds===undefined?{}:{durationSeconds:zone.durationSeconds})}))}),
    ...(value.runningIndex===undefined?{}:{runningIndex:value.runningIndex}),...(value.cardioLoad===undefined?{}:{cardioLoad:value.cardioLoad})});
}
export const associationEvidenceMatchesV2=(occurrence:PersistableOccurrenceV2,activity:RunningSession)=>
  occurrence.associationEvidence===undefined||occurrence.associationEvidence.sportSignature===activitySportSignatureV2(activity);
const DAY_MS=86400000;
const addCivilDays=(value:CivilDate,days:number)=>civilDate(
  new Date(new Date(`${value}T00:00:00.000Z`).getTime()+days*DAY_MS).toISOString().slice(0,10));
/** Premier jour civil hors de la fenêtre de 42 jours révolus. */
export function retentionLimitV2(opportunity:PresentationOpportunityV2,presentation:PresentationMomentV2):CivilDate {
  const anchor=opportunity.suggestedFor>presentation.presentedOn?opportunity.suggestedFor:presentation.presentedOn;
  return addCivilDays(anchor,V2_OPERATIONAL_WINDOW_DAYS+1);
}

function validateBlock(value:unknown,label:string):asserts value is SessionBlockV2 {
  if(!object(value))fail(label);exact(value,['repetitions','durationSeconds','intensity','instruction'],label);
  positiveInteger(value.durationSeconds,`${label}, durée`);
  if(value.repetitions!==undefined)positiveInteger(value.repetitions,`${label}, répétitions`,1000);
  if(!intensities.includes(value.intensity as IntensityV2))fail(`${label}, intensité.`);text(value.instruction,`${label}, consigne`);
}
const blockDuration=(value:SessionBlockV2|undefined)=>value?(value.repetitions??1)*value.durationSeconds:0;
export function structureDurationSeconds(value:SessionStructureV2):number {
  return blockDuration(value.warmUp)+value.efforts.reduce((sum,block)=>sum+blockDuration(block),0)
    +(value.recoveries??[]).reduce((sum,block)=>sum+blockDuration(block),0)+blockDuration(value.coolDown);
}
function validateStructure(value:unknown):asserts value is SessionStructureV2 {
  if(!object(value))fail('structure.');exact(value,['warmUp','efforts','recoveries','coolDown'],'structure');
  if(!Array.isArray(value.efforts)||!value.efforts.length)fail('blocs d’effort.');
  if(value.warmUp!==undefined)validateBlock(value.warmUp,'échauffement');
  value.efforts.forEach((block,index)=>validateBlock(block,`effort ${index+1}`));
  if(value.recoveries!==undefined) {
    if(!Array.isArray(value.recoveries))fail('récupérations.');
    value.recoveries.forEach((block,index)=>validateBlock(block,`récupération ${index+1}`));
  }
  if(value.coolDown!==undefined)validateBlock(value.coolDown,'retour au calme');
}
export function validateSessionContentV2(value:unknown):asserts value is ImmutableSessionContentV2 {
  if(!object(value))fail('contenu.');exact(value,['type','totalDurationSeconds','intensity','terrain','shortSummary','optionalInstructions','structure'],'contenu');
  if(!types.includes(value.type as SessionTypeV2))fail('type de séance.');
  positiveInteger(value.totalDurationSeconds,'durée totale');
  if(!intensities.includes(value.intensity as IntensityV2))fail('intensité.');
  if(!terrains.includes(value.terrain as TerrainV2))fail('terrain.');text(value.shortSummary,'résumé',500);
  if(value.optionalInstructions!==undefined) {
    if(!Array.isArray(value.optionalInstructions)||value.optionalInstructions.length>20)fail('consignes facultatives.');
    value.optionalInstructions.forEach((entry,index)=>text(entry,`consigne ${index+1}`));
  }
  const needsStructure=structuredTypes.includes(value.type as SessionTypeV2);
  if(needsStructure&&value.structure===undefined)fail('blocs requis.');
  if(!needsStructure&&value.structure!==undefined)fail('blocs interdits pour une séance libre.');
  if(value.structure!==undefined) {
    validateStructure(value.structure);
    if(structureDurationSeconds(value.structure)!==value.totalDurationSeconds)fail('somme des blocs différente de la durée totale.');
  }
}

function validateOpportunity(value:unknown):asserts value is PresentationOpportunityV2 {
  if(!object(value))fail('occasion de présentation.');exact(value,['contractVersion','goal','suggestedFor','anchor','availability','generation'],'occasion');
  if(value.contractVersion!==1||!goals.includes(value.goal as PrototypeGoal))fail('version ou objectif.');civilDate(String(value.suggestedFor));
  positiveInteger(value.generation,'génération',Number.MAX_SAFE_INTEGER);
  if(!object(value.anchor))fail('ancre.');
  if(value.anchor.kind==='bootstrap') {exact(value.anchor,['kind','referenceDate'],'ancre');civilDate(String(value.anchor.referenceDate));}
  else if(value.anchor.kind==='activity'||value.anchor.kind==='presentation') {
    exact(value.anchor,['kind','id','date'],'ancre');text(value.anchor.id,'identifiant d’ancre',200);civilDate(String(value.anchor.date));
  } else fail('type d’ancre.');
  if(!object(value.availability))fail('disponibilité.');exact(value.availability,['weekday','maximumSeconds'],'disponibilité');
  if(!weekdays.includes(value.availability.weekday as WeekdayV2))fail('jour disponible.');
  if(value.availability.maximumSeconds!==undefined)positiveInteger(value.availability.maximumSeconds,'plafond disponible');
}
export function validateCandidateV2(value:unknown):asserts value is CandidateV2 {
  if(!object(value))fail('candidat.');exact(value,['phase','content','opportunity'],'candidat');
  if(value.phase!=='candidate')fail('phase candidat.');validateSessionContentV2(value.content);validateOpportunity(value.opportunity);
}
export function selectCandidateV2(candidate:CandidateV2):SelectedSuggestionV2 {
  validateCandidateV2(candidate);return deepFreeze({phase:'selected',content:structuredClone(candidate.content),opportunity:structuredClone(candidate.opportunity)});
}

const normalizeBlock=(value:SessionBlockV2)=>({...(value.repetitions===undefined?{}:{repetitions:value.repetitions}),
  durationSeconds:value.durationSeconds,intensity:value.intensity,instruction:value.instruction});
const normalizeStructure=(value:SessionStructureV2)=>({...(value.warmUp?{warmUp:normalizeBlock(value.warmUp)}:{}),
  efforts:value.efforts.map(normalizeBlock),...((value.recoveries?.length??0)>0?{recoveries:value.recoveries!.map(normalizeBlock)}:{}),
  ...(value.coolDown?{coolDown:normalizeBlock(value.coolDown)}:{})});
export function canonicalSessionContentV2(value:ImmutableSessionContentV2):string {
  validateSessionContentV2(value);
  return JSON.stringify({type:value.type,totalDurationSeconds:value.totalDurationSeconds,intensity:value.intensity,terrain:value.terrain,
    shortSummary:value.shortSummary,...((value.optionalInstructions?.length??0)>0?{optionalInstructions:[...value.optionalInstructions!]}:{}),
    ...(value.structure?{structure:normalizeStructure(value.structure)}:{})});
}
const bytesToHex=(value:ArrayBuffer)=>[...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
async function sha256(value:string):Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return bytesToHex(digest);
}
export async function contentFingerprintV2(value:ImmutableSessionContentV2):Promise<ContentFingerprint> {
  return `sha256:${await sha256(canonicalSessionContentV2(value))}` as ContentFingerprint;
}
function canonicalOpportunity(value:PresentationOpportunityV2):string {
  validateOpportunity(value);
  const anchor=value.anchor.kind==='bootstrap'?{kind:value.anchor.kind,referenceDate:value.anchor.referenceDate}
    :{kind:value.anchor.kind,id:value.anchor.id,date:value.anchor.date};
  return JSON.stringify({contractVersion:value.contractVersion,goal:value.goal,suggestedFor:value.suggestedFor,anchor,
    availability:{weekday:value.availability.weekday,...(value.availability.maximumSeconds===undefined?{}:{maximumSeconds:value.availability.maximumSeconds})},
    generation:value.generation});
}
export async function presentationKeyV2(value:PresentationOpportunityV2):Promise<PresentationKey> {
  return `presentation:v2:${await sha256(canonicalOpportunity(value))}` as PresentationKey;
}
function validateMoment(value:unknown):asserts value is PresentationMomentV2 {
  if(!object(value))fail('moment de présentation.');exact(value,['presentedAt','presentedOn','timeZone','utcOffsetMinutes','civilDateRule'],'présentation');
  instantIso(String(value.presentedAt));civilDate(String(value.presentedOn));ianaTimeZone(String(value.timeZone));
  if(!Number.isSafeInteger(value.utcOffsetMinutes)||(value.utcOffsetMinutes as number)<-840||(value.utcOffsetMinutes as number)>840)fail('décalage UTC.');
  if(value.civilDateRule!=='device-local-at-presentation')fail('règle de date civile.');
}
function validateProvenance(value:unknown):asserts value is OccurrenceProvenanceV2 {
  if(!object(value))fail('provenance.');exact(value,['engine','contractVersion','referenceConfidence','referenceSourceIds','limitationCodes'],'provenance');
  if(value.engine!=='coach-v2'||value.contractVersion!==1||!['provisional','confirmed'].includes(value.referenceConfidence as string))fail('provenance du moteur.');
  for(const [field,entries] of [['sources',value.referenceSourceIds],['limites',value.limitationCodes]] as const) {
    if(!Array.isArray(entries)||entries.length>100)fail(`provenance, ${field}.`);
    entries.forEach((entry,index)=>text(entry,`provenance, ${field} ${index+1}`,200));
    if(new Set(entries).size!==entries.length)fail(`provenance, ${field} dupliqués.`);
  }
}
export function validateOccurrenceShapeV2(value:unknown):asserts value is PersistableOccurrenceV2 {
  if(!object(value))fail('occurrence.');exact(value,['schemaVersion','id','presentationKey','contentFingerprint','content','opportunity','presentation','provenance','state','revision','updatedAt','retainUntil','supersedesId','supersededById','activityId','associationEvidence','associationInvalidation'],'occurrence');
  if(value.schemaVersion!==2)fail('version d’occurrence.');occurrenceId(String(value.id));validateSessionContentV2(value.content);
  validateOpportunity(value.opportunity);validateMoment(value.presentation);validateProvenance(value.provenance);
  if(!['active','obsolete','associated'].includes(value.state as string))fail('état de présentation.');
  positiveInteger(value.revision,'révision',Number.MAX_SAFE_INTEGER);instantIso(String(value.updatedAt));civilDate(String(value.retainUntil));
  if(Date.parse(String(value.updatedAt))<Date.parse(String((value.presentation as unknown as PresentationMomentV2).presentedAt)))fail('mise à jour antérieure à la présentation.');
  if(value.retainUntil!==retentionLimitV2(value.opportunity as unknown as PresentationOpportunityV2,value.presentation as unknown as PresentationMomentV2))fail('limite de conservation incohérente.');
  for(const field of ['supersedesId','supersededById'] as const)if(value[field]!==undefined) {
    occurrenceId(String(value[field]));if(value[field]===value.id)fail(`${field} autoréférencé.`);
  }
  if(value.activityId!==undefined)text(value.activityId,'identifiant d’activité',200);
  if(value.associationEvidence!==undefined) {
    if(!object(value.associationEvidence))fail('preuve d’association.');exact(value.associationEvidence,['sportSignature'],'preuve d’association');
    text(value.associationEvidence.sportSignature,'signature sportive',50000);
  }
  if(value.associationInvalidation!==undefined) {
    if(!object(value.associationInvalidation))fail('invalidation d’association.');
    exact(value.associationInvalidation,['activityId','invalidatedAt','reason'],'invalidation d’association');
    text(value.associationInvalidation.activityId,'ancienne activité associée',200);instantIso(String(value.associationInvalidation.invalidatedAt));
    if(!['activity-missing','activity-replaced','activity-modified'].includes(value.associationInvalidation.reason as string))fail('motif d’invalidation d’association.');
  }
  if(value.state==='associated'&&value.activityId===undefined)fail('activité requise pour une association.');
  if(value.state!=='associated'&&value.activityId!==undefined)fail('activité réservée à une association.');
  if(value.state==='associated'&&value.associationInvalidation!==undefined)fail('association active et invalidée simultanément.');
  if(value.state==='active'&&value.associationEvidence!==undefined)fail('preuve d’association sans association.');
  if(value.associationInvalidation!==undefined&&value.state!=='obsolete')fail('invalidation réservée à une occurrence obsolète.');
  if(value.state!=='obsolete'&&value.supersededById!==undefined)fail('lien de remplacement réservé à une occurrence obsolète.');
  if(typeof value.presentationKey!=='string'||!/^presentation:v2:[a-f0-9]{64}$/.test(value.presentationKey))fail('clé de présentation.');
  if(typeof value.contentFingerprint!=='string'||!/^sha256:[a-f0-9]{64}$/.test(value.contentFingerprint))fail('empreinte de contenu.');
}

export function operationalStatusV2(occurrence:PersistableOccurrenceV2,today:string):
  {readonly withinWindow:boolean;readonly deletionEligible:boolean} {
  validateOccurrenceShapeV2(occurrence);const date=civilDate(today),withinWindow=date<occurrence.retainUntil;
  return {withinWindow,deletionEligible:occurrence.state!=='associated'&&!withinWindow};
}

export function invalidateAssociationV2(occurrence:PersistableOccurrenceV2,activityId:string,updatedAt:InstantIso,
  reason:AssociationInvalidationV2['reason']):PersistableOccurrenceV2 {
  validateOccurrenceShapeV2(occurrence);text(activityId,'identifiant d’activité invalidée',200);instantIso(updatedAt);
  if(occurrence.state!=='associated'||occurrence.activityId!==activityId)return occurrence;
  const {activityId:_removed,...rest}=occurrence;
  const next:PersistableOccurrenceV2={...rest,state:'obsolete',revision:occurrence.revision+1,updatedAt,
    associationInvalidation:{activityId,invalidatedAt:updatedAt,reason}};
  validateOccurrenceShapeV2(next);return next;
}
export async function validateOccurrenceV2(value:unknown):Promise<void> {
  validateOccurrenceShapeV2(value);
  if(value.presentationKey!==await presentationKeyV2(value.opportunity))fail('clé de présentation incohérente.');
  if(value.contentFingerprint!==await contentFingerprintV2(value.content))fail('empreinte de contenu incohérente.');
}
function deepFreeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {Object.freeze(value);Object.values(value).forEach(deepFreeze);}
  return value;
}

/** Constate une présentation en mémoire. Une sélection seule n'appelle pas cette fonction. */
export async function observePresentationV2(input:{selection:SelectedSuggestionV2;moment:PresentationMomentV2;
  provenance:OccurrenceProvenanceV2;existing:readonly PersistableOccurrenceV2[];createId:()=>string}):Promise<ObservePresentationResultV2> {
  if(!object(input.selection)||input.selection.phase!=='selected')fail('sélection.');
  validateSessionContentV2(input.selection.content);validateOpportunity(input.selection.opportunity);validateMoment(input.moment);validateProvenance(input.provenance);
  for(const occurrence of input.existing)await validateOccurrenceV2(occurrence);
  const key=await presentationKeyV2(input.selection.opportunity),fingerprint=await contentFingerprintV2(input.selection.content);
  const previous=input.existing.find(value=>value.presentationKey===key);
  if(previous)return {status:previous.contentFingerprint===fingerprint?'existing':'content-conflict',occurrence:previous};
  const occurrence:PersistableOccurrenceV2=deepFreeze({schemaVersion:2,id:occurrenceId(input.createId()),presentationKey:key,
    contentFingerprint:fingerprint,content:structuredClone(input.selection.content),opportunity:structuredClone(input.selection.opportunity),
    presentation:structuredClone(input.moment),provenance:structuredClone(input.provenance),state:'active',revision:1,
    updatedAt:input.moment.presentedAt,retainUntil:retentionLimitV2(input.selection.opportunity,input.moment)});
  await validateOccurrenceV2(occurrence);return {status:'created',occurrence};
}
