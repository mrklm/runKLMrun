import { afterAll,describe,it,expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { simulateSpacingHypothesesV2 as simulate } from './spacing-calibration-v2';
import { CALIBRATION_DATE_V2 as today,CALIBRATION_REFERENCE_V2 as reference,CALIBRATION_HYPOTHESES_V2 as hypotheses,spacingCalibrationScenariosV2,calibrationDateV2 } from './spacing-calibration-fixtures-v2';
import { evaluateRecoveryV2,RECOVERY_TIMING_V2 } from '../recovery-policy-v2';
import { adaptCoachV2WithContinuity,type CoachV2ApplicationSnapshot } from '../application-adapter-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from '../presentation-identity-v2';
import { coachV2Perspectives } from '../perspectives-v2';
import { observePresentationV2,civilDate,instantIso,ianaTimeZone } from '../persistence-foundations-v2';
const scenarios=spacingCalibrationScenariosV2();
const run=(id='equal-volume')=>simulate({activities:scenarios.find(value=>value.id===id)!.activities,referenceDate:today,reference,hypotheses});
const conclusions:Record<string,string>={
  'slight-variation':'insufficient-data/insufficient-data','equal-volume':'insufficient-data/insufficient-data','high-volume':'insufficient-data/insufficient-data',
  beginner:'insufficient-data/insufficient-data',return:'insufficient-data/insufficient-data','regular-intervals':'insufficient-data/insufficient-data',
  'partial-hard':'maintain/maintain','completed-very-hard':'maintain/maintain','repeated-long':'insufficient-data/insufficient-data',
  'alternating-families':'insufficient-data/insufficient-data','close-long-structured':'insufficient-data/insufficient-data','volume-increase':'insufficient-data/insufficient-data',
  'no-effort':'insufficient-data/insufficient-data','partial-coverage':'insufficient-data/insufficient-data','corrected-effort':'insufficient-data/insufficient-data',
  'deleted-review':'insufficient-data/insufficient-data','future-perspectives':'insufficient-data/insufficient-data','no-family-practice':'insufficient-data/insufficient-data',
  'joint-candidate':'insufficient-data/insufficient-data','omitted-record':'insufficient-data/insufficient-data','decreased-volume':'insufficient-data/insufficient-data',
  'deleted-activity':'insufficient-data/insufficient-data','old-hard':'maintain/insufficient-data',
};
const capture:Record<string,unknown>={};
afterAll(()=>{if(process.env.D4D_CAPTURE==='1')writeFileSync('/tmp/d4d-calibration.json',JSON.stringify(capture,null,2));});
describe('D4d : laboratoire sans activation',()=>{
  for(const scenario of scenarios)it(`scénario reproductible ${scenario.id}`,()=>{
    const input={activities:scenario.activities,referenceDate:today,reference,hypotheses};
    const before=structuredClone(input),result=simulate(input);
    expect(`${result.eligibility.structured.conclusion}/${result.eligibility.longRun.conclusion}`).toBe(conclusions[scenario.id]);
    expect(input).toEqual(before);
    expect(result.current).toEqual(evaluateRecoveryV2({referenceDate:today,activities:scenario.activities}));
    expect(result.variants[0].structured.theoretical).toEqual(result.variants[0].structured.current);
    expect(result.variants[0].longRun.theoretical).toEqual(result.variants[0].longRun.current);
    for(const variant of result.variants)for(const family of ['structured','longRun'] as const){
      expect(variant[family].theoretical.firstUnblockedDate<=variant[family].current.firstUnblockedDate).toBe(true);
      if(variant[family].d4c!=='candidate')expect(variant[family].withD4cFilter).toEqual(variant[family].current);
    }
    capture[scenario.id]={risk:scenario.risk,condition:scenario.condition,study:result};
  });
  it('14/12/10 jours : levées structurées J+4/J+2/J, sans proposer de séance',()=>{
    const result=run();
    expect(['14/10','12/9','10/7'].map(id=>result.variants.find(value=>value.hypothesis.id===id)!.structured.theoretical.firstUnblockedDate))
      .toEqual([calibrationDateV2(-4),calibrationDateV2(-2),today]);
  });
  it('10/9/7 jours : levées longues J+4/J+3/J+1',()=>{
    const result=run('repeated-long');
    expect(['14/10','12/9','10/7'].map(id=>result.variants.find(value=>value.hypothesis.id===id)!.longRun.theoretical.firstUnblockedDate))
      .toEqual([calibrationDateV2(-4),calibrationDateV2(-3),calibrationDateV2(-1)]);
  });
  it('very-hard reste une protection exigeante dans toutes les hypothèses',()=>{
    const result=run('completed-very-hard');
    for(const value of result.variants){
      expect(value.longRun.theoretical.notBefore).toBe(calibrationDateV2(-1));
      expect(value.longRun.theoretical.protections).toContain('very-hard-protection');
      expect(value.preference.days).toBe(7);
    }
  });
  it('les deux jours ne peuvent pas être assouplis',()=>{
    const activity={id:'recent',date:calibrationDateV2(1)};
    const result=simulate({activities:[activity],referenceDate:today,reference,hypotheses});
    for(const value of result.variants)expect(value.structured.theoretical.firstUnblockedDate).toBe(calibrationDateV2(-1));
    expect(()=>simulate({activities:[],referenceDate:today,reference,hypotheses:[{...hypotheses[0],structuredDays:1}]})).toThrow();
  });
  it('stabilité comparée : variation légère, seuil uniquement explicite',()=>{
    const result=run('slight-variation');
    expect(result.volume.strictEquality).toBe('increased');
    expect(result.volume.relativeToPriorMedian.relativeChange).toBeCloseTo(60/3600);
    expect(result.volume.relativeToPriorMedian.withinExplicitTolerance).toBeNull();
    const explicit=simulate({activities:scenarios[0].activities,referenceDate:today,reference,hypotheses,relativeVolumeTolerance:0.02});
    expect(explicit.volume.relativeToPriorMedian.withinExplicitTolerance).toBe(true);
    expect(explicit.eligibility).toEqual(result.eligibility);
    expect(result.volume.transitions.at(-1)?.deltaSeconds).toBe(60);
    expect(result.volume.trend.slopeSecondsPerWeek).toBeCloseTo(18);
  });
  it('une pente nulle peut masquer une oscillation des volumes',()=>{
    const rows=scenarios[1].activities.map((value,index)=>({...value,durationSeconds:[1800,1800,3600,3600,3600,3600,1800,1800][index]}));
    const result=simulate({activities:rows,referenceDate:today,reference,hypotheses});
    expect(result.volume.trend.slopeSecondsPerWeek).toBe(0);expect(result.volume.trend.rangeSeconds).toBe(3600);
    expect(result.volume.transitions.map(value=>value.deltaSeconds)).toEqual([3600,0,-3600]);
  });
  it('couverture partielle : somme connue visible, aucun ratio/tendance extrapolé',()=>{
    const result=run('partial-coverage');expect(result.volume.weeks[3].duration.unknownCount).toBe(1);
    expect(result.volume.weeks[3].duration.knownTotal).toBe(1800);
    expect(result.volume.relativeToPriorMedian.relativeChange).toBeNull();expect(result.volume.trend.slopeSecondsPerWeek).toBeNull();
  });
  it('deux familles et durée accrue : dimensions de cumul, candidature non calibrée',()=>{
    const result=run('joint-candidate').variants.find(value=>value.hypothesis.id==='12/9+300s')!;
    expect(result.interactions).toMatchObject({bothGapsReduced:true,gapAndDurationIncrease:true});
    expect(result.structured.d4c).toBe('insufficient-data');expect(result.longRun.d4c).toBe('insufficient-data');
    expect(run('joint-candidate').variants.find(value=>value.hypothesis.id==='12/9')!.structured.theoretical).toEqual(result.structured.theoretical);
  });
  it('futur réel exclu et perspectives non converties en preuves',()=>{
    const base=run(),scenario=scenarios[1];
    const future=simulate({activities:[...scenario.activities,{id:'future',date:calibrationDateV2(-1),documentedType:'intervals',effort:'very-hard'}],referenceDate:today,reference,hypotheses});
    expect(future.current).toEqual(base.current);expect(future.variants).toEqual(base.variants);
    expect(run('future-perspectives')).toEqual(base);
  });
  it('doublons contradictoires et identifiants absents empêchent une stabilité complète',()=>{
    const activities=[...scenarios[1].activities,{...scenarios[1].activities[0],durationSeconds:900},{date:today}];
    const result=simulate({activities,referenceDate:today,reference,hypotheses});
    expect(result.volume.sourceUncertain).toBe(true);expect(result.volume.trend.slopeSecondsPerWeek).toBeNull();
    expect(result.eligibility.structured.conclusion).toBe('insufficient-data');
  });
  it('ordre et répétition des appels sans effet ; entrées figées',()=>{
    const activities=scenarios[1].activities.map(value=>Object.freeze({...value}));Object.freeze(activities);
    const input={activities,referenceDate:today,reference,hypotheses};const first=simulate(input);run('beginner');
    expect(simulate({...input,activities:[...activities].reverse()})).toEqual(first);
  });
  it('un intervalle de douze jours ne déclenche plus automatiquement un maintien',()=>{
    const activities=[...scenarios[1].activities,{id:'later-real',date:calibrationDateV2(-2),durationSeconds:1800,
      documentedType:'hills' as const,effort:'moderate' as const}];
    const result=simulate({activities,referenceDate:calibrationDateV2(-2),reference,hypotheses});
    expect(result.eligibility.structured.conclusion).toBe('insufficient-data');
    expect(result.eligibility.structured.unfavorable.map(value=>value.code)).not.toContain('close-family-sessions');
  });
  it('correction et suppression recalculées, absence de préférence D2 sans valeur de preuve',()=>{
    expect(run('old-hard').eligibility.structured.conclusion).toBe('maintain');
    expect(run('corrected-effort').eligibility.structured.conclusion).toBe('insufficient-data');
    expect(run('deleted-review').eligibility.structured.conclusion).toBe('insufficient-data');
    expect(run('deleted-activity').eligibility.structured.conclusion).toBe('insufficient-data');
    const increase=run('volume-increase');
    expect(increase.d2.decisions.preference).toBe('unchanged');
    expect(increase.eligibility.structured.conclusion).toBe('insufficient-data');
  });
  it('paramètres invalides refusés explicitement',()=>{
    const base={activities:[],referenceDate:today,reference,hypotheses};
    expect(()=>simulate({...base,relativeVolumeTolerance:NaN})).toThrow();
    expect(()=>simulate({...base,hypotheses:[hypotheses[0],hypotheses[0]]})).toThrow();
    expect(()=>simulate({...base,hypotheses:[{...hypotheses[0],durationIncreaseSeconds:-1}]})).toThrow();
    expect(()=>simulate({...base,hypotheses:[{...hypotheses[0],longRunDays:11}]})).toThrow();
    expect(RECOVERY_TIMING_V2).toEqual({minimumDaysAfterActivity:2,structuredActivityGapDays:14,longActivityGapDays:10});
  });
});

for(const temperament of ['pas-a-pas','evolution-active','rentre-dedans'] as const)describe(`production inchangée : ${temperament}`,()=>{
  for(const scenario of scenarios)it(scenario.id,async()=>{
    const source:CoachV2ApplicationSnapshot={coachTemperament:temperament,sessions:scenario.activities.map(value=>({id:value.id!,date:value.date,
      title:'D4d synthétique',sport:'RUNNING',durationSeconds:value.durationSeconds??NaN,distanceMeters:value.distanceMeters,
      trainingType:value.documentedType,feeling:value.effort?{effort:value.effort}:undefined})),
      configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
        days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]};
    const initial=await adaptCoachV2WithContinuity(source,today);
    if(initial.candidate)source.occurrences=[(await observePresentationV2({selection:selectedApplicationSuggestionV2(initial,1),existing:[],createId:()=>'synthetic',
      moment:{presentedAt:instantIso(`${today}T08:00:00.000Z`),presentedOn:civilDate(today),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
      provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:initial.reference.confidence==='confirmed'?'confirmed':'provisional',referenceSourceIds:initial.reference.sourceIds,limitationCodes:[]}})).occurrence];
    const before=await adaptCoachV2WithContinuity(source,today),active=reusableActiveOccurrenceV2(source.occurrences,before,today),perspectives=coachV2Perspectives(before,active);
    run(scenario.id);
    const after=await adaptCoachV2WithContinuity(source,today);
    expect(after).toEqual(before);expect(reusableActiveOccurrenceV2(source.occurrences,after,today)).toEqual(active);expect(coachV2Perspectives(after,active)).toEqual(perspectives);
    capture[`${scenario.id}/${temperament}`]={selectedDate:before.selectedDate,type:before.candidate?.type??null,
      active:active?.content.type??null,perspectives:perspectives.map(value=>({date:value.date,type:value.session.type}))};
  });
});
