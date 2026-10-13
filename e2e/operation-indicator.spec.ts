import { test, expect } from '@playwright/test';
test('indicateur partagé : délai, fin immédiate, erreur et démontage', async ({ page }) => {
  await page.goto('./#/parametres');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.clock.install({ time: new Date('2026-10-14T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-14T12:00:01Z'));
  await page.evaluate(async () => {
    const reactUrl = '/runKLMrun/node_modules/.vite/deps/react.js';
    const domUrl = '/runKLMrun/node_modules/.vite/deps/react-dom_client.js';
    const indicatorUrl = '/runKLMrun/src/components/DelayedOperation.tsx';
    const reactModule = await import(reactUrl), domModule = await import(domUrl), { DelayedOperation } = await import(indicatorUrl);
    const React = reactModule.default ?? reactModule; const { createRoot } = domModule.default ?? domModule;
    const element = document.createElement('div'); element.id = 'synthetic-indicator'; document.body.append(element);
    const root = createRoot(element);
    Object.assign(window, { syntheticRender: (active: boolean) => root.render(React.createElement(DelayedOperation, { active }, 'Traitement synthétique…')), syntheticUnmount: () => root.unmount() });
  });
  const render = async (active: boolean) => { await page.evaluate(active => (window as unknown as { syntheticRender: (a: boolean) => void }).syntheticRender(active), active); await page.clock.runFor(1); };
  const indicator = page.locator('#synthetic-indicator');
  await render(true); await page.clock.runFor(200); await render(false); await page.clock.runFor(500);
  await expect(indicator).toBeEmpty();
  await render(true); await page.clock.runFor(398); await expect(indicator).toBeEmpty();
  await page.clock.runFor(5); await expect(indicator).toContainText('Traitement synthétique');
  // Comme dans les finally des opérations, succès et erreur remettent active à false.
  await render(false); await expect(indicator).toBeEmpty();
  await render(true); await page.clock.runFor(500); await render(false); await expect(indicator).toBeEmpty();
  await render(true); await page.evaluate(() => (window as unknown as { syntheticUnmount: () => void }).syntheticUnmount());
  await page.clock.runFor(500); await expect(indicator).toBeEmpty();
});
test('une erreur de sauvegarde ferme l’indicateur et libère les actions', async ({ page }) => {
  await page.goto('./#/parametres'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.evaluate(() => {
    class FailedWorker {
      onerror?: (event: { message: string }) => void;
      timer?: number;
      postMessage() { this.timer = window.setTimeout(() => this.onerror?.({ message: 'Échec synthétique' }), 1500); }
      terminate() { window.clearTimeout(this.timer); }
    }
    Object.defineProperty(window, 'Worker', { value: FailedWorker, configurable: true });
  });
  const backups = page.getByRole('region', { name: 'Données et sauvegardes', exact: true });
  await backups.getByRole('button', { name: 'Exporter mes données', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importer les séances', exact: true })).toBeDisabled();
  await expect(backups.getByText(/Lecture des données, préparation et compression/)).toBeVisible();
  await expect(backups.getByRole('alert')).toBeVisible();
  await expect(backups.getByText(/Lecture des données, préparation et compression/)).toHaveCount(0);
  await expect(backups.getByRole('button', { name: 'Exporter mes données', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Importer les séances', exact: true })).toBeEnabled();
});
