import { expect, it } from 'vitest';
import { productPolicy, COACH_POLICY_VERSION } from './product-policy';
import { proposeNextSession } from './proposals';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
const profile={goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const,minutesPerSession:120},preferences:{}};
it('valeurs produit explicites et indépendantes',()=>{
 const p=productPolicy('begin');expect(COACH_POLICY_VERSION).toBe(1);
 expect(p).toMatchObject({evidenceAgeLimitDays:180,discoverySeconds:1800,duration:{minimumReferences:4,supportedFraction:0.8,cautiousFraction:0.5,cautiousMaximumSeconds:2700}});
 expect(productPolicy('return').discoverySeconds).toBe(1200);expect(productPolicy('speed').discoverySeconds).toBeUndefined();expect(productPolicy('speed').minimumSuggestionSeconds).toBe(1800);
 p.duration.minimumReferences=10;expect(productPolicy('begin').duration.minimumReferences).toBe(4);
});
it('début et reprise sans historique, consentement et plaisir exclus',()=>{
 for(const kind of ['begin','return','speed','wellbeing'] as const)for(const preference of ['accepted','declined','unexpressed'] as const){
  const configuration:EvolvingCoachValues={goal:{model:'evolving',kind},structuredPlanningPreference:preference};
  const r=proposeNextSession({configuration,historicalProfile:{...profile,availability:{...profile.availability,days:[...profile.availability.days]}},sessions:[],referenceDate:'2026-10-15',policy:productPolicy(kind)});
  expect(r.suggestions).toHaveLength(preference==='accepted' && (kind==='begin'||kind==='return')?1:0);
  if(r.suggestions.length)expect(r.suggestions[0].durationSeconds).toBe(kind==='return'?1200:1800);
 }
});
