import { describe,expect,it } from 'vitest';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { PresentedSuggestion,StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { proposeExperimentalOrchestratedV2 } from './orchestration-integration-v2';
import { productPolicy } from './product-policy';
import { proposeSuggestions } from './proposals';
import { suggestionExpiry,suggestionId } from './suggestions';

const today='2026-10-18',DAY=86400000,origin=Date.parse(`${today}T00:00:00Z`);
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,minutes=40):RunningSession=>({id,date:date(offset),startTime:`${date(offset)}T08:00:00Z`,
  title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60,distanceMeters:8000});
const profile:CoachProfileValues={goal:{kind:'regular'},availability:{sessionsPerWeek:3,days:['monday','wednesday','friday'],
  minutesPerSession:60},preferences:{terrain:'trail'},accompanimentMode:'advisor'};
const config=(kind:EvolvingCoachValues['goal']['kind']='endurance'):EvolvingCoachValues=>({goal:kind==='race'
  ?{model:'evolving',kind,distanceMeters:10000,eventDate:'2026-12-01'}:{model:'evolving',kind} as EvolvingCoachValues['goal'],
  experience:'experienced',structuredPlanningPreference:'accepted'});
const sessions=()=>[-5,-4,-3,-2].map((offset,index)=>run(`run-${index}`,offset));
const stored=(value:PresentedSuggestion,state:StoredSuggestion['state']='current'):StoredSuggestion=>({ ...value,id:suggestionId(value),
  createdAt:`${value.date}T08:00:00.000Z`,updatedAt:`${value.date}T08:00:00.000Z`,revision:1,
  expiresOn:suggestionExpiry(value.date),state});
const call=(overrides:Partial<Parameters<typeof proposeExperimentalOrchestratedV2>[0]>={})=>proposeExperimentalOrchestratedV2({
  sessions:sessions(),storedSuggestions:[],referenceDate:today,proposalPolicy:productPolicy('endurance'),
  configuration:config(),historicalProfile:profile,presented:[],...overrides,
});

describe('orchestration expérimentale V2 intégrée',()=>{
  it('laisse V1 implicite et explicite strictement identiques',()=>{
    const input={sessions:sessions(),referenceDate:today,configuration:config(),historicalProfile:profile,policy:productPolicy('endurance')};
    expect(proposeSuggestions(input)).toEqual(proposeSuggestions({...input,referenceMode:'v1'}));
  });

  it('sélectionne au plus une séance avec une référence confirmée',()=>{
    const result=call();
    expect(result.catalog.reference.confidence).toBe('confirmed');
    expect(result.selection?.session).toBe(result.catalog.sessions[0]);
    expect(result.reason).toBe('selected');
  });

  it('conserve une référence provisoire prudente et refuse une référence indisponible',()=>{
    const provisional=call({sessions:[-20,-16,-12,-8].map((offset,index)=>run(`old-${index}`,offset)),configuration:config('speed'),
      proposalPolicy:productPolicy('speed')});
    expect(provisional.catalog.reference.confidence).toBe('provisional');
    expect(provisional.selection?.session.type).toBe('easy-endurance');
    const unavailable=call({sessions:[run('only',-2)]});
    expect(unavailable.catalog.reference.confidence).toBe('unavailable');
    expect(unavailable).toMatchObject({selection:null,reason:'catalog-unavailable'});
  });

  it('ne transforme pas une consultation répétée en présentation',()=>{
    const first=call(),second=call();
    expect(second.selection?.fingerprint).toBe(first.selection?.fingerprint);
    expect(second.reason).toBe('selected');
    const presented=call({presented:[{date:today,type:first.selection!.session.type}]});
    expect(presented.selection).toEqual(first.selection);
    expect(presented.reason).toBe('selected');
  });

  it('distingue une activité réelle récente d’une suggestion ignorée',()=>{
    expect(call({sessions:[...sessions(),run('recent',-1)]})).toMatchObject({selection:null,reason:'recent-activity'});
    const ignored=stored({date:date(-1),kind:'easy',durationSeconds:1800});
    const result=call({storedSuggestions:[ignored]});
    expect(result.reason).toBe('selected');
  });

  it('n’invente aucun type et utilise seulement les types documentés explicitement',()=>{
    const old=run('old-intervals',-20),activities=[old,...sessions()];
    const unknown=call({sessions:activities,configuration:config('speed'),proposalPolicy:productPolicy('speed')});
    expect(unknown.catalog.adaptedInput?.observedSessionTypes).toEqual([]);
    const documented=call({sessions:activities,configuration:config('speed'),proposalPolicy:productPolicy('speed'),
      documentedActivityTypes:{[old.id]:'intervals'}});
    expect(documented.catalog.adaptedInput?.observedSessionTypes).toEqual(['intervals']);
    expect(documented.catalog.sessions.some(value=>value.type==='intervals')).toBe(true);
    expect(documented.selection?.session.type).toBe('easy-endurance'); // Défaut Pas à Pas, sans retirer le candidat admissible.
  });

  it('introduit un fractionné avec six activités réelles réparties sur 28 jours',()=>{
    const regular=[-26,-21,-16,-11,-6,-3].map((offset,index)=>run(`regular-${index}`,offset));
    const result=call({sessions:regular,configuration:config('speed'),proposalPolicy:productPolicy('speed')});
    expect(result.catalog.adaptedInput?.intervalIntroduction).toMatchObject({activityCount:6,eligible:true});
    expect(result.catalog.sessions.map(value=>value.type)).toContain('intervals');
  });

  it('ne débloque pas le fractionné pour une pratique groupée ou sous le seuil',()=>{
    const grouped=[-8,-7,-6,-5,-4,-3].map((offset,index)=>run(`grouped-${index}`,offset));
    const result=call({sessions:grouped,configuration:config('speed'),proposalPolicy:productPolicy('speed')});
    expect(result.catalog.adaptedInput?.intervalIntroduction?.eligible).toBe(false);
    expect(result.catalog.sessions.map(value=>value.type)).toEqual(['easy-endurance']);
  });

  it('ne modifie ni les candidats ni les suggestions persistées',()=>{
    const suggestion=stored({date:date(-5),kind:'easy',durationSeconds:1800}),copy=structuredClone(suggestion);
    const result=call({storedSuggestions:[suggestion]});
    expect(suggestion).toEqual(copy);
    expect(result.selection?.session).toBe(result.catalog.sessions.find(value=>value.type===result.selection?.session.type));
  });

  it('respecte les dates civiles aux limites de journée et refuse les dates impossibles',()=>{
    const boundary={...run('boundary',-1),startTime:`${date(-1)}T23:59:59-02:00`};
    expect(call({sessions:[...sessions(),boundary]})).toMatchObject({selection:null,reason:'recent-activity'});
    expect(()=>call({referenceDate:'2026-02-30'})).toThrow();
  });
});
