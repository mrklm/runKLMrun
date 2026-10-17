import { expect, it, vi } from 'vitest';
import { proposeNextSession, proposeSuggestions, type ProposalInput } from './proposals';
import { productPolicy } from './product-policy';
import { replacementCandidates, suggestionId, suggestionExpiry } from './suggestions';
import type { CoachPlanning } from '../../types/coach-planning';
import type { StoredSuggestion } from '../../types/coach-suggestion';
const input=():ProposalInput=>({configuration:{goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'},historicalProfile:{goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:90},preferences:{terrain:'trail'}},referenceDate:'2026-10-17',policy:productPolicy('endurance'),sessions:['2026-10-09','2026-10-11','2026-10-13','2026-10-15','2026-10-17'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:3600}))});
it('trois suggestions espacées sur sept jours, variation facile sans augmentation des plafonds',()=>{
 const data=input(),before=structuredClone(data),result=proposeSuggestions(data);
 expect(result.horizon).toEqual({from:'2026-10-18',to:'2026-10-24'});
 expect(result.suggestions.map(s=>s.date)).toEqual(['2026-10-19','2026-10-21','2026-10-23']);
 expect(result.suggestions.map(s=>s.durationSeconds)).toEqual([3600,2700,3600]);
 expect(result.suggestions.map(s=>s.kind)).toEqual(['endurance','easy','endurance']);
 expect(result.suggestions.every(s=>s.intensity.kind==='easy'&&s.recommendedTerrain.surface==='trail'&&s.durationSeconds%300===0)).toBe(true);
 expect(data).toEqual(before);expect(result.suggestions[1].explanation).toContain('plus courtes');
});
it('identités stables compatibles avec 5B, ordre des activités sans influence et aucune écriture',()=>{
 const spy=vi.spyOn(indexedDB,'open'),a=input(),result=proposeSuggestions(a);
 expect(proposeSuggestions({...a,sessions:[...a.sessions].reverse()}).suggestions).toEqual(result.suggestions);
 for(const s of result.suggestions)expect(s.id).toBe(suggestionId({date:s.date,kind:s.kind,durationSeconds:s.durationSeconds,terrain:{surface:s.recommendedTerrain.surface,relief:s.recommendedTerrain.relief}}));
 expect(spy).not.toHaveBeenCalled();spy.mockRestore();
});
it('le moteur unique conserve sa réduction ; les suggestions libres utilisent la durée habituelle',()=>{
 const a=input(),single=proposeNextSession(a),set=proposeSuggestions(a);
 expect(single.suggestions).toHaveLength(1);expect(set.suggestions[0].date).toBe(single.suggestions[0].date);expect(single.suggestions[0].durationSeconds).toBe(2700);expect(set.suggestions[0].durationSeconds).toBe(3600);
 expect(single.horizon.to).toBe('2026-10-31');
});
it('aucune suggestion sans disponibilité, durée suffisante, consentement ou références récentes',()=>{
 for(const variant of ['days','cap','consent','empty','old','wellbeing']){
  const a=input();if(variant==='days')a.historicalProfile!.availability.days=[];
  if(variant==='cap')a.historicalProfile!.availability.minutesPerSession=20;
  if(variant==='consent')a.configuration!.structuredPlanningPreference='declined';
  if(variant==='empty')a.sessions=[];
  if(variant==='old')a.sessions=a.sessions.map(s=>({...s,date:s.date.replace('2026','2024')}));
  if(variant==='wellbeing')a.configuration!.goal={model:'evolving',kind:'wellbeing'};
  expect(proposeSuggestions(a).suggestions).toEqual([]);
 }
});
it('disponibilités rares et fréquence souhaitée basse ne sont pas remplies artificiellement',()=>{
 const a=input();a.historicalProfile!.availability.days=['friday'];expect(proposeSuggestions(a).suggestions).toHaveLength(1);
 a.historicalProfile!.availability.days=['monday','wednesday','friday'];a.historicalProfile!.availability.sessionsPerWeek=1;
 expect(proposeSuggestions(a).suggestions).toHaveLength(0); // prochain créneau à J+7, samedi indisponible
});
it.each(['begin','return'] as const)('%s : sans références, une découverte uniquement',kind=>{
 const a=input();a.configuration!.goal={model:'evolving',kind};a.policy=productPolicy(kind);a.sessions=[];
 const result=proposeSuggestions(a);expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0].kind).toBe('discovery');
});
it('références variables : pas de multiplication ni de variation inventée',()=>{
 const a=input();a.sessions=a.sessions.map((s,i)=>({...s,durationSeconds:i%2?7200:3600}));
 expect(proposeSuggestions(a).suggestions.length).toBeLessThanOrEqual(1);
});
function planning():CoachPlanning {
 const time='2026-10-17T12:00:00.000Z';return {id:'local',revision:1,createdAt:time,updatedAt:time,dismissed:['b'.repeat(64)],sessions:[{id:'plan',proposalKey:'a'.repeat(64),date:'2026-10-20',durationSeconds:3600,kind:'endurance',intention:'Synthétique',note:'Conserver',origin:'coach',status:'planned',createdAt:time,updatedAt:time,original:{date:'2026-10-19',durationSeconds:2700,explanation:'Synthétique',policyVersion:1}}]};
}
it('planning déplacé respecté avec espacement, notes/refus/révisions intacts ; annulation libère le créneau',()=>{
 const p=planning(),before=structuredClone(p),result=proposeSuggestions(input(),p);
 expect(result.suggestions.map(s=>s.date)).toEqual(['2026-10-22','2026-10-24']);expect(p).toEqual(before);
 p.sessions[0].status='cancelled';expect(proposeSuggestions(input(),p).suggestions).toHaveLength(3);
});
it('durée déjà planifiée déduite du budget, sans raccourcir artificiellement les nouvelles séances',()=>{
 const p=planning();p.sessions[0].durationSeconds=12600;
 expect(proposeSuggestions(input(),p).suggestions).toEqual([]);
});
it('ensemble présenté : ses membres ne se remplacent pas mutuellement ; ensemble vide ne purge rien',()=>{
 const projection=proposeSuggestions(input()).suggestions.map(s=>({date:s.date,kind:s.kind,durationSeconds:s.durationSeconds,terrain:{surface:s.recommendedTerrain.surface,relief:s.recommendedTerrain.relief}}));
 const records:StoredSuggestion[]=projection.map(s=>({...s,id:suggestionId(s),createdAt:'2026-10-17T12:00:00.000Z',updatedAt:'2026-10-17T12:00:00.000Z',revision:1,state:'current',expiresOn:suggestionExpiry(s.date)}));
 expect(replacementCandidates(records,projection,'2026-10-17')).toEqual([]);expect(replacementCandidates(records,[],'2026-10-17')).toEqual([]);
 expect(replacementCandidates(records,projection.slice(1),'2026-10-17')).toEqual([records[0]]);
});
it.each([[35,[35,30,35]],[37,[35,30,35]],[40,[40,30,40]],[43,[40,30,40]],[45,[45,35,45]]])('médiane %s : durée habituelle et facile sans progression', (minutes, expected) => {
 const a=input();a.sessions=a.sessions.map(s=>({...s,durationSeconds:Number(minutes)*60}));
 const before=structuredClone(a), result=proposeSuggestions(a);
 expect(result.suggestions.map(s=>s.durationSeconds/60)).toEqual(expected);
 expect(result.suggestions.every(s=>s.durationSeconds<=Number(minutes)*60 && s.intensity.kind==='easy')).toBe(true);
 expect(result.suggestions[0].durationBasis.diagnostic?.coefficient).toBe(1);
 expect(result.diagnostic?.durationBasis?.diagnostic.coefficient).toBe(1);
 expect(result.suggestions[1].durationBasis.diagnostic?.coefficient).toBe(0.8);
 expect(proposeSuggestions(a)).toEqual(result);expect(a).toEqual(before);
});
it('minimum et disponibilité peuvent empêcher toute variation : libellés identiques',()=>{
 for(const minutes of [30,35]){
 const a=input();a.sessions=a.sessions.map(s=>({...s,durationSeconds:minutes*60}));a.historicalProfile!.availability.minutesPerSession=30;
 const result=proposeSuggestions(a);expect(result.suggestions.map(s=>s.durationSeconds)).toEqual([1800,1800,1800]);
 expect(result.suggestions.every(s=>s.kind==='easy')).toBe(true);
 }
});
it('pas de variation avec références incomplètes ou trop peu nombreuses',()=>{
 const a=input();a.sessions=a.sessions.slice(-2);
 expect(proposeSuggestions(a).suggestions.length).toBeLessThanOrEqual(1);
 a.sessions=input().sessions.map((s,i)=>({...s,durationSeconds:i===0?NaN:s.durationSeconds}));
 const result=proposeSuggestions(a);expect(result.suggestions.length).toBeLessThanOrEqual(1);
 expect(result.suggestions.every(s=>s.durationBasis.assessment!=='supported')).toBe(true);
});
it('rythme faible : une seule sortie malgré sept jours disponibles',()=>{
 const a=input();a.sessions=['2026-09-19','2026-09-26','2026-10-03','2026-10-10','2026-10-17'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:2400}));
 const result=proposeSuggestions(a);expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0].date).toBe('2026-10-24');
 expect(result.suggestions[0].durationSeconds).toBe(2400);
});
it('budget insuffisant : moins de suggestions, pas de réduction pour remplir le planning',()=>{
 const a=input();a.sessions=['2026-10-03','2026-10-06','2026-10-09','2026-10-12','2026-10-15'].map((date,i)=>({id:String(i),date,title:'Synthétique',durationSeconds:2400}));
 const result=proposeSuggestions(a);expect(result.suggestions.map(s=>s.durationSeconds)).toEqual([2400,1800]);
 expect(result.suggestions.reduce((n,s)=>n+s.durationSeconds,0)).toBeLessThanOrEqual(2400*7/3);
 expect(result.constraints.some(s=>s.includes('volume'))).toBe(true);
});
it('réutilise la fenêtre sélectionnée, pas arbitrairement les huit dernières sorties',()=>{
 const a=input();a.sessions=[...a.sessions,...['2026-09-01','2026-09-03','2026-09-05'].map((date,i)=>({id:`old${i}`,date,title:'Ancienne',durationSeconds:1800}))];
 const result=proposeSuggestions(a);expect(result.evidence.knownDurations).toBe(5);
 expect(result.suggestions[0].durationSeconds).toBe(3600);
 expect(result.suggestions[0].referenceSessionIds.some(id=>id.startsWith('old'))).toBe(false);
});
it.each(['begin','return'] as const)('%s conserve exactement le calcul prudent unique',kind=>{
 const a=input();a.configuration!.goal={model:'evolving',kind};a.policy=productPolicy(kind);
 const single=proposeNextSession(a),multiple=proposeSuggestions(a);
 expect(multiple.suggestions).toHaveLength(1);expect(multiple.suggestions[0]).toMatchObject({date:single.suggestions[0].date,kind:single.suggestions[0].kind,durationSeconds:single.suggestions[0].durationSeconds,durationBasis:single.suggestions[0].durationBasis,intensity:single.suggestions[0].intensity});
});
it.each(['speed','distance','race'] as const)('%s : aucune intensité supplémentaire',kind=>{
 const a=input();a.configuration!.goal=kind==='speed'?{model:'evolving',kind}:kind==='distance'?{model:'evolving',kind,distanceMeters:10000}:{model:'evolving',kind,distanceMeters:10000,eventDate:'2026-12-01'};a.policy=productPolicy(kind);
 const result=proposeSuggestions(a);expect(result.suggestions).toHaveLength(3);
 expect(result.suggestions.every(s=>s.intensity.kind==='easy'&&s.durationSeconds<=3600)).toBe(true);
});
