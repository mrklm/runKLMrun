import { expect,it } from 'vitest';
import { localCoachV2Reference,resolveCoachV2Reference } from './local-reference-v2';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachComparisonDisplay } from '../../components/coach-v2-display';

const snapshot=():CoachV2ApplicationSnapshot=>({
  sessions:['2026-10-10','2026-10-12','2026-10-14','2026-10-16'].map((date,index)=>
    ({id:String(index),date,title:'Course',sport:'RUNNING',durationSeconds:2100})),
  occurrences:[],configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'},
  profile:{goal:{},preferences:{},availability:{days:['sunday','monday','wednesday'],minutesPerSession:45}},
});

it.each([[17,59,'2026-10-18'],[18,0,'2026-10-19'],[18,1,'2026-10-19']] as const)
('à %i:%i locales, la date minimale est respectée', (hour,minute,expected)=>{
  const source=snapshot(),before=structuredClone(source),reference=localCoachV2Reference(new Date(2026,9,18,hour,minute));
  const result=adaptCoachV2Readonly(source,reference);
  expect(result).toMatchObject({selectedDate:expected,dailyMaximumSeconds:2700,
    candidate:{type:'easy-endurance',totalDurationSeconds:2100}});
  expect(adaptCoachV2Readonly(source,reference)).toEqual(result);expect(source).toEqual(before);
});

it('cherche le prochain jour disponible lorsque le jour courant est indisponible',()=>{
  const source=snapshot();source.profile!.availability.days=['wednesday'];
  expect(adaptCoachV2Readonly(source,{date:'2026-10-18',minuteOfDay:17*60+59}).selectedDate).toBe('2026-10-21');
});

it('ne prolonge pas la fin de la période de recherche après 18 h',()=>{
  const source=snapshot();source.profile!.availability.days=['sunday'];
  expect(adaptCoachV2Readonly(source,{date:'2026-10-18',minuteOfDay:18*60}))
    .toMatchObject({selectedDate:null,reason:'no-available-date'});
});

it.each([17*60+59,18*60])('conserve l’espacement après une activité réelle à la minute %i',minuteOfDay=>{
  const source=snapshot();source.sessions=[...source.sessions,{id:'recent',date:'2026-10-18',title:'Course',sport:'RUNNING',durationSeconds:2100}];
  expect(adaptCoachV2Readonly(source,{date:'2026-10-18',minuteOfDay}).selectedDate).toBe('2026-10-21');
});

it('applique la même heure aux décisions et explications du comparateur sans modifier V1',()=>{
  const source=snapshot(),before=structuredClone(source);
  const early=coachComparisonDisplay(source,{date:'2026-10-18',minuteOfDay:1079});
  const late=coachComparisonDisplay(source,{date:'2026-10-18',minuteOfDay:1080});
  expect(early.v2.suggestions[0].date).toBe('2026-10-18');expect(late.v2.suggestions[0].date).toBe('2026-10-19');
  expect(late.v2.suggestions[0].reasons.join(' ')).toContain('19/10/2026');
  expect(late.v1).toEqual(early.v1);
  expect(coachComparisonDisplay(source,{date:'2026-10-18',minuteOfDay:1080})).toEqual(late);
  expect(source).toEqual(before);
});

// Ces cas sont également exécutés sous des fuseaux à décalages UTC opposés.
it.each([[2026,9,18,23,59,'2026-10-18',1439],[2026,9,19,0,0,'2026-10-19',0],
  [2026,11,31,23,59,'2026-12-31',1439],[2027,0,1,0,0,'2027-01-01',0]] as const)
('capture la date et l’heure locales %i/%i/%i %i:%i', (year,month,day,hour,minute,date,minuteOfDay)=>{
  expect(localCoachV2Reference(new Date(year,month,day,hour,minute))).toEqual({date,minuteOfDay});
});

it('réautorise le nouveau jour à minuit local',()=>{
  const source=snapshot();
  expect(adaptCoachV2Readonly(source,localCoachV2Reference(new Date(2026,9,18,23,59))).selectedDate).toBe('2026-10-19');
  expect(adaptCoachV2Readonly(source,localCoachV2Reference(new Date(2026,9,19,0,0))).selectedDate).toBe('2026-10-19');
});

it('garde les appels par date seule déterministes et refuse une heure invalide',()=>{
  expect(resolveCoachV2Reference('2026-10-18')).toEqual({date:'2026-10-18',minuteOfDay:0});
  for(const minuteOfDay of [-1,1440,NaN,1080.5])expect(()=>resolveCoachV2Reference({date:'2026-10-18',minuteOfDay})).toThrow();
  expect(()=>localCoachV2Reference(new Date(NaN))).toThrow();
});
