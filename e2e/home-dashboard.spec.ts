import { expect, test, type Page } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';

const modules = '/runKLMrun/src/';
const coachPanel = (page: Page) => page.getByTestId('coach-v2-experimental');
const recentActivities = (page: Page) => page.locator('details[aria-labelledby="activity-title"]');

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

async function openHome(page: Page) {
  await page.goto('./#/');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
}

async function seedDashboard(page: Page, available = true) {
  await page.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));
  await page.goto('./#/parametres');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  const databaseName = await writableActiveDatabase(page);
  await page.evaluate(async input => {
    const { createCoachProfileRepository } = await import(/* @vite-ignore */ `${input.modules}storage/coach-profile.ts`);
    const { createEvolvingCoachRepository } = await import(/* @vite-ignore */ `${input.modules}storage/evolving-coach.ts`);
    const { createSessionRepository } = await import(/* @vite-ignore */ `${input.modules}storage/database.ts`);
    const sessions = createSessionRepository(input.databaseName);
    const profile = createCoachProfileRepository(input.databaseName);
    await profile.save({
      goal: { kind: 'endurance' },
      availability: input.available ? { sessionsPerWeek: 3, days: ['monday', 'wednesday', 'friday'], minutesPerSession: 60 } : {},
      preferences: { terrain: 'road' },
      accompanimentMode: 'advisor',
    }, undefined);
    await createEvolvingCoachRepository(input.databaseName).save({
      goal: { model: 'evolving', kind: 'endurance' }, experience: 'experienced', structuredPlanningPreference: 'accepted',
    }, undefined);
    for (const [index, date] of ['2026-10-09', '2026-10-11', '2026-10-13', '2026-10-15', '2026-10-17'].entries()) {
      await sessions.save({ id: `dashboard-${index}`, title: 'Sortie synthétique', sport: 'RUNNING', date, durationSeconds: 2400 });
    }
  }, { modules, databaseName, available });
  return databaseName;
}

for (const width of [390, 1280]) test(`accueil du profil actif et perspectives V2 à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seedDashboard(page);
  await openHome(page);

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Dernière sortie', 'Suggestions du Coach']);
  await expect(page.getByRole('region', { name: 'Dernière sortie', exact: true }).locator('time')).toContainText('17/10/2026');
  await expect(recentActivities(page)).not.toHaveAttribute('open');
  await recentActivities(page).locator('summary').click();
  await expect(recentActivities(page).getByRole('listitem')).toHaveCount(4);

  await expect(coachPanel(page)).toBeVisible();
  await expect(coachPanel(page).getByRole('article')).toHaveCount(3);
  await expect(coachPanel(page)).toContainText('Prochaine séance conseillée');
  await expect(coachPanel(page)).toContainText('Perspective susceptible d’évoluer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('accueil sans disponibilité : état V2 explicite sans recommandation fictive', async ({ page }) => {
  await seedDashboard(page, false);
  await openHome(page);

  await expect(coachPanel(page)).toContainText('Aucune suggestion adaptée n’est disponible actuellement.');
  await expect(coachPanel(page).getByRole('article')).toHaveCount(0);
});

test('accueil vide : état discret, historique et réglages accessibles', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('heading', { name: 'Votre histoire commence ici' })).toBeVisible();
  await expect(coachPanel(page)).toContainText('Le Coach ne dispose pas encore d’un repère stable');
  await recentActivities(page).locator('summary').click();
  await expect(recentActivities(page).getByRole('link', { name: 'Voir tout l’historique' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Paramètres', exact: true })).toBeVisible();
});

test('une activité ajoutée dans un autre onglet actualise la dernière sortie', async ({ page, context }) => {
  await openHome(page);
  const databaseName = await writableActiveDatabase(page);
  const other = await context.newPage();
  await openHome(other);
  expect(await activeDatabase(other)).toBe(databaseName);
  await other.evaluate(async input => {
    const { createSessionRepository } = await import(/* @vite-ignore */ `${input.modules}storage/database.ts`);
    await createSessionRepository(input.databaseName).save({
      id: 'synthetic-dashboard', title: 'Sortie synthétique', date: '2026-10-16', durationSeconds: 1800, distanceMeters: 5000,
    });
  }, { modules, databaseName });

  const latest = page.getByRole('region', { name: 'Dernière sortie', exact: true });
  await expect(latest).toContainText('16/10/2026');
  await expect(latest).toContainText('5 km');
  await recentActivities(page).locator('summary').click();
  await expect(recentActivities(page).getByRole('link', { name: 'Sortie synthétique', exact: true })).toBeVisible();
  await latest.getByRole('link', { name: 'Sortie synthétique', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/seance\/synthetic-dashboard/);
});

test('les quatre activités récentes incluent la dernière date locale et gardent les anciennes dans Courses', async ({ page }) => {
  await openHome(page);
  const databaseName = await writableActiveDatabase(page);
  await page.evaluate(async input => {
    const { createSessionRepository } = await import(/* @vite-ignore */ `${input.modules}storage/database.ts`);
    const sessions = createSessionRepository(input.databaseName);
    for (const day of [14, 18, 16, 15, 17]) {
      await sessions.save({
        id: `recent-${day}`, title: `Sortie du ${day}`, date: `2026-10-${day}`,
        ...(day === 18 ? { startTime: '2026-10-18T00:30:00+02:00' } : {}), durationSeconds: 1800,
      });
    }
  }, { modules, databaseName });

  await recentActivities(page).locator('summary').click();
  await expect(recentActivities(page).locator('time')).toHaveText(['18/10/2026 · 00:30', '17/10/2026', '16/10/2026', '15/10/2026']);
  await recentActivities(page).getByRole('link', { name: 'Voir tout l’historique', exact: true }).click();
  await expect(page.locator('.courses-history').getByRole('link', { name: 'Sortie du 14', exact: true })).toBeVisible();
});
