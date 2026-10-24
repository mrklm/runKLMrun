import { expect, test } from '@playwright/test';

test('ouvre l’aide depuis la navigation principale', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  const link = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Aide', exact: true });
  await link.click();
  await expect(page).toHaveURL(/#\/aide$/);
  await expect(page.getByRole('heading', { name: 'Aide', exact: true })).toBeVisible();
  await expect(page.getByText('Utiliser le Coach', { exact: true })).toBeVisible();
  await expect(link).toHaveAttribute('aria-current', 'page');
});
