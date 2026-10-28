import { expect, test } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';

const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8ebed"/></svg>';
let tileRequests: string[], errors: string[], mapModules: string[];
test.beforeEach(async ({ page, context }) => {
  tileRequests = []; errors = []; mapModules = [];
  // Fixtures synthétiques et navigateur isolé ; aucune tuile externe réellement téléchargée.
  await context.route('https://tile.openstreetmap.org/**', async route => {
    tileRequests.push(route.request().url());
    await route.fulfill({ contentType: 'image/svg+xml', body: tile });
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/SessionMap')) mapModules.push(request.url()); });
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
    for (const id of ['map-route', 'map-empty', 'map-point', 'map-dateline'])
      tx.objectStore('sessions').put({ id, title: id, date: '2026-01-02', startTime: '2026-01-02T10:00:00Z', durationSeconds: 600 });
    const gps = [[0, 0], [.001, .001], [.002, .001], [null, null], [.003, .002], [.004, .004]]
      .map(([latitude, longitude], timeSeconds) => ({ timeSeconds, latitude, longitude }));
    tx.objectStore('details').put({ id: 'map-route', gps, heartRate: [{ timeSeconds: 0, value: 120 }, { timeSeconds: 10, value: 140 }] });
    tx.objectStore('details').put({ id: 'map-point', gps: [{ timeSeconds: 0, latitude: 0, longitude: 0 }] });
    tx.objectStore('details').put({ id: 'map-dateline', gps: [179, 179.5, -179.5, -179].map((longitude, timeSeconds) => ({ timeSeconds, latitude: 0, longitude })) });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, databaseName);
  await page.goto('./#/seance/map-empty'); await page.reload();
  await expect(page.locator('.splash-screen')).toHaveCount(0);
});
test.afterEach(() => { expect(errors).toEqual([]); });

for (const width of [390, 1280]) test(`carte automatique, segments, formulaires et navigation à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./#/seance/map-route');
  const panel = page.getByRole('region', { name: 'Parcours GPS', exact: true });
  await expect(panel.getByRole('heading', { name: 'Parcours GPS' })).toBeVisible();
  await expect(panel).not.toContainText('Votre tracé reste sur cet appareil');
  await expect(panel).not.toContainText('D : premier point GPS disponible');
  const map = page.getByTestId('session-map');
  await expect(map).toBeVisible(); await expect(map.locator('.leaflet-container')).toHaveCount(1);
  await expect(map.locator('path.session-map-route')).toHaveCount(2);
  await expect(map.getByTitle('Départ du parcours GPS', { exact: true })).toBeVisible();
  await expect(map.getByTitle('Arrivée du parcours GPS', { exact: true })).toBeVisible();
  await expect(map.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible();
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0);
  expect(tileRequests.every(url => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(url))).toBe(true);
  for (const marker of await map.locator('.leaflet-marker-icon').all()) {
    const box = (await marker.boundingBox())!, frame = (await map.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(frame.x); expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.y).toBeGreaterThanOrEqual(frame.y); expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
  }
  const original = (await map.locator('.leaflet-container').elementHandle())!;
  const feeling = page.getByRole('region', { name: 'Votre ressenti', exact: true });
  await feeling.getByRole('button', { name: 'Ajouter un ressenti ou un commentaire' }).click();
  await feeling.getByLabel('Effort perçu (facultatif)').selectOption('easy');
  await feeling.getByRole('button', { name: 'Enregistrer le ressenti' }).click();
  await expect(feeling.getByText('Facile', { exact: true })).toBeVisible();
  const training = page.getByRole('region', { name: 'Type d’entraînement', exact: true });
  await training.getByRole('button', { name: 'Ajouter un type d’entraînement' }).click();
  await training.getByRole('combobox').selectOption('hills');
  await training.getByRole('button', { name: 'Enregistrer le type', exact: true }).click();
  await expect(training.getByText('Côtes', { exact: true })).toBeVisible();
  expect(await original.evaluate(node => node.isConnected && node === document.querySelector('.leaflet-container'))).toBe(true);
  await expect(page.locator('.recharts-surface')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const toggle = panel.getByRole('button', { name: 'Parcours GPS', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('session-map')).toHaveCount(0);
  const requestsWhenClosed = tileRequests.length;
  await feeling.getByRole('button', { name: 'Modifier le ressenti ou le commentaire' }).click();
  await feeling.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByTestId('session-map')).toHaveCount(0);
  expect(tileRequests).toHaveLength(requestsWhenClosed);
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
  for (let visit = 0; visit < 3; visit++) {
    await page.getByRole('navigation').getByRole('link', { name: 'Accueil', exact: true }).click();
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Votre ressenti', exact: true })).toHaveCount(0);
    await page.goto('./#/seance/map-route');
    await expect(page.locator('.leaflet-container')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Votre ressenti', exact: true })).toHaveCount(1);
    await page.goto('./#/seance/map-point');
    await expect(page.getByRole('heading', { name: 'map-point', exact: true })).toBeVisible();
    await expect(page.locator('.leaflet-container')).toHaveCount(1);
    await expect(page.locator('path.session-map-route')).toHaveCount(0);
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  }
});

test('coordonnées absentes et point unique sans parcours inventé', async ({ page }) => {
  await page.goto('./#/seance/map-empty');
  const panel = page.getByRole('region', { name: 'Parcours GPS · Indisponible', exact: true });
  const toggle = panel.getByRole('button', { name: 'Parcours GPS · Indisponible', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toContainText('Coordonnées GPS indisponibles');
  await expect(page.getByTestId('session-map')).toHaveCount(0);
  expect(tileRequests).toHaveLength(0); expect(mapModules).toHaveLength(0);
  await page.goto('./#/seance/map-point');
  const pointPanel = page.getByRole('region', { name: 'Parcours GPS', exact: true });
  await expect(pointPanel.getByRole('button', { name: 'Parcours GPS', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(pointPanel).toContainText('Un seul point GPS disponible');
  await expect(page.getByTestId('session-map')).toBeVisible();
  await expect(page.locator('path.session-map-route')).toHaveCount(0);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
});

test('antiméridien : segments séparés et cadrage local', async ({ page }) => {
  await page.goto('./#/seance/map-dateline');
  await expect(page.locator('path.session-map-route')).toHaveCount(2);
  const xs = await page.locator('.leaflet-marker-icon').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
  expect(Math.abs(xs[0] - xs[1])).toBeGreaterThan(50);
  expect(Math.abs(xs[0] - xs[1])).toBeLessThan(1280);
});

test('tuiles indisponibles : tracé local et message de connexion', async ({ page, context }) => {
  await context.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('./#/seance/map-route');
  await expect(page.getByRole('status').filter({ hasText: 'Fond cartographique indisponible' })).toBeVisible();
  await expect(page.locator('path.session-map-route')).toHaveCount(2);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
});
