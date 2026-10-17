import { test, expect } from '@playwright/test';
for(const width of [390,1280])test(`Courses : historique à la demande et anciennes routes à ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('./');await expect(page.locator('.splash-screen')).toHaveCount(0);
 await page.getByRole('link',{name:'Voir tout l’historique',exact:true}).click();
 await expect(page.locator('.courses-history > summary')).toBeInViewport();
 await page.getByRole('navigation').getByRole('link',{name:'Courses',exact:true}).click();
 await page.evaluate(async()=>{const path='/runKLMrun/src/storage/database.ts';const {sessionRepository}=await import(/* @vite-ignore */ path);await sessionRepository.save({id:'courses-test',title:'Sortie témoin',date:'2026-10-17',durationSeconds:1800});});
 const history=page.locator('.courses-history');
 await expect(history).not.toHaveAttribute('open');await expect(page.locator('.history-year')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Calendrier mensuel'})).toBeVisible();
 await page.getByRole('combobox',{name:'Période',exact:true}).selectOption('all');await expect(page.getByText('Évolution sur la période',{exact:true})).toBeVisible();
 await history.locator('summary').focus();await page.keyboard.press('Enter');await expect(history).toHaveAttribute('open');await expect(history.getByRole('link',{name:'Sortie témoin',exact:true})).toBeVisible();
 await history.getByRole('link',{name:'Sortie témoin',exact:true}).click();await expect(page).toHaveURL(/seance\/courses-test/);await page.goBack();await expect(page.getByRole('heading',{name:'Courses',exact:true})).toBeVisible();
 await page.getByRole('navigation').getByRole('link',{name:'Accueil',exact:true}).click();await page.getByRole('link',{name:'Voir tout l’historique',exact:true}).click();
 await expect(history).toHaveAttribute('open');await expect(history.locator(':scope > summary')).toBeFocused();await expect(history.locator(':scope > summary')).toBeInViewport();
 await page.getByRole('navigation').getByRole('link',{name:'Courses',exact:true}).click();await expect(history).not.toHaveAttribute('open');await expect(page.locator('.history-year')).toHaveCount(0);
 for(const route of ['historique','statistiques']){await page.goto(`./#/${route}`);await expect(page.getByRole('heading',{name:'Courses',exact:true})).toBeVisible();await expect(page.getByRole('navigation').getByRole('link',{name:'Courses',exact:true})).toHaveAttribute('aria-current','page');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
