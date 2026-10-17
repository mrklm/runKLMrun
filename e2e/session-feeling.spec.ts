import { test, expect } from '@playwright/test';
for (const width of [390,1280]) test(`ressenti facultatif, persistance et concurrence à ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});await page.goto('./#/historique');await expect(page.locator('.splash-screen')).toHaveCount(0);
 await page.getByText('Ajouter une sortie manuellement',{exact:true}).click();
 const manual=page.getByRole('form',{name:'Ajouter une sortie manuellement'});
 await manual.getByLabel('Date de la sortie').fill('2026-10-10');await manual.getByLabel('Durée (minutes)',{exact:true}).fill('30');
 await manual.getByLabel('Commentaire personnel (facultatif)').fill('Commentaire seul');
 await manual.getByRole('button',{name:'Enregistrer la sortie'}).click();await manual.getByRole('link',{name:'Consulter la sortie'}).click();
 const region=page.getByRole('region',{name:'Votre ressenti',exact:true});await expect(region.getByText('Commentaire seul',{exact:true})).toBeVisible();
 const url=page.url();await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(region.getByText('Commentaire seul',{exact:true})).toBeVisible();
 await region.getByRole('button',{name:'Modifier le ressenti ou le commentaire'}).click();
 await region.getByLabel('Effort perçu (facultatif)').selectOption('easy');
 await region.getByRole('button',{name:'Enregistrer le ressenti'}).focus();await page.keyboard.press('Enter');await expect(region.getByText('Facile',{exact:true})).toBeVisible();
 const other=await context.newPage();await other.goto(url);await expect(other.locator('.splash-screen')).toHaveCount(0);
 const otherRegion=other.getByRole('region',{name:'Votre ressenti',exact:true});await expect(otherRegion.getByText('Facile',{exact:true})).toBeVisible();
 await otherRegion.getByRole('button',{name:'Modifier le ressenti ou le commentaire'}).click();await otherRegion.getByLabel('Commentaire personnel (facultatif)').fill('Brouillon conservé');
 await region.getByRole('button',{name:'Modifier le ressenti ou le commentaire'}).click();await region.getByLabel('Effort perçu (facultatif)').selectOption('hard');await region.getByRole('button',{name:'Enregistrer le ressenti'}).click();await expect(region.getByText('Difficile',{exact:true})).toBeVisible();
 await otherRegion.getByRole('button',{name:'Enregistrer le ressenti'}).click();await expect(otherRegion.getByRole('alert')).toContainText('autre onglet');await expect(otherRegion.getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Brouillon conservé');
 await otherRegion.getByRole('button',{name:'Recharger le ressenti'}).click();await expect(otherRegion.getByText('Difficile',{exact:true})).toBeVisible();
 await region.getByRole('button',{name:'Modifier le ressenti ou le commentaire'}).click();await region.getByLabel('Effort perçu (facultatif)').selectOption('');await region.getByRole('button',{name:'Enregistrer le ressenti'}).click();await expect(otherRegion.getByText('Difficile',{exact:true})).toHaveCount(0);await expect(otherRegion.getByText('Commentaire seul',{exact:true})).toBeVisible();
 await region.getByRole('button',{name:'Modifier le ressenti ou le commentaire'}).click();await region.getByLabel('Commentaire personnel (facultatif)').fill('');await region.getByRole('button',{name:'Enregistrer le ressenti'}).click();await expect(region.getByRole('button',{name:'Ajouter un ressenti ou un commentaire'})).toBeVisible();
 for(const theme of ['AIR-KLM Day flight','Midnight Garage']) {
 await page.getByRole('navigation').getByRole('link',{name:'Paramètres'}).click();await page.getByRole('combobox',{name:'Thème',exact:true}).selectOption({label:theme});await page.goto(url);await expect(region.getByRole('button',{name:'Ajouter un ressenti ou un commentaire'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await other.close();
});
