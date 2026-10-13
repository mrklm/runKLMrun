import { test, expect } from '@playwright/test';

test('bilan, verrou entre onglets, confirmation et consultation sans détails', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('./#/parametres');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  // Base du contexte Playwright isolé ; aucune donnée du navigateur utilisateur.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('runklmrun');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(['sessions', 'details'], 'readwrite');
        tx.objectStore('sessions').add({ id: 'retention-synthetic', title: 'Sortie synthétique ancienne', date: '2000-01-01', durationSeconds: 600, distanceMeters: 2000 });
        tx.objectStore('details').add({ id: 'retention-synthetic', heartRate: [{ timeSeconds: 0, value: 140 }] });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });
  const count = () => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('runklmrun');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('details'), result = tx.objectStore('details').count();
      tx.oncomplete = () => { db.close(); resolve(result.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  expect(await count()).toBe(1);
  const section = page.getByRole('region', { name: 'Conservation des données détaillées' });
  await section.getByRole('button', { name: 'Actualiser le bilan' }).click();
  await expect(section.getByRole('status')).toContainText('Bilan actualisé');
  await section.getByRole('button', { name: 'Alléger mon historique' }).click();
  await expect(section.getByRole('button', { name: 'Confirmer et activer' })).toBeDisabled();
  await section.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(await count()).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('runklmrun-detail-retention-v1'))).toBeNull();

  const other = await context.newPage(); await other.goto('./#/');
  // Un autre onglet détient réellement le même verrou navigateur.
  await other.evaluate(() => new Promise<void>(resolve => {
    void navigator.locks.request('runklmrun-retention:runklmrun', async () => {
      resolve(); await new Promise<void>(release => { window.addEventListener('release-retention', () => release(), { once: true }); });
    });
  }));
  await section.getByRole('button', { name: 'Alléger mon historique' }).click();
  await section.getByRole('checkbox').check();
  await section.getByRole('button', { name: 'Confirmer et activer' }).click();
  await expect(section.getByRole('status')).toContainText('autre onglet');
  expect(await count()).toBe(1);
  await other.evaluate(() => window.dispatchEvent(new Event('release-retention')));
  await other.close();

  await section.getByRole('button', { name: 'Alléger mon historique' }).click();
  await section.getByRole('checkbox').check();
  await section.getByRole('button', { name: 'Confirmer et activer' }).click();
  await expect(section.getByRole('status')).toContainText('1 détails supprimés');
  expect(await count()).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('runklmrun-detail-retention-v1')!).enabled)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Historique', exact: true }).click();
  await page.getByRole('link', { name: /Sortie synthétique ancienne/ }).click();
  await expect(page.getByRole('heading', { name: 'Informations générales' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Détails indisponibles' })).toBeVisible();
  // Simule une nouvelle échéance sur le contexte synthétique après activation.
  await page.evaluate(async () => {
    localStorage.setItem('runklmrun-detail-retention-v1', JSON.stringify({ enabled: true, checkedAt: 0 }));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('runklmrun');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('details', 'readwrite');
        tx.objectStore('details').put({ id: 'retention-synthetic' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });
  expect(await count()).toBe(1);
  await page.reload();
  await expect.poll(count).toBe(0);

});
