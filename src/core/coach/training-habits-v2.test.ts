import { describe,it,expect } from 'vitest';
import { analyzeTrainingHabitsV2 as analyze,TRAINING_HABITS_WINDOW_DAYS } from './training-habits-v2';
import { analyzeRecentLoadV2 } from './recent-load-v2';
import { recordedActivityEvidenceV2 } from './activity-evidence-v2';
import { buildRecommendationContinuityV2 } from './recommendation-continuity-v2';
import { adaptCoachV2WithContinuity,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { observePresentationV2,civilDate,instantIso,ianaTimeZone,activitySportSignatureV2,type PersistableOccurrenceV2 } from './persistence-foundations-v2';
import { SESSION_ORCHESTRATOR_EXPERIMENT,FEELING_PREFERENCE_WINDOW_DAYS,type RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import type { RunningSession } from '../../types/session';

const today='2026-11-04',DAY=86400000;
const date=(age:number,end=today)=>new Date(Date.parse(`${end}T00:00:00Z`)-age*DAY).toISOString().slice(0,10);
const reference:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',referenceSeconds:1800,
  sourceIds:['reference'],reasons:[],excluded:[],artificialDecreaseRisk:false};
const run=(id:string,age=0,patch:Partial<RecordedActivityEvidence>={}):RecordedActivityEvidence=>({id,date:date(age),
  durationSeconds:1800,documentedType:'easy-endurance',effort:'moderate',...patch});
const compute=(activities:RecordedActivityEvidence[],ref=reference,referenceDate=today)=>analyze({activities,reference:ref,referenceDate});
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

describe('D4a : habitudes descriptives, sans décision de récupération',()=>{
  it('coureur régulier : quatre périodes de sept jours, jours distincts et fréquence observée',()=>{
    const activities=[27,24,20,17,13,10,6,3].map((age,i)=>run(String(i),age));
    const result=compute(activities),regularity=result.historicalRegularity;
    expect(TRAINING_HABITS_WINDOW_DAYS).toBe(28);
    expect(regularity.activeWeeks.value).toEqual({count:4,totalWeeks:4});
    expect(regularity.weeks.map(value=>value.value)).toEqual(Array(4).fill({activityCount:2,activeDays:2}));
    expect(regularity.weeks[0].period).toEqual({from:date(27),through:date(21),days:7});
    expect(regularity.weeks[3].period).toEqual({from:date(6),through:today,days:7});
    expect(regularity.activities.frequency.value).toEqual({activityCount:8,activeDays:8,activitiesPerWeek:2});
    expect(regularity.activities.spacing.value.gapDays).toEqual([3,4,3,4,3,4,3]);
    expect(result.immediateContext.value).toEqual({lastRecordedActivityDate:date(3),daysSinceLastRecordedActivity:3,recoveryStatus:'not-measured'});
  });
  it('débutant : une activité ne prouve ni habitude établie ni récupération',()=>{
    const result=compute([run('first')]);
    expect(result.historicalRegularity.activities.frequency.value.activitiesPerWeek).toBe(0.25);
    expect(result.historicalRegularity.activeWeeks.value.count).toBe(1);
    expect(result.historicalRegularity.activities.spacing).toMatchObject({status:'insufficient-data',value:{gapDays:[],minimumDays:null}});
    expect(result.demandingSpacing.structured.frequency.status).toBe('no-records');
    expect(result.cumulativeLoad.volumeEvolution.value.comparison).toBe('unknown');
  });
  it('reprise apparente : expose l’écart enregistré sans déduire une absence certaine de pratique',()=>{
    const result=compute([run('older',27),run('recent',0)]);
    expect(result.historicalRegularity.activeWeeks.value.count).toBe(2);
    expect(result.historicalRegularity.activities.spacing.value.gapDays).toEqual([27]);
    expect(result.historicalRegularity.activities.spacing.limitations.join(' ')).toContain('données manquantes');
    const oldOnly=compute([run('old',40)]);
    expect(oldOnly.historicalRegularity.activities.frequency.value.activityCount).toBe(0);
    expect(oldOnly.immediateContext.value.daysSinceLastRecordedActivity).toBe(40);
    expect(oldOnly.historicalRegularity.activities.spacing.value.gapDays).toEqual([]);
  });
  it('alternance des quatre familles : un groupe structuré commun, aucun délai séparé inventé',()=>{
    const activities=[run('i',12,{documentedType:'intervals'}),run('s',10,{documentedType:'steady-run'}),
      run('h',8,{documentedType:'hills'}),run('v',6,{documentedType:'endurance-variations'})];
    const result=compute(activities).demandingSpacing;
    expect(result.structured.frequency.value.activityCount).toBe(4);
    expect(result.structured.spacing.value.gapDays).toEqual([2,2,2]);
    expect(Object.values(result.structuredByFamily).map(value=>value.frequency.value.activityCount)).toEqual([1,1,1,1]);
    expect(result.longRuns.frequency.value.activityCount).toBe(0);
  });
  it('séances rapprochées et même jour : écarts nuls, ordre horaire non inventé',()=>{
    const result=compute([run('b',1,{documentedType:'intervals'}),run('a',1,{documentedType:'hills'}),
      run('c',0,{documentedType:'steady-run'})]).demandingSpacing.structured;
    expect(result.frequency.value).toEqual({activityCount:3,activeDays:2,activitiesPerWeek:0.75});
    expect(result.spacing.value.gapDays).toEqual([0,1]);
    expect(result.spacing.value.sameDayGroups).toEqual([{date:date(1),activityIds:['a','b'],zeroDayGapCount:1}]);
    expect(result.spacing.value.betweenActiveDays[0].fromActivityIds).toEqual(['a','b']);
  });
  it('longues répétées : groupe distinct, durées relatives et ressentis sourcés',()=>{
    const result=compute([run('a',15,{documentedType:'long-run',durationSeconds:3600,effort:'easy'}),
      run('b',5,{documentedType:'long-run',durationSeconds:2700,effort:'hard'}),run('structured',2,{documentedType:'intervals'})]);
    expect(result.demandingSpacing.longRuns.spacing.value.gapDays).toEqual([10]);
    expect(result.demandingSpacing.longRuns.relativeDurations.value.map(value=>value.relativeDuration)).toEqual([2,1.5]);
    expect(result.demandingSpacing.longRuns.efforts.value.counts).toEqual({easy:1,moderate:0,hard:1,'very-hard':0,unknown:0});
    expect(result.demandingSpacing.longRuns.efforts.sourceActivityIds).toEqual(['a','b']);
    expect(result.demandingSpacing.structured.frequency.value.activityCount).toBe(1);
  });
  it('types et ressentis manquants : couverture explicite, aucune famille supposée',()=>{
    const result=compute([run('unknown',2,{documentedType:undefined,effort:undefined}),
      run('known',1,{documentedType:'intervals',effort:undefined,durationSeconds:undefined})]);
    const group=result.demandingSpacing.structured;
    expect(group.frequency).toMatchObject({status:'insufficient-data',coverage:{recordedActivities:2,classifiedActivities:1,
      groupActivities:1,unclassifiedActivityIds:['unknown'],recordingCompleteness:'unknown'}});
    expect(group.efforts.coverage.missingValueActivityIds).toEqual(['known']);
    expect(group.relativeDurations.coverage.missingValueActivityIds).toEqual(['known']);
    expect(group.relativeDurations.value[0].relativeDuration).toBeNull();
    expect(result.cumulativeLoad.volumeEvolution.value.comparison).toBe('unknown');
  });
  it('historique vide : aucun intervalle, aucune récupération supposée',()=>{
    const result=compute([]);
    expect(result.historicalRegularity.activeWeeks).toMatchObject({status:'no-records',value:{count:0}});
    expect(result.immediateContext.value).toEqual({lastRecordedActivityDate:null,daysSinceLastRecordedActivity:null,recoveryStatus:'not-measured'});
    expect(result.cumulativeLoad.volumeEvolution.status).toBe('insufficient-data');
  });
  it.each(['partial','completed'] as const)('%s ne pondère aucune mesure ni fréquence',status=>{
    const actual=run('actual',3,{durationSeconds:900,documentedType:'intervals',effort:'hard'});
    expect(compute([{...actual,confirmedRealization:{occurrenceId:'proposal',result:status}}])).toEqual(compute([actual]));
    expect(compute([actual]).demandingSpacing.structured.relativeDurations.value[0].relativeDuration).toBe(0.5);
  });
  it('doublons identiques comptés une fois, contradictions exclues et ordre indépendant',()=>{
    const a=run('a',4),b=run('b',2),contradiction={...b,durationSeconds:100};
    const result=compute([b,a,contradiction,a]);
    expect(result.historicalRegularity.activities.frequency.value.activityCount).toBe(1);
    expect(result.inputQuality.duplicateIds).toEqual(['a','b']);
    expect(result.inputQuality.excluded).toEqual([{id:'b',reason:'conflicting-duplicate'}]);
    expect(result.historicalRegularity.activities.frequency.status).toBe('insufficient-data');
    expect(compute([a,contradiction,a,b])).toEqual(result);
    expect(compute([a,a]).historicalRegularity.activities.frequency.value.activityCount).toBe(1);
  });
  it('identifiants et dates invalides : diagnostics sans disparition silencieuse',()=>{
    const result=compute([run(''),run('invalid',0,{date:'2026-02-30'}),run('okay')]);
    expect(result.inputQuality.missingIdCount).toBe(1);
    expect(result.inputQuality.excluded).toEqual([{id:'invalid',reason:'invalid-date'}]);
    expect(result.historicalRegularity.activities.frequency.value.activityCount).toBe(1);
  });
  it('diagnostics amont D3b conservés et déterministes pour chaque indicateur',()=>{
    const issues=[{source:'occurrence' as const,id:'x',code:'missing-activity' as const},
      {source:'activity' as const,id:'y',code:'conflicting-id' as const}];
    const input={activities:[run('a')],reference,referenceDate:today};
    const result=analyze({...input,sourceIssues:[...issues,issues[0]]});
    expect(result).toEqual(analyze({...input,sourceIssues:[...issues].reverse()}));
    expect(result.historicalRegularity.activeWeeks.inputQuality.upstreamIssues).toHaveLength(2);
    expect(result.historicalRegularity.activeWeeks.status).toBe('insufficient-data');
  });
  it.each(['increased','equal','decreased'] as const)('volume %s : deux semaines adjacentes issues de D2a',comparison=>{
    const seconds=comparison==='increased'?2400:comparison==='equal'?1800:900;
    const activities=[run('previous',10),run('current',2,{durationSeconds:seconds})];
    const result=compute(activities);
    expect(Object.fromEntries(Object.entries(result.cumulativeLoad.windows).map(([key,value])=>[key,value.value])))
      .toEqual(analyzeRecentLoadV2({activities,reference,referenceDate:today}).windows);
    expect(result.cumulativeLoad.volumeEvolution.value).toMatchObject({comparison,
      previous7Days:{durationSeconds:1800},deltaSeconds:seconds-1800});
    expect(result.cumulativeLoad.volumeEvolution.value.previous7Days.period.through).toBe(date(7));
    expect(result.cumulativeLoad.volumeEvolution.value.last7Days.period.from).toBe(date(6));
  });
  it('volume incomplet ou semaine vide : aucune hausse ou baisse conclue',()=>{
    for(const activities of [[run('one',2)],[run('old',10)],
      [run('old',10,{durationSeconds:undefined}),run('new',2)],
      [run('old',10),run('new',2,{durationSeconds:undefined})]]){
      expect(compute(activities).cumulativeLoad.volumeEvolution.value.comparison).toBe('unknown');
    }
  });
  it.each(['expired','insufficient'] as const)('référence %s : aucun rapport inventé',freshness=>{
    const result=compute([run('a',0,{documentedType:'long-run'})],{...reference,freshness});
    expect(result.demandingSpacing.longRuns.relativeDurations.value[0].relativeDuration).toBeNull();
    expect(result.demandingSpacing.longRuns.relativeDurations.status).toBe('insufficient-data');
  });
  it('référence provisoire : rapport descriptif avec confiance conservée',()=>{
    const result=compute([run('a')],{...reference,confidence:'provisional'});
    expect(result.habitualReference.confidence).toBe('provisional');
    expect(result.historicalRegularity.activities.relativeDurations.limitations.join(' ')).toContain('provisional');
  });
  it('dépassement numérique : jamais de volume comparé ou rapport infini',()=>{
    const result=compute([run('old',10,{durationSeconds:Number.MAX_VALUE}),run('new',2,{durationSeconds:Number.MAX_VALUE})]);
    expect(result.cumulativeLoad.windows.last14Days.value.durationSeconds.overflow).toBe(true);
    expect(result.cumulativeLoad.volumeEvolution.value.comparison).toBe('unknown');
    const tiny=compute([run('a',0,{durationSeconds:Number.MAX_VALUE})],{...reference,referenceSeconds:Number.MIN_VALUE});
    expect(tiny.historicalRegularity.activities.relativeDurations.value[0].relativeDuration).toBeNull();
  });
  it.each(['2026-01-01','2026-03-29','2026-10-25','2024-03-01'])('frontières civiles à %s',referenceDate=>{
    const activities=[28,27,21,20,14,13,7,6,0,-1].map(age=>run(String(age),0,{date:date(age,referenceDate)}));
    const result=compute(activities,reference,referenceDate);
    expect(result.historicalRegularity.activities.frequency.value.activityCount).toBe(8);
    expect(result.historicalRegularity.weeks.map(value=>value.value.activityCount)).toEqual([2,2,2,2]);
    expect(result.inputQuality.excluded).toEqual([{id:'-1',reason:'future-date'}]);
    expect(result.historicalRegularity.activities.frequency.status).toBe('observed');
    expect(result.historicalRegularity.activities.spacing.value.intervalCount).toBe(7);
  });
  it('une activité hors fenêtre ne crée pas un intervalle traversant la borne gauche',()=>{
    const result=compute([run('outside',28),run('inside',27)]);
    expect(result.historicalRegularity.activities.spacing.value.gapDays).toEqual([]);
  });
  it('corriger ou supprimer un bilan recalcule uniquement les observations présentes',()=>{
    const a=run('a',8,{documentedType:'intervals',effort:'hard'}),b=run('b',2,{documentedType:'hills'});
    expect(compute([a,b]).demandingSpacing.structured.spacing.value.gapDays).toEqual([6]);
    const corrected=compute([{...a,effort:'easy',documentedType:'easy-endurance'},b]);
    expect(corrected.demandingSpacing.structured.frequency.value.activityCount).toBe(1);
    expect(corrected.demandingSpacing.structured.efforts.value.counts.hard).toBe(0);
    expect(compute([{...a,effort:undefined},b]).demandingSpacing.structured.efforts.coverage.missingValueActivityIds).toEqual(['a']);
    expect(compute([b]).historicalRegularity.activities.frequency.value.activityCount).toBe(1);
    expect(compute([{...a,documentedType:undefined},b]).demandingSpacing.structured.frequency.coverage.unclassifiedActivityIds).toEqual(['a']);
  });
  it('fonction pure, données figées, aucun état accumulé ni dépendance à l’ordre',()=>{
    const activities=freeze([run('a',4),run('b',2),run('c',2)]),ref=freeze(structuredClone(reference));
    const first=compute(activities,ref);
    compute([run('unrelated')]);
    expect(compute([...activities].reverse(),ref)).toEqual(first);
    expect(()=>compute([],ref,'not-a-date')).toThrow();
  });
});

const snapshot=():CoachV2ApplicationSnapshot=>({coachTemperament:'rentre-dedans',sessions:[26,21,16,11,6,2].map((age,index)=>({id:`run-${index}`,
  date:date(age),title:'Synthétique',sport:'RUNNING',durationSeconds:2400,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
  configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
    days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]});
async function proposal(source:CoachV2ApplicationSnapshot):Promise<PersistableOccurrenceV2>{
  const result=await adaptCoachV2WithContinuity(source,today);
  return (await observePresentationV2({existing:[],createId:()=> 'proposal',selection:selectedApplicationSuggestionV2(result,1),
    moment:{presentedAt:instantIso(`${today}T08:00:00.000Z`),presentedOn:civilDate(today),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:source.sessions.map(value=>value.id),limitationCodes:[]}})).occurrence;
}

describe('D4a indépendant du moteur et de ses confirmations',()=>{
  it('type réel distinct de la prescription : seules les activités déclarées sont comptées',async()=>{
    const source=snapshot(),old=await proposal(source);
    expect(old.content.type).toBe('intervals');
    const actual:RunningSession={id:'actual',date:today,title:'Synthétique',durationSeconds:900,trainingType:'easy-endurance',feeling:{effort:'hard'}};
    const occurrence:PersistableOccurrenceV2={...old,state:'associated',activityId:actual.id,associationEvidence:{sportSignature:activitySportSignatureV2(actual)},
      realization:{result:'completed',proposalOrigin:'manual',confirmedBy:'user'}};
    const collect=async(value:PersistableOccurrenceV2,sessions=[actual])=>{
      const memory=await buildRecommendationContinuityV2({sessions,occurrences:[value]});
      return analyze({activities:memory.activities,sourceIssues:memory.issues,reference,referenceDate:today});
    };
    const complete=await collect(occurrence);
    expect(complete.demandingSpacing.structured.frequency.value.activityCount).toBe(0);
    expect(complete.historicalRegularity.activities.relativeDurations.value[0].durationSeconds).toBe(900);
    expect(await collect({...occurrence,realization:{...occurrence.realization!,result:'partial'}})).toEqual(complete);
    expect(await collect({...occurrence,realization:undefined})).toEqual(complete);
    const deleted=await collect(occurrence,[]);
    expect(deleted.inputQuality.upstreamIssues[0].code).toBe('missing-activity');
    expect(deleted.historicalRegularity.activities.frequency.value.activityCount).toBe(0);
    const negative=await collect({...old,realization:{result:'not-completed',proposalOrigin:'manual',confirmedBy:'user'}},[]);
    expect(negative.historicalRegularity.activities.frequency.value.activityCount).toBe(0);
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('recommandations, actives et perspectives identiques avant/après pour %s',async coachTemperament=>{
    const source=snapshot();source.coachTemperament=coachTemperament;
    source.occurrences=[await proposal(source)];
    const immutable=freeze(source),before=await adaptCoachV2WithContinuity(immutable,today);
    const activeBefore=reusableActiveOccurrenceV2(immutable.occurrences,before,today),planBefore=coachV2Perspectives(before,activeBefore);
    const evidence=recordedActivityEvidenceV2(immutable,today),memory=await buildRecommendationContinuityV2(immutable);
    const description=analyze({activities:evidence,reference:before.reference,referenceDate:today,sourceIssues:memory.issues});
    expect(description.historicalRegularity.activities.frequency.value.activityCount).toBe(6);
    const after=await adaptCoachV2WithContinuity(immutable,today);
    expect(after).toEqual(before);
    const activeAfter=reusableActiveOccurrenceV2(immutable.occurrences,after,today);
    expect(activeAfter).toEqual(activeBefore);expect(coachV2Perspectives(after,activeAfter)).toEqual(planBefore);
    expect(SESSION_ORCHESTRATOR_EXPERIMENT).toEqual({minimumDaysAfterActivity:2,structuredActivityGapDays:14,longActivityGapDays:10});
    expect(FEELING_PREFERENCE_WINDOW_DAYS).toBe(7);
  });
});
