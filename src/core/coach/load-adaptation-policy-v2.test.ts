import { describe,expect,it } from 'vitest';
import { interpretRecentLoadV2 } from './load-adaptation-policy-v2';
import { analyzeRecentLoadV2 } from './recent-load-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import { orchestratePrototypeSession,SESSION_ORCHESTRATOR_EXPERIMENT,FEELING_PREFERENCE_WINDOW_DAYS,
  type RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import { selectPrototypeSessions } from './simulation/session-strategies-v2';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { civilDate,ianaTimeZone,instantIso,observePresentationV2 } from './persistence-foundations-v2';

const today='2026-11-04',DAY=86400000;
const date=(age:number)=>new Date(Date.parse(`${today}T00:00:00Z`)-age*DAY).toISOString().slice(0,10);
const reference:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',
  referenceSeconds:1800,sourceIds:['reference'],reasons:[],excluded:[],artificialDecreaseRisk:false};
const run=(id:string,age=2,patch:Partial<RecordedActivityEvidence>={}):RecordedActivityEvidence=>
  ({id,date:date(age),durationSeconds:1800,distanceMeters:4000,documentedType:'easy-endurance',effort:'easy',...patch});
const load=(activities:RecordedActivityEvidence[],ref=reference,referenceDate=today)=>analyzeRecentLoadV2({activities,reference:ref,referenceDate});
const policy=(activities:RecordedActivityEvidence[],ref=reference,referenceDate=today)=>interpretRecentLoadV2(load(activities,ref,referenceDate));
const codes=(result:ReturnType<typeof policy>)=>result.reasons.map(value=>value.code);
function deepFreeze<T>(value:T):T {
  if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze);}
  return value;
}

describe('politique isolée de charge D2b-1',()=>{
  it('ne change rien pour une séance isolée facile documentée après deux jours',()=>{
    const result=policy([run('easy')]);
    expect(result.decisions).toEqual({allSessions:{status:'baseline-only',notBefore:null},
      structured:{status:'baseline-only',notBefore:null},longRun:{status:'baseline-only',notBefore:null},
      preference:'unchanged',progression:'baseline-only'});
    expect(result.evidence.pattern).toBe('isolated');
    expect(result.quality.gaps).toEqual([]);
  });
  it('préfère récupérer après une séance longue difficile sans inventer un délai supplémentaire',()=>{
    const result=policy([run('long',2,{durationSeconds:5400,documentedType:'long-run',effort:'hard'})]);
    expect(result.decisions).toMatchObject({preference:'recovery',progression:'do-not-increase',
      longRun:{status:'defer',notBefore:date(-8)},structured:{status:'baseline-only',notBefore:null}});
    expect(result.evidence.aboveHabitualActivityIds).toEqual(['long']);
    expect(codes(result)).toContain('difficult-effort');
  });
  it('ne transforme pas une durée isolée supérieure à l’habitude en surcharge',()=>{
    const result=policy([run('long',2,{durationSeconds:5400})]);
    expect(result.decisions.preference).toBe('unchanged');
    expect(result.evidence.aboveHabitualActivityIds).toEqual(['long']);
  });
  it('préfère récupérer après accumulation et durée supérieure à une référence confirmée',()=>{
    const result=policy([run('a'),run('b',2,{durationSeconds:2400})]);
    expect(result.evidence.pattern).toBe('concentrated');
    expect(result.decisions.preference).toBe('recovery');
    expect(codes(result)).toContain('concentrated-above-habitual');
    expect(result.protections).toEqual([]); // Aucun délai inventé après J+2.
  });
  it('la concentration seule ne prouve pas une charge excessive',()=>{
    const result=policy([run('a'),run('b')]);
    expect(result.decisions.preference).toBe('unchanged');
    expect(result.evidence.pattern).toBe('concentrated');
  });
  it('compare deux semaines adjacentes et combine hausse observée et concentration',()=>{
    const result=policy([run('previous',9),run('a'),run('b')]);
    expect(result.evidence.volumes).toEqual({last7DaysSeconds:3600,last14DaysSeconds:5400,previous7DaysSeconds:1800,comparison:'increased'});
    expect(result.decisions.preference).toBe('recovery');
    expect(codes(result)).toContain('concentrated-volume-increase');
  });
  it('ne déclenche pas la préférence pour une hausse de volume sans concentration',()=>{
    const result=policy([run('previous',9),run('a',6),run('b',3)]);
    expect(result.evidence).toMatchObject({pattern:'multiple-spread',volumes:{comparison:'increased'}});
    expect(result.decisions.preference).toBe('unchanged');
  });
  it('ne traite ni une semaine précédente vide ni un volume partiel comme une hausse établie',()=>{
    expect(policy([run('a'),run('b')]).evidence.volumes.comparison).toBe('unknown');
    const result=policy([run('previous',9,{durationSeconds:undefined}),run('a'),run('b')]);
    expect(result.evidence.volumes.comparison).toBe('unknown');
    expect(result.decisions.preference).toBe('cautious');
    expect(result.quality.gaps.map(value=>value.code)).toContain('missing-duration');
  });
  it('conserve les mesures partielles et ne tire aucun effort d’un statut',()=>{
    const actual=run('partial',2,{durationSeconds:900});
    const expected=policy([actual]);
    for(const result of ['partial','completed','not-completed']){
      const annotated=Object.assign({...actual},{confirmedRealization:{occurrenceId:'r',result}});
      expect(policy([annotated as RecordedActivityEvidence])).toEqual(expected);
    }
    expect(expected.evidence.volumes.last7DaysSeconds).toBe(900);
    expect(policy([]).evidence.volumes.last7DaysSeconds).toBe(0);
  });
  it('le type réel prévaut, sans utiliser la confirmation comme preuve de fractionné',()=>{
    const result=policy([run('a',2,{confirmedRealization:{occurrenceId:'interval-recommendation',result:'completed'}})]);
    expect(result.evidence.structuredActivityIds).toEqual([]);
    expect(result.protections).toEqual([]);
  });
  it('demande une réévaluation sans ressenti, sans inventer de fatigue',()=>{
    const result=policy([run('a',2,{effort:undefined})]);
    expect(result.decisions).toMatchObject({preference:'cautious',structured:{status:'review',notBefore:null}});
    expect(codes(result)).not.toContain('difficult-effort');
    expect(result.quality.effortCoverage7Days).toEqual({known:0,unknown:1});
  });
  it.each(['unavailable','provisional'] as const)('reste prudent avec une référence %s',confidence=>{
    const result=policy([run('a',2,{durationSeconds:5400}),run('b')],{...reference,confidence,available:confidence!=='unavailable'});
    expect(result.evidence.aboveHabitualActivityIds).toEqual([]);
    expect(result.decisions).toMatchObject({preference:'cautious',progression:'do-not-increase',structured:{status:'review'}});
  });
  it('préserve les protections connues même sans aucune durée ni référence',()=>{
    const result=policy([run('a',1,{durationSeconds:undefined,documentedType:'intervals',effort:'very-hard'})],{...reference,available:false,referenceSeconds:null});
    expect(result.decisions.allSessions).toEqual({status:'defer',notBefore:date(-1)});
    expect(result.decisions.structured).toEqual({status:'defer',notBefore:date(-13)});
    expect(result.decisions.longRun).toEqual({status:'defer',notBefore:date(-6)});
    expect(result.evidence.volumes.last7DaysSeconds).toBeNull();
  });
  it('signale les contradictions sans inventer leurs dates de récupération',()=>{
    const rows=[run('conflict',0),run('conflict',1),run('known',2)];
    const result=policy(rows);
    expect(result).toEqual(policy([...rows].reverse()));
    expect(result.decisions).toMatchObject({allSessions:{status:'review',notBefore:null},structured:{status:'review'},preference:'cautious'});
    expect(result.quality.gaps).toContainEqual({code:'excluded-data',activityIds:['conflict']});
  });
  it('les doublons identiques ne créent aucune accumulation',()=>{
    const actual=run('a');
    const result=policy([actual,actual]);
    expect(result.evidence.pattern).toBe('isolated');
    expect(result.decisions).toEqual(policy([actual]).decisions);
  });
  it('reste déterministe et ne modifie pas l’analyse D2a',()=>{
    const rows=[run('z',9),run('b',2,{durationSeconds:2400,effort:'hard'}),run('a')];
    const analysis=deepFreeze(load(rows)),before=structuredClone(analysis);
    const result=interpretRecentLoadV2(analysis);
    expect(result).toEqual(policy([...rows].reverse()));
    expect(analysis).toEqual(before);
  });
  it('la distance manquante ne bloque pas une interprétation fondée sur les durées',()=>{
    expect(policy([run('a',2,{distanceMeters:undefined})]).decisions).toEqual(policy([run('a')]).decisions);
  });
  it('ne convertit pas un dépassement numérique en hausse de charge',()=>{
    const result=policy([run('a',2,{durationSeconds:Number.MAX_VALUE}),run('b',3,{durationSeconds:Number.MAX_VALUE})]);
    expect(result.evidence.volumes.comparison).toBe('unknown');
    expect(result.quality.gaps.map(value=>value.code)).toContain('numeric-overflow');
    expect(result.decisions.structured.status).toBe('review');
  });
  it('les activités futures ne justifient ni blocage ni fatigue actuelle',()=>{
    const result=policy([run('actual'),run('future',-1,{effort:'very-hard',documentedType:'intervals'})]);
    expect(result.decisions).toEqual(policy([run('actual')]).decisions);
  });
});

describe('protections et frontières civiles inchangées',()=>{
  it('importe les seuils existants sans nouveau paramètre susceptible de les réduire',()=>{
    expect(SESSION_ORCHESTRATOR_EXPERIMENT).toEqual({minimumDaysAfterActivity:2,structuredActivityGapDays:14,longActivityGapDays:10});
    expect(FEELING_PREFERENCE_WINDOW_DAYS).toBe(7);
  });
  it.each([0,1,2])('repos minimal à J+%i',age=>{
    expect(policy([run('a',age)]).decisions.allSessions.status).toBe(age<2?'defer':'baseline-only');
  });
  it.each([6,7])('protection très difficile à J+%i',age=>{
    const result=policy([run('a',age,{effort:'very-hard'})]);
    expect(result.protections.some(value=>value.code==='very-hard-protection')).toBe(age<7);
    expect(result.decisions.structured.status==='defer').toBe(age<7);
  });
  it.each([6,7])('préférence difficile à J+%i',age=>{
    const result=policy([run('a',age,{effort:'hard'})]);
    expect(codes(result).includes('difficult-effort')).toBe(age<7);
    expect(result.protections).toEqual([]);
  });
  it.each([9,10])('sortie longue à J+%i',age=>{
    expect(policy([run('a',age,{documentedType:'long-run'})]).decisions.longRun.status==='defer').toBe(age<10);
  });
  it.each([13,14])('fractionné à J+%i',age=>{
    expect(policy([run('a',age,{documentedType:'intervals'})]).decisions.structured.status==='defer').toBe(age<14);
  });
  it.each(['steady-run','hills','endurance-variations'] as const)('préserve les quatorze jours pour %s',documentedType=>{
    expect(policy([run('a',13,{documentedType})]).decisions.structured.notBefore).toBe(date(-1));
  });
  it('la concentration sort de sa fenêtre à J+3 sans annuler les autres protections',()=>{
    const rows=[run('a',2,{durationSeconds:2400}),run('b',2,{documentedType:'intervals'})];
    expect(policy(rows).decisions.preference).toBe('recovery');
    const next=policy(rows,reference,date(-1));
    expect(next.decisions.preference).toBe('unchanged');
    expect(next.decisions.structured.status).toBe('defer');
  });
  it.each(['2026-12-31','2026-03-28','2026-10-24'])('reste civil au changement de jour : %s',activityDate=>{
    const actual={...run('a'),date:activityDate};
    const after=(offset:number)=>new Date(Date.parse(`${activityDate}T00:00:00Z`)+offset*DAY).toISOString().slice(0,10);
    expect(policy([actual],reference,after(1)).decisions.allSessions.notBefore).toBe(after(2));
    expect(policy([actual],reference,after(2)).decisions.allSessions.status).toBe('baseline-only');
  });
});

describe('appel isolé de la politique sans effet de bord',()=>{
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('orchestration strictement identique pour %s',coachTemperament=>{
    const candidates=selectPrototypeSessions({goal:'speed',habitualReferenceSeconds:1800,evidence:'documented',experience:'experienced',
      availabilitySeconds:3600,observedSessionTypes:['intervals','long-run','hills']});
    for(const activities of [[run('easy')],[run('long',2,{durationSeconds:5400,effort:'hard'})],
      [run('a'),run('b',2,{durationSeconds:2400})],[run('partial',2,{durationSeconds:900,confirmedRealization:{occurrenceId:'r',result:'partial'}})],
      [run('no-effort',2,{effort:undefined})],[run('missing-duration',2,{durationSeconds:undefined})]]){
      const input=deepFreeze({referenceDate:today,coachTemperament,goal:'speed' as const,habitualReferenceSeconds:1800,
        availabilitySeconds:3600,candidates,activities,presented:[]});
      const before=orchestratePrototypeSession(input);
      policy(activities);
      expect(orchestratePrototypeSession(input)).toEqual(before);
    }
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('pipeline, occurrence active et perspectives inchangés pour %s',async coachTemperament=>{
    const snapshot:CoachV2ApplicationSnapshot={coachTemperament,sessions:[25,20,15,10,5,2].map((age,index)=>
      ({id:String(index),date:date(age),durationSeconds:1800,title:'Synthétique',trainingType:'easy-endurance',feeling:{effort:'easy'}})),
      occurrences:[],configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced'},
      profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:60},
        preferences:{terrain:'road'},accompanimentMode:'advisor'}};
    const first=adaptCoachV2Readonly(snapshot,today);
    const occurrence=(await observePresentationV2({selection:selectedApplicationSuggestionV2(first,1),
      moment:{presentedAt:instantIso(`${today}T08:00:00.000Z`),presentedOn:civilDate(today),timeZone:ianaTimeZone('Europe/Paris'),
        utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
      provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:first.reference.sourceIds,limitationCodes:[]},
      existing:[],createId:()=> 'active'})).occurrence;
    snapshot.occurrences=[occurrence];
    const before=adaptCoachV2Readonly(snapshot,today),retained=reusableActiveOccurrenceV2(snapshot.occurrences,before,today);
    expect(retained?.id).toBe('active');
    const clone=structuredClone(snapshot);
    interpretRecentLoadV2(deepFreeze(analyzeRecentLoadV2({activities:before.activityEvidence,reference:before.reference,referenceDate:today})));
    const after=adaptCoachV2Readonly(snapshot,today);
    expect(after).toEqual(before);
    expect(reusableActiveOccurrenceV2(snapshot.occurrences,after,today)).toEqual(retained);
    expect(coachV2Perspectives(after,retained)).toEqual(coachV2Perspectives(before,retained));
    expect(snapshot).toEqual(clone);
  });
});
