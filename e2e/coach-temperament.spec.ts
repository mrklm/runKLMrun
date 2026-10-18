import { test, expect, type Page } from '@playwright/test';
import { seedCoach } from './helpers/coach';

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const root='/runKLMrun/src/';
    const {openDatabase}=await import(/* @vite-ignore */ root+'storage/database-connection.ts');
    const {calculateCoachVersionsComparisonReadonly}=await import(/* @vite-ignore */ root+'storage/coach-v2-readonly.ts');
    const db=await openDatabase();
    const [record,profile,sessions,suggestions,v2,planning]=await Promise.all([
      db.get('evolvingCoach','local'),db.getAll('coachProfile'),db.getAll('sessions'),
      db.getAll('coachSuggestions'),db.getAll('coachSuggestionsV2'),db.getAll('coachPlanning')]);
    db.close();
    return {record,profile,sessions,suggestions,v2,planning,comparison:await calculateCoachVersionsComparisonReadonly('2026-10-18')};
  });
}
for(const width of [390,1280]) test('tempérament indépendant, clavier et conservation à '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});await seedCoach(page);
  await page.goto('./#/parametres');await expect(page.locator('.splash-screen')).toHaveCount(0);
  const panel=page.getByRole('region',{name:'Type de Coach',exact:true}),slider=panel.getByRole('slider');
  await expect(slider).toBeEnabled();await expect(slider).toHaveValue('0');await expect(slider).toHaveAttribute('aria-valuetext','Pas à Pas');
  const before=await snapshot(page);expect(before.record.coachTemperament).toBeUndefined();
  await expect(panel).toContainText('Ce choix s’applique aux nouveaux calculs du Coach V2.');
  for(const [key,value,label] of [['ArrowRight','1','Évolution Active'],['End','2','Rentre dedans'],['Home','0','Pas à Pas']] as const){
    await slider.focus();await page.keyboard.press(key);
    await expect(panel.getByRole('status')).toHaveText('Préférence enregistrée.');
    await expect(slider).toHaveValue(value);await expect(slider).toHaveAttribute('aria-valuetext',label);
    await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(slider).toBeEnabled();await expect(slider).toHaveValue(value);
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
  const panel=page.getByRole('region',{name:'Type de Coach',exact:true}),slider=panel.getByRole('slider');
  await expect(slider).toBeEnabled();const before=await snapshot(page);
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<typeof original>){
      if(this.name==='evolvingCoach')throw new Error('Échec synthétique');
      return original.apply(this,args);
    };
  });
  await slider.focus();await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('alert')).toContainText('n’a pas pu être enregistré');
  expect(await snapshot(page)).toEqual(before);
  await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(slider).toBeEnabled();await expect(slider).toHaveValue('0');
  await slider.focus();await page.keyboard.press('End');
  await expect(panel.getByRole('status')).toHaveText('Préférence enregistrée.');
  expect((await snapshot(page)).record.coachTemperament).toBe('rentre-dedans');
});
