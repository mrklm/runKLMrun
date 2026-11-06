import { analyzeTrainingHabitsV2 } from './training-habits-v2';
import { analyzeRecentLoadV2 } from './recent-load-v2';
const finite=(value:number)=>Number.isFinite(value)?value:null;
/** Observations D4d partagées avec D4c, sans seuil, éligibilité ou admissibilité.
 * Aucune extrapolation des durées inconnues, aucun état physiologique inféré. */
export function analyzeVolumeObservationsV2(input:Parameters<typeof analyzeTrainingHabitsV2>[0]) {
  const load=analyzeRecentLoadV2(input),habits=analyzeTrainingHabitsV2(input);
  const normalized=load.activities.map(value=>({id:value.id,date:value.date,
    durationSeconds:value.durationSeconds??undefined,distanceMeters:value.distanceMeters??undefined,
    documentedType:value.documentedType??undefined,effort:value.effort??undefined}));
  const weeks=habits.historicalRegularity.weeks.map(week=>{
    const observed=analyzeRecentLoadV2({...input,activities:normalized,referenceDate:week.period.through}).windows.last7Days;
    return {period:week.period,activityIds:observed.activityIds,activityCount:observed.activityCount,
      duration:observed.durationSeconds,
      completeForRecordedActivities:observed.activityCount>0&&!observed.durationSeconds.unknownCount&&!observed.durationSeconds.overflow};
  });
  const sourceUncertain=load.quality.missingIdCount>0||load.quality.excluded.some(value=>value.reason!=='future-date')||(input.sourceIssues?.length??0)>0;
  const totals=weeks.map(week=>week.completeForRecordedActivities&&!sourceUncertain?week.duration.knownTotal:null);
  const referenceValues=totals.slice(0,-1);
  const referenceSeconds=referenceValues.every(value=>value!==null)?[...referenceValues as number[]].sort((a,b)=>a-b)[1]:null;
  const latest=totals.at(-1)??null;
  const relativeChange=latest!==null&&referenceSeconds!==null&&referenceSeconds>0?finite((latest-referenceSeconds)/referenceSeconds):null;
  const transitions=weeks.slice(1).map((week,index)=>{
    const before=totals[index],after=totals[index+1];
    return {from:weeks[index].period,to:week.period,
      deltaSeconds:before!==null&&after!==null?finite(after-before):null,
      relativeChange:before!==null&&before>0&&after!==null?finite((after-before)/before):null};
  });
  // Pente des moindres carrés sur les quatre semaines également espacées.
  // Ce coefficient statistique n'est ni un poids de risque ni un seuil.
  const complete=totals.every(value=>value!==null);
  const mean=complete?(totals as number[]).reduce((sum,value)=>sum+value/4,0):null;
  const slope=mean!==null?finite((totals as number[]).reduce((sum,value,index)=>sum+(index-1.5)*(value-mean),0)/5):null;
  return {weeks,strictEquality:habits.cumulativeLoad.volumeEvolution.value.comparison,
    relativeToPriorMedian:{referenceSeconds,relativeChange},transitions,
    trend:{slopeSecondsPerWeek:slope,rangeSeconds:complete?finite(Math.max(...totals as number[])-Math.min(...totals as number[])):null},
    sourceUncertain,recordingCompleteness:'unknown' as const};
}
