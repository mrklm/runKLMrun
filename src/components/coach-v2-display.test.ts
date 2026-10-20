import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from '../core/coach/application-adapter-v2';
import { compareCoachVersionsReadonly } from '../core/coach/comparison-v1-v2';
import type { PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import { ComparisonSuggestions } from './CoachV2Comparison';
import { coachComparisonDisplay,coachExplanationLines,coachValueLabel,coachV2Explanation,storedCoachV2Explanation } from './coach-v2-display';

const date='2026-10-18';
function snapshot():CoachV2ApplicationSnapshot {
 return {sessions:['2026-10-10','2026-10-11','2026-10-12','2026-10-13'].map((date,i)=>({id:String(i),date,title:'Course',sport:'RUNNING',durationSeconds:2192})),
  occurrences:[],configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'},
  profile:{goal:{},availability:{sessionsPerWeek:3,days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'trail'}}};
}
it.each([['easy','Facile'],['easy-endurance','Endurance facile'],['flat','Plat'],['selected','Sélectionnée'],
 ['controlled-hard','Effort contrôlé'],['long-run','Sortie longue'],['no-available-date','Aucun jour disponible'],['discovery','Sortie de découverte']])('traduit %s à l’affichage', (value,label)=>expect(coachValueLabel(value)).toBe(label));
it('préserve les formulations inconnues et déduplique les justifications sans les inventer',()=>{
 expect(coachValueLabel('Allure confortable')).toBe('Allure confortable');
 expect(coachExplanationLines(['Référence fournie : 2192 s.','Référence fournie : 2192 s.','Surface déclarée « trail » non convertie en relief qualitatif.']))
  .toEqual(['Référence fournie : 36 min 32 s.','Surface déclarée « Chemins » non convertie en relief qualitatif.']);
});
it('explique la date admissible, la référence réellement utilisée et le terrain sans déduire le relief de la surface',()=>{
 const result=adaptCoachV2Readonly(snapshot(),date),before=structuredClone(result),display=coachV2Explanation(result);
 expect(result.selectedDate).toBe('2026-10-19');
 expect(display.reasons.join(' ')).toContain('19/10/2026');
 expect(display.reasons).toContain('Durée de référence utilisée : 36 min 32 s.');
 expect(display.reasons).toContain('Temps disponible ce jour : 1 h maximum.');
 expect(display.reasons).toContain('Terrain plat retenu prudemment faute de préférence ou de relief documenté.');
 expect(display.reasons.join(' ')).toContain('sans progression ni structure exigeante');
 expect(display.reasons.join(' ')).not.toMatch(/Terrain préféré|confirmée|fractionné documenté/i);
 expect(display.limitations).toContain('La référence de durée reste provisoire.');
 expect(display.limitations).toEqual(expect.arrayContaining(result.uncertainties));
 expect(result).toEqual(before);
});
it('ne crée ni référence mesurée ni justification de terrain absente pour un débutant',()=>{
 const source=snapshot();source.sessions=[];source.configuration!.goal={model:'evolving',kind:'begin'};source.configurationCreatedOn='2026-10-17';
 const result=adaptCoachV2Readonly({...source,coachTemperament:'rentre-dedans'},date),display=coachV2Explanation(result);
 expect(result.candidate).not.toBeNull();
 expect(display.reasons.join(' ')).not.toMatch(/Durée de référence utilisée|Terrain plat retenu|confirmée/);
 expect(display.reasons).toContain('Amorçage facile sans séance exigeante.');
 expect(display.limitations).toContain('Capacité actuelle non établie.');
});
it('conserve les motifs et incertitudes du fractionné sans lui attribuer les raisons de la séance facile',()=>{
 const source=snapshot();source.configuration!.goal={model:'evolving',kind:'speed'};
 source.sessions=['2026-10-01','2026-10-04','2026-10-07','2026-10-10','2026-10-13','2026-10-16']
  .map((date,i)=>({id:String(i),date,title:'Course',sport:'RUNNING',durationSeconds:3600}));
 const result=adaptCoachV2Readonly({...source,coachTemperament:'rentre-dedans'},date),display=coachV2Explanation(result);
 expect(result.candidate?.type).toBe('intervals');
 expect(display.reasons).toEqual(expect.arrayContaining(result.candidate!.rationale.designChoices));
 expect(display.limitations).toEqual(expect.arrayContaining(result.candidate!.rationale.uncertainties));
 expect(display.reasons.join(' ')).not.toMatch(/sans structure exigeante|Fractionné documenté/);
});
it('ne justifie pas de date ou de séance quand la sélection est absente',()=>{
 const source=snapshot();source.profile!.availability={};const result=adaptCoachV2Readonly(source,date);
 expect(result.candidate).toBeNull();
 expect(coachV2Explanation(result).reasons.join(' ')).not.toMatch(/premier jour disponible|Durée de référence utilisée/);
 expect(coachV2Explanation(result).reasons).toEqual(expect.arrayContaining(result.catalog.reasons));
});
it('explique seulement la progression réellement retenue, le maintien et la récupération prouvée',()=>{
 const base=adaptCoachV2Readonly(snapshot(),date),candidate={...base.candidate!,durationSeconds:2400,totalDurationSeconds:2400,changedDimensions:['duration'] as const};
 const progressive={...base,reference:{...base.reference,confidence:'confirmed' as const,referenceSeconds:2100},candidate,
   catalog:{...base.catalog,adaptedInput:{...base.catalog.adaptedInput!,habitualReferenceSeconds:2100,progressionState:'progression-possible' as const}}};
 expect(coachV2Explanation(progressive).reasons.join(' ')).toContain('augmentée de 5 min');
 const maintained={...progressive,candidate:{...candidate,durationSeconds:2100,totalDurationSeconds:2100,changedDimensions:[]},
   catalog:{...progressive.catalog,adaptedInput:{...progressive.catalog.adaptedInput!,progressionState:'maintien' as const}}};
 expect(coachV2Explanation(maintained).reasons.join(' ')).toContain('durée habituelle est conservée');
 expect(coachV2Explanation({...maintained,catalog:{...maintained.catalog,adaptedInput:{...maintained.catalog.adaptedInput!,progressionState:'recuperation' as const,
   intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:14,eligible:true}}}}).reasons.join(' ')).toContain('ressentie comme très difficile');
 expect(coachV2Explanation({...progressive,candidate:{...candidate,durationSeconds:2100,totalDurationSeconds:2100}}).reasons.join(' ')).not.toContain('augmentée de');
});
it('présente les variations et les perspectives sans les confondre avec du fractionné ou une activité',()=>{
 const base=adaptCoachV2Readonly(snapshot(),date),variation={...base.candidate!,type:'endurance-variations' as const};
 expect(coachV2Explanation({...base,candidate:variation}).reasons.join(' ')).toContain('allure modulée, sans fractionné rapide');
});
it('ne remplace pas les explications historiques manquantes par un nouveau calcul',()=>{
 const occurrence={opportunity:{suggestedFor:'2026-10-19',availability:{maximumSeconds:1800}},
  provenance:{referenceConfidence:'provisional',referenceSourceIds:['a'],limitationCodes:[]}} as unknown as PersistableOccurrenceV2;
 const before=structuredClone(occurrence),display=storedCoachV2Explanation(occurrence);
 expect(display.reasons).toEqual(['Date retenue lors de la proposition : 19/10/2026.','Temps disponible enregistré pour ce jour : 30 min maximum.']);
 expect(display.limitations.join(' ')).toContain('ne sont pas conservées');
 expect(display.limitations.join(' ')).toContain('provisoire');
 expect(occurrence).toEqual(before);
});
it('préserve toutes les décisions comparées et ne touche pas au stockage',()=>{
 const source=snapshot(),before=structuredClone(source),open=vi.spyOn(indexedDB,'open');
 const original=compareCoachVersionsReadonly(source,date),display=coachComparisonDisplay(source,date);
 expect(display.v1).toEqual(original.v1);
 expect(display.v2.status).toBe(original.v2.status);
 expect(display.v2.suggestions.map(({reasons,limitations,...decision})=>decision))
  .toEqual(original.v2.suggestions.map(({reasons,limitations,...decision})=>decision));
 expect(source).toEqual(before);expect(open).not.toHaveBeenCalled();open.mockRestore();
 const html=renderToStaticMarkup(createElement(ComparisonSuggestions,{title:'Coach V2',values:display.v2.suggestions,...display.v2}));
 expect(html).toContain('Sélectionnée');expect(html).toContain('Endurance facile');expect(html).toContain('Facile · Plat');
 expect(html).toContain('Pourquoi ?');expect(html).toContain('Limites');expect(html).toContain('36 min 32 s');
 expect(html).not.toMatch(/2192 s|easy-endurance|selected|<button/);
});
