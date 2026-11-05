import { describe,expect,it } from 'vitest';
import { analyzeRecentLoadV2 } from './recent-load-v2';
import { recordedActivityEvidenceV2 } from './activity-evidence-v2';
import { adaptCoachV2Readonly,habitualReferenceFromOccurrencesV2,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import type { RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2 } from './presentation-identity-v2';
const reference:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',
  referenceSeconds:1800,sourceIds:['baseline'],reasons:[],excluded:[],artificialDecreaseRisk:false};
const run=(id:string,date='2026-11-04',patch:Partial<RecordedActivityEvidence>={}):RecordedActivityEvidence=>
  ({id,date,durationSeconds:1800,distanceMeters:4000,...patch});
const analyze=(activities:RecordedActivityEvidence[],ref=reference,date='2026-11-04')=>
  analyzeRecentLoadV2({activities,reference:ref,referenceDate:date});

describe('charge récente descriptive D2a',()=>{
  it('signale les dépassements de somme sans produire Infinity',()=>{
    const result=analyze([run('a',undefined,{durationSeconds:Number.MAX_VALUE}),run('b',undefined,{durationSeconds:Number.MAX_VALUE})]);
    expect(result.windows.last7Days.durationSeconds).toEqual({knownTotal:null,knownCount:2,unknownCount:0,overflow:true});
  });
  it('la réponse négative ne pondère pas une activité réelle ; aucune activité signifie aucun effort',()=>{
    const actual=run('a');
    const malformed=Object.assign({...actual},{confirmedRealization:{occurrenceId:'r',result:'not-completed'}});
    expect(analyze([malformed as RecordedActivityEvidence])).toEqual(analyze([actual]));
    expect(analyze([]).windows.last14Days.activityCount).toBe(0);
  });
  it('garde inconnus les distances, types et ressentis invalides',()=>{
    const invalid=Object.assign(run('a'),{distanceMeters:-1,documentedType:'invalid',effort:'invalid'});
    const result=analyze([invalid as RecordedActivityEvidence]);
    expect(result.activities[0]).toMatchObject({distanceMeters:null,documentedType:null,effort:null});
    expect(result.windows.last7Days).toMatchObject({unknownTypeCount:1,efforts:{unknown:1},distanceMeters:{knownTotal:null,unknownCount:1}});
  });
  it('décrit un historique régulier et une séance longue sans score arbitraire',()=>{
    const result=analyze([run('a','2026-10-23'),run('b','2026-10-27'),run('c','2026-10-31'),run('d',undefined,{durationSeconds:5400})]);
    expect(result.habitualReference.seconds).toBe(1800);
    expect(result.activities.map(value=>value.relativeDuration)).toEqual([1,1,1,3]);
    expect(result.windows.last7Days.durationSeconds).toEqual({knownTotal:7200,knownCount:2,unknownCount:0,overflow:false});
    expect(result.windows.last14Days.durationSeconds.knownTotal).toBe(10800);
  });
  it('décrit la concentration sans qualifier la charge',()=>{
    const result=analyze([run('a'),run('b'),run('c','2026-11-02'),run('d','2026-11-01')]);
    expect(result.windows.last3Days).toMatchObject({activityCount:3,activeDays:2,maximumActivitiesPerDay:2});
    expect(result.daily.at(-1)).toMatchObject({date:'2026-11-04',activityCount:2,durationSeconds:{knownTotal:3600}});
  });
  it('conserve exactement les mesures partielles et ignore les métadonnées de réalisation',()=>{
    const partial=run('a',undefined,{durationSeconds:901.5,confirmedRealization:{occurrenceId:'r',result:'partial'}});
    expect(analyze([partial])).toEqual(analyze([{...partial,confirmedRealization:undefined}]));
    expect(analyze([partial]).windows.last7Days.durationSeconds.knownTotal).toBe(901.5);
  });
  it.each([undefined,NaN,Infinity,-1,0])('ne remplace pas une durée inconnue : %s',durationSeconds=>{
    const result=analyze([run('a',undefined,{durationSeconds})]);
    expect(result.activities[0].relativeDuration).toBeNull();
    expect(result.windows.last7Days.durationSeconds).toEqual({knownTotal:null,knownCount:0,unknownCount:1,overflow:false});
  });
  it('distingue une somme partielle, une fenêtre vide et une distance nulle',()=>{
    const result=analyze([run('a',undefined,{durationSeconds:undefined,distanceMeters:0}),run('b')]);
    expect(result.windows.last7Days.durationSeconds).toEqual({knownTotal:1800,knownCount:1,unknownCount:1,overflow:false});
    expect(result.windows.last7Days.distanceMeters).toEqual({knownTotal:4000,knownCount:2,unknownCount:0,overflow:false});
    expect(analyze([]).windows.last7Days.durationSeconds).toEqual({knownTotal:0,knownCount:0,unknownCount:0,overflow:false});
  });
  it('compte les ressentis et les types réels séparément',()=>{
    const result=analyze([run('a',undefined,{effort:'hard',documentedType:'intervals'}),
      run('b',undefined,{effort:'easy',documentedType:'long-run'}),run('c'),run('d',undefined,{effort:'very-hard'})]);
    expect(result.windows.last7Days).toMatchObject({efforts:{easy:1,moderate:0,hard:1,'very-hard':1,unknown:1},
      structuredActivityIds:['a'],longRunActivityIds:['b'],unknownTypeCount:2});
  });
  it('ne fabrique aucune référence lorsque l’historique est insuffisant',()=>{
    const source:CoachV2ApplicationSnapshot={sessions:[{id:'a',title:'Synthétique',date:'2026-11-04',durationSeconds:1800}],occurrences:[]};
    const ref=habitualReferenceFromOccurrencesV2(source,'2026-11-04');
    expect(analyze(recordedActivityEvidenceV2(source,'2026-11-04'),ref).activities[0].relativeDuration).toBeNull();
  });
  it.each(['expired','insufficient'] as const)('ne réutilise pas une référence %s',freshness=>{
    expect(analyze([run('a')],{...reference,freshness}).habitualReference.seconds).toBeNull();
  });
  it('compte une fois les doublons identiques et exclut les doublons contradictoires sans dépendre de l’ordre',()=>{
    const rows=[run('a'),run('a'),run('b'),run('b',undefined,{durationSeconds:900}),run('c')];
    const result=analyze(rows);
    expect(result).toEqual(analyze([...rows].reverse()));
    expect(result).toEqual(analyze([rows[3],rows[0],rows[4],rows[1],rows[2]]));
    expect(result.windows.last7Days.activityCount).toBe(2);
    expect(result.quality).toEqual({missingIdCount:0,duplicateIds:['a','b'],excluded:[{id:'b',reason:'conflicting-duplicate'}]});
  });
  it('contrôle les limites inclusives 3/7/14 jours et les dates futures',()=>{
    const result=analyze(['2026-10-21','2026-10-22','2026-10-28','2026-10-29','2026-11-01','2026-11-02','2026-11-04','2026-11-05'].map(date=>run(date,date)));
    expect(result.windows.last3Days.activityCount).toBe(2);
    expect(result.windows.last7Days.activityCount).toBe(4);
    expect(result.windows.last14Days.activityCount).toBe(6);
    expect(result.quality.excluded).toEqual([{id:'2026-11-05',reason:'future-date'}]);
  });
  it.each(['2026-01-01','2026-03-29','2026-10-25','2024-03-01'])('utilise les jours civils à %s',date=>{
    const result=analyze([run('a',date)],reference,date);
    expect(result.daily).toHaveLength(14);
    expect(result.daily.at(-1)?.date).toBe(date);
    expect(Date.parse(result.daily.at(-1)!.date)-Date.parse(result.daily[0].date)).toBe(13*86400000);
  });
  it('le changement de jour fait sortir J−6 de la fenêtre de sept jours',()=>{
    const activities=[run('a','2026-10-29')];
    expect(analyze(activities).windows.last7Days.activityCount).toBe(1);
    expect(analyze(activities,reference,'2026-11-05').windows.last7Days.activityCount).toBe(0);
  });
  it('signale les dates et identifiants invalides',()=>{
    expect(analyze([run(''),run('bad','2026-02-30')]).quality).toEqual({missingIdCount:1,duplicateIds:[],excluded:[{id:'bad',reason:'invalid-date'}]});
    expect(()=>analyze([],reference,'invalid')).toThrow();
  });
  it('ne modifie ni les entrées, ni les recommandations, ni leurs perspectives ou leur réutilisation',()=>{
    const source:CoachV2ApplicationSnapshot={sessions:['2026-10-10','2026-10-15','2026-10-20','2026-10-25'].map((date,index)=>
      ({id:String(index),date,durationSeconds:1800,title:'Synthétique'})),occurrences:[],
      configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced'},
      profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'}};
    for(const coachTemperament of ['pas-a-pas','evolution-active','rentre-dedans'] as const){
      const snapshot={...source,coachTemperament},before=adaptCoachV2Readonly(snapshot,'2026-11-04');
      const frozen=structuredClone(before);
      analyzeRecentLoadV2({activities:before.activityEvidence,reference:before.reference,referenceDate:'2026-11-04'});
      expect(before).toEqual(frozen);
      const after=adaptCoachV2Readonly(snapshot,'2026-11-04');
      expect(after).toEqual(before);
      expect(coachV2Perspectives(after)).toEqual(coachV2Perspectives(before));
      expect(reusableActiveOccurrenceV2(snapshot.occurrences,after,'2026-11-04')).toEqual(reusableActiveOccurrenceV2(snapshot.occurrences,before,'2026-11-04'));
    }
  });
});
