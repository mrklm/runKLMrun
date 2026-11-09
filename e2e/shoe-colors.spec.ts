import { test, expect } from './helpers/protected-test';

test('icône de chaussure personnalisée puis remise aux couleurs d’origine', async ({ page }) => {
  await page.goto('./#/chaussures'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Nouvelle paire|Ajouter une paire de chaussures/ }).click();
  const form = page.locator('form.shoe-panel');
  await form.getByLabel('Modèle ou nom personnalisé').fill('Paire colorée');
  await form.getByLabel('Date de première utilisation', { exact: true }).fill('2025-02-07');
  const details = form.locator('details.shoe-colors');
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').click();
  await expect(details.locator('img.shoe-icon')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Couleurs d’origine' })).toBeDisabled();
  await details.getByLabel('Tige', { exact: true }).fill('#2b6cd6');
  await details.getByLabel('Lacets', { exact: true }).fill('#ffd400');
  await expect(details.locator('svg.shoe-icon')).toHaveAttribute('data-shoe-colors', '#2b6cd6 #ffd400 #ffffff #1b1e25 #1b1e25');
  await form.getByRole('button', { name: 'Enregistrer cette paire' }).click();

  const pair = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Paire colorée', exact: true }) });
  const icon = pair.locator('svg.shoe-icon');
  await expect(icon).toHaveAttribute('data-shoe-colors', '#2b6cd6 #ffd400 #ffffff #1b1e25 #1b1e25');
  expect((await icon.boundingBox())?.width).toBeCloseTo(100, 0);

  await page.goto('./#/'); await expect(page.locator('.home-shoe-summary svg.shoe-icon')).toBeVisible();

  await page.goto('./#/chaussures');
  await pair.getByRole('button', { name: 'Modifier cette paire' }).click();
  await expect(form.getByLabel('Modèle ou nom personnalisé')).toBeFocused(); await expect(form).toBeInViewport();
  await form.locator('details.shoe-colors summary').click();
  await form.getByRole('button', { name: 'Couleurs d’origine' }).click();
  await form.getByRole('button', { name: 'Enregistrer cette paire' }).click();
  await expect(pair.locator('img.shoe-icon')).toBeVisible(); await expect(pair.locator('svg.shoe-icon')).toHaveCount(0);
});
