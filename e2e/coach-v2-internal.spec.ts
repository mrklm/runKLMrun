import { expect,test,type Page } from '@playwright/test';

const modules='/runKLMrun/src/';
async function seed(page:Page,withAvailability=true) {
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
    await Promise.all(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'].map(store=>tx.objectStore(store as 'sessions').clear()));
    for(const [index,date] of ['2026-10-10','2026-10-11','2026-10-12','2026-10-13'].entries())await tx.objectStore('sessions').put({id:`run-${index}`,title:'Course',sport:'RUNNING',date,durationSeconds:2400});
    await tx.objectStore('coachProfile').put({id:'local',revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z',
      goal:{kind:'endurance'},availability:input.withAvailability?{sessionsPerWeek:3,days:['monday','wednesday','friday'],minutesPerSession:60}:{},
      preferences:{terrain:'road'},accompanimentMode:'advisor'});
    await tx.objectStore('evolvingCoach').put({id:'local',revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z',
      configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'}});
    await tx.done;db.close();
  },{modules,withAvailability});
}
const count=async(page:Page)=>page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
  const db=await openDatabase(),value=await db.count('coachSuggestionsV2');db.close();return value;},{modules});

test.describe('consultation V2',()=>{
  test.use({timezoneId:'Europe/Paris'});
  const occurrences=(page:Page)=>page.evaluate(async modules=>{
    const {openDatabase}=await import(/* @vite-ignore */ modules+'storage/database-connection.ts');
    const db=await openDatabase(),values=await db.getAll('coachSuggestionsV2');db.close();return values;
  },modules);
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
    await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
    const panel=page.getByTestId('coach-v2-experimental');await panel.scrollIntoViewIfNeeded();
    await expect(panel.getByRole('status')).toContainText('vous est proposée');
    return panel;
  };

  test('conserve demain puis aujourd’hui après 18 h entre consultations et ouvertures',async({page})=>{
    const panel=await prepare(page,'2026-10-18T10:00:00Z'),initial=await occurrences(page);
    expect(initial).toHaveLength(1);expect(initial[0].opportunity.suggestedFor).toBe('2026-10-19');
    const perspectives=panel.getByRole('region',{name:'Perspectives sur 7 jours'});
    await expect(perspectives.getByRole('article')).toHaveCount(2);
    await expect(perspectives).toContainText('21/10/2026');
    await expect(perspectives).toContainText('23/10/2026');
    await expect(page.getByTestId('coach-v2-comparison')).toContainText('Perspective facultative et révisable');
    for(let index=0;index<2;index++){
      await returnToTab(page);await expect(panel.getByRole('status')).toContainText('vous est proposée');
      expect(await occurrences(page)).toEqual(initial);
    }
    await page.clock.setSystemTime(new Date('2026-10-19T18:01:00Z'));
    await returnToTab(page);await expect(panel).toContainText('19/10/2026');
    await expect(panel.getByRole('status')).toContainText('vous est proposée');
    await page.reload();await expect(panel.getByRole('status')).toContainText('vous est proposée');
    expect(await occurrences(page)).toEqual(initial);
  });

  test('renouvelle la suggestion passée seulement au retour et conserve son historique',async({page})=>{
    const panel=await prepare(page,'2026-10-19T10:00:00Z'),initial=await occurrences(page);
    expect(initial[0].opportunity.suggestedFor).toBe('2026-10-19');
    await page.clock.setSystemTime(new Date('2026-10-19T21:59:59Z'));
    await page.clock.runFor(2000); // Minuit local franchi sans nouvelle consultation.
    await expect(panel).toContainText('19/10/2026');expect(await occurrences(page)).toEqual(initial);
    await page.evaluate(async modules=>{
      const {openDatabase}=await import(/* @vite-ignore */ modules+'storage/database-connection.ts');
      const {storageChanges}=await import(/* @vite-ignore */ modules+'storage/changes.ts');
      const db=await openDatabase();await db.put('sessions',{id:'new-actual',date:'2026-10-20',title:'Course réelle',sport:'RUNNING',durationSeconds:2400});db.close();
      storageChanges.committed('runklmrun',['sessions','profile','configuration','suggestions-v2']);
    },modules);
    await page.clock.runFor(1000);
    await expect(panel).toContainText('19/10/2026');expect(await occurrences(page)).toEqual(initial);
    await returnToTab(page);
    await expect(panel).toContainText('23/10/2026');
    await expect(panel.getByRole('status')).toContainText('vous est proposée');
    const renewed=await occurrences(page);expect(renewed).toHaveLength(2);
    expect(renewed.find(value=>value.id===initial[0].id)).toEqual(initial[0]);
    expect(renewed.every(value=>value.state==='active'&&!value.activityId)).toBe(true);
    await returnToTab(page);await expect(panel.getByRole('status')).toContainText('vous est proposée');
    expect(await occurrences(page)).toEqual(renewed);
  });
});

for(const route of ['entrainement','#/entrainement']) {
  test(`comparateur interne sur la route ${route}`,async({page})=>{
    await page.goto(`./${route}`);await seed(page,false);await page.reload();
    await expect(page.getByRole('heading',{name:'Coach',exact:true})).toBeVisible();
    await expect(page.getByTestId('coach-v2-comparison')).toHaveCount(0);
    await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
    await expect(page.getByTestId('coach-v2-experimental')).toBeVisible();
    const comparison=page.getByTestId('coach-v2-comparison');
    await expect(comparison).toContainText('Développement uniquement · lecture seule');
    await expect(comparison.getByRole('heading',{name:'Coach V1',exact:true})).toBeVisible();
    await expect(comparison.getByRole('heading',{name:'Coach V2',exact:true})).toBeVisible();
    expect(await count(page)).toBe(0);
    await page.getByRole('link',{name:'Accueil',exact:true}).click();
    await expect(page.getByTestId('coach-v2-comparison')).toHaveCount(0);
    await expect(page.getByTestId('coach-v2-experimental')).toBeVisible();
  });
}

test('présentation V2 interne visible, réaffichage et sauvegarde V6',async({page,context})=>{
  await page.goto('./#/entrainement');await seed(page);
  await page.reload();
  await expect(page.getByTestId('coach-v2-experimental')).toHaveCount(0);expect(await count(page)).toBe(0);
  await page.goto('./#/');await expect(page.getByTestId('coach-v2-experimental')).toHaveCount(0);
  await page.goto('./#/courses');await expect(page.getByTestId('calendar-suggestion-v2')).toHaveCount(0);
  await page.goto('./#/entrainement');

  await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await expect(panel).toContainText('Développement uniquement');
  await expect(panel).toContainText('Endurance facile');await panel.scrollIntoViewIfNeeded();
  await expect(panel.getByRole('status')).toContainText('vous est proposée');expect(await count(page)).toBe(1);
  const comparison=page.getByTestId('coach-v2-comparison');await expect(comparison).toContainText('Comparaison Coach V1 / V2');
  await expect(comparison.getByRole('heading',{name:'Coach V1',exact:true})).toBeVisible();
  await expect(comparison.getByRole('heading',{name:'Coach V2',exact:true})).toBeVisible();expect(await count(page)).toBe(1);
  await page.goto('./#/');
  await expect(page.getByTestId('coach-v2-experimental')).toContainText('Suggestion du Coach');
  await page.setViewportSize({width:390,height:844});
  const mobileBox=await page.getByTestId('coach-v2-experimental').boundingBox();
  expect(mobileBox).not.toBeNull();expect(mobileBox!.x).toBeGreaterThanOrEqual(0);expect(mobileBox!.x+mobileBox!.width).toBeLessThanOrEqual(390);
  expect(await count(page)).toBe(1);
  await page.goto('./#/courses');
  await expect(page.getByTestId('calendar-suggestion-v2')).toHaveCount(1);
  await expect(page.getByTestId('calendar-suggestion-v2')).toContainText('Suggestion V2 expérimentale');
  const backup=await page.evaluate(async input=>{const {readBackupSnapshot}=await import(/* @vite-ignore */ input.modules+'storage/backup.ts');
    const {createBackup}=await import(/* @vite-ignore */ input.modules+'backup/format.ts');return createBackup(await readBackupSnapshot(),'0.7.0','2026-10-18T10:00:00.000Z');},{modules});
  expect(backup.formatVersion).toBe(6);expect(backup.data.coachSuggestionsV2).toHaveLength(1);

  const other=await context.newPage();await other.goto('./#/entrainement');
  await expect(other.getByTestId('coach-v2-experimental').getByRole('status')).toContainText('vous est proposée');
  expect(await count(other)).toBe(1);
});

test('association V2 explicitement confirmée depuis une activité compatible',async({page})=>{
  await page.goto('./#/entrainement');await seed(page);await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
  await page.getByTestId('coach-v2-experimental').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('coach-v2-experimental').getByRole('status')).toContainText('vous est proposée');
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(),occurrence=(await db.getAll('coachSuggestionsV2'))[0];
    await db.put('sessions',{id:'compatible-run',title:'Sortie compatible',sport:'RUNNING',date:occurrence.opportunity.suggestedFor,durationSeconds:2700});db.close();
  },{modules});
  await page.goto('./#/seance/compatible-run');await page.reload();
  const association=page.getByTestId('coach-v2-association');
  await expect(association).toContainText('Suggestion V2 et activité');
  await association.getByRole('button',{name:'Associer explicitement à cette activité'}).click();
  await expect(association.getByRole('status')).toContainText('Association confirmée');
});

test('activation interne sans suggestion admissible ne crée rien',async({page})=>{
  await page.goto('./#/entrainement');await seed(page,false);await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
  await expect(page.getByTestId('coach-v2-experimental')).toContainText('Aucune suggestion adaptée n’est disponible actuellement.');
  expect(await count(page)).toBe(0);
});

test('amorçage débutant stable entre deux onglets sans activité fictive',async({page,context})=>{
  await page.goto('./#/entrainement');await seed(page);
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
    await tx.objectStore('sessions').clear();await tx.objectStore('coachSuggestionsV2').clear();
    await tx.objectStore('coachProfile').put({id:'local',revision:1,createdAt:'2026-10-17T08:00:00.000Z',updatedAt:'2026-10-17T08:00:00.000Z',
      goal:{kind:'regular'},availability:{sessionsPerWeek:2,days:['monday','thursday'],minutesPerSession:30},preferences:{terrain:'road'},accompanimentMode:'advisor'});
    await tx.objectStore('evolvingCoach').put({id:'local',revision:1,createdAt:'2026-10-17T08:00:00.000Z',updatedAt:'2026-10-17T08:00:00.000Z',
      configuration:{goal:{model:'evolving',kind:'begin'},experience:'beginner',structuredPlanningPreference:'accepted'}});
    await tx.done;db.close();
  },{modules});
  await page.evaluate(()=>localStorage.setItem('runklmrun:coach-v2-internal','enabled'));await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await expect(panel).toContainText('Endurance facile');await expect(panel).toContainText('15 min');
  await panel.scrollIntoViewIfNeeded();await expect(panel.getByRole('status')).toContainText('vous est proposée');expect(await count(page)).toBe(1);
  const other=await context.newPage();await other.goto('./#/entrainement');await expect(other.getByTestId('coach-v2-experimental')).toContainText('15 min');
  await expect(other.getByTestId('coach-v2-experimental').getByRole('status')).toContainText('vous est proposée');expect(await count(other)).toBe(1);
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
  await expect(panel.getByRole('status')).toContainText('vous est proposée');expect(await count(page)).toBe(1);
});

test('ressenti difficile : explication réelle conservée pendant la présentation',async({page})=>{
  await page.clock.install({time:new Date('2026-10-18T10:00:00Z')});
  await page.goto('./#/entrainement');await seed(page);
  await page.evaluate(async modules=>{
    const {openDatabase}=await import(/* @vite-ignore */ modules+'storage/database-connection.ts');
    const db=await openDatabase(),tx=db.transaction(['sessions','evolvingCoach'],'readwrite');
    await tx.objectStore('sessions').clear();
    for(const [index,date] of ['2026-09-27','2026-10-01','2026-10-05','2026-10-09','2026-10-12','2026-10-15'].entries()){
      await tx.objectStore('sessions').put({id:'feeling-'+index,title:'Course',sport:'RUNNING',date,durationSeconds:2400,
        ...(index===5?{feeling:{effort:'hard'}}:{})});
    }
    const record=await tx.objectStore('evolvingCoach').get('local');
    record.coachTemperament='rentre-dedans';record.configuration.goal={model:'evolving',kind:'speed'};await tx.objectStore('evolvingCoach').put(record);
    await tx.done;db.close();localStorage.setItem('runklmrun:coach-v2-internal','enabled');
  },modules);
  await page.reload();
  const panel=page.getByTestId('coach-v2-experimental');await panel.scrollIntoViewIfNeeded();
  await expect(panel.getByRole('status')).toContainText('vous est proposée');
  await expect(panel.locator('[data-presentation-title]')).toContainText('Endurance facile');
  await expect(panel).toContainText('la course du 15/10/2026 a été ressentie comme difficile');
  expect(await count(page)).toBe(1);
  await page.reload();await expect(panel.getByRole('status')).toContainText('vous est proposée');
  expect(await count(page)).toBe(1);
});
