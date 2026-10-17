import { test, expect } from '@playwright/test';
test.use({ timezoneId:'America/Los_Angeles' });
for(const width of [390,1280]) test(`calendrier, synchronisation et thèmes à ${width}px`,async({page,context})=>{
 await page.clock.setFixedTime(new Date('2026-10-17T20:00:00Z'));
 await page.setViewportSize({width,height:900}); await page.goto('./#/statistiques');
 await expect(page.locator('.splash-screen')).toHaveCount(0);
 const other=await context.newPage();await other.goto('./#/parametres');
 await other.evaluate(async()=>{
   const path='/runKLMrun/src/storage/database.ts';const {sessionRepository}=await import(/* @vite-ignore */ path);
   await sessionRepository.save({id:'calendar-a',title:'Sortie A',date:'2026-10-17',startTime:'2026-10-17T23:50:00-07:00',durationSeconds:600});
   await sessionRepository.save({id:'calendar-b',title:'Sortie B',date:'2026-10-17',durationSeconds:900,distanceMeters:2000,ascentMeters:0});
   const repoPath='/runKLMrun/src/storage/coach-suggestions.ts';const {createSuggestionRepository}=await import(/* @vite-ignore */ repoPath);
   await createSuggestionRepository().recordPresented({date:'2026-10-19',kind:'easy',durationSeconds:1800});
 });
 const calendar=page.getByRole('region',{name:'Calendrier mensuel'});
 await expect(calendar.getByRole('link')).toHaveCount(2);await expect(calendar.getByText('○ Suggestion facultative',{exact:true})).toHaveCount(1);
 await expect(page.locator('.statistics-metrics')).toContainText('2');await expect(page.locator('.statistics-metrics')).toContainText('Données disponibles : 1/2');
 const snapshot=()=>other.evaluate(async()=>{const path='/runKLMrun/src/storage/coach-suggestions.ts';return (await import(/* @vite-ignore */ path)).createSuggestionRepository().list();});
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
