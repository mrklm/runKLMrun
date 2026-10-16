import { expect, it } from 'vitest';
import { productPolicy } from './product-policy';
import { proposeNextSession, type ProposalInput } from './proposals';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
const goal = (kind: EvolvingCoachValues['goal']['kind']): EvolvingCoachValues['goal'] => kind==='race' ? {model:'evolving',kind,distanceMeters:10000,eventDate:'2027-01-01'} : kind==='distance' ? {model:'evolving',kind,distanceMeters:10000} : {model:'evolving',kind};
function input(kind: EvolvingCoachValues['goal']['kind']='endurance',minutes=45): ProposalInput {
 // Intervalles 4, 2, 1, 1 : médiane 1,5 ; quatre sorties dans les six derniers jours.
 const dates=['2026-10-04','2026-10-08','2026-10-10','2026-10-11','2026-10-12'];
 const durations=[2221,1800,2200,2242,2621.77];
 return {configuration:{goal:goal(kind),experience:'experienced',structuredPlanningPreference:'accepted'},historicalProfile:{goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:minutes},preferences:{}},sessions:dates.map((date,i)=>({id:String(i),title:'Synthétique',date,durationSeconds:durations[i]})),referenceDate:'2026-10-14',policy:productPolicy(kind)};
}
it('reproduit les références documentées, deux jours et les intervalles variables',()=>{
 const source=input(),before=structuredClone(source),r=proposeNextSession(source),s=r.suggestions[0];
 expect(r.evidence).toMatchObject({knownDurations:4,medianDurationSeconds:2221,medianGapDays:1.5,latestAgeDays:2});
 expect(s.durationBasis.diagnostic).toMatchObject({gapSpread:2,coefficient:0.8,coefficientReasons:[]});
 expect(s.durationBasis.diagnostic?.durationSpread).toBeCloseTo(0.37);
 expect(s.durationSeconds).toBe(1800);expect(source).toEqual(before);
 const noExperience=input();delete noExperience.configuration!.experience;
 expect(proposeNextSession(noExperience).suggestions[0].durationSeconds).toBe(s.durationSeconds);
});
it.each(['endurance','speed','distance','race'] as const)('%s : minimum éditorial et plafond disponible',kind=>{
 expect(proposeNextSession(input(kind,29)).suggestions).toEqual([]);
 expect(proposeNextSession(input(kind,30)).suggestions[0].durationSeconds).toBe(1800);
 for(const minutes of [1,15,29,30,45,90]) for(const s of proposeNextSession(input(kind,minutes)).suggestions){expect(s.durationSeconds).toBeGreaterThanOrEqual(1800);expect(s.durationSeconds).toBeLessThanOrEqual(minutes*60);}
});
it.each(['begin','return'] as const)('%s conserve les séances courtes',kind=>{
 const source=input(kind,15);source.sessions=[];
 expect(proposeNextSession(source).suggestions[0].durationSeconds).toBe(900);
});
it('ne relève pas une durée peu représentative ni une médiane inférieure à 30 minutes',()=>{
 for(const duration of [1200,1799]){const source=input();source.sessions=source.sessions.map(s=>({...s,durationSeconds:duration}));expect(proposeNextSession(source).suggestions).toEqual([]);}
 const few=input();few.sessions=few.sessions.slice(-2);expect(proposeNextSession(few).suggestions).toEqual([]);
 const old=input();old.referenceDate='2027-01-01';expect(proposeNextSession(old).suggestions).toEqual([]);
});
it('pratique trop variable en durée : conserve les 50 % sans relever le plafond prudent',()=>{
 const source=input();source.sessions=source.sessions.map((s,i)=>({...s,durationSeconds:i%2?7200:14400}));
 const s=proposeNextSession(source).suggestions[0];expect(s.durationBasis.diagnostic?.coefficient).toBe(0.5);expect(s.durationSeconds).toBeLessThanOrEqual(2700);
});
it('plaisir et forme reste sans planning',()=>expect(proposeNextSession(input('wellbeing')).suggestions).toEqual([]));
