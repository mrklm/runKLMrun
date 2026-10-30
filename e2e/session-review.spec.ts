import { test, expect } from './helpers/protected-test';
import type { Page } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';
const root = '/runKLMrun/src/';
async function seed(page: Page, count = 1, historical = false) {
  await page.goto('./'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif' })).toBeVisible();
  await expect(page.getByText('Votre histoire commence ici')).toBeVisible();
  const database = await activeDatabase(page);
  await page.evaluate(async ({ root, database, count, historical }) => {
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    await createSessionRepository(database).addImported({ id: 'review-run', title: 'Séance synthétique', date: '2026-10-20', sport: 'RUNNING', durationSeconds: 1800, distanceMeters: 5000 });
    const core = await import(/* @vite-ignore */ root + 'core/coach/persistence-foundations-v2.ts');
    const { createSuggestionV2Repository } = await import(/* @vite-ignore */ root + 'storage/coach-suggestions-v2.ts');
    const repository = createSuggestionV2Repository(database);
    for (let index = 1; index <= count; index++) {
      await repository.recordPresented({ selection: core.selectCandidateV2({ phase: 'candidate',
        content: { type: 'easy-endurance', intensity: 'easy', terrain: 'flat', totalDurationSeconds: 1800 + index * 60, shortSummary: `Endurance ${index}` },
        opportunity: { contractVersion: 1, goal: 'endurance', suggestedFor: core.civilDate('2026-10-20'),
          anchor: { kind: 'bootstrap', referenceDate: core.civilDate('2026-10-18') }, availability: { weekday: 'tuesday' }, generation: index } }),
        moment: { presentedAt: core.instantIso('2026-10-18T08:00:00.000Z'), presentedOn: core.civilDate('2026-10-18'),
          timeZone: core.ianaTimeZone('Europe/Paris'), utcOffsetMinutes: 120, civilDateRule: 'device-local-at-presentation' },
        provenance: { engine: 'coach-v2', contractVersion: 1, referenceConfidence: 'provisional', referenceSourceIds: [], limitationCodes: [] }, createId: () => `review-${index}` });
    }
    if (historical) await repository.associateActivity({ occurrenceId: 'review-1', activityId: 'review-run', expectedRevision: 1, updatedAt: core.instantIso('2026-10-20T12:00:00.000Z') });
  }, { root, database, count, historical });
  await page.goto('./#/seance/review-run'); await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByTestId('session-review').getByLabel('Effort perçu (facultatif)')).toBeEnabled();
  return database;
}
async function snapshot(page: Page, database: string) {
  return page.evaluate(async ({ root, database }) => {
    const { readBackupSnapshot } = await import(/* @vite-ignore */ root + 'storage/backup.ts');
    return readBackupSnapshot(database);
  }, { root, database });
}
const panel = (page: Page) => page.getByTestId('session-review');
async function save(page: Page) {
  await panel(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(panel(page).getByRole('status')).toContainText('Votre bilan a été enregistré.');
}

test('réponses Oui, Partiellement, Non sans précision, effacement et relecture V7', async ({ page }) => {
  const database = await seed(page), review = panel(page);
  await expect(review.getByRole('radio', { checked: true })).toHaveCount(0);
  for (const [label, result] of [['Oui', 'completed'], ['Partiellement', 'partial'], ['Non, autre entraînement', 'not-completed']]) {
    await review.getByRole('radio', { name: label, exact: true }).check(); await save(page);
    const data = await snapshot(page, database);
    expect(data.coachSuggestionsV2?.[0].realization?.result).toBe(result);
    expect(data.sessions[0].trainingType).toBeUndefined(); expect(data.sessions[0].trainingDescription).toBeUndefined();
    await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0); await expect(review.getByRole('radio', { name: label, exact: true })).toBeChecked();
  }
  await expect(review.getByText('Quel entraînement avez-vous réalisé ?', { exact: true })).toBeVisible();
  await review.getByRole('combobox', { name: 'Type d’entraînement', exact: true }).selectOption('recovery'); await save(page);
  await review.getByRole('combobox', { name: 'Type d’entraînement', exact: true }).selectOption('other');
  await review.getByLabel('Précisez votre entraînement').fill('Course d’orientation'); await save(page);
  expect((await snapshot(page, database)).sessions[0].trainingType).toBeUndefined();
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0); await expect(review.getByLabel('Précisez votre entraînement')).toHaveValue('Course d’orientation');
  const format = await page.evaluate(async ({ root, database }) => {
    const { readBackupSnapshot } = await import(/* @vite-ignore */ root + 'storage/backup.ts');
    const { createBackup, verifyBackup } = await import(/* @vite-ignore */ root + 'backup/format.ts');
    return (await verifyBackup(await createBackup(await readBackupSnapshot(database), 'test'))).formatVersion;
  }, { root, database });
  expect(format).toBe(7);
  await review.getByRole('button', { name: 'Effacer la réponse au Coach' }).click();
  await review.getByLabel('Précisez votre entraînement').fill(''); await save(page);
  const data = await snapshot(page, database);
  expect(data.coachSuggestionsV2?.[0].realization).toBeUndefined(); expect(data.sessions[0].trainingDescription).toBeUndefined();
});

test('plusieurs recommandations : choix explicite et association sans confirmation', async ({ page }) => {
  const database = await seed(page, 2), review = panel(page);
  await expect(review.getByLabel('Recommandation à renseigner')).toHaveValue('');
  await expect(review.getByRole('radio')).toHaveCount(0);
  await review.getByLabel('Recommandation à renseigner').selectOption('review-2');
  await review.getByText('Association sans confirmation', { exact: true }).click();
  await review.getByLabel('Associer sans confirmer la réalisation').check(); await save(page);
  await expect(review).toContainText('sans confirmation de réalisation');
  const data = await snapshot(page, database), occurrence = data.coachSuggestionsV2?.find(item => item.id === 'review-2');
  expect(occurrence?.activityId).toBe('review-run'); expect(occurrence?.realization).toBeUndefined();
  await review.getByLabel('Recommandation à renseigner').selectOption('review-1');
  await review.getByRole('radio', { name: 'Oui', exact: true }).check();
  await review.getByLabel('Effort perçu (facultatif)').selectOption('hard');
  await review.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('déjà associée');
  expect((await snapshot(page, database)).sessions[0].feeling).toBeUndefined();
});

test('association historique, invalidation sportive et suppression de l’activité', async ({ page }) => {
  const database = await seed(page, 1, true), review = panel(page);
  await expect(review).toContainText('sans confirmation de réalisation'); await expect(review.getByRole('radio', { checked: true })).toHaveCount(0);
  await review.getByRole('radio', { name: 'Partiellement', exact: true }).check(); await save(page);
  await page.evaluate(async ({ root, database }) => {
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    const repository = createSessionRepository(database), [session] = await repository.list(); await repository.save({ ...session, durationSeconds: 2400 });
  }, { root, database });
  await expect(review).toContainText('Aucune réalisation n’est confirmée'); await expect(review.getByRole('radio')).toHaveCount(0);
  await expect(review.getByLabel('Effort perçu (facultatif)')).toBeEnabled();
  await review.getByLabel('Effort perçu (facultatif)').selectOption('moderate'); await save(page);
  await page.evaluate(async ({ root, database }) => {
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    await createSessionRepository(database).remove!('review-run');
  }, { root, database });
  await expect(page.getByRole('heading', { name: 'Séance introuvable' })).toBeVisible();
});

test('une recommandation liée ailleurs n’est pas libre ; réponse négative obsolète consultable', async ({ page }) => {
  const database = await seed(page, 2);
  await page.evaluate(async ({ root, database }) => {
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    const { createSuggestionV2Repository } = await import(/* @vite-ignore */ root + 'storage/coach-suggestions-v2.ts');
    const { createSessionReviewRepository } = await import(/* @vite-ignore */ root + 'storage/session-review.ts');
    const { instantIso } = await import(/* @vite-ignore */ root + 'core/coach/persistence-foundations-v2.ts');
    await createSessionRepository(database).addImported({ id: 'other', title: 'Autre', date: '2026-10-20', durationSeconds: 1000 });
    const repository = createSuggestionV2Repository(database);
    await repository.associateActivity({ occurrenceId: 'review-1', activityId: 'other', expectedRevision: 1, updatedAt: instantIso('2026-10-20T12:00:00.000Z') });
    const reviews = createSessionReviewRepository(database);
    const saved = await reviews.save(await reviews.get('review-run', 'review-2'), { realization: { result: 'not-completed', proposalOrigin: 'manual', confirmedBy: 'user' } });
    await repository.markObsolete('review-2', saved.occurrence!.revision, instantIso(new Date().toISOString()));
  }, { root, database });
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0); const review = panel(page);
  await expect(review).toContainText('déjà associée à une autre activité'); await expect(review).toContainText('Réponse enregistrée : Non, autre entraînement.');
  await expect(review.getByRole('radio')).toHaveCount(0);
  await review.getByRole('button', { name: 'Effacer la réponse au Coach' }).click(); await save(page);
  expect((await snapshot(page, database)).coachSuggestionsV2?.find(item => item.id === 'review-2')?.realization).toBeUndefined();
});

test('changement de profil : aucun brouillon ni enregistrement dans l’autre profil', async ({ page }) => {
  const database = await seed(page, 0);
  const other = await page.evaluate(async ({ root }) => {
    const registry = await import(/* @vite-ignore */ root + 'storage/profile-registry.ts');
    const profile = await registry.createRunnerProfile({ displayName: 'Profil B synthétique' });
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    await createSessionRepository(profile.databaseName).addImported({ id: 'review-run', title: 'Séance B', date: '2026-10-20', durationSeconds: 900 });
    return profile;
  }, { root });
  await panel(page).getByLabel('Commentaire personnel (facultatif)').fill('Brouillon A');
  await page.getByRole('combobox', { name: 'Profil actif' }).selectOption(other.id);
  await expect(page.getByRole('combobox', { name: 'Profil actif' })).toHaveValue(other.id);
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('./#/seance/review-run'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(panel(page).getByLabel('Commentaire personnel (facultatif)')).toHaveValue('');
  await panel(page).getByLabel('Commentaire personnel (facultatif)').fill('B enregistré'); await save(page);
  expect((await snapshot(page, database)).sessions[0].feeling).toBeUndefined();
  expect((await snapshot(page, other.databaseName)).sessions[0].feeling?.comment).toBe('B enregistré');
});
