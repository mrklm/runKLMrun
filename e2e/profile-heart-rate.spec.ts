import { readFile } from 'node:fs/promises';
import { test, expect } from './helpers/protected-test';
import { readBackupFile } from '../src/backup/compression';

const open = async (page: import('@playwright/test').Page) => {
  await page.goto('./#/parametres'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const section = page.getByRole('region', { name: 'Profils' }), panel = section.locator('> details');
  if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
  return section;
};

test('fréquence cardiaque du profil : saisie, contrôle, relecture et sauvegarde', async ({ page }) => {
  const section = await open(page);
  await section.getByRole('button', { name: 'Modifier', exact: true }).click();
  await section.getByLabel('Fréquence cardiaque au repos (bpm)').fill('110');
  await section.getByLabel('Fréquence cardiaque maximale (bpm)').fill('105');
  await section.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(section.getByRole('alert')).toContainText('inférieure à la fréquence cardiaque maximale');
  await expect(section.getByLabel('Fréquence cardiaque au repos (bpm)')).toHaveValue('110');
  await section.getByLabel('Fréquence cardiaque au repos (bpm)').fill('55');
  await section.getByLabel('Fréquence cardiaque maximale (bpm)').fill('175');
  await section.getByLabel('Coefficients de calcul de la charge').selectOption('male');
  await section.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(section.getByText('Profil modifié.', { exact: true })).toBeVisible();
  await page.reload(); const again = await open(page);
  await again.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(again.getByLabel('Fréquence cardiaque au repos (bpm)')).toHaveValue('55');
  await expect(again.getByLabel('Fréquence cardiaque maximale (bpm)')).toHaveValue('175');
  await expect(again.getByLabel('Coefficients de calcul de la charge')).toHaveValue('male');
  await again.getByRole('button', { name: 'Annuler' }).click();
  const data = page.getByRole('region', { name: 'Données', exact: true }).locator('details').filter({ has: page.getByText('Données et sauvegardes', { exact: true }) });
  if (await data.getAttribute('open') === null) await data.locator(':scope > summary').click();
  const backups = data.locator('.backups');
  const download = page.waitForEvent('download');
  await backups.getByRole('button', { name: 'Exporter mes données' }).click();
  const exported = await readBackupFile(new Blob([new Uint8Array(await readFile((await (await download).path())!))]));
  expect(exported.formatVersion).toBe(10);
  expect(exported.data.runnerProfile).toMatchObject({ restingHeartRate: 55, maxHeartRate: 175, loadCoefficients: 'male' });
});
