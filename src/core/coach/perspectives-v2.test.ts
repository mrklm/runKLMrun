import { describe,expect,it } from 'vitest';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { compareCoachVersionsReadonly } from './comparison-v1-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { civilDate,ianaTimeZone,instantIso,observePresentationV2 } from './persistence-foundations-v2';

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
async function stored(input=snapshot){
  const result=adaptCoachV2Readonly(input,date);
  return (await observePresentationV2({selection:selectedApplicationSuggestionV2(result,1),existing:[],createId:()=> 'retained',
    moment:{presentedOn:civilDate(date),presentedAt:instantIso(date+'T08:00:00.000Z'),timeZone:ianaTimeZone('Europe/Paris'),
      utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',
      referenceSourceIds:input.sessions.map(value=>value.id),limitationCodes:[]}})).occurrence;
}

describe('perspectives V2 sur sept jours, sans activité fictive',()=>{
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
    const sessions=snapshot.sessions.map(session=>({...session,durationSeconds:2100}));
    const input={...snapshot,sessions,coachTemperament:'evolution-active' as const,occurrences:[{...occurrence,
      provenance:{...occurrence.provenance,referenceConfidence:'confirmed' as const}}],
      documentedActivityTypes:Object.fromEntries(sessions.map(session=>[session.id,'easy-endurance' as const]))};
    const before=structuredClone(input),result=adaptCoachV2Readonly(input,date),plan=coachV2Perspectives(result);
    expect(plan.map(value=>value.session.totalDurationSeconds)).toEqual([2400,2100,2100]);
    expect(plan.filter(value=>value.session.totalDurationSeconds>2100)).toHaveLength(1);
    expect(coachV2Perspectives(adaptCoachV2Readonly(input,date))).toEqual(plan);
    expect(compareCoachVersionsReadonly(input,date).v1).toEqual(compareCoachVersionsReadonly({...input,coachTemperament:'pas-a-pas'},date).v1);
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
    const comparison=compareCoachVersionsReadonly(input,date);
    expect(comparison.v2.suggestions.map(value=>value.date)).toEqual(dates(plan));
    expect(comparison.v2.suggestions[0].durationSeconds).toBe(occurrence.content.totalDurationSeconds);
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
  it('partage le classement entre prochaine séance et perspectives, sans effet V1',()=>{
    const plans=['pas-a-pas','evolution-active','rentre-dedans'].map(value=>{
      const input={...speed,coachTemperament:value as NonNullable<CoachV2ApplicationSnapshot['coachTemperament']>};
      expect(compareCoachVersionsReadonly(input,date).v1).toEqual(compareCoachVersionsReadonly(speed,date).v1);
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
  it('transmet very-hard aux perspectives, privilégie le facile et laisse V1 inchangé',()=>{
    const before=structuredClone(veryHardFeeling),result=adaptCoachV2Readonly(veryHardFeeling,date);
    expect(result.activityEvidence.at(-1)).toMatchObject({date:'2026-10-15',effort:'very-hard'});
    expect(result.candidate?.type).toBe('easy-endurance');
    expect(result.candidate?.rationale.designChoices.join(' ')).toContain('ressentie');
    const plan=coachV2Perspectives(result);
    expect(plan.map(value=>value.session.type)).toEqual(['easy-endurance','easy-endurance','intervals']);
    expect('rationale' in plan[2].session&&plan[2].session.rationale.designChoices.join(' ')).not.toContain('ressentie');
    expect(compareCoachVersionsReadonly(veryHardFeeling,date).v1).toEqual(compareCoachVersionsReadonly(speed,date).v1);
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
