import { afterAll,describe,it,expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { studyFrequencyHistoryV2 as study } from './frequency-history-v2';
import { FREQUENCY_STUDY_DATE_V2 as today,FREQUENCY_STUDY_REFERENCE_V2 as reference,frequencyHistoryScenariosV2,frequencyHistoryRowsV2,frequencyStudyDateV2 as date } from './frequency-history-fixtures-v2';
import { analyzeTrainingHabitsV2 } from '../training-habits-v2';
import { adaptCoachV2WithContinuity,type CoachV2ApplicationSnapshot } from '../application-adapter-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from '../presentation-identity-v2';
import { coachV2Perspectives } from '../perspectives-v2';
import { observePresentationV2,civilDate,instantIso,ianaTimeZone } from '../persistence-foundations-v2';
const scenarios=frequencyHistoryScenariosV2();
const run=(id='structured-12')=>study({activities:scenarios.find(value=>value.id===id)!.activities,referenceDate:today,reference});
const capture:Record<string,unknown>={};
afterAll(()=>{if(process.env.FREQUENCY_CAPTURE==='1')writeFileSync('/tmp/frequency-history.json',JSON.stringify(capture,null,2));});
describe('fréquence historique : étude descriptive sans personnalisation active',()=>{
  for(const scenario of scenarios)it(scenario.id,()=>{
    const input={activities:scenario.activities,referenceDate:today,reference},before=structuredClone(input),result=study(input);
    expect(input).toEqual(before);expect(result.windows.map(value=>value.period.days)).toEqual([28,56,84]);
    const d4a=analyzeTrainingHabitsV2(input);
    for(const [family,original] of [['structured',d4a.demandingSpacing.structured],['longRun',d4a.demandingSpacing.longRuns]] as const){
      expect(result.windows[0][family].activityIds).toEqual(original.frequency.sourceActivityIds);
      expect(result.windows[0][family].intervalCount).toBe(original.spacing.value.intervalCount);
      const gaps=result.windows[0][family].histogram.flatMap(value=>Array<number>(value.count).fill(value.days));
      expect(gaps).toEqual([...original.spacing.value.gapDays].sort((a,b)=>a-b));
    }
    expect(result.recent.recovery.parameters).toEqual({minimumDaysAfterActivity:2,structuredActivityGapDays:14,longActivityGapDays:10});
    capture[scenario.id]={note:scenario.note,study:result};
  });
  it.each([{id:'structured-12',family:'structured',counts:[3,5,7],gap:12},
    {id:'structured-14',family:'structured',counts:[2,4,6],gap:14},
    {id:'structured-7',family:'structured',counts:[4,8,12],gap:7},
    {id:'long-9',family:'longRun',counts:[3,6,10],gap:9},
    {id:'long-10',family:'longRun',counts:[3,6,9],gap:10}] as const)('$id : profondeur et nombre exact d’intervalles',({id,family,counts,gap})=>{
      const result=run(id);expect(result.windows.map(value=>value[family].activityCount)).toEqual(counts);
      expect(result.windows.map(value=>value[family].intervalCount)).toEqual(counts.map(value=>value-1));
      for(const window of result.windows)expect(window[family].histogram).toEqual([{days:gap,count:window[family].intervalCount}]);
  });
  it('étendre la fenêtre ne crée pas de profondeur pour un historique de 28 jours',()=>{
    const windows=run('regular-28').windows;
    expect(windows.map(value=>value.structured.activityCount)).toEqual([3,3,3]);
    expect(windows.map(value=>value.structured.spanDays)).toEqual([25,25,25]);
    expect(windows[2].structured.blocks28Days.map(value=>value.activityCount)).toEqual([0,0,3]);
    expect(windows[2].overall.weeks.filter(value=>value.activityCount===0)).toHaveLength(8);
  });
  it('série concentrée : même intervalle répété, mais un seul bloc occupé',()=>{
    const group=run('concentrated-demanding').windows[2].structured;
    expect(group.repetition).toBe('equal-observed-gaps');expect(group.histogram[0].days).toBe(3);
    expect(group.blocks28Days.filter(value=>value.activityCount>0)).toHaveLength(1);
    expect(group.spanDays).toBeLessThan(28);
  });
  it('hypothèse B : écart exact, plus rapide ou plus lent, sans décision',()=>{
    expect(run('structured-12').windows[2].structured.comparison.hypothesisB.equal).toBe(6);
    expect(run('structured-14').windows[2].structured.comparison.hypothesisB.above).toBe(5);
    expect(run('structured-7').windows[2].structured.comparison.hypothesisB.below).toBe(11);
    expect(run('structured-12').windows[2].structured.comparison.hypothesisB.exactIntervalEndingBlocks28Days).toHaveLength(3);
    expect(run()).not.toHaveProperty('candidate');expect(run()).not.toHaveProperty('selectedPolicy');
  });
  it('les signaux récents survivent à une répétition sur 84 jours',()=>{
    expect(run('high-frequency-hard').recent.difficultActivityIds).toContain('run-2');
    expect(run('very-hard-recent').recent.recovery.gates.structured.protections).toContain('very-hard-protection');
    expect(run('growing-and-concentrated').recent.cautionReasons.map(value=>value.code)).toContain('concentrated-volume-increase');
    expect(run('high-frequency-growing').recent.volume.strictEquality).toBe('increased');
    expect(run('unknown-efforts').windows[2].structured.coverage.missingEffortActivityIds).toHaveLength(7);
  });
  it('longues et structurées : montrer la densité cumulée sans fusionner leurs comparaisons',()=>{
    const window=run('mixed-close').windows[2];
    expect(window.structured.comparison.hypothesisB.days).toBe(12);expect(window.longRun.comparison.hypothesisB.days).toBe(9);
    expect(window.demanding.activityCount).toBe(window.structured.activityCount+window.longRun.activityCount);
    expect(window.demanding.minimumDays).toBeLessThan(2);
  });
  it('correction, suppression et couverture manquante modifient seulement les faits',()=>{
    const baseline=run().windows[2],corrected=run('corrected-activity').windows[2],deleted=run('deleted-activity').windows[2],unknown=run('incomplete-history').windows[2];
    expect(corrected.overall.activityCount).toBe(baseline.overall.activityCount);
    expect(deleted.overall.activityCount).toBe(baseline.overall.activityCount-1);
    for(const window of [corrected,deleted,unknown]){
      expect(window.structured.activityCount).toBe(6);
      expect(window.structured.histogram).toContainEqual({days:24,count:1});
    }
    expect(unknown.structured.uncertaintyReasons).toContain('unknown-types');
    expect(run().windows[2]).toEqual(baseline);
  });
  it('futur exclu des trois fenêtres et du contexte présent',()=>{
    const baseline=run(),future=run('future-activity');
    for(let i=0;i<3;i++){
      expect(future.windows[i].structured).toEqual(baseline.windows[i].structured);
      expect(future.windows[i].overall).toEqual(baseline.windows[i].overall);
    }
    expect(future.recent.recovery).toEqual(baseline.recent.recovery);
    expect(future.windows[0].inputQuality.excluded).toEqual([{id:'future',reason:'future-date'}]);
  });
  it('reprise : grand intervalle et blocs vides ne prouvent pas un repos',()=>{
    const group=run('return-after-gap').windows[2].structured;
    expect(group.maximumDays).toBeGreaterThan(28);
    expect(group.blocks28Days[1].activityCount).toBe(0);
    expect(group.repetition).toBe('variable-observed-gaps');
  });
  it('alternance : les quatre familles restent une population commune',()=>{
    const types=scenarios.find(value=>value.id==='alternating-structured')!.activities.filter(value=>value.documentedType!=='easy-endurance').map(value=>value.documentedType);
    expect(new Set(types).size).toBe(4);
    expect(run('alternating-structured').windows.map(value=>value.structured.histogram)).toEqual(run().windows.map(value=>value.structured.histogram));
  });
  it('doublons, contradictions et ordre : sources déterministes',()=>{
    const rows=frequencyHistoryRowsV2(84,12),input={activities:rows,referenceDate:today,reference};
    expect(study({...input,activities:[...rows].reverse()})).toEqual(study(input));
    const identical=study({...input,activities:[...rows,rows[0]]});expect(identical.windows[2].structured.activityCount).toBe(7);
    const conflict=study({...input,activities:[...rows,{...rows[0],effort:'hard'}]});
    expect(conflict.windows[2].structured.coverage.inputUncertain).toBe(true);
    expect(conflict.windows[2].inputQuality.excluded[0].reason).toBe('conflicting-duplicate');
  });
  it('bornes civiles : inclure J-27/55/83, exclure les intervalles traversants',()=>{
    const activities=[0,27,28,55,56,83,84,-1].map(age=>({id:String(age),date:date(age),documentedType:'intervals' as const}));
    const result=study({activities,referenceDate:today,reference});
    expect(result.windows.map(value=>value.structured.activityCount)).toEqual([2,4,6]);
    expect(result.windows.map(value=>value.structured.intervalCount)).toEqual([1,3,5]);
  });
  it('même jour : écarts nuls sans ordre horaire inventé, même groupe commun',()=>{
    const activities=[{id:'b',date:today,documentedType:'hills' as const},{id:'a',date:today,documentedType:'intervals' as const}];
    const result=study({activities,referenceDate:today,reference}).windows[0].structured;
    expect(result.histogram).toEqual([{days:0,count:1}]);expect(result.intervals).toEqual([]);
    expect(result.sameDay).toEqual([{date:today,activityIds:['a','b'],zeroGapCount:1}]);
  });
  it('confirmation ne renforce pas une fréquence ; inconnus et erreurs amont restent visibles',()=>{
    const rows=frequencyHistoryRowsV2(84,12),base=study({activities:rows,referenceDate:today,reference});
    for(const result of ['completed','partial'] as const)expect(study({activities:rows.map(value=>({...value,confirmedRealization:{occurrenceId:'proposal',result}})),referenceDate:today,reference})).toEqual(base);
    const unresolved=study({activities:rows,referenceDate:today,reference,sourceIssues:[{source:'activity',id:'missing',code:'invalid-data'}]});
    expect(unresolved.windows[2].structured.uncertaintyReasons).toContain('source-quality');
  });
  it('calcul sans mutation ni horloge implicite',()=>{
    const rows=frequencyHistoryRowsV2(84,12).map(value=>Object.freeze(value));Object.freeze(rows);
    expect(()=>study({activities:rows,referenceDate:today,reference})).not.toThrow();
    expect(()=>study({activities:rows,referenceDate:'invalid',reference})).toThrow();
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
