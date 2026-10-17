import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { observationsForAssociationPolicy } from './association-policy-v2';
import { habitualReferenceValidityV2 } from './reference-validity-v2';
import type { StoredSuggestion } from '../../../types/coach-suggestion';
import type { RunningSession } from '../../../types/session';

const start=Date.parse('2026-01-05T00:00:00Z');
const date=(offset:number)=>new Date(start+offset*86400000).toISOString().slice(0,10);
const run=(id:string,day:number,minutes:number):RunningSession=>({id,date:date(day),title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const suggestion=(id:string,session:RunningSession):StoredSuggestion=>({id,date:session.date,kind:'easy',durationSeconds:1800,
  createdAt:`${session.date}T08:00:00.000Z`,updatedAt:`${session.date}T08:00:00.000Z`,revision:1,
  expiresOn:'2027-01-01',state:'current',activityId:session.id});
const seed=()=>[-28,-21,-14,-7].map((day,index)=>run(`seed-${index}`,day,40));
const snapshot=(sessions:RunningSession[],suggestions:StoredSuggestion[],day=83)=>habitualReferenceValidityV2(
  observationsForAssociationPolicy(sessions,suggestions,'bounded'),date(day));

describe('expiration expérimentale de la référence habituelle V2',()=>{
  it('rend le repère obsolète après plus de 42 jours sans aucune course',()=>{
    expect(snapshot(seed(),[],35).validity).toBe('valid-revisable');
    const result=snapshot(seed(),[],36);
    expect(result.validity).toBe('expired-inactivity');expect(result.referenceSeconds).toBeNull();
  });

  it('des courses associées régulières maintiennent la validité sans réviser la durée',()=>{
    const sessions=seed(),suggestions:StoredSuggestion[]=[];
    for(let week=0;week<12;week++) { const session=run(`linked-${week}`,week*7+2,30);sessions.push(session);suggestions.push(suggestion(`s-${week}`,session)); }
    const result=snapshot(sessions,suggestions);
    expect(result.validity).toBe('valid-retained');expect(result.referenceSeconds).toBe(2400);
    expect(result.revisions).toEqual([]);expect(result.currentCapacityProven).toBe(false);
  });

  it('tolère une pratique associée irrégulière seulement tant que sa continuité reste sous la borne',()=>{
    const continuous=seed(),continuousSuggestions:StoredSuggestion[]=[];
    for(const [index,day] of [20,55,80].entries()) { const session=run(`linked-${index}`,day,35);continuous.push(session);continuousSuggestions.push(suggestion(`s-${index}`,session)); }
    expect(snapshot(continuous,continuousSuggestions).validity).toBe('valid-retained');
    const broken=seed(),brokenSuggestions:StoredSuggestion[]=[];
    for(const [index,day] of [50,80].entries()) { const session=run(`broken-${index}`,day,35);broken.push(session);brokenSuggestions.push(suggestion(`b-${index}`,session)); }
    expect(snapshot(broken,brokenSuggestions).validity).toBe('insufficient');
  });

  it('une reprise après interruption ne réactive pas une ancienne référence',()=>{
    const sessions=seed(),suggestions:StoredSuggestion[]=[];
    const resumed=run('resumed',70,40);sessions.push(resumed);suggestions.push(suggestion('resume',resumed));
    const result=snapshot(sessions,suggestions);
    expect(result.validity).toBe('insufficient');expect(result.referenceSeconds).toBeNull();
  });

  it('une progression indépendante réelle révise toujours la référence',()=>{
    const sessions=seed();for(let week=0;week<4;week++) sessions.push(run(`progress-${week}`,week*7+2,45));
    const result=snapshot(sessions,[],27);
    expect(result.validity).toBe('valid-revisable');expect(result.referenceSeconds).toBe(2700);
  });

  it('des suggestions raccourcies entretiennent la validité sans entraîner la dérive de C',()=>{
    const sessions=seed(),suggestions:StoredSuggestion[]=[];
    for(let week=0;week<12;week++) {
      const session=run(`short-${week}`,week*7+2,week<4?30:week<8?25:20);sessions.push(session);suggestions.push(suggestion(`s-${week}`,session));
    }
    const result=snapshot(sessions,suggestions);
    expect(result.validity).toBe('valid-retained');expect(result.referenceSeconds).toBe(2400);expect(result.revisions).toEqual([]);
  });

  it('génère le bilan avant/après uniquement sur demande',()=>{
    const content='| Scénario | B 2F | B 2G |\n|---|---|---|\n| Inactivité réelle | Expirée | Expirée |\n| Courses associées régulières | Expirée | 40 min conservée |\n| Suggestions raccourcies | Expirée | 40 min conservée, aucune révision |\n';
    expect(content).toContain('aucune révision');
    if(process.env.COACH_V2_VALIDITY_REPORT) writeFileSync(process.env.COACH_V2_VALIDITY_REPORT,content);
  });
});
