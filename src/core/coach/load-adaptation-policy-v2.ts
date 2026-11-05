import type { analyzeRecentLoadV2 } from './recent-load-v2';
import { FEELING_PREFERENCE_WINDOW_DAYS,SESSION_ORCHESTRATOR_EXPERIMENT } from './simulation/session-orchestrator-v2';

export type RecentLoadAnalysisV2=ReturnType<typeof analyzeRecentLoadV2>;
type Activity=RecentLoadAnalysisV2['activities'][number];
export type LoadPolicyGapCode='no-recent-activity'|'unconfirmed-reference'|'missing-duration'
  |'missing-effort'|'missing-type'|'excluded-data'|'numeric-overflow';
export interface LoadPolicyReasonV2 {
  code:'minimum-rest'|'structured-gap'|'long-run-gap'|'very-hard-protection'|'difficult-effort'
    |'concentrated-above-habitual'|'concentrated-volume-increase'|'incomplete-evidence';
  source:'existing-protection'|'proposed-preference'|'data-quality';
  activityIds:string[];
  explanation:string;
}
export interface LoadPolicyGateV2 {
  /** baseline-only n'est jamais une autorisation : les autres filtres du Coach restent nécessaires. */
  status:'defer'|'review'|'baseline-only';
  /** Première date non bloquée par les seules protections connues. Ne garantit pas l'admissibilité future. */
  notBefore:string|null;
}
export interface LoadProtectionV2 {
  code:'minimum-rest'|'structured-gap'|'long-run-gap'|'very-hard-protection';
  scope:'all'|'structured'|'long-run'|'demanding';
  days:number;
  notBefore:string;
  activityIds:string[];
}
const DAY=86_400_000;
const day=(date:string)=>Date.parse(`${date}T00:00:00Z`)/DAY;
const addDays=(date:string,count:number)=>new Date((day(date)+count)*DAY).toISOString().slice(0,10);
const structured=(value:Activity)=>value.documentedType!==null
  &&['intervals','steady-run','hills','endurance-variations'].includes(value.documentedType);

/** Politique pure D2b-1, appliquée par l'adaptateur depuis D2b-2. Entrée : résultat de D2a à la
 * date examinée, jamais un agrégat modifié ou calculé pour une autre date.
 * Les protections existantes forment un plancher séparé des préférences.
 * Aucun score, coefficient de ressenti, durée fictive ou nouvelle date de récupération.
 */
export function interpretRecentLoadV2(load:RecentLoadAnalysisV2) {
  const today=load.referenceDate,rows=load.activities;
  const {last3Days:w3,last7Days:w7,last14Days:w14}=load.windows;
  const recent=rows.filter(value=>value.date>=w7.from);
  const recent14=rows.filter(value=>value.date>=w14.from);
  const reasons:LoadPolicyReasonV2[]=[],protections:LoadProtectionV2[]=[];
  const floors=SESSION_ORCHESTRATOR_EXPERIMENT;
  const protect=(code:LoadProtectionV2['code'],scope:LoadProtectionV2['scope'],days:number,
    values:Activity[],explanation:string)=>{
    const active=values.filter(value=>day(today)-day(value.date)<days);
    if(!active.length)return;
    const notBefore=active.map(value=>addDays(value.date,days)).sort().at(-1)!;
    const activityIds=active.map(value=>value.id);
    protections.push({code,scope,days,notBefore,activityIds});
    reasons.push({code,source:'existing-protection',activityIds:[...activityIds],explanation});
  };
  protect('minimum-rest','all',floors.minimumDaysAfterActivity,rows,'Deux jours civils minimum après toute activité réelle, même sans durée.');
  protect('structured-gap','structured',floors.structuredActivityGapDays,rows.filter(structured),'Espacement existant de quatorze jours après un type structuré déclaré.');
  protect('long-run-gap','long-run',floors.longActivityGapDays,rows.filter(value=>value.documentedType==='long-run'),'Espacement existant de dix jours après une sortie longue déclarée.');
  protect('very-hard-protection','demanding',FEELING_PREFERENCE_WINDOW_DAYS,rows.filter(value=>value.effort==='very-hard'),
    'Pendant sept jours, privilégier le facile ; sans option facile admissible, aucune séance exigeante.');

  const gaps:{code:LoadPolicyGapCode;activityIds:string[]}[]=[];
  const gap=(code:LoadPolicyGapCode,values:Activity[])=>gaps.push({code,activityIds:values.map(value=>value.id)});
  if(!w7.activityCount)gap('no-recent-activity',[]);
  const confirmed=load.habitualReference.seconds!==null&&load.habitualReference.confidence==='confirmed'
    &&load.habitualReference.freshness==='current';
  if(!confirmed)gap('unconfirmed-reference',[]);
  if(w14.durationSeconds.unknownCount)gap('missing-duration',recent14.filter(value=>value.durationSeconds===null));
  if(w7.efforts.unknown)gap('missing-effort',recent.filter(value=>value.effort===null));
  if(w14.unknownTypeCount)gap('missing-type',recent14.filter(value=>value.documentedType===null));
  const harmfulExclusions=load.quality.excluded.filter(value=>value.reason!=='future-date');
  const excludedData=load.quality.missingIdCount>0||harmfulExclusions.length>0;
  if(excludedData)gaps.push({code:'excluded-data',activityIds:harmfulExclusions.map(value=>value.id)});
  if(w14.durationSeconds.overflow||w7.durationSeconds.overflow)gap('numeric-overflow',recent14);

  // Deux fenêtres adjacentes de même longueur. Le volume sur 14 jours inclut
  // celui sur 7 jours : ne jamais comparer directement ces sommes imbriquées.
  const previousCount=w14.activityCount-w7.activityCount;
  const completeVolumes=!excludedData&&!w14.durationSeconds.unknownCount&&!w14.durationSeconds.overflow
    &&!w7.durationSeconds.overflow&&w14.durationSeconds.knownTotal!==null&&w7.durationSeconds.knownTotal!==null;
  const previousSeconds=completeVolumes?w14.durationSeconds.knownTotal!-w7.durationSeconds.knownTotal!:null;
  const comparable=completeVolumes&&w7.activityCount>0&&previousCount>0&&previousSeconds!==null&&previousSeconds>0;
  const volumeChange=comparable?(w7.durationSeconds.knownTotal!>previousSeconds!?'increased':'not-increased'):'unknown';
  const concentrated=w3.activityCount>1;
  const aboveHabitual=confirmed?recent.filter(value=>value.relativeDuration!==null&&value.relativeDuration>1):[];
  const concentratedAbove=aboveHabitual.filter(value=>value.date>=w3.from);
  const difficult=recent.filter(value=>value.effort==='hard'||value.effort==='very-hard');
  if(difficult.length)reasons.push({code:'difficult-effort',source:'existing-protection',activityIds:difficult.map(value=>value.id),
    explanation:'Ressenti difficile dans la fenêtre existante de sept jours : préférer une option facile admissible.'});
  // Une simple différence positive n'est pas un seuil de surcharge. La nouvelle
  // préférence exige une concentration observée et un second fait concordant.
  const durationPreference=concentrated&&concentratedAbove.length>0&&!excludedData;
  const volumePreference=concentrated&&volumeChange==='increased';
  if(durationPreference)reasons.push({code:'concentrated-above-habitual',source:'proposed-preference',activityIds:[...w3.activityIds],
    explanation:'Plusieurs activités sur trois jours, dont une plus longue que la référence confirmée : préférence prudente pour la récupération, sans nouveau délai.'});
  if(volumePreference)reasons.push({code:'concentrated-volume-increase',source:'proposed-preference',activityIds:[...w14.activityIds],
    explanation:'Plusieurs activités sur trois jours et volume observé supérieur aux sept jours précédents : préférence prudente pour la récupération, sans seuil de surcharge.'});
  if(gaps.length)reasons.push({code:'incomplete-evidence',source:'data-quality',activityIds:[...new Set(gaps.flatMap(value=>value.activityIds))].sort(),
    explanation:'Données insuffisantes pour justifier une intensification ; réévaluer sans inventer de charge ni de date de récupération.'});
  const recoveryPreference=difficult.length>0||durationPreference||volumePreference;
  const gate=(scope:'all'|'structured'|'long-run'):LoadPolicyGateV2=>{
    const dates=protections.filter(value=>value.scope==='all'||value.scope===scope||scope!=='all'&&value.scope==='demanding')
      .map(value=>value.notBefore).sort();
    const notBefore=dates.at(-1)??null;
    return {status:notBefore?'defer':excludedData||scope!=='all'&&gaps.length?'review':'baseline-only',notBefore};
  };
  return {
    policyVersion:'d2b-1' as const,referenceDate:today,
    protections,
    decisions:{allSessions:gate('all'),structured:gate('structured'),longRun:gate('long-run'),
      preference:recoveryPreference?'recovery' as const:gaps.length?'cautious' as const:'unchanged' as const,
      progression:recoveryPreference||gaps.length?'do-not-increase' as const:'baseline-only' as const},
    evidence:{
      pattern:w7.activityCount===0?'none' as const:w7.activityCount===1?'isolated' as const:concentrated?'concentrated' as const:'multiple-spread' as const,
      aboveHabitualActivityIds:aboveHabitual.map(value=>value.id),
      volumes:{last7DaysSeconds:w7.durationSeconds.knownTotal,last14DaysSeconds:w14.durationSeconds.knownTotal,
        previous7DaysSeconds:previousSeconds,comparison:volumeChange},
      concentration:{activityCount:w3.activityCount,activeDays:w3.activeDays,maximumActivitiesPerDay:w3.maximumActivitiesPerDay},
      efforts:{...w7.efforts},structuredActivityIds:[...w14.structuredActivityIds],longRunActivityIds:[...w14.longRunActivityIds],
    },
    quality:{gaps,durationCoverage14Days:{known:w14.durationSeconds.knownCount,unknown:w14.durationSeconds.unknownCount},
      effortCoverage7Days:{known:w7.activityCount-w7.efforts.unknown,unknown:w7.efforts.unknown},
      distanceCoverage14Days:{known:w14.distanceMeters.knownCount,unknown:w14.distanceMeters.unknownCount},
      missingIdCount:load.quality.missingIdCount,excluded:load.quality.excluded.map(value=>({...value})),
      duplicateIds:[...load.quality.duplicateIds]},
    reasons,
  };
}
