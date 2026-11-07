import { expect, test } from './helpers/protected-test';

for (const width of [390, 1280]) for (const theme of ['AIR-KLM Day flight', 'AIR-KLM Night flight']) {
  test(`aide : navigation, titres et lecture à ${width}px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#/parametres');
    await expect(page.getByRole('combobox', { name: 'Thème', exact: true })).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false);
    await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption({ label: theme });
    const link = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Aide', exact: true });
    await link.click();
    await expect(page).toHaveURL(/#\/aide$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('runKLMrun');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
    await expect(page.getByRole('heading', { name: 'Le bilan de séance', level: 3 })).toBeVisible();
    await expect(page.locator('.help-philosophy')).toHaveText("philosophie : runKLMrun s'adapte à vous, pas l'inverse.");
    await expect(link).toHaveAttribute('aria-current', 'page');
    const sizes = await page.locator('.help-page').evaluate(element => ['h1', 'h2', 'h3', 'p'].map(selector => parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize)));
    expect(sizes).toEqual(width === 390 ? [27, 22, 18, 16] : [32, 25, 20, 16]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('link', { name: 'April', exact: true })).toHaveAttribute('href', 'https://www.april.org/');
    await page.screenshot({ path: `/tmp/runklmrun-help-${width}-${theme.includes('Night') ? 'night' : 'day'}.png`, fullPage: true });
    await page.locator('.help-content').getByRole('link', { name: 'Courses', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Courses', level: 1 })).toBeVisible();
    await link.click();
    await page.locator('.help-content').getByRole('link', { name: 'Paramètres', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Thème', exact: true })).toBeVisible();
    await page.goto('./#/aide'); await page.reload();
    await expect(page.getByRole('heading', { name: 'runKLMrun', level: 1 })).toBeVisible();
  });
}
