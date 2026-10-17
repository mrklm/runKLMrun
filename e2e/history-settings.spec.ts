import { test, expect } from '@playwright/test';
for(const width of [390,1280])test(`historique et paramètres à ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('./#/historique');await expect(page.locator('.splash-screen')).toHaveCount(0);
 await page.getByText('Ajouter une sortie manuellement',{exact:true}).click();
 const form=page.getByRole('form',{name:'Ajouter une sortie manuellement'});
 await form.getByLabel('Date de la sortie').fill('2026-10-10');await form.getByLabel('Durée (minutes)',{exact:true}).fill('32.5');
 await form.getByLabel('Distance (km, facultative)').fill('-1');await form.getByRole('button',{name:'Enregistrer la sortie'}).click();await expect(form.getByRole('alert')).toContainText('distance positive ou nulle');
 await form.getByLabel('Distance (km, facultative)').fill('5,2');await form.getByRole('button',{name:'Enregistrer la sortie'}).click();
 await expect(form.getByRole('status')).toContainText('Sortie enregistrée');
 const saved=await page.evaluate(async()=>{const path='/runKLMrun/src/storage/database.ts';const {sessionRepository}=await import(/* @vite-ignore */ path);return sessionRepository.list();});
 expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({durationSeconds:1950,distanceMeters:5200});
 await form.getByRole('link',{name:'Consulter la sortie'}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/seance/);
 await page.goBack();await expect(page.getByRole('heading',{name:'Courses',exact:true})).toBeVisible();
 await page.getByRole('navigation').getByRole('link',{name:'Paramètres'}).click();
 await expect(page.getByRole('heading',{name:'Importer des séances Polar'})).toHaveCount(0);
 await page.getByText('Configurer le Coach',{exact:true}).click();
 const coach=page.getByRole('region',{name:'Votre accompagnement',exact:true});
 await coach.getByRole('button',{name:'Configurer mon accompagnement'}).click();
 await coach.getByRole('combobox',{name:'Votre objectif',exact:true}).selectOption('wellbeing');
 await coach.getByRole('button',{name:/Enregistrer/}).click();await expect(coach).toContainText('Courir pour le plaisir et la forme');
 await expect(page.getByRole('button',{name:'Exporter mes données',exact:true})).toBeVisible();
 for(const theme of ['AIR-KLM Day flight','Midnight Garage']){
 await page.getByRole('combobox',{name:'Thème',exact:true}).selectOption({label:theme});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.getByRole('link',{name:'Mes chaussures',exact:true}).click();await expect(page.getByRole('heading',{name:'Mes chaussures',exact:true})).toBeVisible();
 await page.goto('./#/entrainement');await expect(page.getByRole('heading',{name:'Coach',exact:true})).toBeVisible();
});
