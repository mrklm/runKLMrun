import { test, expect, type Page } from '@playwright/test';
const information = (page: Page) => page.getByRole('region', { name: 'Suggestions passées' });
async function seed(page: Page, date = '2026-10-16') {
  await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
  await page.goto('./'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.evaluate(async date => {
    const path = '/runKLMrun/src/storage/coach-suggestions.ts';
    const { createSuggestionRepository } = await import(/* @vite-ignore */ path);
    await createSuggestionRepository().recordPresented({ date, kind: 'endurance', durationSeconds: 2100 });
  }, date);
}
test('accueil : import tardif dans un autre onglet puis suppression notifiée, sans interaction obligatoire', async ({ page, context }) => {
  await seed(page); await expect(information(page)).toContainText('16/10/2026');
  await expect(information(page).getByRole('button')).toHaveCount(0);
  const other = await context.newPage(); await other.clock.setFixedTime(new Date('2026-10-17T12:00:00Z')); await other.goto('./');
  await other.evaluate(async () => {
    const root = '/runKLMrun/src/';
    const { importTcxFiles } = await import(/* @vite-ignore */ root + 'importers/tcx-files.ts');
    const { sessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    const xml = '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="2026-10-16T10:00:00Z"><TotalTimeSeconds>2520</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>';
    await importTcxFiles([new File([xml], 'synthetique.tcx')], sessionRepository, () => {});
  });
  await expect(information(page)).toHaveCount(0);
  await other.evaluate(async () => {
    const root = '/runKLMrun/src/storage/';
    const { openDatabase } = await import(/* @vite-ignore */ root + 'database-connection.ts');
    const { storageChanges } = await import(/* @vite-ignore */ root + 'changes.ts');
    const db = await openDatabase(), tx = db.transaction(['sessions', 'details'], 'readwrite');
    await tx.objectStore('sessions').clear(); await tx.objectStore('details').clear(); await tx.done; db.close();
    storageChanges.committed('runklmrun', ['sessions']);
  });
  await expect(information(page)).toContainText('n’a pas encore été importée');
});
test('ambiguité : plusieurs suggestions ou activités ne produisent aucun message', async ({ page }) => {
  await seed(page); await expect(information(page)).toBeVisible();
  await page.evaluate(async () => {
    const root = '/runKLMrun/src/storage/';
    const { createSuggestionRepository } = await import(/* @vite-ignore */ root + 'coach-suggestions.ts');
    await createSuggestionRepository().recordPresented({ date: '2026-10-16', kind: 'easy', durationSeconds: 1800 });
  });
  await expect(information(page)).toHaveCount(0);
  await page.evaluate(async () => {
    const root = '/runKLMrun/src/storage/';
    const { createSuggestionRepository } = await import(/* @vite-ignore */ root + 'coach-suggestions.ts');
    const { sessionRepository } = await import(/* @vite-ignore */ root + 'database.ts');
    await createSuggestionRepository().recordPresented({ date: '2026-10-15', kind: 'easy', durationSeconds: 1800 });
    for (const id of ['one', 'two']) await sessionRepository.save({ id, date: '2026-10-15', title: 'Synthétique', durationSeconds: 1800 });
  });
  await expect(information(page)).toHaveCount(0);
});
test('date civile et expiration, information masquée pendant un rapprochement', async ({ page }) => {
  await seed(page, '2026-10-17'); await expect(information(page)).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00Z'));
  await expect(information(page)).toContainText('17/10/2026');
  await page.evaluate(async () => {
    const path = '/runKLMrun/src/storage/suggestion-reconciliation.ts';
    const { startSuggestionReconciliation } = await import(/* @vite-ignore */ path);
    // Exécution volontairement en attente pour vérifier l’absence d’affichage prématuré.
    const stop = startSuggestionReconciliation('runklmrun', () => new Promise<number>(() => {}));
    (window as unknown as { stopDiagnostic: () => void }).stopDiagnostic = stop;
  });
  await expect(information(page)).toHaveCount(0);
  await page.reload(); await expect(information(page)).toContainText('17/10/2026');
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00Z')); await expect(information(page)).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z')); await expect(information(page)).toHaveCount(0);
});
