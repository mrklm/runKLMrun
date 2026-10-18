import { describe,expect,it } from 'vitest';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { PresentedSuggestion,StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { productPolicy } from './product-policy';
import { proposeSuggestions } from './proposals';
import { adaptReferenceObservations,compareHabitualReferences } from './reference-comparison-v2';
import { suggestionExpiry,suggestionId } from './suggestions';

const referenceDate='2026-10-18',DAY=86400000,reference=Date.parse(`${referenceDate}T00:00:00Z`);
const date=(offset:number)=>new Date(reference+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,minutes:number):RunningSession=>({id,date:date(offset),title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const stored=(session:RunningSession,idSuffix='',linked=true):StoredSuggestion=>{
  const value:PresentedSuggestion={date:session.date,kind:'easy',durationSeconds:1800};
  return {...value,id:suggestionId(value)+idSuffix,createdAt:`${session.date}T08:00:00.000Z`,updatedAt:`${session.date}T08:00:00.000Z`,
    revision:1,expiresOn:suggestionExpiry(session.date),state:'current',...(linked?{activityId:session.id}:{})};
};
const policy=productPolicy('endurance');
const compare=(sessions:RunningSession[],suggestions:StoredSuggestion[]=[])=>
  compareHabitualReferences({sessions,suggestions,referenceDate,policy});
const recent=(minutes:number[])=>minutes.map((value,index)=>run(`r-${index}`,index-minutes.length+1,value));

describe('comparaison en lecture seule des références V1 et B 2G',()=>{
  it('reste indisponible avec un historique vide ou trop court',()=>{
    expect(compare([])).toMatchObject({v1ReferenceSeconds:null,v2ReferenceSeconds:null,v2Available:false});
    const short=compare(recent([30,35]));
    expect(short.v2Available).toBe(false);expect(short.v2Validity).toBe('insufficient');
  });

  it('produit la même référence pour quatre activités indépendantes récentes cohérentes',()=>{
    const result=compare(recent([40,40,40,40]));
    expect(result).toMatchObject({v1ReferenceSeconds:2400,v2ReferenceSeconds:2400,v2Available:true,v2Validity:'valid-revisable'});
    expect(result.excluded).toEqual([]);
  });

  it('distingue les associations fiables et les suggestions ignorées',()=>{
    const sessions=recent([40,40,40,40]),suggestions=sessions.map(session=>stored(session));
    const linked=compare(sessions,suggestions);
    expect(linked.observations.every(value=>value.role==='suggestion-linked')).toBe(true);
    expect(linked.v2Available).toBe(false);
    const ignored=compare([], [stored(run('sans-course',-1,30),'',false)]);
    expect(ignored.observations).toEqual([]);expect(ignored.v2Available).toBe(false);
  });

  it('écarte les associations ambiguës',()=>{
    const first=run('a',-1,40),second={...run('b',-1,42),date:first.date};
    const result=compare([first,second],[stored(first,'',false)]);
    expect(result.observations).toEqual([]);
    expect(result.excluded.filter(value=>value.reason==='ambiguous-association')).toHaveLength(2);
  });

  it('détecte une progression ou une réduction durable sans utiliser les suggestions',()=>{
    const progression=compare(recent([40,40,40,40,45,45,45,45]));
    const reduction=compare(recent([40,40,40,40,35,35,35,35]));
    expect(progression.v2ReferenceSeconds).toBe(2700);
    expect(reduction.v2ReferenceSeconds).toBe(2100);
    expect(progression.observations.every(value=>value.role==='independent-unknown')).toBe(true);
  });

  it('n’invente pas l’indépendance après expiration de la preuve d’association',()=>{
    const old=[run('old-1',-60,40),run('old-2',-55,40),run('old-3',-50,40),run('old-4',-45,40)];
    const result=compare(old);
    expect(result.v2Available).toBe(false);
    expect(result.excluded.every(value=>value.reason==='association-unknown')).toBe(true);
  });

  it('écarte les données manquantes, futures ou incohérentes avec leur motif',()=>{
    const invalid={...run('invalid',-1,30),durationSeconds:0};
    const result=compare([invalid,run('future',1,30)]);
    expect(result.excluded).toEqual(expect.arrayContaining([
      {entity:'session',id:'invalid',reason:'invalid-session'},
      {entity:'session',id:'future',reason:'future-session'},
    ]));
  });

  it('ne modifie ni les entrées ni les suggestions V1',()=>{
    const sessions=recent([40,40,40,40]),copy=structuredClone(sessions);
    const configuration:EvolvingCoachValues={goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'};
    const historicalProfile:CoachProfileValues={goal:{kind:'regular'},availability:{sessionsPerWeek:3,
      days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'trail'},accompanimentMode:'advisor'};
    const input={sessions,referenceDate,configuration,historicalProfile,policy};
    const before=proposeSuggestions(input);
    compareHabitualReferences({sessions,suggestions:[],referenceDate,policy});
    const after=proposeSuggestions(input);
    expect(after).toEqual(before);expect(sessions).toEqual(copy);
  });

  it('l’adaptateur ne fabrique ni date d’import ni type de séance',()=>{
    const adapted=adaptReferenceObservations(recent([40,40,40,40]),[],referenceDate);
    expect(adapted.observations.every(value=>!('recordedOn' in value)&&!('sessionType' in value))).toBe(true);
  });
});
