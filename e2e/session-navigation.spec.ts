import { test, expect } from '@playwright/test';
let errors: string[];
test.beforeEach(async ({ page }) => {
  // Les fixtures de janvier doivent rester récentes face à la conservation des 30 jours.
  await page.clock.setFixedTime(new Date('2026-01-04T12:00:00Z'));
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByText('Votre histoire commence ici')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('runklmrun');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(['sessions', 'details'], 'readwrite');
    const id = 'polar:synthetic/a % é';
    tx.objectStore('sessions').put({ id, title: 'Sortie synthétique complète', date: '2026-01-02', startTime: '2026-01-02T10:00:00Z', durationSeconds: 600, distanceMeters: 1500 });
    tx.objectStore('sessions').put({ id: 'synthetic-empty', title: 'Sortie synthétique sans détails', date: '2026-01-01', durationSeconds: 900 });
    const samples = Array.from({ length: 50 }, (_, i) => ({ timeSeconds: i * 2, value: 140 + i % 10 }));
    tx.objectStore('details').put({ id, heartRate: samples, altitude: samples, cadence: samples.map(p => ({ ...p, value: 80 })), speed: samples.map(p => ({ ...p, value: 3 })) });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close();
  });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sortie synthétique complète', exact: true })).toBeVisible();
});
test.afterEach(() => { expect(errors).toEqual([]); });
for (const origin of ['Accueil', 'Historique']) {
  test(`ouvre la bonne séance depuis ${origin}, puis revient à l’historique`, async ({ page }) => {
    if (origin === 'Historique') { await page.getByRole('navigation').getByRole('link', { name: 'Courses' }).click(); await page.getByText('Historique des courses', { exact: true }).click(); }
    await page.getByRole('link', { name: 'Sortie synthétique complète', exact: true }).click();
    await expect(page).toHaveURL(/#\/seance\/polar%3Asynthetic%2Fa%20%25%20%C3%A9$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sortie synthétique complète', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Informations générales' })).toBeVisible();
    await expect(page.locator('.recharts-surface')).toHaveCount(4);
    await expect(page.getByRole('slider')).toBeVisible();
    await page.getByRole('slider').focus(); await page.getByRole('slider').press('ArrowRight');
    await expect(page.locator('.recharts-reference-line')).toHaveCount(4);
    await page.getByRole('link', { name: 'Revenir à l’historique' }).click();
    await expect(page).toHaveURL(/#\/courses\/historique$/);
    await expect(page.getByRole('link', { name: 'Sortie synthétique complète', exact: true })).toBeVisible();
  });
  test(`ouvre la carte en cliquant sur ses informations depuis ${origin}`, async ({ page }) => {
    if (origin === 'Historique') { await page.getByRole('navigation').getByRole('link', { name: 'Courses' }).click(); await page.getByText('Historique des courses', { exact: true }).click(); }
    await page.locator('.session-card').filter({ hasText: 'Sortie synthétique complète' }).getByText('0 h 10 min 0 s').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sortie synthétique complète', exact: true })).toBeVisible();
  });
}
test('ouvre une séance sans détails et permet le retour', async ({ page }) => {
  await page.getByRole('link', { name: 'Sortie synthétique sans détails' }).click();
  await expect(page.getByRole('heading', { name: 'Détails indisponibles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Informations générales' })).toBeVisible();
  await page.getByRole('link', { name: 'Revenir à l’historique' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible();
});
