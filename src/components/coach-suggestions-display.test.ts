import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { CoachSuggestions } from './CoachSuggestions';
import { proposeSuggestions } from '../core/coach/proposals';
import { productPolicy } from '../core/coach/product-policy';
import type { Weekday } from '../types/coach-profile';
const days:Weekday[]=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
it.each([0,1,2,3])('affiche %s cartes sans validation ni écriture au rendu',count=>{
 const spy=vi.spyOn(indexedDB,'open');
 const sessions=['2026-10-09','2026-10-11','2026-10-13','2026-10-15','2026-10-17'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:3600}));
 const available:Weekday[]=count===0?[]:count===1?['monday']:count===2?['monday','wednesday']:days;
 const proposal=proposeSuggestions({configuration:{goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'},historicalProfile:{goal:{},availability:{days:available,minutesPerSession:90},preferences:{}},sessions,referenceDate:'2026-10-17',policy:productPolicy('endurance')});
 const html=renderToStaticMarkup(createElement(CoachSuggestions,{proposal,context:{sessions}}));
 expect((html.match(/<article /g)??[]).length).toBe(count);expect(html).toContain('Suggestions du Coach');expect(html).not.toContain('<button');
 expect(html).not.toContain('Terrain libre');expect(html).not.toContain('séance manquée');expect(spy).not.toHaveBeenCalled();spy.mockRestore();
});
