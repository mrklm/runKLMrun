import { test, expect } from '@playwright/test';
import { seedCoach,openCoach,revealAll,suggestions,suggestionRows,setMinutes,planningData } from './helpers/coach';
for(const count of [0,1,2,3])test(`${count} suggestions réelles, aucune validation ni ajout au planning`,async({page})=>{
 await seedCoach(page,count);await openCoach(page);await expect(suggestions(page).getByRole('article')).toHaveCount(count);
 await expect(suggestions(page).getByRole('button')).toHaveCount(0);
 if(count===0)await expect(suggestions(page)).toContainText('Aucun jour disponible');
 else {await revealAll(page);await expect.poll(async()=>(await suggestionRows(page)).length).toBe(count);}
 expect(await planningData(page)).toBeUndefined();
});
for(const width of [390,1280])test(`cartes compactes à ${width}px et thèmes clair/sombre`,async({page})=>{
 await page.setViewportSize({width,height:900});await seedCoach(page);await openCoach(page);
 await expect(suggestions(page).getByRole('article')).toHaveCount(3);
 for(const theme of ['Midnight Garage','AIR-KLM Day flight']){
  await page.getByRole('link',{name:'Paramètres',exact:true}).click();await page.getByRole('combobox',{name:'Thème',exact:true}).selectOption(theme);
  await openCoach(page);await expect(suggestions(page)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const texts=await suggestions(page).getByRole('article').allTextContents();expect(texts.every(t=>t.includes('Allure tranquille')&&t.includes('Chemins'))).toBe(true);
 }
});
test('StrictMode, réaffichage, recalcul identique et retour d’onglet ne réécrivent pas les suggestions',async({page})=>{
 await seedCoach(page);await openCoach(page);await revealAll(page);await expect.poll(async()=>(await suggestionRows(page)).length).toBe(3);
 const before=await suggestionRows(page);
 await setMinutes(page,90);await expect(suggestions(page).getByRole('article')).toHaveCount(3);await revealAll(page);
 await page.getByRole('link',{name:'Accueil',exact:true}).click();await openCoach(page);await revealAll(page);
 expect(await suggestionRows(page)).toEqual(before);
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await revealAll(page);expect(await suggestionRows(page)).toEqual(before);
});
test('hors écran : mémorisation au défilement, obsolescence seulement lorsque tout le nouvel ensemble a été présenté',async({page})=>{
 await page.setViewportSize({width:390,height:650});await seedCoach(page);await openCoach(page);await revealAll(page);
 await expect.poll(async()=>(await suggestionRows(page)).length).toBe(3);const old=await suggestionRows(page);
 await page.addStyleTag({content:'.coach-suggestion-list article + article { margin-top:900px; }'});
 await page.evaluate(()=>scrollTo(0,0));await setMinutes(page,40);
 const cards=suggestions(page).getByRole('article');await expect(cards).toHaveCount(3);await cards.nth(0).locator('h4').scrollIntoViewIfNeeded();
 await expect.poll(async()=>(await suggestionRows(page)).length).toBe(4);
 expect((await suggestionRows(page)).filter(s=>old.some(o=>o.id===s.id)).every(s=>s.state==='current')).toBe(true);
 await revealAll(page);await expect.poll(async()=>(await suggestionRows(page)).length).toBe(6);
 await expect.poll(async()=>(await suggestionRows(page)).filter(s=>s.state==='superseded').length).toBe(3);
 expect((await suggestionRows(page)).filter(s=>s.state==='current')).toHaveLength(3);
});
test('ensemble masqué puis remplacé avant présentation : aucune carte fantôme',async({page})=>{
 await seedCoach(page);const mask=await page.addStyleTag({content:'.coach-proposal-card { visibility:hidden !important; }'});
 await openCoach(page);await expect(suggestions(page).getByRole('article',{includeHidden:true})).toHaveCount(3);await setMinutes(page,40);
 await expect(suggestions(page).getByRole('article',{includeHidden:true}).nth(0)).toContainText('40 min');expect(await suggestionRows(page)).toEqual([]);
 await mask.evaluate(el=>el.remove());await revealAll(page);await expect.poll(async()=>(await suggestionRows(page)).length).toBe(3);
 expect((await suggestionRows(page)).every(s=>s.durationSeconds<=2400)).toBe(true);
});
test('deux onglets : coexistence, remplacement cohérent et aucune boucle de notification',async({page,context})=>{
 await seedCoach(page);await openCoach(page);await revealAll(page);await expect.poll(async()=>(await suggestionRows(page)).length).toBe(3);
 const other=await context.newPage();await other.clock.setFixedTime(new Date('2026-10-17T00:00:00Z'));await other.goto('./#/entrainement');await expect(other.locator('.splash-screen')).toHaveCount(0);
 await other.evaluate(async()=>{const path='/runKLMrun/src/storage/changes.ts';const {subscribeStorage}=await import(/* @vite-ignore */ path);(window as any).events=0;subscribeStorage(['suggestions'],()=>{(window as any).events++;});});
 await page.bringToFront();await setMinutes(page,40);await expect(suggestions(page).getByRole('article').nth(0)).toContainText('40 min');await revealAll(page);
 await expect.poll(async()=>(await suggestionRows(page)).length).toBe(6);
 await other.bringToFront();await revealAll(other);await expect.poll(()=>other.evaluate(()=>(window as any).events)).toBeGreaterThan(0);
 const events=await other.evaluate(()=>(window as any).events);await other.waitForTimeout(300);
 expect(await other.evaluate(()=>(window as any).events)).toBe(events);expect(await suggestionRows(other)).toEqual(await suggestionRows(page));
 expect((await suggestionRows(other)).filter(s=>s.state==='current')).toHaveLength(3);
});
