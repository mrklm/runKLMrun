import { test, expect } from '@playwright/test';
for (const width of [390, 1280]) test(`trois rubriques, accès transitoires et clavier à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link')).toHaveText(['⌂Accueil', '≡Courses', '⚙Paramètres']);
  await expect(nav.getByRole('link', { name: /Coach|chaussures/ })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Accueil', exact: true }).focus();
  for (const name of ['Courses', 'Paramètres']) {
    await page.keyboard.press('Tab'); await expect(nav.getByRole('link', { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Enter'); await expect(nav.getByRole('link', { name: 'Paramètres' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Mes chaussures', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mes chaussures', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Paramètres' }).click();
  await page.getByText('Configurer le Coach',{exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Votre accompagnement' })).toBeVisible();
  await expect(page).toHaveTitle('Paramètres — runKLMrun');
  await nav.getByRole('link', { name: 'Accueil', exact: true }).click();
  await page.getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coach', exact: true })).toBeVisible();
  for (const path of ['entrainement', 'chaussures']) {
    await page.goto(`./#/${path}`); await expect(page.locator('.splash-screen')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: path === 'entrainement' ? 'Coach' : 'Mes chaussures', exact: true })).toBeVisible();
  }
  await nav.getByRole('link', { name: 'Paramètres' }).click();
  for (const theme of ['AIR-KLM Day flight', 'Midnight Garage']) {
    await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption({ label: theme });
    await expect(nav).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
