import { describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { behaviours, profiles, simulate, simulateAll, present, reconcile, type Simulation } from './longitudinal';
import { validateStoredSuggestion } from '../suggestions';
import type { StoredSuggestion, PresentedSuggestion } from '../../../types/coach-suggestion';

const results=simulateAll();
const minutes=(seconds:number|null)=>seconds===null?'—':String(Math.round(seconds/60*100)/100);
function report(runs: Simulation[]) {
  let text='\n## Résultats reproductibles\n\nValeurs en minutes. S = suggestions arrivées à leur date, encore courantes après les consultations antérieures ; une même identité n’est pas recomptée chaque jour. N = nouvelles identités présentées dans la semaine (peut dépasser S). Médiane et référence sont relevées en fin de semaine. F/E = suggestions faciles/exigeantes, jamais une mesure de l’effort réalisé. Ø = jours dont le calcul ne produit aucune suggestion future. Liens = associations factuelles, pas adhésion.\n\n';
  text+='| Profil | Scénario | S total | Couru total | S1 : durées | S12 : durées | Jours Ø | Liens finaux |\n|---|---|---:|---:|---|---|---:|---:|\n';
  for(const r of runs) text+=`| ${r.profile} | ${r.behaviour} | ${r.weeks.reduce((a,w)=>a+w.durations.length,0)} | ${minutes(r.weeks.reduce((a,w)=>a+w.actualSeconds,0))} | ${r.weeks[0].durations.map(minutes).join(' / ')||'—'} | ${r.weeks[11].durations.map(minutes).join(' / ')||'—'} | ${r.weeks.reduce((a,w)=>a+w.noProposalDays,0)} | ${r.records.filter(s=>s.activityId).length} |\n`;
  for(const r of runs) {
    text+=`\n### ${r.profile} — ${r.behaviour}\n\n| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |\n|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|\n`;
    for(const w of r.weeks) text+=`| ${w.week} | ${w.durations.map(minutes).join(' / ')||'—'} | ${minutes(w.suggestedSeconds)} | ${minutes(w.actualSeconds)} | ${w.actualCount} | ${minutes(w.recentMedian)} | ${minutes(w.reference)} | ${w.easy}/${w.demanding} | ${w.newIdentities} : ${w.presentedDurations.map(minutes).join(' / ')||'—'} | ${minutes(w.presentedDurations.reduce((a,b)=>a+b,0))} | ${w.noProposalDays} | ${w.associated} |\n`;
  }
  return text;
}

describe('simulation longitudinale synthétique du moteur de production',()=>{
  it('couvre neuf profils, quatre comportements et douze semaines complètes',()=>{
    expect(results).toHaveLength(36);
    for(const r of results) { expect(r.weeks).toHaveLength(12); expect(r.trace).toHaveLength(84); }
  });
  it('reste déterministe, sans horloge ni ouverture IndexedDB, et ne modifie pas les profils',()=>{
    const p=profiles()[0],before=structuredClone(p),open=vi.spyOn(indexedDB,'open');
    vi.useFakeTimers();vi.setSystemTime(new Date('2042-07-01T00:00:00Z'));
    try { expect(simulate(p,'all')).toEqual(results[0]); expect(p).toEqual(before);expect(open).not.toHaveBeenCalled(); }
    finally { vi.useRealTimers();open.mockRestore(); }
  });
  it('respecte plafonds, pas de cinq minutes, intensité et identités de production',()=>{
    for(const r of results) {
      expect(new Set(r.records.map(s=>s.id)).size).toBe(r.records.length);
      r.records.forEach(validateStoredSuggestion);
      for(const t of r.trace) {
        expect(t.result.suggestions.length).toBeLessThanOrEqual(3);
        for(const s of t.result.suggestions) {
          expect(s.durationSeconds%300).toBe(0); expect(s.durationSeconds).toBeLessThanOrEqual(3600);
          expect(s.intensity.kind).toBe('easy');expect(s.date>t.date).toBe(true);
          expect(s.durationSeconds).toBeLessThanOrEqual(s.durationBasis.proposedMaximumSeconds);
        }
      }
    }
  });
  it('ne transforme pas une absence de réalisation en activité et conserve les apports personnels',()=>{
    for(const p of profiles()) {
      const none=results.find(r=>r.profile===p.id&&r.behaviour==='none')!;
      expect(none.sessions).toEqual(p.input.sessions);
      const personal=results.find(r=>r.profile===p.id&&r.behaviour==='personal')!;
      expect(personal.sessions.filter(s=>s.id.startsWith('personal-'))).toHaveLength(12);
    }
  });
  it('applique réellement le rapprochement prudent : durées différentes, ambiguïté et suppression',()=>{
    const members:PresentedSuggestion[]=[{date:'2026-01-06',kind:'easy',durationSeconds:1800}];
    const records:StoredSuggestion[]=[];present(records,members,'2026-01-05');present(records,members,'2026-01-05');
    expect(records).toHaveLength(1);expect(records[0].revision).toBe(1);
    const activity={id:'synthetic',title:'Test',date:'2026-01-06',durationSeconds:2520};
    reconcile(records,[activity],'2026-01-06');expect(records[0].activityId).toBe(activity.id);
    reconcile(records,[activity,{...activity,id:'second'}],'2026-01-06');expect(records[0].activityId).toBeUndefined();
    reconcile(records,[activity],'2026-01-06');reconcile(records,[],'2026-01-07');expect(records[0].activityId).toBeUndefined();
    present(records,[{...members[0],date:'2026-01-08'}],'2026-01-05');expect(records[0].state).toBe('superseded');
  });
  it('compare les objectifs avec les mêmes données plutôt que des profils confondus',()=>{
    for(const behaviour of behaviours) {
      const reference=results.find(r=>r.profile==='endurance'&&r.behaviour===behaviour)!;
      for(const goal of ['speed','distance','race']) expect(results.find(r=>r.profile===goal&&r.behaviour===behaviour)!.weeks).toEqual(reference.weeks);
    }
  });
  it('fige les trajectoires observées sans les qualifier de comportement souhaitable',()=>{
    const all=(id:string)=>results.find(r=>r.profile===id&&r.behaviour==='all')!;
    expect(all('begin').weeks.slice(0,4).map(w=>w.durations)).toEqual([[1800,1800],[900,900],[600,300],[300]]);
    expect(all('return').weeks.slice(0,3).map(w=>w.durations)).toEqual([[1200,1200],[600,600],[300,300]]);
    expect(all('regular3').weeks.flatMap(w=>w.durations)).toEqual(Array(28).fill(2100));
    expect(all('old').weeks.every(w=>w.durations.length===0)).toBe(true);
    expect(results.find(r=>r.profile==='begin'&&r.behaviour==='none')!.weeks.every(w=>w.durations.length===7)).toBe(true);
  });
  it('ne résout pas arbitrairement deux identités présentées le même jour',()=>{
    const records:StoredSuggestion[]=[];
    present(records,[{date:'2026-01-06',kind:'easy',durationSeconds:1800}],'2026-01-05');
    present(records,[{date:'2026-01-06',kind:'endurance',durationSeconds:2100}],'2026-01-05');
    reconcile(records,[{id:'run',date:'2026-01-06',title:'Synthétique',durationSeconds:2100}],'2026-01-06');
    expect(records.every(r=>r.activityId===undefined)).toBe(true);
    expect(records[0].state).toBe('superseded');
  });
  it('produit les tableaux du rapport uniquement sur demande explicite',()=>{
    const content=report(results);expect(content).toContain('### begin — all');
    if(process.env.COACH_SIMULATION_REPORT) writeFileSync(process.env.COACH_SIMULATION_REPORT,content);
  });
});
