import { coachExplanations } from './coach-planning-display';
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoachDiagnostic } from './CoachDiagnostic';
import { proposeNextSession } from '../core/coach/proposals';
import { productPolicy } from '../core/coach/product-policy';
import type { ProposalInput } from '../core/coach/proposals';
const input = (kind: 'return' | 'endurance', minutes = 60): ProposalInput => ({
 configuration:{goal:{model:'evolving',kind},structuredPlanningPreference:'accepted'},
 historicalProfile:{goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:minutes},preferences:{}},
 sessions:['2026-10-06','2026-10-08','2026-10-10','2026-10-12'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:2221})),
 referenceDate:'2026-10-12',policy:productPolicy(kind),
});
afterEach(()=>vi.unstubAllEnvs());
it('trace le coefficient prudent et les étapes exactes sans modifier les entrées',()=>{
 const source=input('return'),before=structuredClone(source),p=proposeNextSession(source),s=p.suggestions[0];
 expect(source).toEqual(before);expect(s.durationSeconds).toBe(900);
 expect(s.durationBasis.diagnostic).toEqual({coefficient:0.5,coefficientReasons:['Objectif débuter ou reprendre : durée transitoire prudente.'],durationSpread:0,gapSpread:0,afterCoefficientSeconds:1110.5,prudentCapSeconds:2700,afterCapsSeconds:1110,editorialMinimumApplied:false});
 expect(s.durationBasis.proposedMaximumSeconds).toBe(1110);
});
it('distingue le minimum éditorial du résultat après coefficient',()=>{
 const s=proposeNextSession(input('endurance',45)).suggestions[0];
 expect(s.durationBasis.diagnostic).toMatchObject({coefficient:0.8,coefficientReasons:[],afterCoefficientSeconds:2221*0.8,prudentCapSeconds:null,afterCapsSeconds:1800,editorialMinimumApplied:true});
 expect(s.durationBasis.availableMaximumSeconds).toBe(2700);expect(s.durationSeconds).toBe(1800);
});
it('découverte sans coefficient ni variabilité inventés',()=>{
 const source=input('return');source.sessions=[];const s=proposeNextSession(source).suggestions[0];
 expect(s.durationBasis.diagnostic).toMatchObject({coefficient:null,durationSpread:null,gapSpread:null,afterCoefficientSeconds:null,afterCapsSeconds:1200});
});
it('rend les valeurs et raisons exactes dans un panneau fermé, sans mutation',()=>{
 vi.stubEnv('DEV',true);const p=proposeNextSession(input('return')),before=structuredClone(p),html=renderToStaticMarkup(createElement(CoachDiagnostic,{proposal:p}));
 expect(html).toContain('Diagnostic Coach');expect(html).not.toMatch(/<details[^>]*\bopen/);
 expect(html).toContain('18 min 30,5 s');expect(html).toContain('37 min 1 s');expect(html).toContain('0,5');expect(html).toContain('Objectif débuter ou reprendre');expect(p).toEqual(before);
});
it('ne rend rien en production',()=>{vi.stubEnv('DEV',false);expect(renderToStaticMarkup(createElement(CoachDiagnostic,{proposal:proposeNextSession(input('return'))}))).toBe('');});
it('sans suggestion : affiche explicitement l’absence de calcul',()=>{vi.stubEnv('DEV',true);const source=input('return');source.configuration=null;expect(renderToStaticMarkup(createElement(CoachDiagnostic,{proposal:proposeNextSession(source)}))).toContain('Aucune proposition disponible');});

it('explique la durée en langage courant sans modifier le diagnostic',()=>{
 const p=proposeNextSession(input('endurance',45)),s=p.suggestions[0];
 const explanation=coachExplanations(p,s).find(block=>block.title==='La durée')!.text;
 expect(explanation).toBe('Vos sorties récentes durent généralement autour de 37 minutes. Le Coach vous propose 30 minutes pour cette séance.');
 expect(p.evidence.medianDurationSeconds).toBe(2221);
 expect(s.durationBasis.diagnostic?.editorialMinimumApplied).toBe(true);
 expect(explanation).not.toContain('éditorial');
 expect(explanation).not.toContain('arrondi inférieur');
});
