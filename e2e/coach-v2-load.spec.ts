import { test,expect } from './helpers/protected-test';
import { activeDatabase } from './helpers/active-database';

test.use({timezoneId:'Europe/Paris'});
test('un bilan difficile retire immédiatement une ancienne recommandation exigeante sans effacer son historique',async({page})=>{
  await page.clock.install({time:new Date('2026-11-04T10:00:00Z')});
  await page.goto('./#/entrainement');
  await expect(page.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();
  await page.evaluate(async()=>{
    const root='/runKLMrun/src/storage/';
    const {bootstrapProfiles}=await import(/* @vite-ignore */ root+'profile-bootstrap.ts');
    const {isProfileActive,profileDatabaseName}=await import(/* @vite-ignore */ root+'profile-registry.ts');
    const {openDatabase}=await import(/* @vite-ignore */ root+'database-connection.ts');
    const {active}=await bootstrapProfiles();
    if(!isProfileActive(active)||active.databaseName!==profileDatabaseName(active.id)||active.databaseName==='runklmrun')throw new Error('Profil de test invalide.');
    const db=await openDatabase(active.databaseName);db.close();
  });
  const database=await activeDatabase(page);
  await page.evaluate(async database=>{
    const root='/runKLMrun/src/';
    const {openDatabase}=await import(/* @vite-ignore */ root+'storage/database-connection.ts');
    const db=await openDatabase(database),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
    for(const store of ['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'])await tx.objectStore(store).clear();
    for(const [index,age] of [26,21,16,11,6,2].entries())await tx.objectStore('sessions').put({id:`run-${index}`,
      date:new Date(Date.parse('2026-11-04T00:00:00Z')-age*86400000).toISOString().slice(0,10),title:'Synthétique',sport:'RUNNING',
      durationSeconds:2400,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}});
    const metadata={id:'local',revision:1,createdAt:'2026-09-01T08:00:00.000Z',updatedAt:'2026-09-01T08:00:00.000Z'};
    await tx.objectStore('coachProfile').put({...metadata,goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
      days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'});
    await tx.objectStore('evolvingCoach').put({...metadata,coachTemperament:'rentre-dedans',configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'}});
    await tx.done;db.close();
  },database);
  await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await panel.scrollIntoViewIfNeeded();
  const primary=panel.locator('.coach-v2-card-primary');
  await expect(primary.getByRole('heading')).toContainText('Fractionné');
  const occurrences=()=>page.evaluate(async database=>{
    const root='/runKLMrun/src/';const {createSuggestionV2Repository}=await import(/* @vite-ignore */ root+'storage/coach-suggestions-v2.ts');
    return createSuggestionV2Repository(database).listAll();
  },database);
  await expect.poll(async()=> (await occurrences()).length).toBe(1);
  const before=await occurrences();
  await page.evaluate(async database=>{
    const root='/runKLMrun/src/';const {createFeelingRepository}=await import(/* @vite-ignore */ root+'storage/session-feeling.ts');
    await createFeelingRepository(database).save('run-5',{effort:'hard'},{effort:'moderate'});
  },database);
  await expect(primary.getByRole('heading')).toContainText('Endurance facile');
  await expect.poll(async()=> (await occurrences()).length).toBe(2);
  expect((await occurrences()).find(value=>value.id===before[0].id)).toEqual(before[0]);
  await page.reload();await panel.scrollIntoViewIfNeeded();
  await expect(primary.getByRole('heading')).toContainText('Endurance facile');
  expect(await occurrences()).toHaveLength(2);
  expect((await occurrences()).find(value=>value.id===before[0].id)).toEqual(before[0]);
});
