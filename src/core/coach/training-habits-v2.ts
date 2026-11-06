import { analyzeRecentLoadV2 } from './recent-load-v2';
import { INTERVAL_INTRODUCTION_EXPERIMENT } from './catalog-integration-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import type { RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import type { ContinuityIssueV2 } from './recommendation-continuity-v2';

/** Même horizon descriptif que la régularité existante, jamais un délai de récupération. */
export const TRAINING_HABITS_WINDOW_DAYS=INTERVAL_INTRODUCTION_EXPERIMENT.windowDays;
const WEEK_DAYS=7,DAY=86400000;
const day=(date:string)=>Date.parse(`${date}T00:00:00Z`)/DAY;
const civil=(position:number)=>new Date(position*DAY).toISOString().slice(0,10);
const structuredTypes=['intervals','steady-run','hills','endurance-variations'] as const;
type Load=ReturnType<typeof analyzeRecentLoadV2>;
type Activity=Load['activities'][number];
export interface HabitPeriodV2 {from:string;through:string;days:number}
export interface HabitIndicatorV2<T> {
  value:T;
  status:'observed'|'no-records'|'insufficient-data';
  period:HabitPeriodV2;
  sourceActivityIds:string[];
  populationActivityIds:string[];
  coverage:{
    /** Dénominateurs limités aux activités connues, sans promesse d'exhaustivité. */
    recordedActivities:number;classifiedActivities:number;groupActivities:number;knownValues:number;
    missingValueActivityIds:string[];unclassifiedActivityIds:string[];recordingCompleteness:'unknown';
  };
  /** Diagnostics de toute l'entrée, pas nécessairement attribuables à cette période. */
  inputQuality:Load['quality'] & {upstreamIssues:ContinuityIssueV2[]};
  limitations:string[];
}
const COMMON_LIMITATIONS=[
  'Les sources décrivent uniquement la pratique enregistrée ; une date vide ne prouve pas une absence de pratique.',
  'Les dates et espacements sont civils, pas des durées de récupération physiologique.',
  'Une réalisation complète ou partielle ne prouve aucune tolérance ; les confirmations ne pondèrent pas les activités.',
  'Une donnée écartée avant cette analyse ne peut être retrouvée sans diagnostic fourni par l’appelant.',
];

/** Analyse descriptive indépendante. Aucun appel au stockage, à l'horloge, au
 * classement ou aux politiques de récupération. Les entrées D1 ou activités D3b
 * sont acceptées ; transmettre les issues D3b si une validation amont les a exclues.
 * La référence fournie doit être celle de referenceDate ; sa confiance est conservée.
 */
export function analyzeTrainingHabitsV2(input:{
  activities:readonly RecordedActivityEvidence[];referenceDate:string;reference:ReferenceBootstrapResult;
  sourceIssues?:readonly ContinuityIssueV2[];
}) {
  // D2a assure normalisation, exclusion des dates futures et doublons contradictoires.
  const load=analyzeRecentLoadV2(input),end=day(input.referenceDate);
  const period:HabitPeriodV2={from:civil(end-TRAINING_HABITS_WINDOW_DAYS+1),through:input.referenceDate,days:TRAINING_HABITS_WINDOW_DAYS};
  const rows=load.activities.filter(value=>value.date>=period.from);
  const upstreamIssues=[...new Map((input.sourceIssues??[]).map(value=>{
    const issue={source:value.source,id:value.id,code:value.code};return [JSON.stringify(issue),issue] as const;
  })).values()].sort((a,b)=>a.source.localeCompare(b.source)||(a.id??'').localeCompare(b.id??'')||a.code.localeCompare(b.code));
  const inputQuality={...load.quality,upstreamIssues};
  const uncertainInput=load.quality.missingIdCount>0||load.quality.excluded.some(value=>value.reason!=='future-date')||upstreamIssues.length>0;
  function indicator<T>(value:T,selected:Activity[],observed:Activity[],window:HabitPeriodV2,missing:Activity[]=[],
    needsType=false,insufficient=false,limitations:string[]=[]):HabitIndicatorV2<T> {
    const unclassified=needsType?observed.filter(value=>value.documentedType===null):[];
    return {value,status:uncertainInput||missing.length||unclassified.length||insufficient?'insufficient-data':selected.length?'observed':'no-records',
      period:{...window},sourceActivityIds:selected.map(value=>value.id),populationActivityIds:observed.map(value=>value.id),coverage:{recordedActivities:observed.length,
        classifiedActivities:observed.filter(value=>value.documentedType!==null).length,groupActivities:selected.length,
        knownValues:selected.length-missing.length,missingValueActivityIds:missing.map(value=>value.id),
        unclassifiedActivityIds:unclassified.map(value=>value.id),recordingCompleteness:'unknown'},
      inputQuality:structuredClone(inputQuality),limitations:[...COMMON_LIMITATIONS,...limitations]};
  }
  function describe(selected:Activity[],needsType=false) {
    const days=[...new Set(selected.map(value=>value.date))];
    const byDay=days.map(date=>({date,activityIds:selected.filter(value=>value.date===date).map(value=>value.id)}));
    const betweenActiveDays=byDay.slice(1).map((value,index)=>({fromDate:byDay[index].date,toDate:value.date,
      days:day(value.date)-day(byDay[index].date),fromActivityIds:[...byDay[index].activityIds],toActivityIds:[...value.activityIds]}));
    // L'ordre des activités du même jour n'est pas inventé. n activités donnent
    // n-1 écarts civils nuls, indépendamment de leur ordre intrajournalier inconnu.
    const sameDayGroups=byDay.filter(value=>value.activityIds.length>1)
      .map(value=>({...value,zeroDayGapCount:value.activityIds.length-1}));
    const gapDays=byDay.flatMap((value,index)=>[
      ...(index?[day(value.date)-day(byDay[index-1].date)]:[]),...Array<number>(value.activityIds.length-1).fill(0),
    ]);
    const efforts={easy:0,moderate:0,hard:0,'very-hard':0,unknown:0};
    selected.forEach(value=>efforts[value.effort??'unknown']++);
    return {
      frequency:indicator({activityCount:selected.length,activeDays:days.length,activitiesPerWeek:selected.length/(period.days/WEEK_DAYS)},
        selected,rows,period,[],needsType,false,['La fréquence divise le nombre enregistré par quatre semaines entières, même pour un historique récent incomplet.']),
      spacing:indicator({gapDays,betweenActiveDays,sameDayGroups,intervalCount:gapDays.length,
        minimumDays:gapDays.length?gapDays.reduce((a,b)=>Math.min(a,b)):null,maximumDays:gapDays.length?gapDays.reduce((a,b)=>Math.max(a,b)):null},
        selected,rows,period,[],needsType,selected.length<2,
        ['Espacements entre activités de ce groupe dans la fenêtre seulement ; aucun écart traversant sa borne gauche.',
          'Les groupes du même jour n’établissent aucun ordre horaire. Les écarts longs peuvent refléter des données manquantes.']),
      relativeDurations:indicator(selected.map(value=>({activityId:value.id,date:value.date,durationSeconds:value.durationSeconds,
        relativeDuration:value.relativeDuration})),selected,rows,period,selected.filter(value=>value.relativeDuration===null),needsType,false,
        ['Chaque rapport utilise la même durée de référence à la date de consultation, pas une référence historique propre à chaque activité.',
          `Confiance de référence : ${load.habitualReference.confidence} ; fraîcheur : ${load.habitualReference.freshness}. Aucun rapport ne mesure une capacité.`]),
      efforts:indicator({counts:efforts,activities:selected.map(value=>({activityId:value.id,date:value.date,effort:value.effort}))},
        selected,rows,period,selected.filter(value=>value.effort===null),needsType,false,
        ['Le ressenti décrit la séance déclarée, pas son délai de récupération. Aucun commentaire libre n’est interprété.']),
    };
  }
  const weeks=Array.from({length:period.days/WEEK_DAYS},(_,index)=>{
    const from=end-period.days+1+index*WEEK_DAYS;
    const window={from:civil(from),through:civil(from+WEEK_DAYS-1),days:WEEK_DAYS};
    const selected=rows.filter(value=>value.date>=window.from&&value.date<=window.through);
    return indicator({activityCount:selected.length,activeDays:new Set(selected.map(value=>value.date)).size},selected,selected,window,[],false,false,
      ['Période glissante de sept jours ancrée sur la date de consultation, pas une semaine ISO.']);
  });
  const structured=rows.filter(value=>structuredTypes.some(type=>type===value.documentedType));
  const longRuns=rows.filter(value=>value.documentedType==='long-run');
  const w7=load.windows.last7Days,w14=load.windows.last14Days;
  const previousCount=w14.activityCount-w7.activityCount;
  const complete=!uncertainInput&&!w14.durationSeconds.unknownCount&&!w14.durationSeconds.overflow
    &&!w7.durationSeconds.overflow&&w14.durationSeconds.knownTotal!==null&&w7.durationSeconds.knownTotal!==null;
  const previousSeconds=complete?w14.durationSeconds.knownTotal!-w7.durationSeconds.knownTotal!:null;
  const comparable=complete&&w7.activityCount>0&&previousCount>0&&previousSeconds!==null&&previousSeconds>0;
  const change=comparable?(w7.durationSeconds.knownTotal!>previousSeconds!?'increased'
    :w7.durationSeconds.knownTotal!<previousSeconds!?'decreased':'equal'):'unknown';
  const volumeRows=load.activities.filter(value=>value.date>=w14.from);
  const latestDate=load.activities.at(-1)?.date??null;
  const latest=load.activities.filter(value=>value.date===latestDate);
  const immediatePeriod={from:load.activities[0]?.date??input.referenceDate,through:input.referenceDate,
    days:load.activities.length?end-day(load.activities[0].date)+1:1};
  return {analysisVersion:'d4a-1' as const,referenceDate:input.referenceDate,
    immediateContext:indicator({lastRecordedActivityDate:latestDate,daysSinceLastRecordedActivity:latestDate?end-day(latestDate):null,
      recoveryStatus:'not-measured' as const},latest,load.activities,immediatePeriod,[],false,false,
      ['Le nombre de jours depuis la dernière activité enregistrée n’atteste ni repos effectif ni récupération.']),
    historicalRegularity:{activeWeeks:indicator({count:weeks.filter(value=>value.value.activityCount>0).length,totalWeeks:weeks.length},rows,rows,period),
      weeks,activities:describe(rows)},
    demandingSpacing:{structured:describe(structured,true),
      structuredByFamily:Object.fromEntries(structuredTypes.map(type=>[type,describe(structured.filter(value=>value.documentedType===type),true)])),
      longRuns:describe(longRuns,true)},
    cumulativeLoad:{windows:Object.fromEntries(Object.entries(load.windows).map(([key,window])=>{
      const observed=load.activities.filter(value=>value.date>=window.from);
      const missing=observed.filter(value=>value.durationSeconds===null||value.distanceMeters===null||value.effort===null);
      return [key,indicator(structuredClone(window),observed,observed,{from:window.from,through:window.through,days:window.days},missing,true,
        window.durationSeconds.overflow||window.distanceMeters.overflow,
        ['Agrégat D2a conservé sans coefficient de ressenti ; chaque mesure garde sa propre couverture.'])];
    })),
      volumeEvolution:indicator({last7Days:{period:{from:w7.from,through:w7.through,days:7},activityCount:w7.activityCount,
        durationSeconds:structuredClone(w7.durationSeconds)},
      previous7Days:{period:{from:w14.from,through:civil(end-7),days:7},activityCount:previousCount,durationSeconds:previousSeconds},
      comparison:change,deltaSeconds:comparable?w7.durationSeconds.knownTotal!-previousSeconds!:null},
      volumeRows,volumeRows,{from:w14.from,through:w14.through,days:14},volumeRows.filter(value=>value.durationSeconds===null),false,!comparable,
      ['Comparaison descriptive de deux périodes adjacentes, non superposées, issues de D2a.',
        'Une période sans activité enregistrée ou des durées incomplètes ne permettent pas de conclure à une évolution comparable.',
        'Un volume égal ou inférieur ne prouve ni stabilité à long terme ni bonne récupération.'])},
    habitualReference:structuredClone(load.habitualReference),inputQuality:structuredClone(inputQuality),
  };
}
