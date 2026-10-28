import { expect, type Page } from '@playwright/test';
import type { StoredSuggestion } from '../../src/types/coach-suggestion';
import { activeDatabase } from './active-database';
export const suggestions=(page:Page)=>page.getByRole('region',{name:'Suggestions du Coach',exact:true});
export const history=(page:Page)=>page.getByRole('region',{name:'Ancien planning personnel',exact:true});
async function writableActiveDatabase(page:Page) {
 await page.evaluate(async()=>{
  const root='/runKLMrun/src/storage/';
  const {bootstrapProfiles}=await import(/* @vite-ignore */ root+'profile-bootstrap.ts');
  const {isProfileActive,profileDatabaseName}=await import(/* @vite-ignore */ root+'profile-registry.ts');
  const {DATABASE_NAME,openDatabase}=await import(/* @vite-ignore */ root+'database-connection.ts');
  const {active}=await bootstrapProfiles();
  if(!isProfileActive(active)||active.databaseName!==profileDatabaseName(active.id)||active.databaseName===DATABASE_NAME)throw new Error('Base du profil actif invalide.');
  if((await indexedDB.databases()).some(database=>database.name===active.databaseName))return;
  const database=await openDatabase(active.databaseName);database.close();
 });
 return activeDatabase(page);
}
export async function suggestionRows(page:Page):Promise<StoredSuggestion[]> {
 const databaseName=await activeDatabase(page);
 return page.evaluate(async databaseName=>{const path='/runKLMrun/src/storage/coach-suggestions.ts';const {createSuggestionRepository}=await import(/* @vite-ignore */ path);return createSuggestionRepository(databaseName).list();},databaseName);
}
export async function seedCoach(page:Page,count=3) {
 await page.clock.setFixedTime(new Date('2026-10-17T00:00:00Z'));
 await page.goto('./#/parametres');await expect(page.locator('.splash-screen')).toHaveCount(0);
 const databaseName=await writableActiveDatabase(page);
 await page.evaluate(async({count,databaseName})=>{
  const root='/runKLMrun/src/storage/';
  const {createCoachProfileRepository}=await import(/* @vite-ignore */ root+'coach-profile.ts');
  const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ root+'evolving-coach.ts');
  const {createSessionRepository}=await import(/* @vite-ignore */ root+'database.ts');
  const p=createCoachProfileRepository(databaseName),r=createSessionRepository(databaseName);
  const days=count===0?[]:count===1?['monday']:count===2?['monday','wednesday']:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  await p.save({goal:{},availability:{days,minutesPerSession:90},preferences:{terrain:'trail'}},undefined);
  await createEvolvingCoachRepository(databaseName).save({goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'},undefined);
  for(const [i,date] of ['2026-10-09','2026-10-11','2026-10-13','2026-10-15','2026-10-17'].entries())await r.save({id:String(i),date,title:'Synthétique',durationSeconds:3600});
 },{count,databaseName});
}
export async function openCoach(page:Page) { await page.goto('./#/entrainement');await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(page.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();await expect(suggestions(page)).toBeVisible(); }
export async function revealAll(page:Page) {
 const cards=suggestions(page).getByRole('article');
 for(let i=0;i<await cards.count();i++){
  const card=cards.nth(i),id=await card.getAttribute('data-suggestion-id');
  await card.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
  await expect.poll(async()=>(await suggestionRows(page)).some(record=>record.id===id)).toBe(true);
 }
}
export async function setMinutes(page:Page,minutes:number) {
 const databaseName=await writableActiveDatabase(page);
 await page.evaluate(async({minutes,databaseName})=>{const path='/runKLMrun/src/storage/coach-profile.ts';const {createCoachProfileRepository}=await import(/* @vite-ignore */ path);const p=createCoachProfileRepository(databaseName),old=await p.get();await p.save({...old,availability:{...old.availability,minutesPerSession:minutes}},old.revision);},{minutes,databaseName});
}
export async function seedLegacyPlanning(page:Page) {
 const databaseName=await writableActiveDatabase(page);
 await page.evaluate(async databaseName=>{
  const root='/runKLMrun/src/storage/';const {openDatabase}=await import(/* @vite-ignore */ root+'database-connection.ts');const {storageChanges}=await import(/* @vite-ignore */ root+'changes.ts');
  const db=await openDatabase(databaseName),time='2026-10-01T12:00:00.000Z';
  const record={id:'local',revision:4,createdAt:time,updatedAt:time,dismissed:['b'.repeat(64)],sessions:[{id:'legacy',proposalKey:'a'.repeat(64),date:'2026-10-20',durationSeconds:1500,kind:'endurance',intention:'Séance historique',note:'Note historique conservée',origin:'coach',status:'planned',createdAt:time,updatedAt:time,original:{date:'2026-10-19',durationSeconds:1800,explanation:'Repères historiques',policyVersion:1}}]};
  await db.put('coachPlanning',record);db.close();storageChanges.committed(databaseName,['planning']);
 },databaseName);
}
export async function planningData(page:Page) {
 const databaseName=await activeDatabase(page);
 return page.evaluate(async databaseName=>{const path='/runKLMrun/src/storage/coach-planning.ts';const {createCoachPlanningRepository}=await import(/* @vite-ignore */ path);return createCoachPlanningRepository(databaseName).get();},databaseName);
}
