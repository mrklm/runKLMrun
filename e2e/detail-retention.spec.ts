import { test, expect, type Page } from '@playwright/test';
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

test('entretien au démarrage, verrou entre onglets et consultation sans détails', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('./#/parametres');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  const databaseName = await writableActiveDatabase(page);
  const other = await context.newPage(); await other.goto('./#/');
  await expect(other.locator('.splash-screen')).toHaveCount(0);
  await expect(other.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  // Un autre onglet détient réellement le même verrou navigateur avant l'injection de la fixture.
  await other.evaluate(async databaseName => {
    const { retentionLockName } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/operation-lock.ts');
    let acquired!: () => void;
    const lockAcquired = new Promise<void>(resolve => { acquired = resolve; });
    (window as Window & { retentionLock?: Promise<void> }).retentionLock = navigator.locks.request(retentionLockName(databaseName), async () => {
      acquired();
      await new Promise<void>(release => { window.addEventListener('release-retention', () => release(), { once: true }); });
    });
    await lockAcquired;
  }, databaseName);
  // Base du contexte Playwright isolé ; aucune donnée du navigateur utilisateur.
  await page.evaluate(async databaseName => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(databaseName), tx = db.transaction(['sessions', 'details'], 'readwrite');
    await tx.objectStore('sessions').add({ id: 'retention-synthetic', title: 'Sortie synthétique ancienne', date: '2000-01-01', durationSeconds: 600, distanceMeters: 2000 });
    await tx.objectStore('details').add({ id: 'retention-synthetic', heartRate: [{ timeSeconds: 0, value: 140 }] });
    await tx.done;
    db.close();
  }, databaseName);
  const count = () => page.evaluate(async databaseName => {
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db = await openDatabase(databaseName);
    try { return await db.count('details'); } finally { db.close(); }
  }, databaseName);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Conservation des données détaillées' }) });
  await expect(section.getByRole('button')).toHaveCount(0);
  await expect.poll(count).toBe(1);
  await expect.poll(async () => other.evaluate(async databaseName => {
    const { retentionLockName } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/operation-lock.ts');
    return (await navigator.locks.query()).held.some(lock => lock.name === retentionLockName(databaseName));
  }, databaseName)).toBe(true);
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  expect(await count()).toBe(1);
  await other.evaluate(() => window.dispatchEvent(new Event('release-retention')));
  await other.close();

  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect.poll(count).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByText('Historique des courses', { exact: true }).click();
  await page.locator('.courses-history').getByRole('link', { name: /Sortie synthétique ancienne/ }).click();
  await expect(page.getByRole('heading', { name: 'Informations générales' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Détails indisponibles' })).toBeVisible();
  // Simule une nouvelle échéance sur le contexte synthétique après activation.
  await page.evaluate(async databaseName => {
    const { retentionKeyForDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/detail-retention.ts');
    const { openDatabase } = await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    localStorage.setItem(retentionKeyForDatabase(databaseName), JSON.stringify({ enabled: true, checkedAt: 0 }));
    const db = await openDatabase(databaseName), tx = db.transaction('details', 'readwrite');
    await tx.objectStore('details').put({ id: 'retention-synthetic' });
    await tx.done;
    db.close();
  }, databaseName);
  expect(await count()).toBe(1);
  await page.reload();
  await expect.poll(count).toBe(0);

});
