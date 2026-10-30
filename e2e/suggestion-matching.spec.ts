import { test, expect } from './helpers/protected-test';
import type { Page } from '@playwright/test';
import { seedCoach } from './helpers/coach';
import { activeDatabase } from './helpers/active-database';

async function occurrences(page: Page) {
  const databaseName=await activeDatabase(page);
  return page.evaluate(async databaseName=>{
    const path='/runKLMrun/src/storage/coach-suggestions-v2.ts';
    const {createSuggestionV2Repository}=await import(/* @vite-ignore */ path);
    return createSuggestionV2Repository(databaseName).listAll();
  },databaseName);
}

test('suggestion V2 présentée, import TCX puis association explicite persistante', async ({ page, context }) => {
  await seedCoach(page, 1);
  await page.goto('./#/entrainement');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  const coach=page.getByTestId('coach-v2-experimental');
  await expect(coach).toContainText('Prochaine séance conseillée');
  await coach.scrollIntoViewIfNeeded();
  await expect.poll(async()=>await occurrences(page)).toHaveLength(1);
  const [suggestion]=await occurrences(page);
  expect(suggestion.state).toBe('active');

  const other=await context.newPage();
  await other.goto('./#/entrainement');
  await expect(other.locator('.splash-screen')).toHaveCount(0);
  const databaseName=await activeDatabase(other);
  const imported=await other.evaluate(async input=>{
    const root='/runKLMrun/src/';
    const {importTcxFiles}=await import(/* @vite-ignore */ root+'importers/tcx-files.ts');
    const {createSessionRepository}=await import(/* @vite-ignore */ root+'storage/database.ts');
    const repository=createSessionRepository(input.databaseName),before=new Set((await repository.list()).map(session=>session.id));
    const xml=`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="${input.date}T10:00:00Z"><TotalTimeSeconds>2520</TotalTimeSeconds><DistanceMeters>6000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const file=new File([xml],'synthetique.TCX');
    const first=await importTcxFiles([file],repository,()=>{}),again=await importTcxFiles([file],repository,()=>{});
    const session=(await repository.list()).find(value=>!before.has(value.id));
    return {first:first.imported,duplicates:again.duplicates,session};
  },{databaseName,date:suggestion.opportunity.suggestedFor});
  expect(imported.first).toBe(1);
  expect(imported.duplicates).toBe(1);
  expect(imported.session).toMatchObject({id:expect.stringMatching(/^tcx:/),date:suggestion.opportunity.suggestedFor});

  await page.goto(`./#/seance/${encodeURIComponent(imported.session!.id)}`);
  const association=page.getByTestId('session-review');
  await expect(association).toContainText('Recommandation du Coach');
  await association.getByText('Association sans confirmation',{exact:true}).click();
  await association.getByLabel('Associer sans confirmer la réalisation').check();
  await association.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(association).toContainText('sans confirmation de réalisation');

  await page.reload();
  await expect(association).toContainText('sans confirmation de réalisation');
  const [stored]=await occurrences(page);
  expect(stored).toMatchObject({id:suggestion.id,state:'associated',activityId:imported.session!.id});
});
