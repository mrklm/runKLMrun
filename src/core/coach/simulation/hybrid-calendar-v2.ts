import { habitualReferenceFromOccurrencesV2 } from '../application-adapter-v2';
import { analyzeRecentLoadV2 } from '../recent-load-v2';
import { interpretRecentLoadV2,type LoadPolicyGateV2 } from '../load-adaptation-policy-v2';
import { evaluateRecoveryV2,RECOVERY_TIMING_V2,isStructuredRecoveryTypeV2,type RecoveryTimingV2 } from '../recovery-policy-v2';
import { applyLoadAdaptationV2 } from '../load-adaptation-selection-v2';
import { orchestratePrototypeSession,type RecordedActivityEvidence,type PresentedSessionEvidence } from './session-orchestrator-v2';
import type { PrototypeSession,PrototypeSessionType,PrototypeGoal } from './session-strategies-v2';
import type { ReferenceBootstrapResult } from '../reference-bootstrap-v2';
import type { CoachTemperament } from '../../../types/evolving-coach';
import { inspectHybridDossierV2,type HybridGroupV2 } from './hybrid-dossier-v2';
import { validSessionDate } from '../../analysis/session-summary';

const DAY=86400000;
export const calendarDateV2=(date:string,offset:number)=>new Date(Date.parse(`${date}T00:00:00Z`)+offset*DAY).toISOString().slice(0,10);
const demanding=(type:PrototypeSessionType|undefined|null)=>type==='long-run'||isStructuredRecoveryTypeV2(type);
export interface CalendarFeedbackV2 {
  /** Déclaration du générateur synthétique, jamais inférée d'une proposition. */
  result:'performed-as-proposed'|'partial'|'not-performed';
  effort?:RecordedActivityEvidence['effort'];durationSeconds?:number;actualType?:PrototypeSessionType;
}
export interface CalendarEventV2 {on:string;removeId?:string;upsert?:RecordedActivityEvidence}
export interface HybridCalendarInputV2 {
  referenceDate:string;days:28|56;group:HybridGroupV2;
  activities:readonly RecordedActivityEvidence[];reference:ReferenceBootstrapResult;
  candidates:readonly PrototypeSession[];goal:PrototypeGoal;temperament:CoachTemperament;
  availabilitySeconds:number;availableWeekdays:readonly number[];
  mode:'projection'|'synthetic-follow-up';
  feedback?:Readonly<Record<string,CalendarFeedbackV2>>;events?:readonly CalendarEventV2[];
}
/** Adaptateur local de simulation. Seules les protections temporelles sont
 * paramétrées ; préférences, qualité, progression D2 et classement restent réutilisés.
 * Avec A, cette sortie est identique au contrat D2 existant (test dédié). */
export function calendarLoadPolicyV2(activities:readonly RecordedActivityEvidence[],reference:ReferenceBootstrapResult,date:string,parameters:RecoveryTimingV2) {
  const load=analyzeRecentLoadV2({activities,reference,referenceDate:date}),base=interpretRecentLoadV2(load);
  const recovery=evaluateRecoveryV2({referenceDate:date,activities:load.activities,parameters});
  const protections=recovery.protections.map(value=>({code:value.code,scope:value.scope,days:value.days,notBefore:value.notBefore,
    activityIds:value.sources.flatMap(source=>source.id?[source.id]:[])}));
  const gate=(scope:'all'|'structured'|'longRun'):LoadPolicyGateV2=>{
    const notBefore=recovery.gates[scope].notBefore;
    const excluded=base.quality.missingIdCount>0||base.quality.excluded.some(value=>value.reason!=='future-date');
    return {status:notBefore?'defer':excluded||scope!=='all'&&base.quality.gaps.length?'review':'baseline-only',notBefore};
  };
  return {...base,protections,decisions:{...base.decisions,allSessions:gate('all'),structured:gate('structured'),longRun:gate('longRun')},
    reasons:[...recovery.protections.map((value,index)=>({code:value.code,source:'existing-protection' as const,
      activityIds:protections[index].activityIds,explanation:value.explanation})),
      ...base.reasons.filter(value=>!['minimum-rest','structured-gap','long-run-gap','very-hard-protection'].includes(value.code))]};
}

/** Calendrier intégral de laboratoire, avec contenus sportifs figés entre A/B.
 * Projection : seules des intentions. Suivi : seuls les bilans synthétiques
 * explicitement fournis créent une activité ; un silence ne crée jamais de preuve.
 * Aucun accès au stockage et aucun appel depuis un chemin applicatif. */
export function simulateHybridCalendarV2(input:HybridCalendarInputV2,variant:'A'|'B-mechanical'|'B-draft') {
  if(!validSessionDate(input.referenceDate)||![28,56].includes(input.days)||!['structured','longRun'].includes(input.group)
    ||!input.availableWeekdays.every(value=>Number.isInteger(value)&&value>=0&&value<=6)
    ||(input.events??[]).some(value=>!validSessionDate(value.on)))throw new Error('Calendrier de simulation invalide.');
  // Normalisation sans effacer les diagnostics de qualité dans le dossier initial.
  let activities=structuredClone(input.activities.filter(value=>value.date<=input.referenceDate))
    .sort((a,b)=>a.date.localeCompare(b.date)||(a.id??'').localeCompare(b.id??'')||JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const intentions:PresentedSessionEvidence[]=[],previousContents:PrototypeSession[]=[];
  const days=[];
  for(let offset=0;offset<input.days;offset++){
    const date=calendarDateV2(input.referenceDate,offset);
    for(const event of input.events??[])if(event.on===date){
      if(event.removeId)activities=activities.filter(value=>value.id!==event.removeId);
      if(event.upsert){activities=activities.filter(value=>value.id!==event.upsert!.id);activities.push(structuredClone(event.upsert));}
    }
    const known=activities.filter(value=>value.date<=date);
    const reference=habitualReferenceFromOccurrencesV2({sessions:known.map(value=>({id:value.id??'',date:value.date,title:'Synthétique',sport:'RUNNING',
      durationSeconds:value.durationSeconds??NaN,trainingType:value.documentedType,feeling:value.effort?{effort:value.effort}:undefined})),occurrences:[]},date);
    const dossier=inspectHybridDossierV2({activities:known,reference,referenceDate:date},input.group);
    const applyB=variant==='B-mechanical'||variant==='B-draft'&&dossier.draftCriteriaMet;
    const parameters={...RECOVERY_TIMING_V2,...(applyB?input.group==='structured'?{structuredActivityGapDays:12}:{longActivityGapDays:9}:{})};
    const load=analyzeRecentLoadV2({activities:known,reference,referenceDate:date});
    const normalized=load.activities.map(value=>({id:value.id,date:value.date,documentedType:value.documentedType??undefined,
      effort:value.effort??undefined,durationSeconds:value.durationSeconds??undefined,distanceMeters:value.distanceMeters??undefined}));
    const policy=calendarLoadPolicyV2(known,reference,date,parameters);
    const envisaged=input.mode==='projection'?intentions:[];
    const available=input.availableWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    const selectionInput={referenceDate:date,goal:input.goal,habitualReferenceSeconds:reference.referenceSeconds,
      availabilitySeconds:input.availabilitySeconds,candidates:input.candidates,activities:normalized,presented:[],
      envisaged,complementaryTo:previousContents,coachTemperament:input.temperament,policy:parameters,loadPolicy:policy};
    // Préférence facile évaluée sur le groupe complet, après les protections sportives.
    const recovery=evaluateRecoveryV2({referenceDate:date,activities:normalized,intentions:envisaged,parameters});
    const temporallyAllowed=input.candidates.filter(value=>value.totalDurationSeconds<=input.availabilitySeconds
      &&recovery.gates[value.type==='long-run'?'longRun':isStructuredRecoveryTypeV2(value.type)?'structured':'all'].status==='admissible');
    const admissible=available?applyLoadAdaptationV2(temporallyAllowed,policy,reference.referenceSeconds):[];
    const choice=available?orchestratePrototypeSession(selectionInput):{selected:null,reason:'unavailable' as const};
    const selected=choice.selected;
    let actual:RecordedActivityEvidence|null=null;
    const feedback=input.feedback?.[date];
    if(selected){
      previousContents.push(selected);
      if(input.mode==='projection')intentions.push({date,type:selected.type});
      else if(feedback&&feedback.result!=='not-performed'){
        actual={id:`synthetic-${date}`,date,documentedType:feedback.result==='partial'?feedback.actualType:feedback.actualType??selected.type,
          durationSeconds:feedback.result==='partial'?feedback.durationSeconds:feedback.durationSeconds??selected.totalDurationSeconds,effort:feedback.effort,
          confirmedRealization:{occurrenceId:`synthetic-proposal-${date}`,result:feedback.result==='partial'?'partial':'completed'}};
        activities.push(actual);
      }
    }
    days.push({date,parameters,reference,available,admissibleTypes:admissible.map(value=>value.type),
      selected:selected?{type:selected.type,seconds:selected.totalDurationSeconds,intensity:selected.intensity}:null,
      reason:choice.reason,dossier:{draftCriteriaMet:dossier.draftCriteriaMet,failed:dossier.failed,
        humanBlockers:dossier.humanBlockers,d4c:dossier.d4c,activationAllowed:dossier.activationAllowed},
      protections:recovery.protections,loadPreference:policy.decisions.preference,loadReasons:policy.reasons,
      actual,feedback:feedback??null,knownActivityIds:load.activities.map(value=>value.id)});
  }
  return {variant,mode:input.mode,referenceDate:input.referenceDate,days,
    observedActivities:activities,activationAllowed:false as const};
}
export type HybridCalendarV2=ReturnType<typeof simulateHybridCalendarV2>;

/** Maxima sur toutes les fenêtres chevauchant le calendrier, queues incluses.
 * Passé réel connu à J + propositions futures, sans double compter leurs bilans.
 * En suivi avec événements, ceci décrit les offres, pas les activités réalisées. */
export function summarizeHybridCalendarV2(input:HybridCalendarInputV2,calendar:HybridCalendarV2) {
  const historical=analyzeRecentLoadV2({activities:input.activities,reference:input.reference,referenceDate:input.referenceDate}).activities
    .filter(value=>value.date<=input.referenceDate&&demanding(value.documentedType))
    .map(value=>({date:value.date,seconds:value.durationSeconds,type:value.documentedType}));
  const proposals=calendar.days.flatMap(value=>value.selected&&demanding(value.selected.type)?[{date:value.date,seconds:value.selected.seconds,type:value.selected.type}]:[]);
  const union=[...historical,...proposals].sort((a,b)=>a.date.localeCompare(b.date));
  const windows=([7,14] as const).map(length=>{
    const values=Array.from({length:input.days+length-1},(_,index)=>{
      const through=calendarDateV2(input.referenceDate,index),from=calendarDateV2(through,1-length);
      const rows=union.filter(value=>value.date>=from&&value.date<=through),total=rows.reduce((sum,value)=>sum+(value.seconds??0),0);
      return {from,through,count:rows.length,seconds:rows.some(value=>value.seconds===null)||!Number.isFinite(total)?null:total};
    });
    return {days:length,maximumCount:Math.max(...values.map(value=>value.count)),
      maximumSeconds:values.some(value=>value.seconds===null)?null:Math.max(...values.map(value=>value.seconds!)),windows:values};
  });
  const blocks28=Array.from({length:input.days/28},(_,index)=>{
    const from=calendarDateV2(input.referenceDate,index*28),through=calendarDateV2(from,27),rows=proposals.filter(value=>value.date>=from&&value.date<=through);
    return {from,through,count:rows.length,seconds:rows.reduce((sum,value)=>sum+value.seconds,0)};
  });
  return {proposals,blocks28,windows,
    transitions:proposals.slice(1).map((value,index)=>({from:proposals[index].type,to:value.type,fromDate:proposals[index].date,toDate:value.date,
      days:(Date.parse(value.date)-Date.parse(proposals[index].date))/DAY})),
    proposedDemandingCount:proposals.length,proposedDemandingSeconds:proposals.reduce((sum,value)=>sum+value.seconds,0),
    uncertainty:input.events?.length?'Événements ultérieurs : maxima comparatifs ancrés sur le passé connu à J ; recalibration glissante requise.':null};
}
export function compareHybridCalendarsV2(input:HybridCalendarInputV2) {
  const A=simulateHybridCalendarV2(input,'A'),mechanical=simulateHybridCalendarV2(input,'B-mechanical'),draft=simulateHybridCalendarV2(input,'B-draft');
  const baseline=summarizeHybridCalendarV2(input,A);
  const compare=(calendar:HybridCalendarV2)=>{
    const summary=summarizeHybridCalendarV2(input,calendar),violations:string[]=[];
    for(let i=0;i<summary.blocks28.length;i++){
      if(summary.blocks28[i].count>baseline.blocks28[i].count)violations.push(`more-demanding-in-block-${i}`);
      if(summary.blocks28[i].seconds>baseline.blocks28[i].seconds)violations.push(`more-duration-in-block-${i}`);
    }
    for(let i=0;i<summary.windows.length;i++){
      const current=summary.windows[i],base=baseline.windows[i];
      if(current.maximumCount>base.maximumCount)violations.push(`higher-count-peak-${current.days}`);
      if(current.maximumSeconds===null||base.maximumSeconds===null)violations.push(`unknown-duration-peak-${current.days}`);
      else if(current.maximumSeconds>base.maximumSeconds)violations.push(`higher-duration-peak-${current.days}`);
    }
    const cumulativeStatus=violations.some(value=>!value.startsWith('unknown-'))?'exceeds-A' as const
      :summary.uncertainty||violations.length?'inconclusive' as const:'within-comparison' as const;
    return {calendar,summary,violations,cumulativeStatus,
      changedDates:calendar.days.filter((value,index)=>JSON.stringify(value.selected)!==JSON.stringify(A.days[index].selected)).map(value=>value.date),
      activationAllowed:false as const};
  };
  return {A:{calendar:A,summary:baseline},mechanical:compare(mechanical),draft:compare(draft),
    effectivePolicy:'A' as const,humanBlockers:inspectHybridDossierV2({activities:input.activities,reference:input.reference,referenceDate:input.referenceDate},input.group).humanBlockers,
    conclusion:'maintien de A recommandé' as const};
}
