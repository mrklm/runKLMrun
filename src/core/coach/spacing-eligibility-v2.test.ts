import { recordedActivityEvidenceV2 } from './activity-evidence-v2';
import { buildRecommendationContinuityV2 } from './recommendation-continuity-v2';
import { adaptCoachV2WithContinuity,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { observePresentationV2,civilDate,instantIso,ianaTimeZone,activitySportSignatureV2,type PersistableOccurrenceV2 } from './persistence-foundations-v2';
import type { RunningSession } from '../../types/session';
import { describe,it,expect } from 'vitest';
import { evaluateSpacingEligibilityV2 as evaluate } from './spacing-eligibility-v2';
import type { RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
const today='2026-11-05';
const date=(age:number)=>new Date(Date.parse(`${today}T00:00:00Z`)-age*86400000).toISOString().slice(0,10);
const reference:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',referenceSeconds:1800,
  sourceIds:['reference'],reasons:[],excluded:[],artificialDecreaseRisk:false};
const run=(age:number,patch:Partial<RecordedActivityEvidence>={}):RecordedActivityEvidence=>({id:`run-${age}`,date:date(age),durationSeconds:1800,
  documentedType:'easy-endurance',effort:'moderate',...patch});
const regular=(type:RecordedActivityEvidence['documentedType']='intervals')=>[27,24,20,17,13,10,6,3].map(age=>run(age,{documentedType:age===24||age===10?type:'easy-endurance'}));
const compute=(activities:readonly RecordedActivityEvidence[])=>evaluate({activities,reference,referenceDate:today});
const codes=(result:ReturnType<typeof compute>['structured'])=>result.unfavorable.map(value=>value.code);

describe('D4c : éligibilité descriptive autonome',()=>{
  it('régulier, deux dates et volume égal : preuves encore insuffisantes',()=>{
    const result=compute(regular());expect(result.structured.conclusion).toBe('insufficient-data');
    expect(result.structured.favorable.map(value=>value.code)).toEqual(['documented-records','regular-recording','repeated-reported-efforts']);
    expect(result.longRun.conclusion).toBe('insufficient-data');
  });
  it('sorties longues répétées : conclusion séparée',()=>{
    const result=compute(regular('long-run'));expect(result.longRun.conclusion).toBe('insufficient-data');
    expect(result.structured.conclusion).toBe('insufficient-data');
  });
  it.each([[],[run(3)],[run(60),run(3)]].map(activities=>({activities})))('débutant, absence ou reprise : insuffisant, pas défavorable inventé',({activities})=>{
    const result=compute(activities).structured;
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it('alternance des quatre familles : un seul périmètre, rapproché',()=>{
    const types=['intervals','steady-run','hills','endurance-variations'] as const;
    const rows=regular().map((value,i)=>i<4?{...value,documentedType:types[i]}:value);
    const result=compute(rows);expect(result.structured.conclusion).toBe('insufficient-data');
    expect(result.structured.observations.family.spacing.value.intervalCount).toBeGreaterThan(1);
    expect(codes(result.structured)).not.toContain('close-family-sessions');expect(Object.keys(result)).not.toContain('hills');
  });
  it.each(['partial','completed'] as const)('%s ne change ni preuve ni conclusion',result=>{
    const rows=regular(),withConfirmation=rows.map(value=>({...value,confirmedRealization:{occurrenceId:'proposal',result}}));
    expect(compute(withConfirmation)).toEqual(compute(rows));
  });
  it.each([['partial','hard'],['completed','very-hard']] as const)('fractionné %s %s : maintien', (result,effort)=>{
    const rows=regular().map(value=>value.id==='run-10'?{...value,effort,confirmedRealization:{occurrenceId:'proposal',result}}:value);
    expect(compute(rows).structured.conclusion).toBe('maintain');
    expect(codes(compute(rows).structured)).toContain('family-difficult-effort');
  });
  it('deux activités récentes : concentration constatée',()=>{
    const result=compute([...regular(),run(1),run(2)]).structured;
    expect(codes(result)).toContain('concentrated-volume-increase');expect(result.conclusion).toBe('maintain');
  });
  it('hausse récente sans concentration : observation, pas maintien automatique',()=>{
    const result=compute(regular().map(value=>value.id==='run-3'?{...value,durationSeconds:2400}:value)).structured;
    expect(codes(result)).toEqual([]);expect(result.conclusion).toBe('insufficient-data');
    expect(result.observations.volume.transitions.at(-1)?.deltaSeconds).toBe(600);
  });
  it('volume élevé mais égal : aucun seuil absolu inventé',()=>{
    expect(compute(regular().map(value=>({...value,durationSeconds:18000}))).structured.conclusion).toBe('insufficient-data');
  });
  it('volume en baisse : absence de stabilité, pas signal défavorable',()=>{
    const result=compute(regular().map(value=>value.id==='run-3'?{...value,durationSeconds:900}:value)).structured;
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it.each(['effort','documentedType','durationSeconds'] as const)('%s absent : inconnu distinct du défavorable',field=>{
    const result=compute(regular().map(value=>({...value,[field]:undefined}))).structured;
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it('régularité seule, même avec ressentis faciles : aucune expérience structurée',()=>{
    const result=compute(regular('easy-endurance').map(value=>({...value,effort:'easy'}))).structured;
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it('correction du type réel puis suppression : recalcul sans état',()=>{
    const rows=regular();expect(compute(rows).structured.conclusion).toBe('insufficient-data');
    expect(compute(rows.map(value=>value.id==='run-24'?{...value,documentedType:'easy-endurance'}:value)).structured.conclusion).toBe('insufficient-data');
    expect(compute(rows.filter(value=>value.id!=='run-24')).structured.conclusion).toBe('insufficient-data');
    expect(compute(rows).structured.conclusion).toBe('insufficient-data');
  });
  it('correction ou suppression du ressenti défavorable',()=>{
    const rows=regular().map(value=>value.id==='run-3'?{...value,effort:'hard' as const}:value);
    expect(compute(rows).structured.conclusion).toBe('maintain');
    expect(compute(rows.map(value=>({...value,effort:'moderate'}))).structured.conclusion).toBe('insufficient-data');
    expect(compute(rows.map(value=>value.id==='run-3'?{...value,effort:undefined}:value)).structured.conclusion).toBe('insufficient-data');
  });
  it('doublons identiques : pas de double compte ; contradictoires : insuffisant',()=>{
    const rows=regular();const duplicate=compute([...rows,rows[0]]);
    expect(duplicate.structured.conclusion).toBe('insufficient-data');expect(duplicate.structured.sources.activityIds).toHaveLength(8);
    const conflict=compute([...rows,{...rows[0],effort:'hard'}]).structured;
    expect(conflict.conclusion).toBe('insufficient-data');expect(conflict.unfavorable).toEqual([]);
    expect(conflict.sources.quality.excluded[0].reason).toBe('conflicting-duplicate');
  });
  it('diagnostic amont non résolu : pas de preuve favorable inventée',()=>{
    const result=evaluate({activities:regular(),reference,referenceDate:today,sourceIssues:[{source:'occurrence',id:'old',code:'signature-mismatch'}]}).structured;
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it('futur exclu sans préférence ni charge',()=>{
    const result=compute([...regular(),run(-1,{documentedType:'hills',effort:'very-hard',durationSeconds:90000})]);
    expect(result.structured.conclusion).toBe('insufficient-data');expect(result.structured.sources.activityIds).not.toContain('run--1');
    expect(result.structured.sources.quality.excluded).toEqual([{id:'run--1',reason:'future-date'}]);
  });
  it.each([6,7])('frontière ressenti général J+%s',age=>{
    const rows=regular().map(value=>value.id==='run-6'?{...value,date:date(age),effort:'hard' as const}:value);
    expect(codes(compute(rows).structured).includes('recent-difficult-effort')).toBe(age===6);
  });
  it.each([12,13,14])('frontière commune structurée %s jours',gap=>{
    const rows=regular().map(value=>value.id==='run-24'?{...value,date:date(10+gap)}:value);
    expect(codes(compute(rows).structured).includes('close-family-sessions')).toBe(false);
    expect(compute(rows).structured.observations.family.spacing.value.gapDays).toEqual([gap]);
    expect(compute(rows).structured.admissibility.notBefore).toBe(date(-4));
  });
  it.each([9,10])('frontière longue %s jours',gap=>{
    const rows=regular('long-run').map(value=>value.id==='run-24'?{...value,date:date(10+gap)}:value);
    expect(codes(compute(rows).longRun).includes('close-family-sessions')).toBe(false);
    expect(compute(rows).longRun.observations.family.spacing.value.gapDays).toEqual([gap]);
  });
  it.each([1,2])('interaction longue/structurée à %s jours : repos général seulement',gap=>{
    const rows=regular().map(value=>value.id==='run-13'?{...value,date:date(10+gap),documentedType:'long-run' as const}:value);
    const result=compute(rows);
    expect(codes(result.structured).includes('close-mixed-sessions')).toBe(false);
    expect(codes(result.longRun).includes('close-mixed-sessions')).toBe(false);
    if(gap===2)expect(result.structured.conclusion).toBe('insufficient-data');
  });
  it('borne gauche J-27 incluse, J-28 exclue',()=>{
    const result=compute([run(28,{documentedType:'intervals'}),run(27,{documentedType:'hills'})]).structured;
    expect(result.sources.familyActivityIds).toEqual(['run-27']);expect(result.period.from).toBe(date(27));
  });
  it('entrées figées, ordre inversé, calcul indépendant et date explicite',()=>{
    const rows=regular().map(value=>Object.freeze(value));Object.freeze(rows);
    const before=compute(rows);compute([]);expect(compute([...rows].reverse())).toEqual(before);
    expect(()=>evaluate({activities:rows,reference,referenceDate:'invalid'})).toThrow();
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


describe('D4c : preuves réelles et aucune influence sur le moteur',()=>{
  it('prescription, association non confirmée et réalisation ne remplacent pas le type réel',async()=>{
    const source=snapshot(),old=await proposal(source);
    expect(old.content.type).toBe('intervals');
    const actual:RunningSession={id:'actual',date:today,title:'Synthétique',durationSeconds:900,trainingType:'easy-endurance',feeling:{effort:'moderate'}};
    const occurrence:PersistableOccurrenceV2={...old,state:'associated',activityId:actual.id,
      associationEvidence:{sportSignature:activitySportSignatureV2(actual)},
      realization:{result:'completed',proposalOrigin:'manual',confirmedBy:'user'}};
    const collect=async(value:PersistableOccurrenceV2,sessions=[actual])=>{
      const memory=await buildRecommendationContinuityV2({sessions,occurrences:[value]});
      return evaluate({activities:memory.activities,sourceIssues:memory.issues,reference,referenceDate:today});
    };
    const complete=await collect(occurrence);
    expect(complete.structured.sources.familyActivityIds).toEqual([]);
    expect(complete.structured.conclusion).toBe('insufficient-data');
    expect(await collect({...occurrence,realization:undefined})).toEqual(complete);
    expect(await collect({...occurrence,realization:{...occurrence.realization!,result:'partial'}})).toEqual(complete);
    const deleted=await collect(occurrence,[]);
    expect(deleted.structured.sources.quality.upstreamIssues[0].code).toBe('missing-activity');
    const proposalOnly=await collect(old,[]);
    expect(proposalOnly.structured.conclusion).toBe('insufficient-data');
    expect(proposalOnly.structured.sources.activityIds).toEqual([]);
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('recommandations, actives et perspectives identiques : %s',async coachTemperament=>{
    const source=snapshot();source.coachTemperament=coachTemperament;source.occurrences=[await proposal(source)];
    const original=structuredClone(source),before=await adaptCoachV2WithContinuity(source,today);
    const activeBefore=reusableActiveOccurrenceV2(source.occurrences,before,today),planBefore=coachV2Perspectives(before,activeBefore);
    const memory=await buildRecommendationContinuityV2(source);
    evaluate({activities:recordedActivityEvidenceV2(source,today),reference:before.reference,referenceDate:today,sourceIssues:memory.issues});
    const after=await adaptCoachV2WithContinuity(source,today);
    expect(after).toEqual(before);
    const activeAfter=reusableActiveOccurrenceV2(source.occurrences,after,today);
    expect(activeAfter).toEqual(activeBefore);expect(coachV2Perspectives(after,activeAfter)).toEqual(planBefore);
    expect(source).toEqual(original);
  });
});

describe('consolidation D4c : observations, éligibilité, admissibilité séparées',()=>{
  it.each([1740,1800,1860,18000])('durée récente %s : le total seul ne qualifie pas la stabilité',durationSeconds=>{
    const result=compute(regular().map(value=>value.id==='run-3'?{...value,durationSeconds}:value)).structured;
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
    expect(result.missing.map(value=>value.code)).toContain('volume-interpretation-unvalidated');
    expect(result.candidateReadiness.status).toBe('not-calibrated');
    expect(result.observations.volume.transitions.at(-1)?.deltaSeconds).toBe(durationSeconds-1800);
  });
  it('hausse progressive : trajectoire visible sans seuil de surcharge inventé',()=>{
    const rows=regular().map((value,index)=>({...value,durationSeconds:1800+Math.floor(index/2)*60}));
    const result=compute(rows).structured;
    expect(result.observations.volume.transitions.map(value=>value.deltaSeconds)).toEqual([120,120,120]);
    expect(result.observations.volume.trend.slopeSecondsPerWeek).toBe(120);
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it('trois dates, plusieurs intervalles courts et ressentis faciles ne suffisent pas à candidate',()=>{
    const rows=regular().map(value=>['run-24','run-13','run-3'].includes(value.id!)?{...value,documentedType:'hills' as const,effort:'easy' as const}:{...value,documentedType:'easy-endurance' as const});
    const result=compute(rows).structured;
    expect(result.observations.family.spacing.value.gapDays).toEqual([11,10]);
    expect(result.favorable.map(value=>value.code)).toContain('repeated-family');
    expect(result.missing.map(value=>value.code)).not.toContain('family-experience');
    expect(result.conclusion).toBe('insufficient-data');expect(result.unfavorable).toEqual([]);
  });
  it.each(['easy','hard','very-hard'] as const)('séances rapprochées avec %s : contexte réel',effort=>{
    const rows=regular().map(value=>value.id==='run-6'||value.id==='run-3'?{...value,documentedType:'intervals' as const,effort}:value);
    const result=compute(rows).structured;
    expect(result.conclusion).toBe(effort==='easy'?'insufficient-data':'maintain');
    expect(result.admissibility.status).toBe('deferred');
    expect(result.admissibility.notBefore).toBe(date(-11));
  });
  it('longue et structurée proches : cumul documenté, aucun délai croisé inventé',()=>{
    const rows=regular().map(value=>value.id==='run-13'?{...value,documentedType:'long-run' as const,date:date(11)}:value);
    const result=compute(rows);
    expect(result.structured.interactions.some(value=>value.days===1)).toBe(true);
    expect(result.structured.missing.map(value=>value.code)).toContain('mixed-demanding-context');
    expect(result.structured.observations.demanding.weekly[2]).toMatchObject({count:2,knownDurationSeconds:3600,unknownDurationCount:0});
    expect(result.structured.conclusion).toBe('insufficient-data');expect(result.longRun.conclusion).toBe('insufficient-data');
    expect(result.longRun.admissibility.status).toBe('admissible');
  });
  it('plusieurs activités exigeantes récentes et hausse concordante : maintien D2',()=>{
    const result=compute([...regular(),run(2,{documentedType:'hills'}),run(1,{documentedType:'long-run'})]);
    for(const group of [result.structured,result.longRun]){
      expect(group.conclusion).toBe('maintain');expect(group.unfavorable.map(value=>value.code)).toContain('concentrated-volume-increase');
      expect(group.observations.concentration.value.activityCount).toBe(2);
    }
  });
  it('couverture partielle : valeurs connues conservées sans tendance imputée',()=>{
    const result=compute(regular().map(value=>value.id==='run-3'?{...value,durationSeconds:undefined}:value)).structured;
    expect(result.observations.volume.weeks[3].duration).toMatchObject({knownTotal:1800,unknownCount:1});
    expect(result.observations.volume.trend.slopeSecondsPerWeek).toBeNull();
    expect(result.observations.volume.relativeToPriorMedian.relativeChange).toBeNull();
    expect(result.conclusion).toBe('insufficient-data');
  });
});
