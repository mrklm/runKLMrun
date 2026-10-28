import { expect,test,type Page } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';

const modules='/runKLMrun/src/';
async function writableActiveDatabase(page:Page) {
  await page.evaluate(async()=>{
    const root='/runKLMrun/src/storage/';
    const {bootstrapProfiles}=await import(/* @vite-ignore */ root+'profile-bootstrap.ts');
    const {isProfileActive,profileDatabaseName}=await import(/* @vite-ignore */ root+'profile-registry.ts');
    const {DATABASE_NAME,openDatabase}=await import(/* @vite-ignore */ root+'database-connection.ts');
    const {active}=await bootstrapProfiles();
    if(!isProfileActive(active)||active.databaseName!==profileDatabaseName(active.id)||active.databaseName===DATABASE_NAME)throw new Error('Base du profil actif invalide.');
    if((await indexedDB.databases()).some(database=>database.name===active.databaseName))return;
    const database=await openDatabase(active.databaseName);database.close();
  });
  return activeDatabase(page);
}
async function seed(page:Page,withAvailability=true) {
  await expect(page.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();
  const databaseName=await writableActiveDatabase(page);
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(input.databaseName),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
    await Promise.all(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'].map(store=>tx.objectStore(store as 'sessions').clear()));
    for(const [index,date] of ['2026-10-10','2026-10-11','2026-10-12','2026-10-13'].entries())await tx.objectStore('sessions').put({id:`run-${index}`,title:'Course',sport:'RUNNING',date,durationSeconds:2400});
    await tx.objectStore('coachProfile').put({id:'local',revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z',
      goal:{kind:'endurance'},availability:input.withAvailability?{sessionsPerWeek:3,days:['monday','wednesday','friday'],minutesPerSession:60}:{},
      preferences:{terrain:'road'},accompanimentMode:'advisor'});
    await tx.objectStore('evolvingCoach').put({id:'local',revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z',
      configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'}});
    await tx.done;db.close();
  },{modules,withAvailability,databaseName});
}
const count=async(page:Page)=>{const databaseName=await activeDatabase(page);return page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
  const db=await openDatabase(input.databaseName),value=await db.count('coachSuggestionsV2');db.close();return value;},{modules,databaseName});};

test.describe('consultation V2',()=>{
  test.use({timezoneId:'Europe/Paris'});
  const occurrences=async(page:Page)=>{const databaseName=await activeDatabase(page);return page.evaluate(async input=>{
    const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(input.databaseName),values=await db.getAll('coachSuggestionsV2');db.close();return values;
  },{modules,databaseName});};
  const returnToTab=async(page:Page)=>{
    // Transition de visibilité explicite, reproductible aussi en navigateur headless.
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
      document.dispatchEvent(new Event('visibilitychange'));});
  };
  const prepare=async(page:Page,time:string)=>{
    await page.clock.install({time:new Date(time)});
    await page.goto('./#/entrainement');await seed(page);
    await page.reload();
    const panel=page.getByTestId('coach-v2-experimental');await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Prochaine séance conseillée');
    await expect.poll(()=>count(page)).toBe(1);
    return panel;
  };

  test('conserve demain puis aujourd’hui après 18 h entre consultations et ouvertures',async({page})=>{
    const panel=await prepare(page,'2026-10-18T10:00:00Z'),initial=await occurrences(page);
    expect(initial).toHaveLength(1);expect(initial[0].opportunity.suggestedFor).toBe('2026-10-19');
    await expect(panel.locator('.coach-v2-card')).toHaveCount(3);
    await expect(panel).toContainText('21/10/2026');
    await expect(panel).toContainText('23/10/2026');
    await expect(panel).toContainText('Perspective susceptible d’évoluer');
    for(let index=0;index<2;index++){
      await returnToTab(page);await expect(panel).toContainText('Prochaine séance conseillée');
      expect(await occurrences(page)).toEqual(initial);
    }
    await page.clock.setSystemTime(new Date('2026-10-19T18:01:00Z'));
    await returnToTab(page);await expect(panel).toContainText('19/10/2026');
    await expect(panel).toContainText('Prochaine séance conseillée');
    await page.reload();await expect(panel).toContainText('Prochaine séance conseillée');
    expect(await occurrences(page)).toEqual(initial);
  });

  test('Accueil et Calendrier partagent les perspectives sans les persister',async({page})=>{
    await page.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));
    await page.goto('./#/entrainement');await seed(page);
    const databaseName=await activeDatabase(page);
    await page.evaluate(async input=>{
      const {calculateCoachV2Readonly}=await import(/* @vite-ignore */ input.modules+'storage/coach-v2-readonly.ts');
      const {presentCoachV2Selection}=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
      const result=await calculateCoachV2Readonly('2026-10-18',input.databaseName);
      await presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:{presentedOn:'2026-10-18',
        presentedAt:'2026-10-18T10:00:00.000Z',timeZone:'Europe/Paris',utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
        provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',
          referenceSourceIds:result.reference.sourceIds,limitationCodes:[]}},input.databaseName);
    },{modules,databaseName});
    await page.goto('./#/');
    const panel=page.getByTestId('coach-v2-experimental');
    await expect(panel.getByRole('article')).toHaveCount(3);
    await expect.poll(()=>count(page)).toBe(1);
    const initial=await occurrences(page);
    const plan=await page.evaluate(async input=>{
      const {readCoachV2Projection}=await import(/* @vite-ignore */ input.modules+'components/coach-v2-projection.ts');
      return (await readCoachV2Projection(input.databaseName)).perspectives;
    },{modules,databaseName});
    expect(plan.map(value=>value.date)).toEqual(['2026-10-19','2026-10-21','2026-10-23']);
    await page.goto('./#/courses');
    await expect(page.getByTestId('calendar-suggestion-v2')).toHaveCount(plan.length);
    for(const item of plan){
      const cell=page.getByRole('listitem',{name:item.date.split('-').reverse().join('/'),exact:true});
      await expect(cell.getByTestId('calendar-suggestion-v2')).toContainText('Endurance facile');
    }
    expect(await occurrences(page)).toEqual(initial);
  });

  test('renouvelle la suggestion passée seulement au retour et conserve son historique',async({page})=>{
    const panel=await prepare(page,'2026-10-19T10:00:00Z'),initial=await occurrences(page);
    expect(initial[0].opportunity.suggestedFor).toBe('2026-10-19');
    await page.clock.setSystemTime(new Date('2026-10-19T21:59:59Z'));
    await page.clock.runFor(2000); // Minuit local franchi sans nouvelle consultation.
    await expect(panel).toContainText('19/10/2026');expect(await occurrences(page)).toEqual(initial);
    const databaseName=await activeDatabase(page);
    await page.evaluate(async input=>{
      const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
      const {storageChanges}=await import(/* @vite-ignore */ input.modules+'storage/changes.ts');
      const db=await openDatabase(input.databaseName);await db.put('sessions',{id:'new-actual',date:'2026-10-20',title:'Course réelle',sport:'RUNNING',durationSeconds:2400});db.close();
      storageChanges.committed(input.databaseName,['sessions','profile','configuration','suggestions-v2']);
    },{modules,databaseName});
    await page.clock.runFor(1000);
    await expect(panel).toContainText('19/10/2026');expect(await occurrences(page)).toEqual(initial);
    await returnToTab(page);
    await expect(panel).toContainText('23/10/2026');
    await expect(panel).toContainText('Prochaine séance conseillée');
    await panel.scrollIntoViewIfNeeded();await expect.poll(()=>count(page)).toBe(2);
    const renewed=await occurrences(page);expect(renewed).toHaveLength(2);
    expect(renewed.find(value=>value.id===initial[0].id)).toEqual(initial[0]);
    expect(renewed.every(value=>value.state==='active'&&!value.activityId)).toBe(true);
    await returnToTab(page);await expect(panel).toContainText('Prochaine séance conseillée');
    expect(await occurrences(page)).toEqual(renewed);
  });
});

test.describe('présentation V2 à date fixe',()=>{
test.use({timezoneId:'Europe/Paris'});
test('présentation V2 interne visible, réaffichage et sauvegarde V6',async({page,context})=>{
  const consultation=new Date('2026-10-23T10:00:00+02:00');
  await page.clock.setFixedTime(consultation);
  await page.goto('./#/entrainement');await seed(page);
  await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await expect(panel).toContainText('Des idées pour les prochains jours');
  await expect(panel).toContainText('Endurance facile');await panel.scrollIntoViewIfNeeded();
  await expect.poll(()=>count(page)).toBe(1);
  await expect(page.getByTestId('coach-v2-comparison')).toHaveCount(0);
  await page.goto('./#/');
  await expect(page.getByTestId('coach-v2-experimental')).toContainText('Suggestions du Coach');
  await page.setViewportSize({width:390,height:844});
  const mobileBox=await page.getByTestId('coach-v2-experimental').boundingBox();
  expect(mobileBox).not.toBeNull();expect(mobileBox!.x).toBeGreaterThanOrEqual(0);expect(mobileBox!.x+mobileBox!.width).toBeLessThanOrEqual(390);
  expect(await count(page)).toBe(1);
  await page.goto('./#/courses');
  await expect(page.getByTestId('calendar-suggestion-v2')).toHaveCount(3);
  for(const date of ['23/10/2026','26/10/2026','28/10/2026']) {
    const suggestion=page.getByRole('listitem',{name:date,exact:true}).getByTestId('calendar-suggestion-v2');
    await expect(suggestion).toHaveCount(1);
    await expect(suggestion).toContainText('Suggestion du Coach');
    await expect(suggestion).toContainText('Endurance facile · 00:40:00');
  }
  const databaseName=await activeDatabase(page);
  const backup=await page.evaluate(async input=>{const {readBackupSnapshot}=await import(/* @vite-ignore */ input.modules+'storage/backup.ts');
    const {createBackup}=await import(/* @vite-ignore */ input.modules+'backup/format.ts');return createBackup(await readBackupSnapshot(input.databaseName),'0.7.0',input.createdAt);},{modules,databaseName,createdAt:consultation.toISOString()});
  expect(backup.formatVersion).toBe(6);expect(backup.data.coachSuggestionsV2).toHaveLength(1);

  const other=await context.newPage();await other.clock.setFixedTime(consultation);await other.goto('./#/entrainement');expect(await activeDatabase(other)).toBe(databaseName);
  await expect(other.getByTestId('coach-v2-experimental')).toContainText('Prochaine séance conseillée');
  expect(await count(other)).toBe(1);
});
});

test('association V2 explicitement confirmée depuis une activité compatible',async({page})=>{
  await page.goto('./#/entrainement');await seed(page);await page.reload();
  await page.getByTestId('coach-v2-experimental').scrollIntoViewIfNeeded();
  await expect.poll(()=>count(page)).toBe(1);
  const databaseName=await activeDatabase(page);
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(input.databaseName),occurrence=(await db.getAll('coachSuggestionsV2'))[0];
    await db.put('sessions',{id:'compatible-run',title:'Sortie compatible',sport:'RUNNING',date:occurrence.opportunity.suggestedFor,durationSeconds:2700});db.close();
  },{modules,databaseName});
  await page.goto('./#/seance/compatible-run');await page.reload();
  const association=page.getByTestId('coach-v2-association');
  await expect(association).toContainText('Suggestion du Coach et activité');
  await association.getByRole('button',{name:'Associer explicitement à cette activité'}).click();
  await expect(association.getByRole('status')).toContainText('Association confirmée');
});

test('activation interne sans suggestion admissible ne crée rien',async({page})=>{
  await page.goto('./#/entrainement');await seed(page,false);await page.reload();
  await expect(page.getByTestId('coach-v2-experimental')).toContainText('Aucune suggestion adaptée n’est disponible actuellement.');
  expect(await count(page)).toBe(0);
});

test('amorçage débutant stable entre deux onglets sans activité fictive',async({page,context})=>{
  await page.goto('./#/entrainement');await seed(page);
  const databaseName=await activeDatabase(page);
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(input.databaseName),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
    await tx.objectStore('sessions').clear();await tx.objectStore('coachSuggestionsV2').clear();
    await tx.objectStore('coachProfile').put({id:'local',revision:1,createdAt:'2026-10-17T08:00:00.000Z',updatedAt:'2026-10-17T08:00:00.000Z',
      goal:{kind:'regular'},availability:{sessionsPerWeek:2,days:['monday','thursday'],minutesPerSession:30},preferences:{terrain:'road'},accompanimentMode:'advisor'});
    await tx.objectStore('evolvingCoach').put({id:'local',revision:1,createdAt:'2026-10-17T08:00:00.000Z',updatedAt:'2026-10-17T08:00:00.000Z',
      configuration:{goal:{model:'evolving',kind:'begin'},experience:'beginner',structuredPlanningPreference:'accepted'}});
    await tx.done;db.close();
  },{modules,databaseName});
  await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await expect(panel).toContainText('Endurance facile');await expect(panel).toContainText('15 min');
  await panel.scrollIntoViewIfNeeded();await expect.poll(()=>count(page)).toBe(1);
  const other=await context.newPage();await other.goto('./#/entrainement');await expect(other.getByTestId('coach-v2-experimental')).toContainText('15 min');
  await expect(other.getByTestId('coach-v2-experimental')).toContainText('Prochaine séance conseillée');expect(await count(other)).toBe(1);
});

test('erreur de mémorisation puis nouvel essai sans doublon',async({page})=>{
  await page.goto('./#/entrainement');await seed(page);
  await page.addInitScript(()=>{const original=IDBObjectStore.prototype.add;let rejected=false;
    IDBObjectStore.prototype.add=function(value:unknown,key?:IDBValidKey){
      if(this.name==='coachSuggestionsV2'&&!rejected){rejected=true;throw new DOMException('Échec synthétique','AbortError');}
      return original.call(this,value,key);
    };
  });
  await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await panel.scrollIntoViewIfNeeded();
  await expect(panel.getByRole('alert')).toContainText('n’a pas pu être mémorisée');expect(await count(page)).toBe(0);
  await panel.getByRole('button',{name:'Réessayer'}).click();
  // La mémorisation V2 exige que le titre et le résumé soient réellement visibles.
  await panel.locator('[data-presentation-title]').scrollIntoViewIfNeeded();
  await expect.poll(()=>count(page)).toBe(1);
});

test('ressenti difficile : explication réelle conservée pendant la présentation',async({page})=>{
  await page.clock.install({time:new Date('2026-10-18T10:00:00Z')});
  await page.goto('./#/entrainement');await seed(page);
  const databaseName=await activeDatabase(page);
  await page.evaluate(async input=>{
    const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(input.databaseName),tx=db.transaction(['sessions','evolvingCoach'],'readwrite');
    await tx.objectStore('sessions').clear();
    for(const [index,date] of ['2026-09-27','2026-10-01','2026-10-05','2026-10-09','2026-10-12','2026-10-15'].entries()){
      await tx.objectStore('sessions').put({id:'feeling-'+index,title:'Course',sport:'RUNNING',date,durationSeconds:2400,
        ...(index===5?{feeling:{effort:'hard'}}:{})});
    }
    const record=await tx.objectStore('evolvingCoach').get('local');
    record.coachTemperament='rentre-dedans';record.configuration.goal={model:'evolving',kind:'speed'};await tx.objectStore('evolvingCoach').put(record);
    await tx.done;db.close();localStorage.setItem('runklmrun:coach-v2-internal','enabled');
  },{modules,databaseName});
  await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await panel.scrollIntoViewIfNeeded();
  await expect(panel).toContainText('Prochaine séance conseillée');
  await expect(panel.locator('[data-presentation-title]')).toContainText('Endurance facile');
  await expect(panel).toContainText('la course du 15/10/2026 a été ressentie comme difficile');
  await expect.poll(()=>count(page)).toBe(1);
  await page.reload();await expect(panel).toContainText('Prochaine séance conseillée');
  expect(await count(page)).toBe(1);
});
