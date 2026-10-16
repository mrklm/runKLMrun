import { test, expect } from '@playwright/test';
test('diagnostic isolé : lecture seule, sans démarrage de l’application', async ({ page }) => {
  await page.goto('diagnostic.html');
  await expect(page.locator('#diagnostic-parameters')).toHaveValue(/fixedDistanceMeters/);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('runklmrun', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('sessions', { keyPath: 'id' });
        r.result.createObjectStore('details', { keyPath: 'id' });
      };
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result, tx = db.transaction(['sessions', 'details'], 'readwrite');
        tx.objectStore('sessions').put({ id: 'fictif', date: '2020-01-01', distanceMeters: 5000, ascentMeters: 0 });
        tx.objectStore('details').put({ id: 'fictif', samples: [1, 2] });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
  await page.locator('#diagnostic-run').click();
  await expect(page.locator('#diagnostic-output')).toHaveValue(/"total": 1/);
  expect(await page.evaluate(async () => new Promise(resolve => {
    const r = indexedDB.open('runklmrun');
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction('details', 'readonly');
      const q = tx.objectStore('details').get('fictif');
      tx.oncomplete = () => { db.close(); resolve(q.result); };
    };
  }))).toEqual({ id: 'fictif', samples: [1, 2] });
});
