import { test, expect } from '@playwright/test';
test.use({ timezoneId: 'America/Los_Angeles' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-04T01:00:00Z')); // 3 janvier localement
  await page.goto('./'); await expect(page.getByText('Votre histoire commence ici')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('runklmrun', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction(['sessions', 'details'], 'readwrite');
    ['2025-12-27', '2025-12-28', '2026-01-03', '2026-01-04', '2024-02-29'].forEach(date => tx.objectStore('sessions').put({ id: date, title: `Synthétique ${date}`, date, durationSeconds: 600, distanceMeters: 1000, cardioLoad: 15 }));
    const samples = Array.from({ length: 10 }, (_, i) => ({ timeSeconds: i, value: 100 + i }));
    tx.objectStore('details').put({ id: '2026-01-03', heartRate: samples, altitude: samples, speed: samples.map(p => ({ ...p, value: 3 })), cadence: samples.map(p => ({ ...p, value: 80 })) });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }); await page.reload();
});
test('filtres réels, calendrier local et agrégations des graphiques', async ({ page }) => {
  await expect(page.locator('.hero')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Statistiques' }).click();
  const count = page.locator('.statistics-metrics > div').filter({ hasText: 'Nombre de séances' }).locator('dd');
  await expect(page.getByRole('combobox', { name: 'Période', exact: true })).toHaveValue('week');
  await expect(count).toHaveText('2');
  await expect(page.getByRole('status')).toContainText('28/12/2025 – 03/01/2026');
  await expect(page.getByRole('heading', { name: 'Distance parcourue par jour (km)' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('month');
  await expect(page.getByRole('combobox', { name: 'Mois', exact: true })).toHaveValue('01'); await expect(count).toHaveText('2');
  await page.getByRole('combobox', { name: 'Année', exact: true }).selectOption('2024'); await page.getByRole('combobox', { name: 'Mois', exact: true }).selectOption('02');
  await expect(count).toHaveText('1');
  await page.getByRole('combobox', { name: 'Mois', exact: true }).selectOption('03'); await expect(page.getByText('Aucune séance pour cette période')).toBeVisible();
  await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('year');
  await expect(page.getByRole('combobox', { name: 'Année', exact: true })).toHaveValue('2026'); await expect(count).toHaveText('2');
  await expect(page.getByRole('heading', { name: 'Distance parcourue par semaine (km)' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('all'); await expect(count).toHaveText('5');
  await expect(page.locator('.recharts-surface')).toHaveCount(3);
});
for (const width of [1280, 768, 390]) test(`fiche compacte sans débordement à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.getByRole('link', { name: 'Synthétique 2026-01-03' }).click();
  await expect(page.locator('.recharts-surface')).toHaveCount(4);
  await expect(page.locator('.session-secondary')).not.toHaveAttribute('open');
  await expect(page.getByText('Charge cardio Polar', { exact: true })).not.toBeVisible();
  const top = await page.locator('.chart-panel').first().evaluate(el => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(width >= 768 ? 850 : 1100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByText('Détails complémentaires', { exact: true }).click();
  await expect(page.getByText('Charge cardio Polar', { exact: true })).toBeVisible();
  await page.getByRole('slider').focus(); await page.getByRole('slider').press('ArrowRight');
  await expect(page.locator('.recharts-reference-line')).toHaveCount(4);
});
