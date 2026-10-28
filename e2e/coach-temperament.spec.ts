import { test, expect, type Page } from '@playwright/test';
import { seedCoach } from './helpers/coach';
import { activeDatabase } from './helpers/active-database';

async function snapshot(page: Page) {
  const databaseName=await activeDatabase(page);
  return page.evaluate(async databaseName => {
    const root='/runKLMrun/src/';
    const {openDatabase}=await import(/* @vite-ignore */ root+'storage/database-connection.ts');
    const db=await openDatabase(databaseName);
    const [record,profile,sessions,suggestions,v2,planning]=await Promise.all([
      db.get('evolvingCoach','local'),db.getAll('coachProfile'),db.getAll('sessions'),
      db.getAll('coachSuggestions'),db.getAll('coachSuggestionsV2'),db.getAll('coachPlanning')]);
    db.close();
    return {record,profile,sessions,suggestions,v2,planning};
  },databaseName);
}
const temperament=(page:Page)=>page.locator('details.coach-temperament');
async function temperamentChoices(page:Page) {
  const panel=temperament(page);
  await expect(panel.locator('summary')).toHaveText('Type de Coach');
  if(await panel.getAttribute('open')===null)await panel.locator('summary').click();
  const choices=panel.getByRole('group',{name:'Choisir le tempérament du Coach',exact:true});
  await expect(choices).toBeVisible();
  return choices;
}
for(const width of [390,1280]) test('tempérament indépendant, clavier et conservation à '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});await seedCoach(page);
  await page.goto('./#/parametres');await expect(page.locator('.splash-screen')).toHaveCount(0);
  let choices=await temperamentChoices(page),buttons=choices.getByRole('button');
  await expect(buttons).toHaveCount(3);await expect(buttons.nth(0)).toBeEnabled();await expect(buttons.nth(0)).toHaveAttribute('aria-pressed','true');
  const before=await snapshot(page);expect(before.record.coachTemperament).toBeUndefined();
  await expect(temperament(page)).toContainText('Le Coach privilégie une progression douce');
  for(const [index,label] of [[1,'Évolution Active'],[2,'Rentre dedans'],[0,'Pas à Pas']] as const){
    const button=choices.getByRole('button',{name:new RegExp(label)});await button.focus();await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed','true');
    await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);choices=await temperamentChoices(page);await expect(choices.getByRole('button',{name:new RegExp(label)})).toHaveAttribute('aria-pressed','true');
  }
  const after=await snapshot(page);
  expect(after.record.configuration).toEqual(before.record.configuration);
  expect(after.record.createdAt).toBe(before.record.createdAt);
  expect(after.record.coachTemperament).toBe('pas-a-pas');
  expect({...after,record:undefined}).toEqual({...before,record:undefined});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('échec d’écriture : choix conservé et reprise explicite',async({page})=>{
  await seedCoach(page);await page.goto('./#/parametres');await expect(page.locator('.splash-screen')).toHaveCount(0);
  let choices=await temperamentChoices(page);
  await expect(choices.getByRole('button',{name:/Pas à Pas/})).toBeEnabled();const before=await snapshot(page);
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<typeof original>){
      if(this.name==='evolvingCoach')throw new Error('Échec synthétique');
      return original.apply(this,args);
    };
  });
  await choices.getByRole('button',{name:/Évolution Active/}).click();
  await expect(temperament(page).getByRole('alert')).toContainText('n’a pas pu être enregistré');
  expect(await snapshot(page)).toEqual(before);
  await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);choices=await temperamentChoices(page);await expect(choices.getByRole('button',{name:/Pas à Pas/})).toBeEnabled();await expect(choices.getByRole('button',{name:/Pas à Pas/})).toHaveAttribute('aria-pressed','true');
  await choices.getByRole('button',{name:/Rentre dedans/}).focus();await page.keyboard.press('Enter');
  expect((await snapshot(page)).record.coachTemperament).toBe('rentre-dedans');
});
