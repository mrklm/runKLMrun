import { describe,expect,it } from 'vitest';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { PresentedSuggestion,StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { productPolicy } from './product-policy';
import { proposeSuggestions,type ProposalInput } from './proposals';
import { suggestionExpiry,suggestionId } from './suggestions';

const today='2026-10-18',DAY=86400000,origin=Date.parse(`${today}T00:00:00Z`);
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,minutes:number):RunningSession=>({id,date:date(offset),title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const stored=(session:RunningSession,linked=true):StoredSuggestion=>{const value:PresentedSuggestion={date:session.date,kind:'easy',durationSeconds:1800};
  return {...value,id:suggestionId(value),createdAt:`${session.date}T08:00:00.000Z`,updatedAt:`${session.date}T08:00:00.000Z`,
    revision:1,expiresOn:suggestionExpiry(session.date),state:'current',...(linked?{activityId:session.id}:{})};};
const configuration:EvolvingCoachValues={goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'};
const historicalProfile:CoachProfileValues={goal:{kind:'regular'},availability:{sessionsPerWeek:3,
  days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'trail'},accompanimentMode:'advisor'};
const base=(sessions:RunningSession[]):ProposalInput=>({sessions,referenceDate:today,configuration,historicalProfile,policy:productPolicy('endurance')});

describe('intégration contrôlée de la référence V2',()=>{
  it('conserve strictement V1 par défaut et avec le mode V1 explicite',()=>{
    const input=base([-6,-4,-2,0].map((offset,index)=>run(`r-${index}`,offset,40)));
    expect(proposeSuggestions(input)).toEqual(proposeSuggestions({...input,referenceMode:'v1'}));
    expect(proposeSuggestions(input).diagnostic).not.toHaveProperty('reference');
  });

  it('n’active V2 que par injection explicite et exige les suggestions persistées',()=>{
    const input=base([]);
    expect(()=>proposeSuggestions({...input,referenceMode:'v2-experimental'})).toThrow(/suggestions persistées/);
    expect(proposeSuggestions({...input,storedSuggestions:[]})).toEqual(proposeSuggestions(input));
  });

  it('expose une référence provisoire actuelle sans secours silencieux vers V1',()=>{
    const sessions=[-20,-16,-12,-8].map((offset,index)=>run(`old-${index}`,offset,40));
    const result=proposeSuggestions({...base(sessions),referenceMode:'v2-experimental',storedSuggestions:[]});
    expect(result.diagnostic?.reference).toMatchObject({mode:'v2-experimental',confidence:'provisional',freshness:'current'});
    expect(result.diagnostic?.durationBasis?.observedMedianSeconds).toBe(2400);
  });

  it('utilise une référence confirmée actuelle pour les progressions et réductions réelles',()=>{
    for(const [minutes,seconds] of [[45,2700],[35,2100]] as const) {
      const sessions=[40,40,40,40,minutes,minutes,minutes,minutes].map((value,index)=>run(`r-${minutes}-${index}`,index-7,value));
      const result=proposeSuggestions({...base(sessions),referenceMode:'v2-experimental',storedSuggestions:[]});
      expect(result.diagnostic?.reference).toMatchObject({confidence:'confirmed',freshness:'current'});
      expect(result.diagnostic?.durationBasis?.observedMedianSeconds).toBe(seconds);
    }
  });

  it('ne revient pas à V1 lorsque V2 est périmée ou indisponible',()=>{
    const stale=[-60,-55,-50,-45].map((offset,index)=>run(`stale-${index}`,offset,40));
    const expired=proposeSuggestions({...base(stale),referenceMode:'v2-experimental',storedSuggestions:[]});
    expect(expired.diagnostic?.reference).toMatchObject({confidence:'unavailable',freshness:'expired'});
    expect(expired.suggestions).toEqual([]);
    const insufficient=proposeSuggestions({...base([run('only',0,40)]),referenceMode:'v2-experimental',storedSuggestions:[]});
    expect(insufficient.diagnostic?.reference).toMatchObject({confidence:'unavailable',freshness:'insufficient'});
    expect(insufficient.suggestions).toEqual([]);
  });

  it('n’utilise pas une suggestion ignorée comme activité',()=>{
    const ignored=stored(run('absente',-1,30),false);
    const result=proposeSuggestions({...base([]),referenceMode:'v2-experimental',storedSuggestions:[ignored]});
    expect(result.diagnostic?.reference?.confidence).toBe('unavailable');expect(result.suggestions).toEqual([]);
  });

  it('évite la baisse artificielle des suggestions raccourcies associées',()=>{
    const historical=[-20,-16,-12,-8].map((offset,index)=>run(`old-${index}`,offset,40));
    const linked=[-6,-4,-2,0].map((offset,index)=>run(`linked-${index}`,offset,30)),suggestions=linked.map(session=>stored(session));
    const copy=structuredClone(suggestions);
    const result=proposeSuggestions({...base([...historical,...linked]),referenceMode:'v2-experimental',storedSuggestions:suggestions});
    expect(result.diagnostic?.reference).toMatchObject({confidence:'provisional',sourceIds:historical.map(value=>value.id)});
    expect(result.diagnostic?.durationBasis?.observedMedianSeconds).toBe(2400);
    expect(suggestions).toEqual(copy);
  });
});
