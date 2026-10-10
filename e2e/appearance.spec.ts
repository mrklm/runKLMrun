import { test, expect } from '@playwright/test';
import { THEMES } from '../src/themes/themes';
import { THEME_STORAGE_KEY } from '../src/themes/theme-store';
for (const width of [320, 1280]) test(`apparence compacte, immédiate et persistante à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./#/parametres');
  const section = page.getByRole('region', { name: 'Apparence', exact: true });
  await expect(section).toBeVisible();
  const select = page.getByRole('combobox', { name: 'Thème', exact: true });
  await expect(select.locator('option')).toHaveCount(16);
  expect(await select.locator('option').allTextContents()).toEqual(THEMES.map(t => t.name));
  await expect(section.locator('button, code, p, .theme-preview, .theme-swatch')).toHaveCount(0);
  expect(await section.evaluate(el => el.nextElementSibling === null)).toBe(true);
  for (const theme of THEMES) {
    await select.selectOption(theme.name);
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg'))).toBe(theme.colors.BG);
    expect(await page.evaluate(key => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe(theme.name);
  }
  await page.reload();
  await expect(select).toHaveValue(THEMES.at(-1)!.name);
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg'))).toBe(THEMES.at(-1)!.colors.BG);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
