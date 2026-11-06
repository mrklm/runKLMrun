import { studyFrequencyHistoryV2 } from './frequency-history-v2';
import { evaluateSpacingEligibilityV2 } from '../spacing-eligibility-v2';
export type HybridGroupV2='structured'|'longRun';
/** Lecture littérale de la proposition documentaire, pas une politique activable.
 * Aucun seuil additionnel ; les validations humaines restent bloquantes. */
export function inspectHybridDossierV2(input:Parameters<typeof studyFrequencyHistoryV2>[0],group:HybridGroupV2) {
  const history=studyFrequencyHistoryV2(input),current=history.windows[0],full=history.windows[2];
  const selected=full[group],recent=current[group],volume=history.recent.volume;
  const exact=selected.comparison.hypothesisB.exactIntervalSources;
  const checks:{code:string;passed:boolean;sourceActivityIds:string[]}[]=[];
  const check=(code:string,passed:boolean,ids=selected.activityIds)=>checks.push({code,passed,sourceActivityIds:[...ids]});
  check('six-distinct-dates',selected.activeDays>=6);
  check('five-between-day-intervals',selected.intervals.length>=5);
  check('span-56-days',selected.spanDays>=56);
  check('three-occupied-blocks',selected.blocks28Days.every(value=>value.activeDays>0));
  check('two-recent-dates',recent.activeDays>=2);
  check('three-exact-B-intervals',exact.length>=3);
  check('exact-B-in-two-blocks',selected.comparison.hypothesisB.exactIntervalEndingBlocks28Days.length>=2);
  check('recent-complete-B-interval',exact.some(value=>value.fromDate>=current.period.from));
  const age=selected.lastRecordedDate?(Date.parse(input.referenceDate)-Date.parse(selected.lastRecordedDate))/86400000:null;
  check('last-family-at-most-14-days',age!==null&&age<=14);
  check('no-unexplained-recording-break',selected.blocks28Days.every(value=>value.activeDays>0)
    &&selected.maximumDays!==null&&selected.maximumDays<=28);
  check('historical-types-known',full.overall.coverage.unknownTypeActivityIds.length===0,full.overall.activityIds);
  check('historical-demanding-fields-known',!full.demanding.coverage.missingDurationActivityIds.length&&!full.demanding.coverage.missingEffortActivityIds.length,full.demanding.activityIds);
  check('recent-fields-known',!current.overall.coverage.missingDurationActivityIds.length&&!current.overall.coverage.missingEffortActivityIds.length,current.overall.activityIds);
  check('sources-resolved',!selected.coverage.inputUncertain);
  check('four-comparable-weeks',!volume.sourceUncertain&&volume.weeks.every(value=>value.completeForRecordedActivities),current.overall.activityIds);
  const latest=volume.weeks[3].duration.knownTotal,previous=volume.weeks[2].duration.knownTotal,median=volume.relativeToPriorMedian.referenceSeconds;
  check('volume-not-above-previous-or-median',latest!==null&&previous!==null&&median!==null&&latest<=previous&&latest<=median,current.overall.activityIds);
  check('nonpositive-volume-slope',volume.trend.slopeSecondsPerWeek!==null&&volume.trend.slopeSecondsPerWeek<=0,current.overall.activityIds);
  check('no-two-strictly-negative-transitions',!volume.transitions.slice(-2).every(value=>value.deltaSeconds!==null&&value.deltaSeconds<0),current.overall.activityIds);
  const eligibility=evaluateSpacingEligibilityV2(input)[group];
  check('no-documentary-adverse-signals',eligibility.unfavorable.length===0,eligibility.unfavorable.flatMap(value=>value.sourceActivityIds));
  check('D2-reference-and-data-available',history.recent.d2.quality.gaps.length===0,current.overall.activityIds);
  const failed=checks.filter(value=>!value.passed).map(value=>value.code);
  return {date:input.referenceDate,group,checks,failed,draftCriteriaMet:failed.length===0,
    adverse:eligibility.unfavorable,unknowns:eligibility.missing,
    d4c:eligibility.conclusion,d4cReadiness:eligibility.candidateReadiness,
    // La comparaison de cumul est calculée séparément, jamais supposée acquise.
    humanBlockers:['validate-experimental-profile','validate-cumulative-comparison',
      'resolve-D4c-not-calibrated-contract','authorize-limited-activation'] as const,
    activationAllowed:false as const};
}
