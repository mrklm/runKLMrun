import { describe, expect, it } from 'vitest';
import type { StoredSuggestion } from '../../../types/coach-suggestion';
import type { RunningSession } from '../../../types/session';
import { habitualReferenceV2 } from './habitual-reference-v2';
import { classifySessionRoles, referenceObservationsFromSessions } from './session-role-v2';

const run=(id:string,date:string,minutes:number):RunningSession=>({id,date,title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const suggestion=(id:string,date:string,kind:StoredSuggestion['kind']='easy',activityId?:string):StoredSuggestion=>({
  id,date,kind,durationSeconds:1800,createdAt:`${date}T08:00:00.000Z`,updatedAt:`${date}T08:00:00.000Z`,
  revision:1,expiresOn:'2027-01-01',state:'current',...(activityId?{activityId}:{}),
});

describe('classification prudente des séances pour la référence V2',()=>{
  it('identifie une association fiable sans transférer le type suggéré à la course',()=>{
    const sessions=[run('run','2026-01-06',42)],suggestions=[suggestion('suggestion','2026-01-06','easy','run')];
    expect(classifySessionRoles(sessions,suggestions)).toEqual([{sessionId:'run',classification:'reliable-suggestion-match',
      timing:'unknown',suggestedKind:'easy',usableForHabitualReference:false}]);
    expect(habitualReferenceV2(referenceObservationsFromSessions(sessions,suggestions),'2026-01-06').status).toBe('insufficient');
  });

  it('utilise une série de courses indépendantes sans leur inventer un type',()=>{
    const sessions=[0,1,2,3].map(i=>run(`run-${i}`,`2026-01-${String(5+i*3).padStart(2,'0')}`,40));
    const classified=classifySessionRoles(sessions,[]);
    expect(classified.every(value=>value.classification==='independent-unknown'&&value.usableForHabitualReference)).toBe(true);
    expect(habitualReferenceV2(referenceObservationsFromSessions(sessions,[]),'2026-01-14').referenceSeconds).toBe(2400);
  });

  it('révise le repère avec des preuves indépendantes répétées malgré leur rôle sportif inconnu',()=>{
    const sessions=[0,1,2,3].map(i=>run(`seed-${i}`,`2026-01-${String(1+i*3).padStart(2,'0')}`,40));
    sessions.push(...[0,1,2,3].map(i=>run(`change-${i}`,`2026-01-${String(13+i*3).padStart(2,'0')}`,45)));
    const snapshot=habitualReferenceV2(referenceObservationsFromSessions(sessions,[]),'2026-01-22');
    expect(snapshot.status).toBe('revised');expect(snapshot.referenceSeconds).toBe(2700);
  });

  it('écarte plusieurs activités ou suggestions le même jour comme ambiguës',()=>{
    const sessions=[run('a','2026-01-06',30),run('b','2026-01-06',45)];
    const suggestions=[suggestion('s1','2026-01-06'),suggestion('s2','2026-01-06','endurance')];
    expect(classifySessionRoles(sessions,suggestions).every(value=>value.classification==='ambiguous')).toBe(true);
    expect(habitualReferenceV2(referenceObservationsFromSessions(sessions,suggestions),'2026-01-06').sourceIds).toEqual([]);
  });

  it('classe factuellement un import tardif sans changer une association fiable',()=>{
    const sessions=[run('late','2026-01-06',50)],suggestions=[suggestion('s','2026-01-06','endurance','late')];
    expect(classifySessionRoles(sessions,suggestions,{late:'2026-02-01'})[0]).toMatchObject({
      classification:'reliable-suggestion-match',timing:'late',usableForHabitualReference:false,
    });
  });

  it('accepte une pratique irrégulière cohérente tant que chaque interruption reste sous la borne',()=>{
    const sessions=['2026-01-01','2026-01-12','2026-02-03','2026-02-28'].map((date,i)=>run(`irregular-${i}`,date,45));
    const snapshot=habitualReferenceV2(referenceObservationsFromSessions(sessions,[]),'2026-02-28');
    expect(snapshot.referenceSeconds).toBe(2700);expect(snapshot.sourceIds).toHaveLength(4);
  });

  it('ne laisse pas une association incertaine réviser une référence établie',()=>{
    const seed=['2026-01-01','2026-01-04','2026-01-07','2026-01-10'].map((date,i)=>run(`seed-${i}`,date,40));
    const uncertain=['2026-01-13','2026-01-16','2026-01-19','2026-01-22'].map((date,i)=>run(`uncertain-${i}`,date,50));
    const suggestions=uncertain.flatMap((session,i)=>[suggestion(`a-${i}`,session.date),suggestion(`b-${i}`,session.date,'endurance')]);
    const snapshot=habitualReferenceV2(referenceObservationsFromSessions([...seed,...uncertain],suggestions),'2026-01-22');
    expect(snapshot.referenceSeconds).toBe(2400);expect(snapshot.revisions).toEqual([]);
  });
});
