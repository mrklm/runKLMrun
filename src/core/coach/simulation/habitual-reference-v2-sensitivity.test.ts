import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dateAt } from './longitudinal';
import { EXPERIMENTAL_REFERENCE_PARAMETERS, habitualReferenceV2, type HabitualReferenceParameters, type ReferenceObservation } from './habitual-reference-v2';

const frequencies=[1,2,4] as const,confirmations=[3,4,5] as const;
const days:Record<(typeof frequencies)[number],number[]>={1:[6],2:[2,6],4:[0,2,4,6]};
const observation=(id:string,date:string,minutes:number,role:ReferenceObservation['role']='habitual'):ReferenceObservation=>({id,date,durationSeconds:minutes*60,role});
const parameters=(confirmationCount:number,expiryDays=42):HabitualReferenceParameters=>({...EXPERIMENTAL_REFERENCE_PARAMETERS,confirmationCount,expiryDays});

function sensitivity(confirmationCount:number,frequency:1|2|4) {
  const observations:ReferenceObservation[]=Array.from({length:confirmationCount},(_,i)=>observation(`seed-${i}`,dateAt(-(confirmationCount-i)*7),40));
  for(let week=0;week<12;week++) {
    for(const offset of days[frequency]) observations.push(observation(`up-${week}-${offset}`,dateAt(week*7+offset),45));
    const snapshot=habitualReferenceV2(observations,dateAt(week*7+6),parameters(confirmationCount));
    if(snapshot.referenceSeconds===2700) return {confirmations:confirmationCount,frequency,sessions:snapshot.revisions[0].sourceIds.length,weeks:week+1};
  }
  throw new Error('Révision non observée dans les douze semaines.');
}

function interruption() {
  const observations:ReferenceObservation[]=Array.from({length:4},(_,i)=>observation(`seed-${i}`,dateAt(-22+i*7),40));
  const rows:{week:number;status:string;reference:number|null}[]=[];
  for(let week=0;week<8;week++) {
    const snapshot=habitualReferenceV2(observations,dateAt(week*7+6));
    rows.push({week:week+1,status:snapshot.status,reference:snapshot.referenceSeconds});
  }
  for(let week=8;week<12;week++) {
    observations.push(observation(`return-${week}`,dateAt(week*7+6),35));
    const snapshot=habitualReferenceV2(observations,dateAt(week*7+6));
    rows.push({week:week+1,status:snapshot.status,reference:snapshot.referenceSeconds});
  }
  return rows;
}

function expirySensitivity(expiryDays:number) {
  const observations:ReferenceObservation[]=Array.from({length:4},(_,i)=>observation(`expiry-seed-${i}`,dateAt(-22+i*7),40));
  for(let week=0;week<12;week++) if(habitualReferenceV2(observations,dateAt(week*7+6),parameters(4,expiryDays)).status==='expired') return week+1;
  return null;
}

function alternating() {
  const observations:ReferenceObservation[]=Array.from({length:4},(_,i)=>observation(`seed-${i}`,dateAt(-28+i*7),40));
  const references:number[]=[];
  for(let week=0;week<12;week++) {
    observations.push(observation(`easy-${week}`,dateAt(week*7+2),30,'easy-suggestion'),observation(`long-${week}`,dateAt(week*7+6),45));
    references.push(habitualReferenceV2(observations,dateAt(week*7+6)).referenceSeconds!);
  }
  return references;
}

function report() {
  let text='\n## Phase 2D — sensibilité de la référence V2\n\n';
  text+='Les résultats utilisent uniquement des données synthétiques. Les paramètres testés sont des choix expérimentaux et non des recommandations scientifiques.\n\n';
  text+='### Confirmations et fréquence\n\n| Confirmations | Courses/semaine | Séances avant révision | Semaines avant révision |\n|---:|---:|---:|---:|\n';
  for(const confirmationCount of confirmations) for(const frequency of frequencies) {
    const row=sensitivity(confirmationCount,frequency);
    text+=`| ${row.confirmations} | ${row.frequency} | ${row.sessions} | ${row.weeks} |\n`;
  }
  text+='\n### Interruption et reprise\n\n| Semaine | État | Référence (min) |\n|---:|---|---:|\n';
  for(const row of interruption()) text+=`| ${row.week} | ${row.status} | ${row.reference===null?'—':row.reference/60} |\n`;
  text+='\n### Ancienneté\n\n| Expiration expérimentale | Première semaine expirée |\n|---:|---:|\n';
  for(const expiryDays of [21,42,56,365]) text+=`| ${expiryDays} jours | ${expirySensitivity(expiryDays)??'Au-delà de S12'} |\n`;
  text+='\n### Alternance facile / longue\n\n| Semaines | Référence (min) | Révisions observées |\n|---|---:|---:|\n';
  const refs=alternating();text+=`| 1–3 | ${refs[0]/60} | 0 |\n| 4–12 | ${refs[3]/60} | 1 |\n`;
  return text;
}

describe('sensibilité du prototype de référence habituelle V2',()=>{
  it('réagit après le nombre exact de confirmations, avec un délai dépendant de la fréquence',()=>{
    for(const confirmationCount of confirmations) for(const frequency of frequencies) {
      const row=sensitivity(confirmationCount,frequency);
      expect(row.sessions).toBe(confirmationCount);expect(row.weeks).toBe(Math.ceil(confirmationCount/frequency));
    }
  });
  it('expire sans conclure à une perte de capacité puis reconstruit un nouvel épisode',()=>{
    const rows=interruption();
    expect(rows.slice(0,6).every(row=>row.status==='stable')).toBe(true);
    expect(rows[6].status).toBe('expired');expect(rows[7].status).toBe('expired');
    expect(rows.slice(8,11).every(row=>row.status==='insufficient'&&row.reference===null)).toBe(true);
    expect(rows[11]).toEqual({week:12,status:'stable',reference:2100});
  });
  it('rend visible la sensibilité à la borne temporelle sans l’interpréter comme une perte physique',()=>{
    expect([21,42,56,365].map(expirySensitivity)).toEqual([4,7,9,null]);
  });
  it('ne crée pas d’oscillation avec une alternance de séances faciles et longues',()=>{
    const refs=alternating();
    expect(refs.slice(0,3)).toEqual([2400,2400,2400]);
    expect(refs.slice(3)).toEqual(Array(9).fill(2700));
  });
  it('une alternance contradictoire de séances habituelles ne franchit jamais la confirmation',()=>{
    const observations:ReferenceObservation[]=Array.from({length:4},(_,i)=>observation(`seed-${i}`,dateAt(-28+i*7),40));
    for(let i=0;i<12;i++) observations.push(observation(`mixed-${i}`,dateAt(i*7+6),i%2?30:50));
    const snapshot=habitualReferenceV2(observations,dateAt(83));
    expect(snapshot.referenceSeconds).toBe(2400);expect(snapshot.revisions).toEqual([]);
  });
  it('génère le tableau seulement sur demande explicite',()=>{
    const content=report();expect(content).toContain('| 5 | 1 | 5 | 5 |');expect(content).toContain('Interruption et reprise');
    if(process.env.COACH_V2_SENSITIVITY_REPORT) writeFileSync(process.env.COACH_V2_SENSITIVITY_REPORT,content);
  });
});
