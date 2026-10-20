import { describe,expect,it } from 'vitest';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { PresentedSuggestion,StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { proposeExperimentalCatalogV2 } from './catalog-integration-v2';
import { productPolicy } from './product-policy';
import { proposeSuggestions } from './proposals';
import { selectPrototypeSessions,sessionStructureDurationSeconds,validatePrototypeSession } from './simulation/session-strategies-v2';
import { suggestionExpiry,suggestionId } from './suggestions';

const today='2026-10-18',DAY=86400000,origin=Date.parse(`${today}T00:00:00Z`);
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,minutes:number,distanceMeters?:number):RunningSession=>({id,date:date(offset),title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60,...(distanceMeters?{distanceMeters}:{})});
const stored=(session:RunningSession):StoredSuggestion=>{const value:PresentedSuggestion={date:session.date,kind:'easy',durationSeconds:1800};
  return {...value,id:suggestionId(value),createdAt:`${session.date}T08:00:00.000Z`,updatedAt:`${session.date}T08:00:00.000Z`,
    revision:1,expiresOn:suggestionExpiry(session.date),state:'current',activityId:session.id};};
const profile:CoachProfileValues={goal:{kind:'regular'},availability:{sessionsPerWeek:3,
  days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'trail'},accompanimentMode:'advisor'};
const config=(kind:EvolvingCoachValues['goal']['kind']='endurance'):EvolvingCoachValues=>({goal:kind==='distance'
  ?{model:'evolving',kind,distanceMeters:10000}:kind==='race'?{model:'evolving',kind,distanceMeters:10000,eventDate:'2026-12-01'}
  :{model:'evolving',kind},experience:'experienced',structuredPlanningPreference:'accepted'});
const call=(sessions:RunningSession[],configuration:EvolvingCoachValues=config(),storedSuggestions:StoredSuggestion[]=[])=>
  proposeExperimentalCatalogV2({sessions,storedSuggestions,referenceDate:today,proposalPolicy:productPolicy(configuration.goal.kind),configuration,historicalProfile:profile});
const confirmed=()=>[40,40,40,40].map((minutes,index)=>run(`recent-${index}`,index-3,minutes,8000+index*100));

describe('raccordement expérimental du catalogue V2',()=>{
  it('laisse les suggestions V1 implicites et explicites strictement identiques',()=>{
    const sessions=confirmed(),input={sessions,referenceDate:today,configuration:config(),historicalProfile:profile,policy:productPolicy('endurance')};
    expect(proposeSuggestions(input)).toEqual(proposeSuggestions({...input,referenceMode:'v1'}));
  });

  it('retourne une sortie V2 séparée avec une référence confirmée',()=>{
    const result=call(confirmed());
    expect(result.mode).toBe('v2-experimental');expect(result.reference.confidence).toBe('confirmed');
    expect(result.sessions[0]).toMatchObject({type:'easy-endurance',intensity:'easy',terrain:'flat',optional:true});
    expect(result.sessions[0]).not.toHaveProperty('id');
  });

  it('limite une référence provisoire à une variante facile non structurée',()=>{
    const sessions=[-20,-16,-12,-8].map((offset,index)=>run(`old-${index}`,offset,40));
    const result=call(sessions,config('speed'));
    expect(result.reference.confidence).toBe('provisional');
    expect(result.sessions).toHaveLength(1);expect(result.sessions[0].type).toBe('easy-endurance');
    expect(result.sessions[0].structure).toBeUndefined();
  });

  it('ne revient pas à V1 si V2 est indisponible',()=>{
    const result=call([run('only',0,40)]);
    expect(result.reference.confidence).toBe('unavailable');expect(result.sessions).toEqual([]);
    expect(result.reasons.join(' ')).toMatch(/aucun retour vers V1/i);
  });

  it('autorise seulement l’amorçage prudent de débuter sans référence',()=>{
    const begin=call([],config('begin'));
    expect(begin.reference.confidence).toBe('unavailable');
    expect(begin.sessions).toHaveLength(1);expect(begin.sessions[0]).toMatchObject({type:'easy-endurance',intensity:'easy'});
    expect(call([],config('endurance')).sessions).toEqual([]);
  });

  it('distingue les objectifs sans inventer de pratique structurée',()=>{
    const begin=call(confirmed(),config('begin')),resume=call(confirmed(),config('return'));
    expect(begin.sessions[0].type).toBe('easy-endurance');expect(resume.sessions[0].type).toBe('recovery');
    for(const result of [begin,resume,call(confirmed(),config('speed')),call(confirmed(),config('race'))])
      expect(result.adaptedInput?.observedSessionTypes).toEqual([]);
  });

  it('conserve les données manquantes et les déclarations mesurables sans les inventer',()=>{
    const unavailable=proposeExperimentalCatalogV2({sessions:confirmed(),storedSuggestions:[],referenceDate:today,
      proposalPolicy:productPolicy('endurance'),configuration:config(),historicalProfile:{...profile,availability:{days:['monday']}}});
    expect(unavailable.sessions).toEqual([]);expect(unavailable.reasons.join(' ')).toMatch(/Disponibilité/);
    const distance=call(confirmed(),config('distance'));
    expect(distance.adaptedInput).toMatchObject({targetDistanceMeters:10000,documentedDistanceMeters:8300});
    expect(distance.adaptedInput?.preferredTerrain).toBeUndefined();
  });

  it('préserve les blocs exacts du catalogue lorsque des preuves explicites lui sont fournies',()=>{
    const sessions=selectPrototypeSessions({goal:'speed',habitualReferenceSeconds:2700,evidence:'documented',experience:'experienced',
      availabilitySeconds:3600,observedSessionTypes:['intervals']});
    const structured=sessions.find(value=>value.type==='intervals')!;validatePrototypeSession(structured);
    expect(sessionStructureDurationSeconds(structured.structure!)).toBe(structured.totalDurationSeconds);
  });

  it('ne modifie aucune suggestion persistée',()=>{
    const activities=confirmed(),suggestions=activities.map(stored),copy=structuredClone(suggestions);
    call(activities,config(),suggestions);expect(suggestions).toEqual(copy);
  });

  it('conseille seulement un relief vallonné documenté, sans créer de côtes ni préférence',()=>{
    const activities=confirmed().map((session,index)=>index===0?{...session,ascentMeters:120}:session);
    const result=call(activities);
    expect(result.adaptedInput?.observedTerrain).toBe('rolling');
    expect(result.sessions[0]).toMatchObject({type:'easy-endurance',terrain:'rolling',intensity:'easy'});
    expect(result.sessions.some(value=>value.type==='hills')).toBe(false);
    expect(result.sessions[0].rationale.observedFacts.join(' ')).toContain('Relief positif documenté');
    expect(result.sessions[0].rationale.runnerDeclarations).toEqual([]);
  });

  it('écarte le dénivelé absent, incohérent ou TCX partiel',()=>{
    const base=confirmed();
    for(const session of [
      {...base[0],ascentMeters:undefined},
      {...base[0],ascentMeters:120,ascentEstimate:{method:'hysteresis-3m-v1' as const,quality:'partial' as const,meters:120}},
      {...base[0],ascentMeters:120,ascentEstimate:{method:'hysteresis-3m-v1' as const,quality:'complete' as const,meters:121}},
    ]) expect(call([session,...base.slice(1)]).sessions[0].terrain).toBe('flat');
  });

  it('ne transforme pas la surface déclarée en préférence de relief',()=>{
    const activities=confirmed().map((session,index)=>index===0?{...session,ascentMeters:120}:session);
    const result=call(activities);
    expect(profile.preferences.terrain).toBe('trail');
    expect(result.sessions[0].terrain).toBe('rolling');
    expect(result.reasons.join(' ')).toContain('Surface déclarée « trail » conservée comme préférence.');
  });
});
