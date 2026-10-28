import { test, expect } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';
test.use({ timezoneId:'America/Los_Angeles' });
async function writableActiveDatabase(page: Parameters<typeof activeDatabase>[0]) {
 await page.evaluate(async()=>{
   const root='/runKLMrun/src/storage/';const {bootstrapProfiles}=await import(/* @vite-ignore */ root+'profile-bootstrap.ts');
   const {isProfileActive,profileDatabaseName}=await import(/* @vite-ignore */ root+'profile-registry.ts');
   const {DATABASE_NAME,openDatabase}=await import(/* @vite-ignore */ root+'database-connection.ts');const {active}=await bootstrapProfiles();
   if(!isProfileActive(active)||active.databaseName!==profileDatabaseName(active.id)||active.databaseName===DATABASE_NAME)throw new Error('Base du profil actif invalide.');
   if((await indexedDB.databases()).some(database=>database.name===active.databaseName))return;
   const database=await openDatabase(active.databaseName);database.close();
 });
 return activeDatabase(page);
}
for(const width of [390,1280]) test(`calendrier, synchronisation et thèmes à ${width}px`,async({page,context})=>{
 await page.clock.setFixedTime(new Date('2026-10-17T20:00:00Z'));
 await page.setViewportSize({width,height:900}); await page.goto('./#/statistiques');
 await expect(page.locator('.splash-screen')).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();const databaseName=await writableActiveDatabase(page);
 const other=await context.newPage();await other.goto('./#/parametres');await expect(other.locator('.splash-screen')).toHaveCount(0);await expect(other.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();
 expect(await activeDatabase(other)).toBe(databaseName);
 await other.evaluate(async databaseName=>{
   const path='/runKLMrun/src/storage/database.ts';const {createSessionRepository}=await import(/* @vite-ignore */ path),sessions=createSessionRepository(databaseName);
   await sessions.save({id:'calendar-a',title:'Sortie A',date:'2026-10-17',startTime:'2026-10-17T23:50:00-07:00',durationSeconds:600});
   await sessions.save({id:'calendar-b',title:'Sortie B',date:'2026-10-17',durationSeconds:900,distanceMeters:2000,ascentMeters:0});
 },databaseName);
 const calendar=page.getByRole('region',{name:'Calendrier mensuel'});
 await expect(calendar.getByRole('link')).toHaveCount(2);await expect(calendar).toContainText('◇ Suggestion du Coach');
 await expect(page.locator('.statistics-metrics')).toContainText('2');await expect(page.locator('.statistics-metrics')).toContainText('Données disponibles : 1/2');
 const snapshot=()=>other.evaluate(async databaseName=>{const path='/runKLMrun/src/storage/database-connection.ts';const {openDatabase}=await import(/* @vite-ignore */ path),db=await openDatabase(databaseName),records=await db.getAll('coachSuggestionsV2');db.close();return records;},databaseName);
 const before=await snapshot();
 await calendar.getByRole('button',{name:'Mois suivant'}).click();await expect(calendar.getByRole('heading',{name:'novembre 2026'})).toBeVisible();await expect(calendar.getByRole('link')).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Période',exact:true})).toHaveValue('week');
 await calendar.getByRole('button',{name:'Mois précédent'}).click();
 for(const theme of ['AIR-KLM Day flight','Midnight Garage']){
 await page.getByRole('navigation').getByRole('link',{name:'Paramètres'}).click();await page.getByRole('combobox',{name:'Thème',exact:true}).selectOption({label:theme});await page.getByRole('navigation').getByRole('link',{name:'Courses'}).click();
 await expect(calendar.getByRole('link')).toHaveCount(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(await snapshot()).toEqual(before);
 await calendar.getByRole('link',{name:/Sortie réalisée : Sortie A/}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/seance\/calendar-a/);
 await other.close();
});
