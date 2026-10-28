import { describe,expect,it } from 'vitest';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot,type CoachV2ReadonlyResult } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { civilDate,ianaTimeZone,instantIso,observePresentationV2 } from './persistence-foundations-v2';
import { selectPrototypeSessions } from './simulation/session-strategies-v2';

const date='2026-10-18';
const snapshot:CoachV2ApplicationSnapshot={
  sessions:['09-22','09-27','10-02','10-07','10-12','10-15'].map((day,index)=>({
    id:'run-'+index,title:'Course',sport:'RUNNING',date:'2026-'+day,durationSeconds:2400})),
  configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'},
  profile:{goal:{kind:'endurance'},availability:{days:['monday','wednesday','friday'],minutesPerSession:45},
    preferences:{terrain:'road'},accompanimentMode:'advisor'},
  occurrences:[],
};
const dates=(values:ReturnType<typeof coachV2Perspectives>)=>values.map(value=>value.date);
const complementaryCatalog=()=>selectPrototypeSessions({goal:'endurance',habitualReferenceSeconds:2400,
  evidence:'documented',experience:'experienced',availabilitySeconds:3000,observedTerrain:'rolling',
  observedSessionTypes:['long-run'],intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:20,eligible:true}});
function complementaryResult(candidates=complementaryCatalog()):CoachV2ReadonlyResult {
  return {selectedDate:'2026-10-22',candidate:candidates[0],coachTemperament:'rentre-dedans',activityEvidence:[],
    reference:{referenceSeconds:2400},catalog:{adaptedInput:{goal:'endurance'}},admissibleSessionsByDate:{
      '2026-10-22':candidates,'2026-10-23':candidates,'2026-10-24':candidates,'2026-10-26':candidates,
      '2026-10-28':candidates}} as unknown as CoachV2ReadonlyResult;
}
async function stored(input=snapshot){
  const result=adaptCoachV2Readonly(input,date);
  return (await observePresentationV2({selection:selectedApplicationSuggestionV2(result,1),existing:[],createId:()=> 'retained',
    moment:{presentedOn:civilDate(date),presentedAt:instantIso(date+'T08:00:00.000Z'),timeZone:ianaTimeZone('Europe/Paris'),
      utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',
      referenceSourceIds:input.sessions.map(value=>value.id),limitationCodes:[]}})).occurrence;
}

describe('perspectives V2 sur sept jours, sans activité fictive',()=>{
  it('confirme les activités réelles sans réécrire la prochaine séance provisoire persistée',async()=>{
    const occurrence=await stored(),input={...snapshot,occurrences:[occurrence]},before=structuredClone(input);
    expect(occurrence.provenance.referenceConfidence).toBe('provisional');
    const result=adaptCoachV2Readonly(input,date);
    expect(result.reference.confidence).toBe('confirmed');
    const retained=reusableActiveOccurrenceV2(input.occurrences,result,date);
    expect(retained).toBe(occurrence);
    const plan=coachV2Perspectives(result,retained);
    expect(plan[0].session).toBe(occurrence.content);
    expect(plan.slice(1).every(value=>value.indicative)).toBe(true);
    expect(adaptCoachV2Readonly(input,date)).toEqual(result);
    expect(input).toEqual(before);
  });
  it('Rentre dedans complète les types admissibles puis les variantes, sans mutation',()=>{
    const result=complementaryResult(),before=structuredClone(result);
    expect([...new Set(result.admissibleSessionsByDate['2026-10-24'].map(value=>value.type))])
      .toEqual(['easy-endurance','endurance-variations','long-run']);
    const plan=coachV2Perspectives(result);
    expect(dates(plan)).toEqual(['2026-10-22','2026-10-24','2026-10-26','2026-10-28']);
    expect(plan.map(value=>value.session.type)).toEqual(['easy-endurance','long-run','endurance-variations','easy-endurance']);
    expect(plan.at(-1)?.session.terrain).toBe('flat');
    const last=plan.at(-1)!.session;
    expect('rationale' in last&&last.rationale.designChoices.join(' '))
      .toContain('type ou une variante absent des intentions précédentes');
    expect(coachV2Perspectives(result)).toEqual(plan);
    expect(result).toEqual(before);
    // Recalcul sans intention réalisée : aucune fatigue ni espacement hérité du calcul précédent.
    expect(coachV2Perspectives({...result,selectedDate:'2026-10-24'}).map(value=>value.session.type))
      .toEqual(['easy-endurance','long-run','endurance-variations']);
  });
  it('Rentre dedans alterne les variantes faciles de même charge puis de durée inférieure',()=>{
    const candidates=selectPrototypeSessions({goal:'endurance',habitualReferenceSeconds:2100,evidence:'documented',
      experience:'experienced',availabilitySeconds:2700,observedTerrain:'rolling',observedSessionTypes:[]});
    const result=complementaryResult(candidates);
    expect(coachV2Perspectives(result).slice(0,3).map(value=>[value.session.totalDurationSeconds,value.session.terrain]))
      .toEqual([[2100,'rolling'],[2100,'flat'],[1800,'rolling']]);
  });
  it('répète le seul candidat fourni par une référence provisoire sans contourner le catalogue',()=>{
    const candidates=selectPrototypeSessions({goal:'endurance',habitualReferenceSeconds:2100,evidence:'insufficient',
      experience:'experienced',availabilitySeconds:2700,observedTerrain:'rolling',observedSessionTypes:[]});
    expect(candidates).toHaveLength(1);
    expect(coachV2Perspectives(complementaryResult(candidates)).every(value=>value.session.type==='easy-endurance'
      &&value.session.totalDurationSeconds===2100&&value.session.terrain==='rolling')).toBe(true);
  });
  it.each(['hard','very-hard'] as const)('respecte le ressenti %s malgré les alternatives stimulantes',effort=>{
    const result=complementaryResult();
    result.activityEvidence=[{date:'2026-10-22',effort}];
    expect(coachV2Perspectives(result).every(value=>value.session.type==='easy-endurance')).toBe(true);
  });
  it('respecte les espacements des activités structurées et longues récentes',()=>{
    const result=complementaryResult();
    result.activityEvidence=[{date:'2026-10-20',documentedType:'endurance-variations'},
      {date:'2026-10-21',documentedType:'long-run'}];
    expect(coachV2Perspectives(result).every(value=>value.session.type==='easy-endurance')).toBe(true);
  });
  it('ancre la complémentarité sur le contenu persisté sans le modifier',async()=>{
    const occurrence=await stored(),before=structuredClone(occurrence),result=complementaryResult();
    const plan=coachV2Perspectives(result,occurrence);
    expect(plan[0].session).toBe(occurrence.content);
    expect(plan.filter(value=>value.session.type==='long-run')).toHaveLength(1);
    expect(plan.filter(value=>value.session.type==='endurance-variations')).toHaveLength(1);
    expect(occurrence).toEqual(before);
  });
  it('Pas à Pas alterne seulement les variantes faciles déjà admissibles',()=>{
    const candidates=selectPrototypeSessions({goal:'endurance',habitualReferenceSeconds:2196,evidence:'documented',experience:'experienced',
      availabilitySeconds:2700,observedTerrain:'rolling',observedSessionTypes:[]}).filter(value=>value.type==='easy-endurance');
    const result={selectedDate:'2026-10-19',candidate:candidates[0],coachTemperament:'pas-a-pas',activityEvidence:[],
      reference:{referenceSeconds:2196},catalog:{adaptedInput:{goal:'endurance'}},admissibleSessionsByDate:{
        '2026-10-19':candidates,'2026-10-21':candidates,'2026-10-23':candidates}} as unknown as CoachV2ReadonlyResult;
    expect(coachV2Perspectives(result).map(value=>[value.session.totalDurationSeconds,value.session.terrain]))
      .toEqual([[2100,'rolling'],[2100,'flat'],[1800,'rolling']]);
  });
  it('Évolution Active préfère un type encore absent de la projection quand il est admissible',()=>{
    const [easy]=selectPrototypeSessions({goal:'endurance',habitualReferenceSeconds:2100,evidence:'documented',experience:'experienced',
      availabilitySeconds:3600,observedSessionTypes:[],intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:14,eligible:true}});
    const candidates=[easy,{...easy,type:'recovery' as const,intensity:'very-easy' as const},{...easy,type:'endurance-variations' as const,intensity:'steady' as const}];
    const result={selectedDate:'2026-10-19',candidate:candidates[0],coachTemperament:'evolution-active',activityEvidence:[],
      reference:{referenceSeconds:2100},catalog:{adaptedInput:{goal:'endurance'}},admissibleSessionsByDate:{
        '2026-10-19':candidates,'2026-10-21':candidates,'2026-10-23':candidates}} as unknown as CoachV2ReadonlyResult;
    const plan=coachV2Perspectives(result);
    expect(plan.slice(0,3).map(value=>value.session.type)).toEqual(['easy-endurance','endurance-variations','recovery']);
    expect(coachV2Perspectives(result)).toEqual(plan);
  });
  it('retient les disponibilités espacées sans progression automatique ni mutation',()=>{
    const before=structuredClone(snapshot),result=adaptCoachV2Readonly(snapshot,date),plan=coachV2Perspectives(result);
    expect(dates(plan)).toEqual(['2026-10-19','2026-10-21','2026-10-23']);
    expect(plan.map(value=>value.indicative)).toEqual([false,true,true]);
    expect(new Set(plan.map(value=>value.session.totalDurationSeconds)).size).toBe(1);
    expect(snapshot).toEqual(before);
    expect(result.facts.sessionIds).toEqual(snapshot.sessions.map(value=>value.id));
    expect(coachV2Perspectives(adaptCoachV2Readonly(snapshot,date))).toEqual(plan);
  });
  it('propage les variations modérées aux perspectives sans les traiter comme des activités',async()=>{
    const occurrence=await stored(snapshot);
    const input={...snapshot,coachTemperament:'rentre-dedans' as const,occurrences:[{...occurrence,
      provenance:{...occurrence.provenance,referenceConfidence:'confirmed' as const}}]},before=structuredClone(input);
    const result=adaptCoachV2Readonly(input,date),plan=coachV2Perspectives(result);
    expect(plan[0].session).toMatchObject({type:'endurance-variations',intensity:'steady'});
    expect(plan[0].session.structure).toBeDefined();
    expect(plan.slice(1).every(value=>value.session.type!=='endurance-variations')).toBe(true);
    expect(input).toEqual(before);
  });
  it('ne cumule pas la durée progressive dans les perspectives',async()=>{
    const occurrence=await stored(snapshot);
    const sessions=snapshot.sessions.map((session,index)=>({...session,durationSeconds:2100,trainingType:'easy-endurance' as const,
      feeling:{effort:index%2?'moderate' as const:'easy' as const}}));
    const input={...snapshot,sessions,coachTemperament:'evolution-active' as const,occurrences:[{...occurrence,
      provenance:{...occurrence.provenance,referenceConfidence:'confirmed' as const}}],
      documentedActivityTypes:Object.fromEntries(sessions.map(session=>[session.id,'easy-endurance' as const]))};
    const before=structuredClone(input),result=adaptCoachV2Readonly(input,date),plan=coachV2Perspectives(result);
    expect(plan.map(value=>value.session.totalDurationSeconds)).toEqual([2400,2100,2100]);
    expect(plan.filter(value=>value.session.totalDurationSeconds>2100)).toHaveLength(1);
    expect(coachV2Perspectives(adaptCoachV2Readonly(input,date))).toEqual(plan);
    expect(input).toEqual(before);
  });
  it.each([{days:['monday'] as const},{days:[] as const}])('ne remplit pas artificiellement les jours : $days',({days})=>{
    const input={...snapshot,profile:{...snapshot.profile!,availability:{days:[...days],minutesPerSession:45}}};
    expect(coachV2Perspectives(adaptCoachV2Readonly(input,date))).toHaveLength(days.length);
  });
  it('ne propose rien malgré les disponibilités si la référence réelle est insuffisante',()=>{
    expect(coachV2Perspectives(adaptCoachV2Readonly({...snapshot,sessions:snapshot.sessions.slice(-1)},date))).toEqual([]);
  });
  it('espace les intentions quotidiennes et ne prolonge pas l’horizon après 18 h',()=>{
    const input={...snapshot,profile:{...snapshot.profile!,availability:{
      days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const,minutesPerSession:45}}};
    // Copie mutable conforme au profil.
    const value={...input,profile:{...input.profile,availability:{...input.profile.availability,days:[...input.profile.availability.days]}}};
    expect(dates(coachV2Perspectives(adaptCoachV2Readonly(value,{date,minuteOfDay:1079}))))
      .toEqual(['2026-10-18','2026-10-20','2026-10-22','2026-10-24']);
    expect(dates(coachV2Perspectives(adaptCoachV2Readonly(value,{date,minuteOfDay:1080}))))
      .toEqual(['2026-10-19','2026-10-21','2026-10-23']);
  });
  it('ne répète pas une séance structurée envisagée et ne la transforme pas en expérience acquise',()=>{
    const input={...snapshot,coachTemperament:'rentre-dedans' as const,configuration:{...snapshot.configuration!,goal:{model:'evolving' as const,kind:'speed' as const}}};
    const plan=coachV2Perspectives(adaptCoachV2Readonly(input,date));
    expect(plan.map(value=>value.session.type)).toEqual(['intervals','easy-endurance','easy-endurance']);
    expect(input.sessions).toEqual(snapshot.sessions);
  });
  it('ancre les perspectives sur la suggestion future retenue par un autre onglet',async()=>{
    const future={...snapshot,profile:{...snapshot.profile!,availability:{days:['wednesday'] as const,minutesPerSession:45}}};
    const occurrence=await stored({...future,profile:{...future.profile,availability:{...future.profile.availability,days:['wednesday']}}});
    const input={...snapshot,occurrences:[occurrence]},before=structuredClone(input),result=adaptCoachV2Readonly(input,date);
    expect(result.selectedDate).toBe('2026-10-19');
    expect(reusableActiveOccurrenceV2(input.occurrences,result,date)?.id).toBe(occurrence.id);
    const plan=coachV2Perspectives(result,occurrence);
    expect(dates(plan)).toEqual(['2026-10-21','2026-10-23']);
    expect(plan[0].session).toBe(occurrence.content);
    expect(input).toEqual(before);
  });
  it('réévalue après une activité réelle sans supprimer l’occurrence incompatible',async()=>{
    const occurrence=await stored(),input={...snapshot,occurrences:[occurrence],
      sessions:[...snapshot.sessions,{id:'actual',title:'Course réelle',sport:'RUNNING',date,durationSeconds:2400}]};
    const before=structuredClone(input),result=adaptCoachV2Readonly(input,date);
    expect(reusableActiveOccurrenceV2(input.occurrences,result,date)).toBeUndefined();
    expect(dates(coachV2Perspectives(result))).toEqual(['2026-10-21','2026-10-23']);
    expect(input).toEqual(before);
  });
  it('conserve aujourd’hui après 18 h et calcule seulement les perspectives suivantes',async()=>{
    const occurrence=await stored(),input={...snapshot,occurrences:[occurrence]};
    const result=adaptCoachV2Readonly(input,{date:'2026-10-19',minuteOfDay:1081});
    const retained=reusableActiveOccurrenceV2(input.occurrences,result,'2026-10-19');
    expect(retained?.id).toBe(occurrence.id);
    expect(dates(coachV2Perspectives(result,retained))).toEqual(['2026-10-19','2026-10-21','2026-10-23']);
  });
});

describe('ressenti dans le pipeline V2',()=>{
  const speed={...snapshot,coachTemperament:'rentre-dedans' as const,sessions:snapshot.sessions.map((session,index)=>({...session,date:['2026-09-27','2026-10-01','2026-10-05','2026-10-09','2026-10-12','2026-10-15'][index]})),configuration:{...snapshot.configuration!,goal:{model:'evolving' as const,kind:'speed' as const}}};
  it('partage le classement entre prochaine séance et perspectives',()=>{
    const plans=['pas-a-pas','evolution-active','rentre-dedans'].map(value=>{
      const input={...speed,coachTemperament:value as NonNullable<CoachV2ApplicationSnapshot['coachTemperament']>};
      return coachV2Perspectives(adaptCoachV2Readonly(input,date)).map(item=>item.session.type);
    });
    expect(plans).toEqual([
      ['easy-endurance','easy-endurance','easy-endurance'],
      ['easy-endurance','intervals','easy-endurance'],
      ['intervals','easy-endurance','easy-endurance'],
    ]);
  });
  const withFeeling={...speed,sessions:speed.sessions.map((session,index)=>index===5?{...session,feeling:{effort:'hard' as const}}:session)};
  const veryHardFeeling={...speed,sessions:speed.sessions.map((session,index)=>index===5?{...session,feeling:{effort:'very-hard' as const}}:session)};
  it('transmet very-hard aux perspectives et privilégie le facile',()=>{
    const before=structuredClone(veryHardFeeling),result=adaptCoachV2Readonly(veryHardFeeling,date);
    expect(result.activityEvidence.at(-1)).toMatchObject({date:'2026-10-15',effort:'very-hard'});
    expect(result.candidate?.type).toBe('easy-endurance');
    expect(result.candidate?.rationale.designChoices.join(' ')).toContain('ressentie');
    const plan=coachV2Perspectives(result);
    expect(plan.map(value=>value.session.type)).toEqual(['easy-endurance','easy-endurance','intervals']);
    expect('rationale' in plan[2].session&&plan[2].session.rationale.designChoices.join(' ')).not.toContain('ressentie');
    expect(veryHardFeeling).toEqual(before);
    expect(adaptCoachV2Readonly(veryHardFeeling,date)).toEqual(result);
  });
  it('conserve sans réécriture une occurrence déjà présentée et compatible',async()=>{
    const occurrence=await stored(speed),input={...withFeeling,occurrences:[occurrence]},before=structuredClone(input);
    const result=adaptCoachV2Readonly(input,date),retained=reusableActiveOccurrenceV2(input.occurrences,result,date);
    expect(retained).toBe(occurrence);expect(retained?.content.type).toBe('intervals');
    expect(coachV2Perspectives(result,retained)[0].session).toBe(occurrence.content);
    expect(input).toEqual(before);
  });
  it.each([
    {id:'cycling',sport:'CYCLING',date:'2026-10-16'},
    {id:'invalid',sport:'RUNNING',date:'2026-10-99'},
    {id:'future',sport:'RUNNING',date:'2026-10-20'},
  ])('ne laisse pas le ressenti non pertinent de $id influencer le choix',row=>{
    const session={...row,title:'Activité',durationSeconds:2400};
    const baseline=adaptCoachV2Readonly({...speed,sessions:[...speed.sessions,session]},date);
    const result=adaptCoachV2Readonly({...speed,sessions:[...speed.sessions,{...session,feeling:{effort:'very-hard'}}]},date);
    expect(result).toEqual(baseline);
  });
});
