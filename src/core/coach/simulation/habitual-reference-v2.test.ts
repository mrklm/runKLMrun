import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { productPolicy } from '../product-policy';
import { proposalEvidence, proposeSuggestions, type ProposalInput } from '../proposals';
import type { RunningSession } from '../../../types/session';
import { dateAt } from './longitudinal';
import { EXPERIMENTAL_REFERENCE_PARAMETERS, habitualReferenceV2, type ReferenceObservation } from './habitual-reference-v2';

type Scenario='stable'|'progression'|'reduction';
interface Row { week:number;v1Reference:number|null;v1Suggestion:number|null;v2Reference:number|null;v2Suggestion:number|null;v2Status:string }
const scenarios:Scenario[]=['stable','progression','reduction'];
const run=(id:string,date:string,minutes:number):RunningSession=>({id,date,title:'Synthétique',sport:'RUNNING',durationSeconds:minutes*60});
const input=(sessions:RunningSession[],date:string):ProposalInput=>({sessions,referenceDate:date,policy:productPolicy('endurance'),configuration:{goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'},historicalProfile:{goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],sessionsPerWeek:2,minutesPerSession:60},preferences:{terrain:'trail'}}});
const habitualMinutes=(scenario:Scenario,week:number)=>scenario==='progression'&&week>=4?45:scenario==='reduction'&&week>=4?30:40;

function simulateComparison(scenario:Scenario):Row[] {
  const sessions:RunningSession[]=[],observations:ReferenceObservation[]=[];
  for(let i=0;i<4;i++) {
    const date=dateAt(-28+i*7),id=`seed-${i}`;
    sessions.push(run(id,date,40));observations.push({id,date,durationSeconds:2400,role:'habitual'});
  }
  const rows:Row[]=[];
  for(let week=0;week<12;week++) {
    const easyDate=dateAt(week*7+2),habitualDate=dateAt(week*7+5),referenceDate=dateAt(week*7+6);
    const easyId=`${scenario}-easy-${week}`,habitualId=`${scenario}-habitual-${week}`;
    sessions.push(run(easyId,easyDate,30),run(habitualId,habitualDate,habitualMinutes(scenario,week)));
    observations.push({id:easyId,date:easyDate,durationSeconds:1800,role:'easy-suggestion'},
      {id:habitualId,date:habitualDate,durationSeconds:habitualMinutes(scenario,week)*60,role:'habitual'});
    const v1Input=input(sessions,referenceDate),evidence=proposalEvidence(sessions,referenceDate,v1Input.policy);
    const proposal=proposeSuggestions(v1Input),v2=habitualReferenceV2(observations,referenceDate);
    rows.push({week:week+1,v1Reference:evidence.medianDurationSeconds,v1Suggestion:proposal.suggestions[0]?.durationSeconds??null,
      v2Reference:v2.referenceSeconds,v2Suggestion:v2.suggestionSeconds,v2Status:v2.status});
  }
  return rows;
}

const minutes=(value:number|null)=>value===null?'—':String(Math.round(value/60*10)/10).replace('.',',');
function report() {
  let text='\n## Phase 2C — prototype de référence habituelle V2\n\n';
  text+='Les tableaux sont générés par `habitual-reference-v2.test.ts`. Les valeurs sont en minutes. La suggestion V1 est la première suggestion du moteur de production ; la suggestion V2 est une projection limitée à la référence habituelle arrondie vers le bas. Elle ne constitue pas encore une stratégie Coach V2 complète.\n\n';
  for(const scenario of scenarios) {
    text+=`### ${scenario==='stable'?'Pratique stable':scenario==='progression'?'Progression durable':'Réduction durable'}\n\n| Semaine | Référence V1 | Suggestion V1 | Référence V2 | Suggestion V2 | État V2 |\n|---:|---:|---:|---:|---:|---|\n`;
    for(const row of simulateComparison(scenario)) text+=`| ${row.week} | ${minutes(row.v1Reference)} | ${minutes(row.v1Suggestion)} | ${minutes(row.v2Reference)} | ${minutes(row.v2Suggestion)} | ${row.v2Status} |\n`;
    text+='\n';
  }
  return text;
}

describe('prototype de référence habituelle V2',()=>{
  it('empêche les séances faciles courtes de diminuer la référence stable',()=>{
    const rows=simulateComparison('stable');
    expect(rows.every(r=>r.v2Reference===2400&&r.v2Suggestion===2400)).toBe(true);
    expect(rows.some(r=>r.v1Reference!==2400||r.v1Suggestion!==2400)).toBe(true);
  });
  it('révise la référence après quatre observations habituelles durablement plus longues',()=>{
    const rows=simulateComparison('progression');
    expect(rows[6].v2Reference).toBe(2400);expect(rows[7].v2Reference).toBe(2700);
    expect(rows.slice(7).every(r=>r.v2Suggestion===2700)).toBe(true);
  });
  it('révise aussi la référence après quatre observations durablement plus courtes',()=>{
    const rows=simulateComparison('reduction');
    expect(rows[6].v2Reference).toBe(2400);expect(rows[7].v2Reference).toBe(1800);
    expect(rows.slice(7).every(r=>r.v2Suggestion===1800)).toBe(true);
  });
  it('ignore une variation isolée, expire les anciennes preuves et valide les entrées',()=>{
    const observations:ReferenceObservation[]=[0,1,2,3].map(i=>({id:String(i),date:dateAt(-21+i*7),durationSeconds:2400,role:'habitual'}));
    observations.push({id:'short',date:dateAt(1),durationSeconds:1800,role:'habitual'});
    expect(habitualReferenceV2(observations,dateAt(2)).referenceSeconds).toBe(2400);
    expect(habitualReferenceV2(observations,dateAt(44)).status).toBe('expired');
    expect(()=>habitualReferenceV2([...observations,observations[0]],dateAt(2))).toThrow(/dupliqués/);
  });
  it('documente exactement le paramétrage expérimental',()=>{
    expect(EXPERIMENTAL_REFERENCE_PARAMETERS).toEqual({confirmationCount:4,meaningfulDifferenceSeconds:300,expiryDays:42,displayStepSeconds:300});
  });
  it('génère le rapport comparatif seulement sur demande',()=>{
    const content=report();expect(content).toContain('Pratique stable');expect(content).toContain('Réduction durable');
    if(process.env.COACH_V2_REFERENCE_REPORT) writeFileSync(process.env.COACH_V2_REFERENCE_REPORT,content);
  });
});
