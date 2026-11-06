import { analyzeRecentLoadV2 } from '../recent-load-v2';
import { analyzeTrainingHabitsV2 } from '../training-habits-v2';
import { analyzeVolumeObservationsV2 } from '../volume-observations-v2';
import { interpretRecentLoadV2 } from '../load-adaptation-policy-v2';
import { evaluateRecoveryV2,isStructuredRecoveryTypeV2,RECOVERY_TIMING_V2 } from '../recovery-policy-v2';

type Input=Parameters<typeof analyzeTrainingHabitsV2>[0];
type Row=ReturnType<typeof analyzeRecentLoadV2>['activities'][number];
const DAY=86400000;
const day=(date:string)=>Date.parse(`${date}T00:00:00Z`)/DAY;
const civil=(value:number)=>new Date(value*DAY).toISOString().slice(0,10);
const finite=(value:number)=>Number.isFinite(value)?value:null;
const median=(values:number[])=>{
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return n?n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2:null;
};
/** Laboratoire descriptif autonome, sans sélection ni recommandation.
 * Les horizons sont comparés, jamais utilisés comme seuils d'autorisation.
 * L'hypothèse B (12/9) ne modifie pas les paramètres de récupération.
 */
export function studyFrequencyHistoryV2(input:Input) {
  const load=analyzeRecentLoadV2(input),habits=analyzeTrainingHabitsV2(input);
  const volume=analyzeVolumeObservationsV2(input),d2=interpretRecentLoadV2(load);
  const recovery=evaluateRecoveryV2({referenceDate:input.referenceDate,activities:load.activities});
  const inputQuality=habits.inputQuality;
  const uncertain=inputQuality.missingIdCount>0||inputQuality.excluded.some(value=>value.reason!=='future-date')||inputQuality.upstreamIssues.length>0;
  const windows=([28,56,84] as const).map(days=>{
    const end=day(input.referenceDate),from=civil(end-days+1),rows=load.activities.filter(value=>value.date>=from);
    const period={from,through:input.referenceDate,days};
    const weeks=Array.from({length:days/7},(_,index)=>({from:civil(end-days+1+index*7),through:civil(end-days+7+index*7),days:7}));
    const blocks=Array.from({length:days/28},(_,index)=>({from:civil(end-days+1+index*28),through:civil(end-days+28+index*28),days:28}));
    const describe=(selected:Row[])=>{
      const dates=[...new Set(selected.map(value=>value.date))];
      const byDate=dates.map(date=>({date,activityIds:selected.filter(value=>value.date===date).map(value=>value.id)}));
      const intervals=byDate.slice(1).map((value,index)=>({fromDate:byDate[index].date,toDate:value.date,
        days:day(value.date)-day(byDate[index].date),fromActivityIds:byDate[index].activityIds,toActivityIds:value.activityIds}));
      const sameDay=byDate.filter(value=>value.activityIds.length>1).map(value=>({...value,zeroGapCount:value.activityIds.length-1}));
      const gaps=[...intervals.map(value=>value.days),...sameDay.flatMap(value=>Array<number>(value.zeroGapCount).fill(0))].sort((a,b)=>a-b);
      const histogram=[...new Set(gaps)].map(gap=>({days:gap,count:gaps.filter(value=>value===gap).length}));
      const distribution=(windows:typeof weeks)=>windows.map(window=>{
        const activities=selected.filter(value=>value.date>=window.from&&value.date<=window.through);
        const known=activities.filter(value=>value.durationSeconds!==null);
        return {period:{...window},activityIds:activities.map(value=>value.id),activityCount:activities.length,
          activeDays:new Set(activities.map(value=>value.date)).size,
          knownDurationSeconds:known.length||!activities.length?finite(known.reduce((sum,value)=>sum+value.durationSeconds!,0)):null,
          missingDurationIds:activities.filter(value=>value.durationSeconds===null).map(value=>value.id),
          // Une affectation à la date d'arrivée ne coupe pas l'intervalle en deux.
          endingIntervalCount:intervals.filter(value=>value.toDate>=window.from&&value.toDate<=window.through).length};
      });
      return {activityIds:selected.map(value=>value.id),activityCount:selected.length,activeDays:dates.length,
        recordedActivitiesPerWeek:selected.length/(days/7),firstRecordedDate:dates[0]??null,lastRecordedDate:dates.at(-1)??null,
        spanDays:dates.length?day(dates.at(-1)!)-day(dates[0])+1:0,
        intervals,sameDay,intervalCount:gaps.length,histogram,medianDays:median(gaps),
        minimumDays:gaps[0]??null,maximumDays:gaps.at(-1)??null,
        repetition:gaps.length<2?'insufficient-intervals' as const:histogram.length===1?'equal-observed-gaps' as const:'variable-observed-gaps' as const,
        weeks:distribution(weeks),blocks28Days:distribution(blocks),
        efforts:selected.map(value=>({activityId:value.id,date:value.date,effort:value.effort})),
        coverage:{recordedActivities:rows.length,groupActivities:selected.length,
          unknownTypeActivityIds:rows.filter(value=>value.documentedType===null).map(value=>value.id),
          missingEffortActivityIds:selected.filter(value=>value.effort===null).map(value=>value.id),
          missingDurationActivityIds:selected.filter(value=>value.durationSeconds===null).map(value=>value.id),
          inputUncertain:uncertain,recordingCompleteness:'unknown' as const}};
    };
    const compare=(selected:Row[],hypothesisDays:number,currentDays:number)=>{
      const observations=describe(selected);
      const counts=(target:number)=>({below:observations.histogram.filter(value=>value.days<target).reduce((sum,value)=>sum+value.count,0),
        equal:observations.histogram.find(value=>value.days===target)?.count??0,
        above:observations.histogram.filter(value=>value.days>target).reduce((sum,value)=>sum+value.count,0)});
      const exact=observations.intervals.filter(value=>value.days===hypothesisDays);
      return {...observations,comparison:{current:{days:currentDays,...counts(currentDays)},hypothesisB:{days:hypothesisDays,...counts(hypothesisDays),
        exactIntervalSources:exact,
        exactIntervalEndingWeeks:weeks.filter(week=>exact.some(value=>value.toDate>=week.from&&value.toDate<=week.through)),
        exactIntervalEndingBlocks28Days:blocks.filter(block=>exact.some(value=>value.toDate>=block.from&&value.toDate<=block.through))}},
        uncertaintyReasons:[...(observations.intervalCount<2?['fewer-than-two-intervals']:[]),
          ...(observations.coverage.unknownTypeActivityIds.length?['unknown-types']:[]),
          ...(observations.coverage.missingEffortActivityIds.length?['unknown-efforts']:[]),
          ...(observations.coverage.missingDurationActivityIds.length?['unknown-durations']:[]),
          ...(uncertain?['source-quality']:[]),'recording-completeness-unknown','physiological-recovery-not-measured']};
    };
    const structured=rows.filter(value=>isStructuredRecoveryTypeV2(value.documentedType));
    const longRuns=rows.filter(value=>value.documentedType==='long-run');
    const demanding=rows.filter(value=>isStructuredRecoveryTypeV2(value.documentedType)||value.documentedType==='long-run');
    return {period,overall:describe(rows),structured:compare(structured,12,RECOVERY_TIMING_V2.structuredActivityGapDays),
      longRun:compare(longRuns,9,RECOVERY_TIMING_V2.longActivityGapDays),demanding:describe(demanding),
      // Jours mixtes explicites ; l'ordre intrajournalier n'est pas inventé.
      mixedDays:[...new Set(demanding.map(value=>value.date))].filter(date=>structured.some(value=>value.date===date)&&longRuns.some(value=>value.date===date)),
      inputQuality:structuredClone(inputQuality)};
  });
  return {studyVersion:'frequency-history-exploration-1' as const,referenceDate:input.referenceDate,windows,
    recent:{period:{from:load.windows.last14Days.from,through:load.windows.last14Days.through,days:14},volume,d2,recovery,
      difficultActivityIds:recovery.preference.sources.flatMap(value=>value.id?[value.id]:[]),
      cautionReasons:d2.reasons.filter(value=>value.code==='difficult-effort'||value.code==='very-hard-protection'
        ||value.code==='concentrated-volume-increase'||value.code==='concentrated-above-habitual'),
      unknowns:d2.quality.gaps},
    limitations:[
      'Fréquence enregistrée, jamais une estimation de récupération physiologique ou une autorisation.',
      'Deux intervalles permettent seulement de constater une répétition minimale, pas une habitude suffisamment établie.',
      'Aucun intervalle traversant la borne gauche n’est compté ; les nombres dépendent des bornes et de la phase des séances.',
      'Une même fréquence peut être récente, ancienne, concentrée ou durable : examiner la distribution et la période réellement couverte.',
      'Les ressentis difficiles récents restent exposés sans être neutralisés par la fréquence historique.',
      'La proximité des règles actuelles est décrite par les écarts exacts, sans marge de proximité arbitraire.',
      'Ni recommandation, ni confirmation, ni intention future ne crée une preuve de tolérance.',
      'Aucune politique choisie, aucun candidat désigné, aucun délai modifié.',
    ]};
}
