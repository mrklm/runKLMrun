import { test, expect } from '@playwright/test';
test('cartes accessibles, thèmes immédiats et disposition mobile', async ({ page }) => {
  await page.goto('./#/chaussures'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const automatic = page.getByRole('radio', { name: 'Une seule paire — Automatique', exact: true });
  const manual = page.getByRole('radio', { name: 'Plusieurs paires — Par séance', exact: true });
  await expect(manual).toBeChecked();
  const cards = page.locator('.shoe-mode-content');
  const first = await cards.nth(0).boundingBox(), second = await cards.nth(1).boundingBox();
  expect(first!.y).toBe(second!.y); expect(first!.height).toBe(second!.height);
  await cards.nth(0).click(); await expect(automatic).toBeChecked();
  await automatic.focus(); await expect(automatic).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(manual).toBeChecked();
  await expect(manual).toBeFocused();
  await expect(cards.nth(1)).toHaveCSS('outline-style', 'solid');
  for (const theme of ['AIR-KLM Day flight', 'Midnight Garage', 'Citron qui pique']) {
    await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
    await page.locator('#theme-select').selectOption({ label: theme });
    await page.getByRole('navigation').getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('link', { name: 'Mes chaussures', exact: true }).click();
    const colors = await manual.evaluate(input => {
      const card = input.nextElementSibling!;
      const probe = document.createElement('span'); probe.style.color = 'var(--accent)'; document.body.append(probe);
      const result = { border: getComputedStyle(card).borderTopColor, accent: getComputedStyle(probe).color, background: getComputedStyle(card).backgroundColor, text: getComputedStyle(card).color };
      probe.remove(); return result;
    });
    await cards.first().locator('..').locator('..').screenshot({ path: `test-results/shoe-mode-${theme.replaceAll(' ', '-')}.png` });
    expect(colors.border).toBe(colors.accent); expect(colors.text).not.toBe(colors.background);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFirst = await cards.nth(0).boundingBox(), mobileSecond = await cards.nth(1).boundingBox();
  expect(mobileSecond!.y).toBeGreaterThan(mobileFirst!.y + mobileFirst!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.shoe-mode-cards').screenshot({ path: 'test-results/shoe-mode-mobile.png' });
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0); await expect(manual).toBeChecked();
});
