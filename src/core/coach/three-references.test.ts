import { expect, it } from 'vitest';
import { proposeNextSession, type ProposalInput } from './proposals';
import { productPolicy } from './product-policy';
function input(): ProposalInput {
 return {configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'},historicalProfile:{goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday']},preferences:{}},referenceDate:'2026-10-16',policy:productPolicy('endurance'),sessions:['2026-10-05','2026-10-09','2026-10-11','2026-10-12','2026-10-13'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:2193}))};
}
it('quatre puis trois références : même durée, fraîcheur et aucune mutation',()=>{
 const source=input(),before=structuredClone(source);
 for(const date of ['2026-10-15','2026-10-16']){
 const r=proposeNextSession({...source,referenceDate:date});
 expect(r.evidence.knownDurations).toBe(date.endsWith('15')?4:3);
 expect(r.evidence.medianGapDays).toBe(1.5);
 expect(r.suggestions[0].durationSeconds).toBe(1800);
 expect(r.diagnostic?.freshnessLimitDays).toBe(3);
 expect(r.diagnostic?.durationBasis?.diagnostic.coefficient).toBe(0.8);
 }
 expect(source).toEqual(before);
 delete source.configuration!.experience;
 expect(proposeNextSession(source).suggestions[0].durationSeconds).toBe(1800);
});
it('à quatre jours les références anciennes ne fixent plus de durée',()=>{
 const r=proposeNextSession({...input(),referenceDate:'2026-10-17'});
 expect(r.status).toBe('insufficient-data');expect(r.suggestions).toEqual([]);
 expect(r.diagnostic?.durationBasis).toBeUndefined();expect(r.constraints.join()).toContain('références récentes');
});
it.each([undefined,30,29])('plafond %s sans valeur inventée',minutes=>{
 const source=input();source.historicalProfile!.availability.minutesPerSession=minutes;
 const r=proposeNextSession(source);
 expect(r.diagnostic?.attempts[0].availableMaximumSeconds).toBe(minutes===undefined?null:minutes*60);
 if(minutes===29){expect(r.suggestions).toEqual([]);expect(r.constraints.join()).toContain('disponibilités');expect(r.constraints.join()).not.toContain('Aucun jour');expect(r.diagnostic?.attempts[0].roundedSeconds).toBe(1500);}
 else expect(r.suggestions[0].durationSeconds).toBe(1800);
});
it('durées incomplètes ou variables : prudence et refus de durée, pas de calendrier',()=>{
 for(const missing of [true,false]){
 const source=input();source.sessions=source.sessions.map((s,i)=>i===4?{...s,durationSeconds:missing?(undefined as unknown as number):5000}:s);
 const r=proposeNextSession(source);
 expect(r.suggestions).toEqual([]);expect(r.diagnostic?.durationBasis?.diagnostic.coefficient).toBe(0.5);
 expect(r.diagnostic?.roundedBeforeAvailability).toBe(900);
 expect(r.constraints.join()).toContain('durée calculée');expect(r.constraints.join()).not.toContain('jour');
 expect(r.diagnostic?.attempts).toEqual([]);
 }
});
it.each(['begin','return'] as const)('%s garde quatre références et les 50 pour cent',kind=>{
 const source=input();source.configuration!.goal={model:'evolving',kind};source.policy=productPolicy(kind);
 const r=proposeNextSession(source);expect(source.policy.duration.minimumReferences).toBe(4);
 expect(r.suggestions[0].durationSeconds).toBe(900);expect(r.diagnostic?.durationBasis?.diagnostic.coefficient).toBe(0.5);
});
it('calendrier incompatible distinct de la durée',()=>{
 const source=input();source.policy.horizonDays=1;source.historicalProfile!.availability.days=['monday'];
 const r=proposeNextSession(source);expect(r.suggestions).toEqual([]);expect(r.constraints.join()).toContain('Aucun jour compatible');
 expect(r.diagnostic?.roundedBeforeAvailability).toBe(1800);expect(r.diagnostic?.attempts).toEqual([]);
});
it.each(['endurance','speed','distance','race'] as const)('%s autorise trois références cohérentes',kind=>expect(productPolicy(kind).duration.minimumReferences).toBe(3));
