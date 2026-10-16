import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const version = `v${JSON.parse(readFileSync('package.json', 'utf8')).version}`;
test('splash initial de trois secondes, version commune et navigation interne', async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-10T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-10T12:00:01Z"));
  await page.goto('./');
  await expect(page.locator('.splash-screen')).toBeVisible();
  await expect(page.locator('.splash-version')).toHaveText(version);
  await expect(page.locator('.app-shell')).toHaveAttribute('inert');
  await page.clock.fastForward(2999);
  await expect(page.locator('.splash-screen')).toHaveCount(1);
  await page.clock.fastForward(1);
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.locator('.brand-version')).toHaveText(version);
  await expect(page.getByRole('img', { name: 'Logo runKLMrun', exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'runKLMrun', exact: true })).toBeVisible();
  for (const name of ['Historique', 'Statistiques', 'Coach', 'Paramètres', 'Accueil']) {
    await page.getByRole('navigation').getByRole('link', { name }).click();
    await expect(page.locator('.splash-screen')).toHaveCount(0);
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Historique' }).click();
  await page.getByRole('link', { name: 'runKLMrun — Accueil' }).click();
  await expect(page).toHaveURL(/#\/$/);
});
for (const width of [320, 768, 1280]) test(`images intactes et responsive à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date("2026-10-10T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-10T12:00:01Z")); await page.goto('./');
  await expect(page.locator('.splash-screen')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.splash-screen img')).toHaveCSS('object-fit', 'contain');
  const bounds = await page.locator('.splash-window').boundingBox();
  expect(bounds!.width).toBe(Math.min(360, width - 32));
  expect(bounds!.height).toBe(380);
  expect(bounds!.x + bounds!.width / 2).toBeCloseTo(width / 2);
  expect(bounds!.y + bounds!.height / 2).toBeCloseTo(450);
  await page.clock.fastForward(3000);
  for (const selector of ['.brand-title']) {
    const img = page.locator(selector);
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(img).toHaveCSS('object-fit', 'contain');
    await expect(img).toHaveCSS('filter', 'none');
    const title = await img.boundingBox();
    expect(title!.width).toBeCloseTo(width <= 640 ? 138.6 : 160.65, 1);
    expect(title!.x + title!.width / 2).toBeCloseTo(width / 2, 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.brand')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
