import { test, expect } from '@playwright/test';
import { seedCoach, openCoach, revealAll, suggestionRows } from './helpers/coach';

test('suggestion présentée, import TCX depuis un autre onglet, doublon puis suppression', async ({ page, context }) => {
  await seedCoach(page, 1); await openCoach(page); await revealAll(page);
  const original = (await suggestionRows(page))[0]; expect(original.activityId).toBeUndefined();
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  const other = await context.newPage(); await other.clock.setFixedTime(new Date('2026-10-17T00:00:00Z')); await other.goto('./');
  const imported = await other.evaluate(async date => {
    const root = '/runKLMrun/src/';
    const { importTcxFiles } = await import(/* @vite-ignore */ root + 'importers/tcx-files.ts');
    const { sessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    const xml = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="${date}T10:00:00Z"><TotalTimeSeconds>2520</TotalTimeSeconds><DistanceMeters>6000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const file = new File([xml], 'synthetique.TCX');
    const first = await importTcxFiles([file], sessionRepository, () => {});
    const again = await importTcxFiles([file], sessionRepository, () => {});
    return { first: first.imported, duplicates: again.duplicates };
  }, original.date);
  expect(imported).toEqual({ first: 1, duplicates: 1 });
  await expect.poll(async () => (await suggestionRows(page)).find(s => s.id === original.id)?.revision).toBe(2);
  const linked = (await suggestionRows(page)).find(s => s.id === original.id)!; expect(linked.activityId).toMatch(/^tcx:/);
  await page.reload(); await expect.poll(async () => (await suggestionRows(page)).find(s => s.id === original.id)).toEqual(linked);
  await other.evaluate(async id => {
    const root = '/runKLMrun/src/storage/';
    const { openDatabase } = await import(/* @vite-ignore */ root + 'database-connection.ts');
    const { storageChanges } = await import(/* @vite-ignore */ root + 'changes.ts');
    const db = await openDatabase(), tx = db.transaction(['sessions', 'details'], 'readwrite');
    await tx.objectStore('sessions').delete(id); await tx.objectStore('details').delete(id); await tx.done; db.close();
    storageChanges.committed('runklmrun', ['sessions']);
  }, linked.activityId!);
  await expect.poll(async () => (await suggestionRows(page)).find(s => s.id === original.id)?.activityId).toBeUndefined();
  expect((await suggestionRows(page)).find(s => s.id === original.id)?.revision).toBe(3);
});
