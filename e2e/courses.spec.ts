import { test, expect, type Page } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';

async function writableActiveDatabase(page: Page) {
 await page.evaluate(async () => {
  const root='/runKLMrun/src/storage/';
  const { bootstrapProfiles }=await import(/* @vite-ignore */ `${root}profile-bootstrap.ts`);
  const { isProfileActive,profileDatabaseName }=await import(/* @vite-ignore */ `${root}profile-registry.ts`);
  const { DATABASE_NAME,openDatabase }=await import(/* @vite-ignore */ `${root}database-connection.ts`);
  const { active }=await bootstrapProfiles();
  if(!isProfileActive(active)||active.databaseName!==profileDatabaseName(active.id)||active.databaseName===DATABASE_NAME)throw new Error('Base du profil actif invalide.');
  if((await indexedDB.databases()).some(database=>database.name===active.databaseName))return;
  const database=await openDatabase(active.databaseName);database.close();
 });
 return activeDatabase(page);
}
async function openRecentActivities(page: Page) {
 const panel=page.locator('details[aria-labelledby="activity-title"]');
 await panel.locator(':scope > summary').click();
 await expect(panel).toHaveAttribute('open','');
}
for(const width of [390,1280])test(`Courses : historique à la demande et anciennes routes à ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('./');await expect(page.locator('.splash-screen')).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();
 const databaseName=await writableActiveDatabase(page);
 await page.evaluate(async databaseName=>{const path='/runKLMrun/src/storage/database.ts';const {createSessionRepository}=await import(/* @vite-ignore */ path);await createSessionRepository(databaseName).save({id:'courses-test',title:'Sortie témoin',date:'2026-10-17',durationSeconds:1800});},databaseName);
 await openRecentActivities(page);
 await page.getByRole('link',{name:'Voir tout l’historique',exact:true}).click();
 await expect(page.locator('.courses-history > summary')).toBeInViewport();
 await page.getByRole('navigation').getByRole('link',{name:'Courses',exact:true}).click();
 const history=page.locator('.courses-history');
 await expect(history).not.toHaveAttribute('open');await expect(page.locator('.history-year')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Calendrier mensuel'})).toBeVisible();
 await page.getByRole('combobox',{name:'Période',exact:true}).selectOption('all');await expect(page.getByText('Évolution sur la période',{exact:true})).toBeVisible();
 await history.locator('summary').focus();await page.keyboard.press('Enter');await expect(history).toHaveAttribute('open');await expect(history.getByRole('link',{name:'Sortie témoin',exact:true})).toBeVisible();
 await history.getByRole('link',{name:'Sortie témoin',exact:true}).click();await expect(page).toHaveURL(/seance\/courses-test/);await page.goBack();await expect(page.getByRole('heading',{name:'Courses',exact:true})).toBeVisible();
 await page.getByRole('navigation').getByRole('link',{name:'Accueil',exact:true}).click();await openRecentActivities(page);await page.getByRole('link',{name:'Voir tout l’historique',exact:true}).click();
 await expect(history).toHaveAttribute('open');await expect(history.locator(':scope > summary')).toBeFocused();await expect(history.locator(':scope > summary')).toBeInViewport();
 await page.getByRole('navigation').getByRole('link',{name:'Courses',exact:true}).click();await expect(history).not.toHaveAttribute('open');await expect(page.locator('.history-year')).toHaveCount(0);
 for(const route of ['historique','statistiques']){await page.goto(`./#/${route}`);await expect(page.getByRole('heading',{name:'Courses',exact:true})).toBeVisible();await expect(page.getByRole('navigation').getByRole('link',{name:'Courses',exact:true})).toHaveAttribute('aria-current','page');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
