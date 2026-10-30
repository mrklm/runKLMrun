import { test, expect } from './helpers/protected-test';
for (const width of [390, 1280]) test(`bilan : ressenti facultatif, persistance et concurrence à ${width}px`, async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 }); await page.goto('./#/historique'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.getByText('Ajouter une sortie manuellement', { exact: true }).click();
  const manual = page.getByRole('form', { name: 'Ajouter une sortie manuellement' });
  await manual.getByLabel('Date de la sortie').fill('2026-10-10'); await manual.getByLabel('Durée (minutes)', { exact: true }).fill('30');
  await manual.getByLabel('Commentaire personnel (facultatif)').fill('Commentaire seul');
  await manual.getByRole('button', { name: 'Enregistrer la sortie' }).click();
  await page.getByRole('dialog', { name: 'Bilan de votre séance', exact: true }).getByRole('button', { name: 'Plus tard', exact: true }).click(); await manual.getByRole('link', { name: 'Consulter la sortie' }).click();
  const region = page.getByRole('region', { name: 'Bilan de votre séance', exact: true }), url = page.url();
  const effort = region.getByLabel('Effort perçu (facultatif)'), comment = region.getByLabel('Commentaire personnel (facultatif)');
  await expect(comment).toHaveValue('Commentaire seul');
  await expect(effort.locator('option')).toHaveText(['Non renseigné', 'Facile', 'Modérée', 'Difficile', 'Très difficile']);
  await expect(region.getByRole('radio')).toHaveCount(0);
  for (let visit = 0; visit < 2; visit++) {
    await page.getByRole('link', { name: 'Revenir à l’historique', exact: true }).click(); await expect(region).toHaveCount(0);
    await page.goto(url); await expect(region).toHaveCount(1); await expect(comment).toHaveValue('Commentaire seul');
  }
  await effort.selectOption('easy'); await region.getByRole('button', { name: 'Enregistrer', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(region.getByRole('status')).toContainText('Votre bilan a été enregistré.');
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0); await expect(effort).toHaveValue('easy');
  const other = await context.newPage(); await other.goto(url); await expect(other.locator('.splash-screen')).toHaveCount(0);
  const otherRegion = other.getByRole('region', { name: 'Bilan de votre séance', exact: true });
  await expect(otherRegion.getByLabel('Effort perçu (facultatif)')).toHaveValue('easy');
  await expect(other.locator('.app-shell')).toHaveJSProperty('inert', false);
  await other.bringToFront();
  await otherRegion.getByLabel('Commentaire personnel (facultatif)').click();
  await otherRegion.getByLabel('Commentaire personnel (facultatif)').fill('Brouillon conservé');
  await expect(otherRegion.getByText('18/2000 caractères',{exact:true})).toBeVisible();
  await effort.selectOption('hard'); await region.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(region.getByRole('status')).toContainText('Votre bilan a été enregistré.');
  await expect(otherRegion.getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Brouillon conservé');
  await expect(otherRegion.getByRole('status')).toContainText('Les informations ont changé');
  await otherRegion.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(otherRegion.getByRole('alert')).toContainText('changé');
  await expect(otherRegion.getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Brouillon conservé');
  await otherRegion.getByRole('button', { name: 'Recharger le bilan' }).click();
  await expect(otherRegion.getByLabel('Effort perçu (facultatif)')).toHaveValue('hard');
  await effort.selectOption(''); await comment.fill(''); await region.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(otherRegion.getByLabel('Commentaire personnel (facultatif)')).toHaveValue('');
  await expect(otherRegion.getByLabel('Effort perçu (facultatif)')).toHaveValue('');
  for (const theme of ['AIR-KLM Day flight', 'Midnight Garage']) {
    await page.getByRole('navigation').getByRole('link', { name: 'Paramètres' }).click();
    await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption({ label: theme }); await page.goto(url);
    await expect(effort).toHaveValue(''); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await other.close(); expect(errors).toEqual([]);
});
