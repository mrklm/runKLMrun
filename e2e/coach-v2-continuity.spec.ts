import { test,expect } from './helpers/protected-test';

test('D3c : alternative réelle, mémoire readonly et réutilisation stable dans le navigateur',async({page})=>{
  await page.goto('./#/entrainement');
  const result=await page.evaluate(async()=>{
    const root='/runKLMrun/src/core/coach/';
    const {adaptCoachV2Readonly,adaptCoachV2WithContinuity}=await import(/* @vite-ignore */ root+'application-adapter-v2.ts');
    const {selectedApplicationSuggestionV2,reusableActiveOccurrenceV2}=await import(/* @vite-ignore */ root+'presentation-identity-v2.ts');
    const {observePresentationV2}=await import(/* @vite-ignore */ root+'persistence-foundations-v2.ts');
    const {coachV2Perspectives}=await import(/* @vite-ignore */ root+'perspectives-v2.ts');
    const today='2026-11-04',date=(age:number)=>new Date(Date.parse(today)-age*86400000).toISOString().slice(0,10);
    const source={coachTemperament:'pas-a-pas',sessions:[26,21,16,11,6,2].map((age,index)=>({id:`synthetic-${index}`,date:date(age),
      title:'Synthétique',sport:'RUNNING',durationSeconds:2400,distanceMeters:5000,ascentMeters:80,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
      configuration:{goal:{model:'evolving',kind:'endurance'},experience:'beginner'},profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
        days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[] as any[]};
    const before=adaptCoachV2Readonly(source,today);
    const make=async(result:any,on:string,id:string)=>(await observePresentationV2({existing:[],createId:()=>id,
      selection:selectedApplicationSuggestionV2({...result,selectedDate:on},1),
      moment:{presentedAt:`${on}T08:00:00.000Z`,presentedOn:on,timeZone:'Europe/Paris',utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
      provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:source.sessions.map(value=>value.id),limitationCodes:[]}})).occurrence;
    const old=await make(before,today,'active'),past=await make(before,date(14),'past');source.occurrences=[old,past];
    const saved=JSON.stringify(source),after=await adaptCoachV2WithContinuity(source,today);
    const rejected=!reusableActiveOccurrenceV2(source.occurrences,after,today);
    const replacement=await make(after,today,'new');source.occurrences.push(replacement);
    const again=await adaptCoachV2WithContinuity(source,today);
    return {before:before.candidate.totalDurationSeconds,after:after.candidate.totalDurationSeconds,
      status:after.continuityDecisionsByDate[today].status,rejected,
      reused:reusableActiveOccurrenceV2(source.occurrences,again,today)?.id,
      sourceUnchanged:saved===JSON.stringify({...source,occurrences:source.occurrences.slice(0,2)}),
      activityCount:again.continuity.activities.length,perspectiveCount:coachV2Perspectives(again,replacement).length};
  });
  expect(result.status).toBe('avoidable-repeat');expect(result.after).toBeLessThanOrEqual(result.before);
  expect(result.rejected).toBe(true);expect(result.reused).toBe('new');expect(result.sourceUnchanged).toBe(true);
  expect(result.activityCount).toBe(6);expect(result.perspectiveCount).toBeGreaterThan(1);
});
