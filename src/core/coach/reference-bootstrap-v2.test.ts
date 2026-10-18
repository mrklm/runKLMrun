import { describe,expect,it } from 'vitest';
import type { PresentedSuggestion,StoredSuggestion } from '../../types/coach-suggestion';
import type { RunningSession } from '../../types/session';
import { productPolicy } from './product-policy';
import { bootstrapHabitualReference,type ReferenceBootstrapPolicy } from './reference-bootstrap-v2';
import { suggestionExpiry,suggestionId } from './suggestions';

const referenceDate='2026-10-18',DAY=86400000,origin=Date.parse(`${referenceDate}T00:00:00Z`),policies:ReferenceBootstrapPolicy[]=['strict','provisional','hybrid'];
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,minutes:number):RunningSession=>({id,date:date(offset),title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const suggestion=(session:RunningSession):StoredSuggestion=>{const value:PresentedSuggestion={date:session.date,kind:'easy',durationSeconds:1800};
  return {...value,id:suggestionId(value),createdAt:`${session.date}T08:00:00.000Z`,updatedAt:`${session.date}T08:00:00.000Z`,
    revision:1,expiresOn:suggestionExpiry(session.date),state:'current',activityId:session.id};};
const evaluate=(sessions:RunningSession[],suggestions:StoredSuggestion[]=[])=>Object.fromEntries(policies.map(bootstrapPolicy=>[bootstrapPolicy,
  bootstrapHabitualReference({sessions,suggestions,referenceDate,proposalPolicy:productPolicy('endurance'),bootstrapPolicy})])) as Record<ReferenceBootstrapPolicy,ReturnType<typeof bootstrapHabitualReference>>;

describe('politiques expérimentales d’amorçage V2',()=>{
  it('compare A/B/C sur un historique ancien dont les associations ont expiré',()=>{
    const result=evaluate([-20,-16,-12,-8].map((offset,index)=>run(`old-${index}`,offset,40)));
    expect(result.strict.available).toBe(false);
    expect(result.provisional).toMatchObject({available:true,confidence:'provisional',referenceSeconds:2400});
    expect(result.hybrid).toMatchObject({available:true,confidence:'provisional',referenceSeconds:2400});
  });

  it('la politique provisoire seule accepte des activités uniquement associées',()=>{
    const sessions=[-6,-4,-2,0].map((offset,index)=>run(`linked-${index}`,offset,30)),suggestions=sessions.map(suggestion);
    const result=evaluate(sessions,suggestions);
    expect(result.strict.available).toBe(false);expect(result.hybrid.available).toBe(false);
    expect(result.provisional).toMatchObject({available:true,confidence:'provisional',referenceSeconds:1800,artificialDecreaseRisk:true});
  });

  it('l’hybride préfère les preuves historiques inconnues aux suggestions raccourcies',()=>{
    const old=[-20,-16,-12,-8].map((offset,index)=>run(`old-${index}`,offset,40));
    const linked=[-6,-4,-2,0].map((offset,index)=>run(`linked-${index}`,offset,30));
    const result=evaluate([...old,...linked],linked.map(suggestion));
    expect(result.provisional.referenceSeconds).toBe(2100);
    expect(result.provisional.artificialDecreaseRisk).toBe(true);
    expect(result.hybrid).toMatchObject({referenceSeconds:2400,confidence:'provisional',artificialDecreaseRisk:false});
  });

  it('reste indisponible pour un débutant avec peu de données',()=>{
    const result=evaluate([run('a',-2,20),run('b',0,25)]);
    for(const policy of policies)expect(result[policy].available).toBe(false);
  });

  it.each([[45,2700],[35,2100]] as const)('confirme une évolution réelle durable vers %i minutes', (minutes,seconds)=>{
    const sessions=[40,40,40,40,minutes,minutes,minutes,minutes].map((value,index)=>run(`r-${index}`,index-7,value));
    const result=evaluate(sessions);
    expect(result.strict).toMatchObject({confidence:'confirmed',referenceSeconds:seconds});
    expect(result.hybrid).toMatchObject({confidence:'confirmed',referenceSeconds:seconds});
    expect(result.provisional.confidence).toBe('provisional');
  });

  it('une interruption supérieure à 42 jours empêche tout amorçage',()=>{
    const result=evaluate([-60,-55,-50,-45].map((offset,index)=>run(`stale-${index}`,offset,40)));
    for(const policy of policies)expect(result[policy].available).toBe(false);
  });

  it('une reprise isolée ne réactive pas une ancienne référence',()=>{
    const sessions=[-60,-55,-50,-45].map((offset,index)=>run(`stale-${index}`,offset,40));sessions.push(run('resume',0,30));
    const result=evaluate(sessions);
    for(const policy of policies)expect(result[policy].available).toBe(false);
  });

  it('écarte les données ambiguës, invalides et trop dispersées',()=>{
    const first=run('a',-2,20),second={...run('b',-2,60),date:first.date},invalid={...run('bad',-1,30),durationSeconds:0};
    const result=evaluate([first,second,invalid],[suggestion(first)]);
    for(const policy of policies)expect(result[policy].available).toBe(false);
  });
});
