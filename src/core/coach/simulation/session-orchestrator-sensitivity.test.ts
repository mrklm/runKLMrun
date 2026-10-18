import { describe,expect,it } from 'vitest';
import { selectPrototypeSessions,type PrototypeGoal } from './session-strategies-v2';
import { SESSION_ORCHESTRATOR_EXPERIMENT,type SessionOrchestratorPolicy } from './session-orchestrator-v2';
import { simulateTemporalOrchestration,type TemporalConsultation } from './session-orchestrator-sensitivity';

const START=Date.parse('2026-01-05T00:00:00Z'),DAY=86400000;
const date=(offset:number)=>new Date(START+offset*DAY).toISOString().slice(0,10);
const consultations=(offsets:readonly number[],availabilitySeconds=3600):TemporalConsultation[]=>
  offsets.map(offset=>({date:date(offset),availabilitySeconds}));
const daily=()=>consultations(Array.from({length:84},(_,index)=>index));
const weekly=()=>consultations(Array.from({length:12},(_,index)=>index*7));
const irregular=()=>consultations([0,1,5,12,13,22,35,36,50,63,70,83]);
const sameDay=()=>consultations(Array.from({length:12},(_,index)=>[index*7,index*7,index*7]).flat());
const catalog=(goal:PrototypeGoal)=>selectPrototypeSessions({goal,habitualReferenceSeconds:2700,evidence:'documented',
  experience:'experienced',availabilitySeconds:3600,preferredTerrain:'hills',observedSessionTypes:['long-run','intervals','hills'],
  targetDistanceMeters:10000,documentedDistanceMeters:8000,eventDate:'2026-12-01'});
const run=(goal:PrototypeGoal,dates:TemporalConsultation[],policy:SessionOrchestratorPolicy=SESSION_ORCHESTRATOR_EXPERIMENT,
  extra:Partial<Parameters<typeof simulateTemporalOrchestration>[0]>={})=>simulateTemporalOrchestration({coachTemperament:'rentre-dedans',goal,
    habitualReferenceSeconds:2700,candidates:catalog(goal),consultations:dates,policy,...extra});
const count=(result:ReturnType<typeof run>,type:string)=>result.presentations.filter(value=>value.type===type).length;

describe('sensibilité temporelle de l’orchestrateur V2',()=>{
  it.each([
    ['quotidienne',daily()],['hebdomadaire',weekly()],['irrégulière',irregular()],['plusieurs fois le même jour',sameDay()],
  ])('sépare le calcul sportif de la fréquence de consultation %s',(_label,dates)=>{
    const result=run('speed',dates);
    expect(count(result,'intervals')).toBe(dates.length);
    expect(result.activities).toEqual([]); // Ce banc ne simule pas la déduplication du dépôt.
  });

  it.each([1,2,3])('compare le délai après activité : %i jour(s)',minimumDaysAfterActivity=>{
    const policy={...SESSION_ORCHESTRATOR_EXPERIMENT,minimumDaysAfterActivity};
    const result=run('speed',consultations([0,1,2,3]),policy,{activities:[{date:date(0)}]});
    expect(result.presentations[0]?.date).toBe(date(minimumDaysAfterActivity));
  });

  it.each([7,10,14])('compare l’espacement après une activité structurée : %i jours',structuredActivityGapDays=>{
    const policy={...SESSION_ORCHESTRATOR_EXPERIMENT,structuredActivityGapDays};
    const result=run('speed',daily(),policy,{activities:[{date:date(0),documentedType:'intervals'}]});
    expect(result.presentations.find(value=>value.type==='intervals')?.date).toBe(date(structuredActivityGapDays));
    expect(count(result,'intervals')).toBe(84-structuredActivityGapDays);
  });

  it.each([7,10,14])('compare l’espacement après une sortie longue réelle : %i jours',longActivityGapDays=>{
    const policy={...SESSION_ORCHESTRATOR_EXPERIMENT,longActivityGapDays};
    const result=run('endurance',daily(),policy,{activities:[{date:date(0),documentedType:'long-run'}]});
    expect(result.presentations.find(value=>value.type==='long-run')?.date).toBe(date(longActivityGapDays));
    expect(count(result,'long-run')).toBe(84-longActivityGapDays);
  });

  it('ne transforme pas les suggestions ignorées en activités ou en progression',()=>{
    const result=run('speed',daily());
    expect(result.activities).toEqual([]);
    expect(new Set(result.presentations.map(value=>value.session.durationSeconds))).toEqual(new Set([2100]));
    expect(result.presentations.every(value=>!('debt' in value)&&!('replacement' in value))).toBe(true);
  });

  it('distingue les suggestions parfois réalisées des simples présentations',()=>{
    const result=run('speed',weekly(),SESSION_ORCHESTRATOR_EXPERIMENT,{realizedPresentationIndexes:[0,2]});
    expect(result.activities).toHaveLength(2);
    expect(result.activities.map(value=>value.date)).toEqual([date(1),date(15)]);
    expect(result.presentations.length).toBeGreaterThan(result.activities.length);
  });

  it('tient compte des activités indépendantes et autorise zéro suggestion',()=>{
    const result=run('speed',consultations([0,1,2,3,4]),SESSION_ORCHESTRATOR_EXPERIMENT,
      {activities:[{date:date(0)},{date:date(2)}]});
    expect(result.zeroSuggestionCount).toBe(4);
    expect(result.presentations.map(value=>value.date)).toEqual([date(4)]);
  });

  it('reprend sans dette après une interruption',()=>{
    const dates=consultations([0,7,14,56,63,70,77]);
    const result=run('speed',dates);
    expect(result.presentations.find(value=>value.date===date(56))).toBeDefined();
    expect(result.presentations.every(value=>!('debt' in value)&&!('replacement' in value))).toBe(true);
  });

  it('respecte les disponibilités et renvoie zéro si aucun candidat ne tient',()=>{
    const result=run('speed',consultations([0],120));
    expect(result.presentations).toEqual([]);
    expect(result.zeroSuggestionCount).toBe(1);
  });
});
