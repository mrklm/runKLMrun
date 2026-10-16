import { expect, it } from 'vitest';
import { coachExplanations, formatCoachDuration, formatCoachDurationText, originalPlanningWarnings } from './coach-planning-display';
import { proposeNextSession } from '../core/coach/proposals';
import { productPolicy } from '../core/coach/product-policy';
import type { CoachProfile } from '../types/coach-profile';
import type { RunningSession } from '../types/session';
const profile: CoachProfile = {id:'local',revision:1,createdAt:'2026-10-12',updatedAt:'2026-10-12',goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:18},preferences:{terrain:'trail'}};
const sessions: RunningSession[]=['2026-10-04','2026-10-06','2026-10-08','2026-10-10','2026-10-12'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:3600}));
function proposal(rows=sessions,p=profile){return proposeNextSession({configuration:{goal:{model:'evolving',kind:'return'},structuredPlanningPreference:'accepted'},historicalProfile:p,sessions:rows,referenceDate:'2026-10-12',policy:productPolicy('return')});}
it.each([[900,'15 min'],[1050,'17 min 30 s'],[3600,'1 h'],[4500,'1 h 15 min'],[5430,'1 h 30 min 30 s'],[7200,'2 h'],[1050.5,'17 min 30,5 s'],[3600.125,'1 h 0,125 s'],[0,'0 s'],[NaN,'—'],[-1,'—']] as const)('formate %s sans changer la précision', (value,label)=>expect(formatCoachDuration(value)).toBe(label));
it('convertit seulement les durées du texte existant',()=>{const source='Maximum 1050 s, repère 3600 s.';expect(formatCoachDurationText(source)).toBe('Maximum 17 min 30 s, repère 1 h.');expect(source).toBe('Maximum 1050 s, repère 3600 s.');});
it('quatre explications brèves fondées sur le rythme, la durée et la préférence réels',()=>{
 const p=proposal(),before=structuredClone(p),blocks=coachExplanations(p,p.suggestions[0],profile);
 expect(blocks.map(b=>b.title)).toEqual(['Votre rythme','La durée','L’intensité','Le terrain']);
 expect(blocks[0].text).toContain('2 jours');expect(blocks[1].text).toContain('60 minutes');expect(blocks[1].text).toContain('18 min');expect(blocks[1].text).toContain('15 min');expect(blocks[3].text).toContain('préférence pour les chemins');
 for(const b of blocks){expect(b.text.length).toBeLessThan(330);expect(b.text).not.toMatch(/\b\d+ s\b|recentCycles|fenêtre|Effectuez cette sortie|C’est une proposition/);expect(b.text.split('.').filter(s=>s.trim()).length).toBeLessThanOrEqual(2);}
 expect(p).toEqual(before);
});
it('absence de références : aucune habitude inventée',()=>{const p=proposal([],{...profile,preferences:{}}),blocks=coachExplanations(p,p.suggestions[0],profile);expect(blocks[0].text).toContain('pas suffisamment documenté');expect(blocks[1].text).toContain('Sans durée récente');expect(blocks[3].text).toContain('Aucune surface');});
it('distingue une surface observée et les durées partielles',()=>{const p=proposal(sessions.map((s,i)=>({...s,sport:'TRAIL_RUNNING',durationSeconds:i?3600:NaN})),{...profile,preferences:{}});const blocks=coachExplanations(p,p.suggestions[0],profile);expect(blocks[1].text).toContain('dont la durée est connue');expect(blocks[3].text).toContain('séances récentes renseignées');expect(blocks[3].text).not.toContain('préférence');});
it('préserve les alertes importantes sans exposer les diagnostics internes',()=>{const source='Paramètre 900 s\nÉchéance déclarée : faisabilité non établie.\nC’est une proposition';expect(originalPlanningWarnings(source)).toEqual(['Échéance déclarée : faisabilité non établie.']);});

it('traduit le seuil technique uniquement à l’affichage',()=>{
 const source='Après arrondi inférieur par pas de 5 minutes, durée inférieure au minimum éditorial fourni (1800 s), sans dépassement du plafond.';
 expect(formatCoachDurationText(source)).toBe('Vos sorties récentes ou vos disponibilités ne permettent pas de proposer une séance d’au moins 30 min.');
 expect(source).toContain('minimum éditorial');
});
