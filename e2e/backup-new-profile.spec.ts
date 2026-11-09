import { test, expect } from './helpers/protected-test';
import type { Page } from '@playwright/test';
import { createBackup } from '../src/backup/format';
import { fixture } from '../src/backup/test-fixture';

const panel = (page: Page) => page.getByRole('region', { name: 'Données', exact: true }).locator('details').filter({ has: page.getByText('Données et sauvegardes', { exact: true }) });
const section = (page: Page) => panel(page).locator('.backups');
async function upload(page: Page, displayName?: string) {
  const document = await createBackup({ ...fixture(), ...(displayName ? { runnerProfile: { displayName, weightKg: 74 } } : {}) }, '1.5.0', '2026-10-10T10:00:00Z');
  await page.goto('./#/parametres'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  if (!await panel(page).evaluate((element: HTMLDetailsElement) => element.open)) await panel(page).locator('summary').click();
  const chooser = page.waitForEvent('filechooser');
  await section(page).getByRole('button', { name: 'Restaurer une sauvegarde', exact: true }).click();
  await (await chooser).setFiles({ name: 'synthetique.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(section(page).getByRole('heading', { name: 'Prévisualisation de la sauvegarde' })).toBeVisible();
}

test('nom différent : création d’un nouveau profil sans modifier le profil actif', async ({ page }) => {
  await upload(page, 'Clem');
  const s = section(page), activeName = (await page.getByRole('combobox', { name: 'Profil actif' }).locator('option:checked').textContent())!.trim();
  await expect(s.getByText('Cette sauvegarde provient du profil Clem.')).toBeVisible();
  await expect(s.getByRole('radio', { name: `Ajouter au profil ${activeName}` })).toBeChecked();
  await s.getByRole('radio', { name: 'Créer un nouveau profil' }).check();
  await expect(s.getByLabel('Pseudonyme du nouveau profil')).toHaveValue('Clem');
  await expect(s.getByRole('radio', { name: 'Fusionner les séances' })).toHaveCount(0);
  await s.getByRole('checkbox', { name: /^Je confirme la création du nouveau profil/ }).check();
  await s.getByRole('button', { name: 'Confirmer la restauration' }).click();
  await expect(s.getByRole('status')).toContainText(`Le profil Clem a été créé avec les données de la sauvegarde. Votre profil ${activeName} n’a pas été modifié.`);
  await expect(page.getByRole('combobox', { name: 'Profil actif' })).toHaveText(new RegExp(activeName));
  await expect(page.getByRole('combobox', { name: 'Profil actif' }).getByRole('option', { name: 'Clem' })).toHaveCount(1);
  await s.getByRole('button', { name: 'Utiliser le profil Clem' }).click();
  await expect(page.getByRole('combobox', { name: 'Profil actif' }).locator('option:checked')).toHaveText('Clem');
  await page.goto('./#/'); await expect(page.getByRole('region', { name: 'Dernière sortie', exact: true }).getByRole('link', { name: 'Sortie synthétique', exact: true })).toBeVisible();
});

test('même nom : aucune question de destination', async ({ page }) => {
  await page.goto('./#/parametres'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const name = (await page.getByRole('combobox', { name: 'Profil actif' }).locator('option:checked').textContent())!.trim();
  await upload(page, name);
  await expect(section(page).getByRole('radio', { name: 'Créer un nouveau profil' })).toHaveCount(0);
  await expect(section(page).getByRole('radio', { name: 'Fusionner les séances' })).toBeVisible();
});
