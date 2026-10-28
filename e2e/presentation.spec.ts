import { test, expect } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';
test.use({ timezoneId: 'America/Los_Angeles' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-04T01:00:00Z')); // 3 janvier localement
  await page.goto('./'); await expect(page.getByText('Votre histoire commence ici')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Profil actif' })).toBeVisible();
  const databaseName = await activeDatabase(page);
  await page.evaluate(async databaseName => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(databaseName); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction(['sessions', 'details'], 'readwrite');
    ['2025-12-27', '2025-12-28', '2026-01-03', '2026-01-04', '2024-02-29'].forEach(date => tx.objectStore('sessions').put({ id: date, title: `Synthétique ${date}`, date, durationSeconds: 600, distanceMeters: 1000, cardioLoad: 15 }));
    const samples = Array.from({ length: 10 }, (_, i) => ({ timeSeconds: i, value: 100 + i }));
    tx.objectStore('details').put({ id: '2026-01-03', heartRate: samples, altitude: samples, speed: samples.map(p => ({ ...p, value: 3 })), cadence: samples.map(p => ({ ...p, value: 80 })) });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, databaseName); await page.reload();
});
test('filtres réels, calendrier local et agrégations des graphiques', async ({ page }) => {
  await expect(page.locator('.hero')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Courses' }).click();
  const count = page.locator('.statistics-metrics > div').filter({ hasText: 'Nombre de sorties' }).locator('dd');
  await expect(page.getByRole('combobox', { name: 'Période', exact: true })).toHaveValue('week');
  await expect(count).toHaveText('2');
  await expect(page.getByRole('status')).toContainText('28/12/2025 – 03/01/2026');
  await expect(page.getByRole('heading', { name: 'Calendrier mensuel' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('month');
  await expect(page.getByRole('combobox', { name: 'Mois', exact: true })).toHaveValue('01'); await expect(count).toHaveText('2');
  await page.getByRole('combobox', { name: 'Année', exact: true }).selectOption('2024'); await page.getByRole('combobox', { name: 'Mois', exact: true }).selectOption('02');
  await expect(count).toHaveText('1');
  await page.getByRole('combobox', { name: 'Mois', exact: true }).selectOption('03'); await expect(page.getByText('Aucune séance pour cette période')).toBeVisible();
  await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('year');
  await expect(page.getByRole('combobox', { name: 'Année', exact: true })).toHaveValue('2026'); await expect(count).toHaveText('2');
  await page.getByText('Évolution sur la période', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Distance parcourue par semaine (km)' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('all'); await expect(count).toHaveText('5');
  await expect(page.locator('.recharts-surface')).toHaveCount(3);
});
for (const width of [1280, 768, 390]) test(`fiche compacte sans débordement à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.getByRole('navigation').getByRole('link', { name: 'Courses' }).click();
  await page.getByText('Historique des courses', { exact: true }).click();
  await page.getByRole('link', { name: 'Synthétique 2026-01-03', exact: true }).click();
  await expect(page.locator('.recharts-surface')).toHaveCount(4);
  await expect(page.locator('.session-secondary')).not.toHaveAttribute('open');
  await expect(page.getByText('Charge cardio Polar', { exact: true })).not.toBeVisible();
  const route = page.getByRole('region', { name: 'Parcours GPS · Indisponible', exact: true });
  await expect(route.getByRole('button', { name: 'Parcours GPS · Indisponible', exact: true })).toHaveAttribute('aria-expanded', 'false');
  const charts = page.locator('.chart-panel');
  const cursor = page.getByRole('region', { name: 'Curseur temporel synchronisé', exact: true });
  const cursorBottom = await cursor.evaluate(el => el.getBoundingClientRect().bottom);
  const firstChartTop = await page.getByRole('region', { name: 'Fréquence cardiaque', exact: true }).evaluate(el => el.getBoundingClientRect().top);
  const shoeHeading = page.getByRole('heading', { name: 'Chaussures de cette séance', exact: true });
  await expect(shoeHeading).toHaveCount(1);
  const shoeTop = await shoeHeading.evaluate(el => el.getBoundingClientRect().top);
  const notes = page.locator('details').filter({ has: page.getByText('À propos des mesures', { exact: true }) });
  const notesTop = await notes.evaluate(el => el.getBoundingClientRect().top);
  expect(notesTop).toBeLessThan(shoeTop);
  for (const chart of await charts.all()) {
    expect(await chart.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(notesTop);
  }
  // .session-curves applique un gap de 12 px ; ±4 px couvre les arrondis de mise en page.
  const cursorToChartGap = firstChartTop - cursorBottom;
  test.info().annotations.push({ type: 'écart-curseur-premier-graphique', description: `${width}px : ${cursorToChartGap}px` });
  expect(cursorToChartGap).toBeGreaterThanOrEqual(8);
  expect(cursorToChartGap).toBeLessThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByText('Détails complémentaires', { exact: true }).click();
  await expect(page.getByText('Charge cardio Polar', { exact: true })).toBeVisible();
  await page.getByRole('slider').focus(); await page.getByRole('slider').press('ArrowRight');
  await expect(page.locator('.recharts-reference-line')).toHaveCount(4);
});
