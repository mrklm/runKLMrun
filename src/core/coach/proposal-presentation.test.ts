import { expect,it } from 'vitest';
import { recommendTerrain, roundProposalDuration, proposalDurationLabel, proposalCopy } from './proposal-presentation';
import type { RunningSession } from '../../types/session';
const begin={model:'evolving',kind:'begin'} as const, endurance={model:'evolving',kind:'endurance'} as const;
const row=(sport:string):RunningSession=>({id:'fictif',date:'2026-10-15',durationSeconds:1234,title:'Montagne',sport,ascentMeters:1200});
it.each([[1110,900],[1395,1200],[1720,1500],[2250,2100],[300,300],[299,0]])('arrondit %s secondes à %s sans dépassement', (value,expected)=>{
 expect(roundProposalDuration(value)).toBe(expected);expect(roundProposalDuration(value)).toBeLessThanOrEqual(value);
});
it('respecte les deux plafonds, même aux bornes des pas de cinq minutes',()=>{
 for(const maximum of [299,300,301,1110,2250,9999])for(const available of [1,299,300,899,900,901,1234,9999]){
  const result=roundProposalDuration(maximum,available);expect(result%300).toBe(0);expect(result).toBeLessThanOrEqual(Math.min(maximum,available));
 }
 expect(()=>roundProposalDuration(NaN)).toThrow();
});
it('présentation directe, sans secondes ni précautions répétées',()=>{
 expect(proposalDurationLabel(900)).toBe('15 min');expect(proposalDurationLabel(3900)).toBe('65 min');
 expect(proposalCopy(endurance)).toEqual({objective:'Entretenir votre endurance.',instruction:'Effectuez cette sortie à un rythme confortable, sans chercher à accélérer.'});
});
it('début, reprise et expérience débutante : relief doux sans imposer une surface',()=>{
 for(const goal of [begin,{model:'evolving',kind:'return'} as const])expect(recommendTerrain(goal,'experienced','discovery','trail',[])).toMatchObject({surface:'trail',relief:'flat-or-gentle'});
 expect(recommendTerrain(endurance,'beginner','endurance',undefined,[]).relief).toBe('flat-or-gentle');
 expect(recommendTerrain(endurance,'experienced','endurance',undefined,[]).label).toBe('Terrain libre');
});
it('préfère la surface déclarée, sinon seulement les sports concordants renseignés',()=>{
 expect(recommendTerrain(endurance,undefined,'easy',undefined,[row('TRAIL_RUNNING')]).surface).toBe('trail');
 expect(recommendTerrain(endurance,undefined,'easy','road',[row('TRAIL_RUNNING')]).surface).toBe('road');
 expect(recommendTerrain(endurance,undefined,'easy','treadmill',[]).surface).toBe('treadmill');
 expect(recommendTerrain(endurance,undefined,'easy',undefined,[row('TRAIL_RUNNING'),row('RUNNING')]).surface).toBe('none');
});
it('le titre, le D+ et le trail ne prouvent jamais le relief',()=>{
 for(const sport of ['RUNNING','TRAIL_RUNNING','UNKNOWN']){
  const r=recommendTerrain(endurance,undefined,'easy',undefined,[row(sport)]);
  expect(r.relief).toBe('free');expect(r.label).not.toContain('vallonné');
 }
});
