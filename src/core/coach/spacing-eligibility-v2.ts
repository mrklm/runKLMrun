import { analyzeTrainingHabitsV2,type HabitPeriodV2 } from './training-habits-v2';
import { analyzeVolumeObservationsV2 } from './volume-observations-v2';
import { analyzeRecentLoadV2 } from './recent-load-v2';
import { interpretRecentLoadV2 } from './load-adaptation-policy-v2';
import { evaluateRecoveryV2,FEELING_PREFERENCE_WINDOW_DAYS } from './recovery-policy-v2';

export type SpacingEligibilityConclusionV2='maintain'|'insufficient-data'|'candidate';
export interface EligibilityObservationV2 {
  code:string;reason:string;sourceActivityIds:string[];period:HabitPeriodV2;
}
const DAY=86400000;
const elapsed=(from:string,to:string)=>(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/DAY;
const limitations=[
  'Candidate permet seulement d’étudier un assouplissement ; aucun délai réduit ni recommandation ne découle de cette analyse.',
  'Les critères sont descriptifs et éditoriaux, pas des seuils physiologiques validés.',
  'La pratique non enregistrée reste inconnue ; une période vide ne prouve ni repos ni absence de pratique.',
  'Les ressentis et réalisations complètes ou partielles ne prouvent pas une récupération ou une tolérance.',
  'Les corrections sont évaluées dans l’instantané courant ; aucun journal de corrections n’est reconstitué.',
];

/** Analyse autonome sans stockage ni branchement au classement. Même contrat
 * de preuves admissibles que D4a : transmettre aussi les diagnostics amont D3b.
 * Aucun statut de réalisation, prescription ou intention ne crée une preuve.
 */
export function evaluateSpacingEligibilityV2(input:Parameters<typeof analyzeTrainingHabitsV2>[0]) {
  const habits=analyzeTrainingHabitsV2(input),all=habits.historicalRegularity.activities;
  const period=all.frequency.period,quality=habits.inputQuality;
  const load=analyzeRecentLoadV2(input),volume=analyzeVolumeObservationsV2(input),d2=interpretRecentLoadV2(load);
  const admissibility=evaluateRecoveryV2({referenceDate:input.referenceDate,activities:load.activities});
  const structured=habits.demandingSpacing.structured,longRuns=habits.demandingSpacing.longRuns;
  // D4a a déjà normalisé et dédupliqué ces observations, excluant les dates futures.
  const demanding=[...structured.efforts.value.activities,...longRuns.efforts.value.activities]
    .sort((a,b)=>a.date.localeCompare(b.date)||a.activityId.localeCompare(b.activityId));
  const structuredIds=new Set(structured.frequency.sourceActivityIds);
  const interactions=demanding.flatMap((next,index)=>{
    const previous=demanding[index-1];
    return previous&&structuredIds.has(previous.activityId)!==structuredIds.has(next.activityId)
      ?[{fromDate:previous.date,toDate:next.date,days:elapsed(previous.date,next.date),
        sourceActivityIds:[previous.activityId,next.activityId]}]:[];
  });
  const evaluate=(family:'structured'|'long-run')=>{
    const group=family==='structured'?structured:longRuns;

    const favorable:EligibilityObservationV2[]=[],unfavorable:EligibilityObservationV2[]=[],missing:EligibilityObservationV2[]=[];
    const fact=(list:EligibilityObservationV2[],code:string,reason:string,ids:readonly string[],window=period)=>
      list.push({code,reason,sourceActivityIds:[...new Set(ids)].sort(),period:{...window}});
    const observed=all.frequency.sourceActivityIds;
    const badQuality=quality.missingIdCount>0||quality.excluded.some(value=>value.reason!=='future-date')||quality.upstreamIssues.length>0;
    if(badQuality)fact(missing,'source-quality','Sources exclues, sans identifiant ou diagnostics amont non résolus ; aucun arbitrage favorable.',
      [...quality.excluded.filter(value=>value.reason!=='future-date').map(value=>value.id),...quality.upstreamIssues.flatMap(value=>value.id?[value.id]:[])]);
    const untyped=group.frequency.coverage.unclassifiedActivityIds;
    if(untyped.length)fact(missing,'unknown-types','Des types réels inconnus empêchent de connaître les expériences et interactions exigeantes.',untyped);
    const unknownEfforts=all.efforts.coverage.missingValueActivityIds;
    if(unknownEfforts.length)fact(missing,'unknown-efforts','Couverture des ressentis incomplète sur les activités observées.',unknownEfforts);
    const unknownDurations=all.relativeDurations.value.filter(value=>value.durationSeconds===null).map(value=>value.activityId);
    if(unknownDurations.length)fact(missing,'unknown-durations','Durées réelles manquantes ; aucune charge n’est déduite des prescriptions.',unknownDurations);
    if(!badQuality&&!untyped.length&&!unknownEfforts.length&&!unknownDurations.length&&observed.length)
      fact(favorable,'documented-records','Types, ressentis et durées renseignés pour les activités enregistrées, sans garantie d’exhaustivité.',observed);

    const weeks=habits.historicalRegularity.activeWeeks;
    if(weeks.value.count===weeks.value.totalWeeks)
      fact(favorable,'regular-recording','Au moins une activité dans chacune des quatre semaines glissantes D4a.',observed);
    else fact(missing,'recent-regularity','Les quatre semaines ne sont pas toutes documentées ; aucune interruption certaine n’est déduite.',observed);

    const ids=group.frequency.sourceActivityIds;
    if(group.frequency.value.activeDays>=3)
      fact(favorable,'repeated-family','Au moins trois dates du groupe : plusieurs intervalles observables, sans preuve de tolérance.',ids);
    else fact(missing,'family-experience','Moins de trois dates du groupe : au plus un intervalle, répétition insuffisamment documentée.',ids);
    if(group.spacing.value.intervalCount<2)
      fact(missing,'family-spacing','Moins de deux intervalles observés ; leur durée ne qualifie pas la récupération.',ids);

    const recent=all.efforts.value.activities.filter(value=>elapsed(value.date,input.referenceDate)<FEELING_PREFERENCE_WINDOW_DAYS);
    const difficult=recent.filter(value=>value.effort==='hard'||value.effort==='very-hard');
    if(difficult.length)fact(unfavorable,'recent-difficult-effort','Ressenti difficile ou très difficile dans la fenêtre existante de sept jours.',difficult.map(value=>value.activityId),habits.cumulativeLoad.volumeEvolution.value.last7Days.period);
    const familyDifficult=group.efforts.value.activities.filter(value=>value.effort==='hard'||value.effort==='very-hard');
    if(familyDifficult.length)fact(unfavorable,'family-difficult-effort','Ressenti défavorable documenté dans ce groupe sur la fenêtre descriptive ; ce constat ne prolonge aucune protection D4b.',familyDifficult.map(value=>value.activityId));
    const gentle=group.efforts.value.activities.filter(value=>value.effort==='easy'||value.effort==='moderate');
    if(new Set(gentle.map(value=>value.date)).size>=2)
      fact(favorable,'repeated-reported-efforts','Au moins deux dates du groupe avec ressenti facile ou modéré ; indice déclaratif seulement.',gentle.map(value=>value.activityId));
    else fact(missing,'concordant-efforts','Plusieurs ressentis concordants du groupe ne sont pas documentés.',ids);

    // Aucun seuil de stabilité n'est calibré : égalité, faible variation ou
    // pente nulle ne lèvent pas cette incertitude. Candidate reste réservé.
    fact(missing,'volume-interpretation-unvalidated',
      'Variations, transitions et tendance disponibles, mais aucun critère validé ne permet de qualifier ce volume pour un assouplissement.',
      habits.cumulativeLoad.volumeEvolution.sourceActivityIds,period);
    for(const reason of d2.reasons)if(reason.code==='concentrated-volume-increase'||reason.code==='concentrated-above-habitual')
      fact(unfavorable,reason.code,reason.explanation,reason.activityIds,habits.cumulativeLoad.volumeEvolution.period);
    if(structured.frequency.value.activityCount&&longRuns.frequency.value.activityCount)
      fact(missing,'mixed-demanding-context',
        'Longues et structurées présentes : proximité et charge cumulée observées, protection de cumul non calibrée.',
        demanding.map(value=>value.activityId));
    // Priorité au défavorable avéré, sans transformer les lacunes en défavorable.
    const conclusion:SpacingEligibilityConclusionV2=unfavorable.length?'maintain':missing.length?'insufficient-data':'candidate';
    return {family,referenceDate:input.referenceDate,period:{...period},conclusion,favorable,unfavorable,missing,
      sources:{activityIds:[...observed],familyActivityIds:[...ids],quality:structuredClone(quality)},
      coverage:structuredClone(group.frequency.coverage),relativeDurations:structuredClone(group.relativeDurations),
      interactions:structuredClone(interactions),
      observations:{regularity:structuredClone(habits.historicalRegularity),family:structuredClone(group),
        volume:structuredClone(volume),concentration:structuredClone(habits.cumulativeLoad.windows.last3Days),
        demanding:{activityIds:demanding.map(value=>value.activityId),
          weekly:habits.historicalRegularity.weeks.map(week=>{
            const values=load.activities.filter(value=>value.date>=week.period.from&&value.date<=week.period.through
              &&demanding.some(item=>item.activityId===value.id));
            const known=values.filter(value=>value.durationSeconds!==null);
            const total=known.reduce((sum,value)=>sum+value.durationSeconds!,0);
            return {period:week.period,activityIds:values.map(value=>value.id),count:values.length,
              knownDurationSeconds:Number.isFinite(total)&&(known.length||!values.length)?total:null,
              unknownDurationCount:values.length-known.length};
          })}},
      uncertainties:[...missing.map(value=>value.reason),'Le niveau absolu de charge et la récupération physiologique restent non qualifiés.'],
      admissibility:structuredClone(admissibility.gates[family==='structured'?'structured':'longRun']),
      candidateReadiness:{status:'not-calibrated' as const,reason:'volume-interpretation-unvalidated' as const},
      reasons:conclusion==='maintain'?unfavorable.map(value=>value.code):conclusion==='insufficient-data'?missing.map(value=>value.code):favorable.map(value=>value.code),
      limitations:[...limitations]};
  };
  return {policyVersion:'d4c-consolidated-2' as const,referenceDate:input.referenceDate,
    structured:evaluate('structured'),longRun:evaluate('long-run')};
}
