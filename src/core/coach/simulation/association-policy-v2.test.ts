import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { StoredSuggestion } from '../../../types/coach-suggestion';
import type { RunningSession } from '../../../types/session';
import { habitualReferenceV2 } from './habitual-reference-v2';
import { observationsForAssociationPolicy, type AssociatedContributionPolicy } from './association-policy-v2';

type Scenario='all'|'partial'|'progression'|'reduction'|'short-feedback'|'alternating'|'ambiguous'|'late';
const policies:AssociatedContributionPolicy[]=['exclude','bounded','complete'];
const scenarios:Scenario[]=['all','partial','progression','reduction','short-feedback','alternating','ambiguous','late'];
const start=Date.parse('2026-01-05T00:00:00Z');
const date=(offset:number)=>new Date(start+offset*86400000).toISOString().slice(0,10);
const run=(id:string,day:number,minutes:number):RunningSession=>({id,date:date(day),title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const suggestion=(id:string,session:RunningSession):StoredSuggestion=>({id,date:session.date,kind:'easy',durationSeconds:1800,
  createdAt:`${session.date}T08:00:00.000Z`,updatedAt:`${session.date}T08:00:00.000Z`,revision:1,
  expiresOn:'2027-01-01',state:'current',activityId:session.id});

function fixture(scenario:Scenario) {
  const sessions:RunningSession[]=[-28,-21,-14,-7].map((day,index)=>run(`seed-${index}`,day,40));
  const suggestions:StoredSuggestion[]=[],recordedOn:Record<string,string>={};
  for(let week=0;week<12;week++) {
    const day=week*7+2;
    if(scenario==='all') {
      const session=run(`linked-${week}`,day,40);sessions.push(session);suggestions.push(suggestion(`s-${week}`,session));
    } else if(scenario==='partial') {
      const session=run(`${week%2?'independent':'linked'}-${week}`,day,week%2?40:35);sessions.push(session);
      if(week%2===0) suggestions.push(suggestion(`s-${week}`,session));
    } else if(scenario==='progression'||scenario==='reduction') {
      const minutes=scenario==='progression'?45:30;
      const independent=run(`independent-${week}`,day,minutes),linked=run(`linked-${week}`,day+3,minutes);
      sessions.push(independent,linked);suggestions.push(suggestion(`s-${week}`,linked));
    } else if(scenario==='short-feedback') {
      const minutes=week<4?30:week<8?25:20,session=run(`feedback-${week}`,day,minutes);
      sessions.push(session);suggestions.push(suggestion(`s-${week}`,session));
    } else if(scenario==='alternating') {
      sessions.push(run(`independent-${week}`,day,week%2?50:30));
    } else if(scenario==='ambiguous') {
      const session=run(`ambiguous-${week}`,day,50);sessions.push(session);
      suggestions.push(suggestion(`a-${week}`,session),{...suggestion(`b-${week}`,session),activityId:undefined});
    } else {
      const session=run(`late-${week}`,day,45);sessions.push(session);suggestions.push(suggestion(`s-${week}`,session));
      recordedOn[session.id]=date(day+21);
    }
  }
  return {sessions,suggestions,recordedOn};
}

function compare(scenario:Scenario,policy:AssociatedContributionPolicy) {
  const data=fixture(scenario);let firstRevisionWeek:number|null=null;
  for(let week=0;week<12;week++) {
    const referenceDate=date(week*7+6),sessions=data.sessions.filter(value=>value.date<=referenceDate);
    const suggestions=data.suggestions.filter(value=>value.date<=referenceDate);
    const snapshot=habitualReferenceV2(observationsForAssociationPolicy(sessions,suggestions,policy,data.recordedOn),referenceDate);
    if(firstRevisionWeek===null&&snapshot.revisions.length) firstRevisionWeek=week+1;
  }
  const observations=observationsForAssociationPolicy(data.sessions,data.suggestions,policy,data.recordedOn);
  const snapshot=habitualReferenceV2(observations,date(83));
  return {reference:snapshot.referenceSeconds===null?null:snapshot.referenceSeconds/60,revisions:snapshot.revisions.length,
    firstRevisionWeek,
    associatedEvidence:observations.filter(value=>value.id.includes('linked-')||value.id.includes('feedback-')||value.id.includes('late-'))
      .filter(value=>value.role==='independent-unknown').length};
}

function report() {
  let text='| Scénario | A exclusion | B contribution bornée | C contribution complète |\n|---|---|---|---|\n';
  for(const scenario of scenarios) {
    const values=policies.map(policy=>compare(scenario,policy));
    const cell=(value:ReturnType<typeof compare>)=>value.reference===null?'—':`${value.reference} min (${value.revisions} rév.${value.firstRevisionWeek?`, S${value.firstRevisionWeek}`:''})`;
    text+=`| ${scenario} | ${cell(values[0])} | ${cell(values[1])} | ${cell(values[2])} |\n`;
  }
  return text;
}

describe('politiques de contribution des courses associées sur douze semaines',()=>{
  it('compare les trois politiques sur les huit mêmes scénarios',()=>{
    for(const scenario of scenarios) for(const policy of policies) expect(compare(scenario,policy)).toHaveProperty('reference');
  });
  it('ne fait pas d’une association fiable une preuve automatique avec A ou B',()=>{
    expect(compare('all','exclude').associatedEvidence).toBe(0);
    expect(compare('all','bounded').associatedEvidence).toBe(0);
    expect(compare('all','complete').associatedEvidence).toBe(12);
  });
  it('la politique bornée accompagne une progression ou réduction ancrée par des courses indépendantes',()=>{
    expect(compare('progression','bounded').reference).toBe(45);
    expect(compare('reduction','bounded').reference).toBe(30);
    expect(compare('progression','bounded').firstRevisionWeek).toBeLessThan(compare('progression','exclude').firstRevisionWeek!);
  });
  it('la contribution complète reproduit la diminution artificielle des suggestions courtes',()=>{
    expect(compare('short-feedback','exclude').reference).toBeNull();
    expect(compare('short-feedback','bounded').reference).toBeNull();
    expect(compare('short-feedback','complete').reference).toBe(20);
  });
  it('aucune politique ne force une décision sur une alternance contradictoire ou une ambiguïté',()=>{
    for(const policy of policies) {
      expect(compare('alternating',policy).reference).toBe(40);
      expect(compare('ambiguous',policy).reference).toBeNull();
    }
  });
  it('un import tardif reste associé sans date inventée et suit la politique choisie',()=>{
    expect(compare('late','exclude').reference).toBeNull();
    expect(compare('late','bounded').reference).toBeNull();
    expect(compare('late','complete').reference).toBe(45);
  });
  it('génère le tableau comparatif uniquement sur demande',()=>{
    const content=report();expect(content).toContain('short-feedback');expect(content.split('\n')).toHaveLength(11);
    if(process.env.COACH_V2_ASSOCIATION_REPORT) writeFileSync(process.env.COACH_V2_ASSOCIATION_REPORT,content);
  });
});
