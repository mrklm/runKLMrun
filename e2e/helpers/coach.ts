import { expect, type Page } from '@playwright/test';
import type { StoredSuggestion } from '../../src/types/coach-suggestion';
export const suggestions=(page:Page)=>page.getByRole('region',{name:'Suggestions du Coach',exact:true});
export const history=(page:Page)=>page.getByRole('region',{name:'Ancien planning personnel',exact:true});
export async function suggestionRows(page:Page):Promise<StoredSuggestion[]> {
 return page.evaluate(async()=>{const path='/runKLMrun/src/storage/coach-suggestions.ts';const {createSuggestionRepository}=await import(/* @vite-ignore */ path);return createSuggestionRepository().list();});
}
export async function seedCoach(page:Page,count=3) {
 await page.clock.setFixedTime(new Date('2026-10-17T00:00:00Z'));
 await page.goto('./#/parametres');await expect(page.locator('.splash-screen')).toHaveCount(0);
 await page.evaluate(async count=>{
  const root='/runKLMrun/src/storage/';
  const {coachProfileRepository:p}=await import(/* @vite-ignore */ root+'coach-profile.ts');
  const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ root+'evolving-coach.ts');
  const {sessionRepository:r}=await import(/* @vite-ignore */ root+'database.ts');
  const days=count===0?[]:count===1?['monday']:count===2?['monday','wednesday']:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  await p.save({goal:{},availability:{days,minutesPerSession:90},preferences:{terrain:'trail'}},undefined);
  await createEvolvingCoachRepository().save({goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'},undefined);
  for(const [i,date] of ['2026-10-09','2026-10-11','2026-10-13','2026-10-15','2026-10-17'].entries())await r.save({id:String(i),date,title:'Synthétique',durationSeconds:3600});
 },count);
}
export async function openCoach(page:Page) { await page.getByRole('navigation').getByRole('link', { name: 'Accueil', exact: true }).click();await page.getByRole('link',{name:'Coach',exact:true}).click();await expect(suggestions(page)).toBeVisible(); }
export async function revealAll(page:Page) {
 const cards=suggestions(page).getByRole('article');
 for(let i=0;i<await cards.count();i++){
  const card=cards.nth(i),id=await card.getAttribute('data-suggestion-id');
  await card.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
  await expect.poll(async()=>(await suggestionRows(page)).some(record=>record.id===id)).toBe(true);
 }
}
export async function setMinutes(page:Page,minutes:number) {
 await page.evaluate(async minutes=>{const path='/runKLMrun/src/storage/coach-profile.ts';const {coachProfileRepository:p}=await import(/* @vite-ignore */ path);const old=await p.get();await p.save({...old,availability:{...old.availability,minutesPerSession:minutes}},old.revision);},minutes);
}
export async function seedLegacyPlanning(page:Page) {
 await page.evaluate(async()=>{
  const root='/runKLMrun/src/storage/';const {openDatabase}=await import(/* @vite-ignore */ root+'database-connection.ts');const {storageChanges}=await import(/* @vite-ignore */ root+'changes.ts');
  const db=await openDatabase(),time='2026-10-01T12:00:00.000Z';
  const record={id:'local',revision:4,createdAt:time,updatedAt:time,dismissed:['b'.repeat(64)],sessions:[{id:'legacy',proposalKey:'a'.repeat(64),date:'2026-10-20',durationSeconds:1500,kind:'endurance',intention:'Séance historique',note:'Note historique conservée',origin:'coach',status:'planned',createdAt:time,updatedAt:time,original:{date:'2026-10-19',durationSeconds:1800,explanation:'Repères historiques',policyVersion:1}}]};
  await db.put('coachPlanning',record);db.close();storageChanges.committed('runklmrun',['planning']);
 });
}
export async function planningData(page:Page) {
 return page.evaluate(async()=>{const path='/runKLMrun/src/storage/coach-planning.ts';const {createCoachPlanningRepository}=await import(/* @vite-ignore */ path);return createCoachPlanningRepository().get();});
}
