import { test, expect } from './helpers/protected-test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readBackupFile } from '../src/backup/compression';
import { activeDatabase } from './helpers/active-database';

async function writableActiveDatabase(page: Page) {
  await page.evaluate(async () => {
    const root = '/runKLMrun/src/storage/';
    const { bootstrapProfiles } = await import(/* @vite-ignore */ `${root}profile-bootstrap.ts`);
    const { isProfileActive, profileDatabaseName } = await import(/* @vite-ignore */ `${root}profile-registry.ts`);
    const { DATABASE_NAME, openDatabase } = await import(/* @vite-ignore */ `${root}database-connection.ts`);
    const { active } = await bootstrapProfiles();
    if (!isProfileActive(active) || active.databaseName !== profileDatabaseName(active.id) || active.databaseName === DATABASE_NAME) {
      throw new Error('Base du profil actif invalide.');
    }
    if ((await indexedDB.databases()).some(database => database.name === active.databaseName)) return;
    const database = await openDatabase(active.databaseName);
    database.close();
  });
  return activeDatabase(page);
}
async function openShoesInSettings(page: Page) {
  const panel = page.locator('section[aria-labelledby="settings-shoes-title"] > details');
  await panel.locator(':scope > summary').click();
  await expect(panel).toHaveAttribute('open', '');
  return panel;
}
async function openBackupsInSettings(page: Page) {
  const panel = page.locator('section[aria-labelledby="settings-data-title"] > details');
  await panel.locator(':scope > summary').click();
  await expect(panel).toHaveAttribute('open', '');
}

test('première utilisation libre, modification, attribution explicite et sauvegarde sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/chaussures'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  const databaseName = await writableActiveDatabase(page);
  await page.evaluate(async databaseName => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(databaseName), tx = db.transaction('sessions', 'readwrite');
    for (const [id, date, distanceMeters] of [['shoe-run-1', '2025-02-07', 5000], ['shoe-run-2', '2025-02-08', 7000]] as const) {
      await tx.objectStore('sessions').put({ id, title: id, date, durationSeconds: 1800, distanceMeters });
    }
    await tx.done; db.close();
  }, databaseName);
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajouter une paire de chaussures' }).click();
  const form = page.locator('form');
  await form.getByLabel('Modèle ou nom personnalisé').fill('Paire du littoral');
  await form.getByLabel('Date de première utilisation', { exact: true }).fill('2025-02-07');
  await expect(form.getByLabel('Date de première utilisation', { exact: true })).toHaveAttribute('type', 'date');
  await expect(form.getByLabel('Date d’achat (facultative)', { exact: true })).toHaveValue('');
  await form.getByLabel('Limite personnelle (km, facultative)', { exact: true }).fill('10');
  await expect(form.getByLabel(/Seuil préventif/)).toHaveCount(0);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Enregistrer cette paire' }).click();
  const pair = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Paire du littoral', exact: true }) });
  await expect(pair.getByText('07/02/2025', { exact: true })).toBeVisible();
  await expect(pair.getByText('Séances associées', { exact: true }).locator('..').locator('dd')).toHaveText('0');
  await pair.getByRole('button', { name: 'Modifier cette paire' }).click();
  await form.getByLabel('Date de première utilisation', { exact: true }).fill('2025-02-06');
  await form.getByRole('button', { name: 'Enregistrer cette paire' }).click();
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(pair.getByText('06/02/2025', { exact: true })).toBeVisible();
  await expect(pair.getByText('Séances associées', { exact: true }).locator('..').locator('dd')).toHaveText('0');
  const period = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Attribuer une paire par période', exact: true }) });
  await period.getByLabel('Date de début', { exact: true }).fill('2025-02-07');
  await period.getByLabel('Date de fin', { exact: true }).fill('2025-02-08');
  await period.getByLabel('Paire concernée').selectOption({ label: 'Paire du littoral' });
  await period.getByRole('button', { name: 'Prévisualiser l’attribution' }).click();
  await expect(period.getByRole('button', { name: 'Confirmer l’attribution' })).toBeDisabled();
  await expect(pair.getByText('Séances associées', { exact: true }).locator('..').locator('dd')).toHaveText('0');
  await period.getByRole('checkbox', { name: 'Je confirme cette attribution.' }).check();
  await period.getByRole('button', { name: 'Confirmer l’attribution' }).click();
  await expect(pair.getByText('Kilométrage cumulé').locator('..').locator('dd')).toHaveText('12 km');
  await expect(pair.getByText(/Limite atteinte/)).toBeVisible();
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Gérer les chaussures : Paire du littoral, 12 km / 10 km', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Paramètres', exact: true }).click();
  await openShoesInSettings(page);
  await pair.getByRole('button', { name: 'Archiver cette paire' }).click();
  await expect(pair.getByRole('button', { name: 'Réactiver cette paire' })).toBeVisible();
  await expect(pair.getByText('Kilométrage cumulé').locator('..').locator('dd')).toHaveText('12 km');
  await expect(pair.getByText(/Limite atteinte/)).toBeVisible();
  await pair.getByRole('button', { name: 'Réactiver cette paire' }).click();
  await page.goto('./#/seance/shoe-run-1'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const association = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Chaussures de cette séance' }) });
  await expect(association.getByText('Paire du littoral', { exact: true }).first()).toBeVisible();
  await association.getByLabel('Paire', { exact: true }).selectOption('');
  await association.getByRole('button', { name: 'Enregistrer l’association' }).click();
  await expect(association.getByText('Aucune paire associée.')).toBeVisible();
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await openBackupsInSettings(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mes données', exact: true }).click();
  const download = await downloading;
  const backup = await readBackupFile(new Blob([new Uint8Array(await readFile((await download.path())!))]));
  expect(backup.formatVersion).toBe(2);
  expect(backup.data.shoes![0].firstUseDate).toBe('2025-02-06');
  expect(backup.data.shoeAssignments).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('propose la paire par défaut après un import, sans attribuer les doublons', async ({ page }) => {
  await page.goto('./#/historique'); await expect(page.locator('.splash-screen')).toHaveCount(0);await page.getByText('Importer des activités',{exact:true}).click();
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  const databaseName = await writableActiveDatabase(page);
  await page.evaluate(async databaseName => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(databaseName), tx = db.transaction('shoes', 'readwrite');
    await tx.objectStore('shoes').put({ id: 'default-synthetic', name: 'Paire proposée', firstUseDate: '2025-02-07', status: 'active', isDefault: true, revision: 1 });
    await tx.done; db.close();
  }, databaseName);
  const xml = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="${new Date().toISOString()}"><TotalTimeSeconds>60</TotalTimeSeconds><DistanceMeters>100</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`;
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'synthetic.TCX', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await page.getByRole('button', { name: 'Importer les séances', exact: true }).click();
  await page.getByRole('dialog', { name: 'Bilan de votre séance', exact: true }).getByRole('button', { name: 'Plus tard', exact: true }).click();
  const proposal = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Chaussures des nouvelles séances', exact: true }) }).last();
  await expect(proposal.getByRole('heading')).toBeVisible();
  await expect(proposal.getByLabel('Paire concernée', { exact: true })).toHaveValue('default-synthetic');
  const associations = () => page.evaluate(async databaseName => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(databaseName), count = await db.count('shoeAssignments'); db.close(); return count;
  }, databaseName);
  expect(await associations()).toBe(0);
  await proposal.getByRole('button', { name: 'Prévisualiser l’attribution' }).click();
  await proposal.getByRole('checkbox').check();
  await proposal.getByRole('button', { name: 'Confirmer l’attribution' }).click();
  await expect(proposal.getByRole('status')).toContainText('1 séance(s) associée(s)');
  await page.getByRole('button', { name: 'Importer les séances', exact: true }).click();
  await expect(page.getByText(/0 séances ajoutées.*1 doublons/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chaussures des nouvelles séances' })).toHaveCount(0);
  expect(await associations()).toBe(1);
  const historicalXml = xml.replace(/StartTime="[^"]+"/, 'StartTime="2020-02-07T12:00:00Z"');
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'historique.TCX', mimeType: 'application/xml', buffer: Buffer.from(historicalXml) });
  await page.getByRole('button', { name: 'Importer les séances', exact: true }).click();
  await page.getByRole('dialog', { name: 'Bilan de votre séance', exact: true }).getByRole('button', { name: 'Plus tard', exact: true }).click();
  await expect(page.getByText(/1 séances ajoutées.*0 doublons/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chaussures des nouvelles séances' })).toHaveCount(0);
  expect(await associations()).toBe(1);
});

test('modes automatique et manuel, conversion confirmée et choix direct dans l’historique', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'));
  await page.goto('./#/chaussures'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  const databaseName = await writableActiveDatabase(page);
  await page.evaluate(async databaseName => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(databaseName), tx = db.transaction(['sessions', 'shoes', 'shoeAssignments'], 'readwrite');
    for (const [id, date] of [['A', '2025-02-07'], ['B', '2026-10-15']]) await tx.objectStore('shoes').put({ id, name: `Paire ${id}`, firstUseDate: date, status: 'active', isDefault: false, revision: 1 });
    for (const [id, date] of [['r1', '2025-02-07'], ['r2', '2026-10-14'], ['r3', '2026-10-15']]) await tx.objectStore('sessions').put({ id, title: id, date, durationSeconds: 600, distanceMeters: 5000 });
    await tx.objectStore('shoeAssignments').put({ sessionId: 'r1', shoeId: 'B' });
    await tx.done; db.close();
  }, databaseName);
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const pairA = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Paire A', exact: true }) });
  await page.getByRole('radio', { name: 'Une seule paire — Automatique' }).click();
  await expect(page.getByRole('radio', { name: 'Une seule paire — Automatique' })).toBeChecked();
  await expect(pairA.getByText('Kilométrage cumulé').locator('..').locator('dd')).toHaveText('10 km');
  await expect(pairA.getByText(/20 mois et 8 jour/)).toBeVisible();
  await expect(page.getByText('Historique des chaussures', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Plusieurs paires — Par séance' }).click();
  await expect(page.getByRole('radio', { name: 'Plusieurs paires — Par séance' })).toBeChecked();
  await expect(pairA.getByText('Kilométrage cumulé').locator('..').locator('dd')).toHaveText('0 km');
  await page.getByRole('button', { name: 'Reprendre les associations calculées par dates' }).click();
  await expect(page.getByText(/2 séance\(s\) · 10 km/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmer la conversion' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Je confirme la conversion en associations manuelles.' }).check();
  await page.getByRole('button', { name: 'Confirmer la conversion' }).click();
  await expect(pairA.getByText('Kilométrage cumulé').locator('..').locator('dd')).toHaveText('5 km');
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByText('Historique des courses', { exact: true }).click();
  const card = page.locator('li').filter({ has: page.getByRole('link', { name: 'r2', exact: true }) });
  const selector = card.getByLabel('Chaussures utilisées', { exact: true });
  await expect(selector).toHaveValue('A');
  await selector.selectOption('B'); await expect(selector).toHaveValue('B');
  await selector.selectOption(''); await expect(selector).toHaveValue('');
  await page.getByRole('navigation').getByRole('link', { name: 'Paramètres', exact: true }).click();
  const shoesInSettings = await openShoesInSettings(page);
  const pairAInSettings = shoesInSettings.locator('section.shoe-panel').filter({ has: page.getByRole('heading', { name: 'Paire A', exact: true }) });
  await page.getByRole('radio', { name: 'Une seule paire — Automatique' }).click();
  await expect(page.getByRole('radio', { name: 'Une seule paire — Automatique' })).toBeChecked();
  await expect(pairAInSettings.getByText('Kilométrage cumulé').locator('..').locator('dd')).toHaveText('10 km');
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await openShoesInSettings(page);
  await expect(page.getByRole('radio', { name: 'Une seule paire — Automatique' })).toBeChecked();
});

for (const width of [390, 1280]) test(`ancienne marge ignorée, modification de limite et affichages à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./#/chaussures');
  await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false);
  const database = await writableActiveDatabase(page);
  await page.evaluate(async database => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(database), tx = db.transaction(['shoes', 'sessions', 'shoeAssignments'], 'readwrite');
    await tx.objectStore('shoes').put({ id: 'legacy-shoe', name: 'Paire synthétique ancienne', brand: 'Marque synthétique', firstUseDate: '2026-10-01', purchaseDate: '2026-09-30', status: 'active', isDefault: true, limitKm: 1500, warningKm: 1500, revision: 1 });
    await tx.objectStore('sessions').put({ id: 'legacy-run', title: 'Sortie synthétique', date: '2026-10-20', durationSeconds: 7200, distanceMeters: 26000 });
    await tx.objectStore('shoeAssignments').put({ sessionId: 'legacy-run', shoeId: 'legacy-shoe' });
    await tx.done; db.close();
  }, database);
  await page.reload();
  const card = page.locator('.shoe-panel').filter({ has: page.getByRole('heading', { name: 'Paire synthétique ancienne', exact: true }) });
  await expect(card.getByText(/Marque synthétique.*Normal/)).toBeVisible();
  await expect(page.getByText('Seuil préventif atteint', { exact: false })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(page.locator('.home-shoe-distance')).toHaveText(/26 km \/ 1\s?500 km/);
  await page.getByRole('link', { name: 'Sortie synthétique', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Paire', exact: true })).toHaveValue('legacy-shoe');
  await expect(page.getByText('Seuil préventif atteint', { exact: false })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Paramètres', exact: true }).click();
  await openShoesInSettings(page);
  for (const limit of ['20', '']) {
    await card.getByRole('button', { name: 'Modifier cette paire', exact: true }).click();
    const form = page.locator('form.shoe-panel');
    await expect(form.getByLabel(/Seuil préventif/)).toHaveCount(0);
    await expect(form.getByLabel('Marque (facultative)', { exact: true })).toHaveValue('Marque synthétique');
    await expect(form.getByLabel('Date d’achat (facultative)', { exact: true })).toHaveValue('2026-09-30');
    await form.getByLabel('Limite personnelle (km, facultative)', { exact: true }).fill(limit);
    await form.getByRole('button', { name: 'Enregistrer cette paire', exact: true }).click();
    await expect(card.getByText(limit ? /Limite atteinte/ : /Marque synthétique.*Normal/)).toBeVisible();
  }
  const stored = await page.evaluate(async database => {
    const { createShoeRepository } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/shoes.ts');
    return createShoeRepository(database).list();
  }, database);
  expect(stored.shoes[0]).toMatchObject({ warningKm: 1500, name: 'Paire synthétique ancienne', brand: 'Marque synthétique', firstUseDate: '2026-10-01', purchaseDate: '2026-09-30' });
  expect(stored.shoes[0].limitKm).toBeUndefined();
  expect(stored.shoeAssignments).toEqual([{ sessionId: 'legacy-run', shoeId: 'legacy-shoe' }]);
  await page.getByRole('navigation').getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(page.locator('.home-shoe-distance')).toHaveText('26 km');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
