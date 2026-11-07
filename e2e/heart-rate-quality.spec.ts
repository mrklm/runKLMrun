import { expect, test } from './helpers/protected-test';
import { activeDatabase } from './helpers/active-database';

// Séances synthétiques dans un profil neuf ; aucune activité réelle.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-04T12:00:00Z'));
  await page.goto('./');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif' })).toBeVisible();
  await expect(page.getByText('Votre histoire commence ici')).toBeVisible();
  const databaseName = await activeDatabase(page);
  await page.evaluate(async databaseName => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['sessions', 'details'], 'readwrite');
    const gps = Array.from({ length: 300 }, (_, timeSeconds) => ({ timeSeconds, latitude: 45 + timeSeconds / 10000, longitude: 4 + timeSeconds / 10000 }));
    const heart = (value: (i: number) => number | null) => Array.from({ length: 300 }, (_, timeSeconds) => ({ timeSeconds, value: value(timeSeconds) }));
    for (const id of ['hr-pocket', 'hr-spike', 'hr-normal'])
      tx.objectStore('sessions').put({ id, title: id, date: '2026-01-02', startTime: '2026-01-02T10:00:00Z', durationSeconds: 300, distanceMeters: 900, source: 'tcx', sport: 'RUNNING' });
    tx.objectStore('details').put({ id: 'hr-pocket', gps });
    tx.objectStore('details').put({ id: 'hr-spike', gps, heartRate: heart(i => i === 150 ? 230 : 140 + (i % 7)) });
    tx.objectStore('details').put({ id: 'hr-normal', gps, heartRate: heart(i => 140 + (i % 7)) });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, databaseName);
});

for (const width of [390, 1280]) test(`qualité FC sur la fiche à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const notice = page.getByRole('region', { name: 'Qualité de la fréquence cardiaque' });

  await page.goto('./#/seance/hr-pocket'); await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Aucune fréquence cardiaque n’a été enregistrée. La durée, la distance et le parcours restent utilisables.');
  await expect(page.getByText('0,9 km')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('./#/seance/hr-spike'); await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(notice).toContainText('Anomalies possibles, à interpréter avec prudence');
  await expect(notice).toContainText('1 pic isolé');
  await expect(notice).toContainText('Les mesures d’origine sont conservées sans modification.');
  await expect(page.getByText('Fréquence cardiaque', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await notice.scrollIntoViewIfNeeded();
  await expect(page.locator('.splash-screen')).toBeHidden({ timeout: 10000 });
  await page.screenshot({ path: `test-results/heart-rate-quality-${width}.png` });

  await page.goto('./#/seance/hr-normal'); await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Informations générales' })).toBeVisible();
  await expect(page.locator('.session-curves')).toBeVisible();
  await expect(notice).toHaveCount(0);
});
