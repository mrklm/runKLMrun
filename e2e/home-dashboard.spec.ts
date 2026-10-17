import { test, expect } from '@playwright/test';
import { seedCoach, revealAll, suggestionRows, seedLegacyPlanning, history, planningData } from './helpers/coach';
for (const width of [390,1280]) test(`accueil personnel, visibilité et planning à ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900}); await seedCoach(page); await seedLegacyPlanning(page);
  const before=await planningData(page);
  expect(await suggestionRows(page)).toEqual([]);
  await page.getByRole('navigation').getByRole('link',{name:'Accueil',exact:true}).click();
  const headings=page.getByRole('heading',{level:2});
  await expect(headings).toHaveText(['Dernière sortie','Suggestions du Coach','Activités récentes','Observations du coach']);
  await expect(page.getByRole('region',{name:'Dernière sortie'}).locator('time')).toContainText('17/10/2026');
  await expect(page.getByRole('region',{name:'Activités récentes'}).getByRole('listitem')).toHaveCount(4);
  await revealAll(page); const recorded=await suggestionRows(page); expect(recorded).toHaveLength(2);
  await page.getByRole('link',{name:'Coach',exact:true}).click(); await revealAll(page);
  expect(await suggestionRows(page)).toEqual(recorded); await expect(history(page)).toBeVisible();
  expect(await planningData(page)).toEqual(before);
  await page.getByRole('navigation').getByRole('link',{name:'Accueil',exact:true}).click();
  await expect(page.getByRole('link',{name:'Comprendre le stockage'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Voir l’espace entraînement/})).toHaveCount(0);
  for (const theme of ['AIR-KLM Day flight','Midnight Garage']) {
    await page.getByRole('navigation').getByRole('link',{name:'Paramètres'}).click();
    await page.getByRole('combobox',{name:'Thème',exact:true}).selectOption({label:theme});
    await page.getByRole('navigation').getByRole('link',{name:'Accueil',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
test('aucune mémorisation des cartes masquées sur l’accueil',async({page})=>{
 await seedCoach(page); await page.addStyleTag({content:'.coach-proposal-card {visibility:hidden !important}'});
 await page.getByRole('navigation').getByRole('link',{name:'Accueil',exact:true}).click();
 await expect(page.locator('.coach-proposal-card')).toHaveCount(3);
 await page.waitForTimeout(350); expect(await suggestionRows(page)).toEqual([]);
});
test('accueil vide : état discret, historique et configuration accessibles',async({page})=>{
 await page.goto('./');await expect(page.locator('.splash-screen')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Votre histoire commence ici'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Observations du coach'})).toBeVisible();
 await expect(page.getByRole('link',{name:"Voir tout l’historique"})).toBeVisible();
 await expect(page.getByRole('link',{name:'Coach',exact:true})).toBeVisible();
});
test('une activité ajoutée dans un autre onglet actualise la dernière sortie',async({page,context})=>{
 await page.goto('./');await expect(page.locator('.splash-screen')).toHaveCount(0);
 const other=await context.newPage();await other.goto('./#/parametres');
 await other.evaluate(async()=>{
  const path='/runKLMrun/src/storage/database.ts';const {sessionRepository}=await import(/* @vite-ignore */ path);
  await sessionRepository.save({id:'synthetic-dashboard',title:'Sortie synthétique',date:'2026-10-16',durationSeconds:1800,distanceMeters:5000});
 });
 const latest=page.getByRole('region',{name:'Dernière sortie'});
 await expect(latest).toContainText('16/10/2026');await expect(latest).toContainText('5 km');
 await latest.getByRole('link',{name:'Sortie synthétique'}).focus();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/seance\/synthetic-dashboard/);
});
