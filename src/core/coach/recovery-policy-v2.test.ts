import { describe,expect,it } from 'vitest';
import { evaluateRecoveryV2,STRUCTURED_RECOVERY_TYPES_V2,type RecoveryActivityV2 } from './recovery-policy-v2';
const referenceDate='2026-11-05';
const date=(age:number)=>new Date(Date.parse(`${referenceDate}T00:00:00Z`)-age*86400000).toISOString().slice(0,10);
const activity=(age:number,extra:Partial<RecoveryActivityV2>={}):RecoveryActivityV2=>({id:'run',date:date(age),...extra});
const evaluate=(activities:RecoveryActivityV2[])=>evaluateRecoveryV2({referenceDate,activities});
describe('politique commune de récupération',()=>{
  it.each([1,2])('repos civil J+%s, même sans durée/type/ressenti',age=>{
    const result=evaluate([activity(age)]);
    expect(result.gates.all.status).toBe(age<2?'deferred':'admissible');
    expect(result.gates.all.notBefore).toBe(age<2?date(age-2):null);
    expect(result.quality.unknownEfforts).toHaveLength(1);
    expect(result.quality.unknownTypes).toHaveLength(1);
  });
  it.each(['hard','very-hard'] as const)('frontière sept jours : %s',effort=>{
    for(const age of [6,7]){
      const result=evaluate([activity(age,{effort})]);
      expect(result.preference.status).toBe(age===6?'prefer-easy':'unchanged');
      expect(result.gates.structured.status).toBe(age===6&&effort==='very-hard'?'deferred':'admissible');
      expect(result.gates.longRun.status).toBe(result.gates.structured.status);
      expect(result.gates.all.status).toBe('admissible');
    }
  });
  it.each(STRUCTURED_RECOVERY_TYPES_V2)('protection commune des quatre familles après %s',documentedType=>{
    for(const age of [13,14]){
      const result=evaluate([activity(age,{documentedType})]);
      expect(result.gates.structured.status).toBe(age===13?'deferred':'admissible');
      expect(result.gates.structured.notBefore).toBe(age===13?date(-1):null);
      expect(result.gates.longRun.status).toBe('admissible');
    }
  });
  it.each([9,10])('sortie longue J+%s indépendante des familles structurées',age=>{
    const result=evaluate([activity(age,{documentedType:'long-run'})]);
    expect(result.gates.longRun.status).toBe(age===9?'deferred':'admissible');
    expect(result.gates.structured.status).toBe('admissible');
  });
  it('alternance : la dernière famille structure la date commune',()=>{
    const result=evaluate(STRUCTURED_RECOVERY_TYPES_V2.map((documentedType,index)=>activity(13-index,{id:`run-${index}`,documentedType})));
    expect(result.gates.structured.notBefore).toBe(date(-4));
    expect(result.gates.structured.sources).toHaveLength(4);
  });
  it('ignore les activités futures, sans en tirer une préférence',()=>{
    const result=evaluate([activity(-1,{documentedType:'intervals',effort:'very-hard'})]);
    expect(result.protections).toEqual([]);expect(result.preference.status).toBe('unchanged');
    expect(result.quality.ignoredFutureSources).toHaveLength(1);
  });
  it('intentions : espacement uniquement, sources distinctes, futures ignorées',()=>{
    const result=evaluateRecoveryV2({referenceDate,activities:[],intentions:[{date:date(3),type:'hills'},{date:date(-1),type:'long-run'}]});
    expect(result.gates.structured.notBefore).toBe(date(-11));
    expect(result.gates.structured.sources[0].kind).toBe('intention');
    expect(result.preference.sources).toEqual([]);expect(result.quality.unknownEfforts).toEqual([]);
    expect(result.gates.longRun.status).toBe('admissible');
  });
  it('ordre et doublons identiques : décision déterministe et entrées intactes',()=>{
    const rows=[activity(1,{id:'a'}),activity(5,{id:'b',documentedType:'intervals',effort:'hard'})];
    const original=structuredClone(rows),expected=evaluate(rows);
    expect(evaluate([...rows].reverse())).toEqual(expected);
    expect(evaluate([...rows,...rows])).toEqual(expected);expect(rows).toEqual(original);
  });
  it('contradictions résiduelles signalées sans arbitrage ni perte de protection connue',()=>{
    const result=evaluate([activity(3,{documentedType:'long-run'}),activity(3,{documentedType:'hills',effort:'very-hard'})]);
    expect(result.quality.conflictingIds).toEqual(['run']);
    expect(result.gates.structured.status).toBe('deferred');expect(result.gates.longRun.status).toBe('deferred');
  });
  it('correction du type, du ressenti et suppression : aucune mémoire cachée',()=>{
    expect(evaluate([activity(3,{documentedType:'intervals'})]).gates.structured.status).toBe('deferred');
    expect(evaluate([activity(3,{documentedType:'easy-endurance'})]).gates.structured.status).toBe('admissible');
    expect(evaluate([activity(3,{effort:'very-hard'})]).gates.longRun.status).toBe('deferred');
    expect(evaluate([activity(3,{effort:'easy'})]).gates.longRun.status).toBe('admissible');
    expect(evaluate([]).protections).toEqual([]);
  });
  it('la frontière reste civile à travers le changement de mois',()=>{
    expect(evaluateRecoveryV2({referenceDate:'2026-11-01',activities:[{date:'2026-10-31'}]}).gates.all.notBefore).toBe('2026-11-02');
  });
  it('rejette dates et paramètres invalides',()=>{
    expect(()=>evaluate([{date:'invalid'}])).toThrow();
    expect(()=>evaluateRecoveryV2({referenceDate,activities:[],parameters:{minimumDaysAfterActivity:-1,structuredActivityGapDays:14,longActivityGapDays:10}})).toThrow();
  });
});
