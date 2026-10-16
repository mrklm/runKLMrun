import { test, expect } from '@playwright/test';
test.use({ timezoneId: 'America/Los_Angeles' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T01:00:00Z'));
  await page.goto('./#/entrainement');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByText('Aucune séance enregistrée sur cette période.', { exact: true })).toBeVisible();
});
for (const width of [390, 1280]) test(`bilan, périodes et accès à la séance à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('runklmrun'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction('sessions', 'readwrite');
    ['2026-10-10', '2026-09-01', '2026-08-01'].forEach((date, i) => tx.objectStore('sessions').put({ id: `test/${i}`, title: `Sortie synthétique ${i}`, date, durationSeconds: 3600, distanceMeters: (i + 1) * 1000 }));
    tx.objectStore('sessions').put({ id: 'missing', title: 'Mesures absentes', date: '2026-10-09' });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  });
  await page.reload();
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  const period = page.getByRole('combobox', { name: 'Période du bilan' });
  const count = page.locator('.training-metrics > div').filter({ has: page.getByText('Séances réalisées', { exact: true }) }).locator('dd').first();
  await expect(period).toHaveValue('8'); await expect(count).toHaveText('3');
  await expect(page.getByText('Distance connue pour 2 séances sur 3.', { exact: false })).toBeVisible();
  await expect(page.getByText('Moyenne partielle sur 8 semaines.')).toHaveCount(2);
  await period.selectOption('4'); await expect(count).toHaveText('2');
  await period.focus(); await period.press('ArrowDown');
  await expect(period).toHaveValue('8'); await expect(count).toHaveText('3');
  await period.selectOption('12'); await expect(count).toHaveText('4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Consulter cette séance' }).click();
  await expect(page).toHaveURL(/#\/seance\/test%2F2$/);
  await expect(page.getByRole('heading', { name: 'Sortie synthétique 2' })).toBeVisible();
});
test('état vide explicite et sélection utilisable', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Votre activité récente' })).toBeVisible();
  await expect(page.getByText('Aucune séance à date exploitable enregistrée jusqu’à aujourd’hui.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Période du bilan' }).selectOption('4');
  await expect(page.locator('.training-history').getByRole('status')).toContainText('13/09/2026');
  await expect(page.getByText('Ce bilan décrit les séances enregistrées.', { exact: false })).toBeVisible();
});
test('réutilise les résumés sans lecture des détails lors des changements de période', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { storageReads: string[] }).storageReads = calls;
    const getAll = IDBObjectStore.prototype.getAll, get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.getAll = function (...args) { calls.push(`all:${this.name}`); return getAll.apply(this, args); };
    IDBObjectStore.prototype.get = function (...args) { calls.push(`get:${this.name}`); return get.apply(this, args); };
  });
  await page.reload();
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  const period = page.getByRole('combobox', { name: 'Période du bilan' });
  await expect(period).toBeVisible();
  await period.selectOption('4'); await period.selectOption('12');
  await page.getByRole('navigation').getByRole('link', { name: 'Historique' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Coach' }).click();
  expect((await page.evaluate(() => (window as unknown as { storageReads: string[] }).storageReads)).filter(call => call.endsWith(':sessions') || call.endsWith(':details'))).toEqual(['all:sessions', 'all:sessions']); // StrictMode rejoue l’effet initial en développement.
});
test('présente l’erreur commune de stockage sans faux bilan vide', async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.getAll = function () { throw new Error('Erreur synthétique de lecture'); };
  });
  await page.reload();
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Stockage local indisponible');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Votre activité récente' })).toHaveCount(0);
});
