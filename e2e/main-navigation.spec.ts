import { test, expect, type Page } from '@playwright/test';

async function openSettingsPanel(page: Page, sectionId: string, summaryName: string) {
  const panel = page.locator(`section[aria-labelledby="${sectionId}"] > details`).filter({ has: page.getByText(summaryName, { exact: true }) });
  await panel.locator(':scope > summary').click();
  await expect(panel).toHaveAttribute('open', '');
  return panel;
}

for (const width of [390, 1280]) test(`quatre rubriques, accès transitoires et clavier à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
  await expect(nav.getByRole('link')).toHaveCount(4);
  for (const name of ['Accueil', 'Courses', 'Paramètres', 'Aide']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Coach|chaussures/ })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Accueil', exact: true }).focus();
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).toBeFocused();
  for (const name of ['Courses', 'Paramètres']) {
    await page.keyboard.press('Tab'); await expect(nav.getByRole('link', { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Enter'); await expect(nav.getByRole('link', { name: 'Paramètres' })).toHaveAttribute('aria-current', 'page');
  const shoesPanel = await openSettingsPanel(page, 'settings-shoes-title', 'Mes chaussures');
  await expect(shoesPanel.getByRole('button', { name: 'Ajouter une paire de chaussures', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Paramètres' }).click();
  const coachPanel = await openSettingsPanel(page, 'settings-coach-title', 'Configurer le Coach');
  await expect(coachPanel.getByRole('heading', { name: 'Votre accompagnement' })).toBeVisible();
  await expect(page).toHaveTitle('Paramètres — runKLMrun');
  await nav.getByRole('link', { name: 'Accueil', exact: true }).click();
  await page.goto('./#/entrainement'); await expect(page.locator('.splash-screen')).toHaveCount(0);
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
