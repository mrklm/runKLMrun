import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page) => { await page.goto('./'); await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible(); await expect(page.locator('.splash-screen')).toHaveCount(0); };
async function profiles(page: Page) {
  return page.evaluate(async () => {
    const root='/runKLMrun/src/storage/';
    const registry=await import(/* @vite-ignore */ `${root}profile-registry.ts`);
    const bootstrap=await import(/* @vite-ignore */ `${root}profile-bootstrap.ts`);
    const database=await import(/* @vite-ignore */ `${root}database.ts`);
    const state=await registry.readProfileRegistry(); if(!state) throw new Error('Registre absent');
    const a={...state.profiles[0],displayName:'Profil A'};
    await registry.writeProfileRegistry({...state,profiles:[a],lastUsedProfileId:a.id});
    const b=await registry.createRunnerProfile({displayName:'Profil B'});
    await database.createSessionRepository(a.databaseName).save({id:'a',title:'Séance A',date:'2026-10-20',durationSeconds:600});
    await database.createSessionRepository(b.databaseName).save({id:'b',title:'Séance B',date:'2026-10-21',durationSeconds:600});
    await bootstrap.selectProfile(a.id); return {a,b};
  });
}

test('sélection A → B → A, isolation et persistance',async({page,context})=>{
  await open(page); await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible(); const {a,b}=await profiles(page); await page.reload(); await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveValue(a.id);
  await expect(page.getByRole('link',{name:'Séance A',exact:true})).toBeVisible();
  const select=page.getByRole('combobox',{name:'Profil actif'});
  await select.selectOption(b.id); await expect(select).toHaveValue(b.id); await expect(page.getByRole('link',{name:'Séance B',exact:true})).toBeVisible(); await expect(page.getByRole('link',{name:'Séance A',exact:true})).toHaveCount(0);
  await page.reload(); await expect(select).toHaveValue(b.id); await expect(page.getByRole('link',{name:'Séance B',exact:true})).toBeVisible();
  const other=await context.newPage(); await open(other); await expect(other.getByRole('combobox',{name:'Profil actif'})).toHaveValue(b.id);
  await select.selectOption(a.id); await expect(page.getByRole('link',{name:'Séance A',exact:true})).toBeVisible(); await expect(page.getByRole('link',{name:'Séance B',exact:true})).toHaveCount(0);
});

test('combobox accessible et verrouillée pendant une opération',async({page})=>{
  await open(page); await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible(); await profiles(page); await page.reload(); const select=page.getByRole('combobox',{name:'Profil actif'}); await expect(select).toBeVisible();
  await page.evaluate(async()=>{const guard=await import(/* @vite-ignore */ '/runKLMrun/src/components/operation-guard.ts');(window as any).releaseProfileTestOperation=guard.acquireOperation();});
  await expect(select).toBeDisabled(); await expect(page.getByText('Changement de profil indisponible',{exact:false})).toBeVisible();
  await page.evaluate(()=>{(window as any).releaseProfileTestOperation();}); await expect(select).toBeEnabled();
});

test('n’affiche pas un profil deleting et prépare le profil de destination',async({page})=>{
 await open(page);const {a,b}=await profiles(page);await page.reload();await page.evaluate(async({id,destination,revision})=>{const registry=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');await registry.markRunnerProfileDeleting(id,destination,revision);},{id:a.id,destination:b.id,revision:a.revision??1});
 const select=page.getByRole('combobox',{name:'Profil actif'});await expect(select).toHaveValue(b.id);await expect(select.getByRole('option',{name:'Profil A'})).toHaveCount(0);
});

test('les suggestions V1 restent passives et silencieuses au démarrage, au changement de profil et après les opérations sur les séances',async({page})=>{
  await open(page);
  const fixture=await page.evaluate(async()=>{
    const root='/runKLMrun/src/storage/';
    const registry=await import(/* @vite-ignore */ `${root}profile-registry.ts`);
    const bootstrap=await import(/* @vite-ignore */ `${root}profile-bootstrap.ts`);
    const {openDatabase}=await import(/* @vite-ignore */ `${root}database-connection.ts`);
    const {suggestionId,suggestionExpiry}=await import(/* @vite-ignore */ '/runKLMrun/src/core/coach/suggestions.ts');
    const state=await registry.readProfileRegistry();if(!state)throw new Error('Registre absent');
    const a=state.profiles.find(profile=>profile.id===state.lastUsedProfileId)??state.profiles[0];
    const b=await registry.createRunnerProfile({displayName:'Profil B passif'});
    const addFixture=async(databaseName:string,id:string)=>{
      const date='2026-10-20',now='2026-10-01T08:00:00.000Z';
      const presented={date,kind:'endurance' as const,durationSeconds:1800};
      const suggestion={...presented,id:suggestionId(presented),createdAt:now,updatedAt:now,revision:1,expiresOn:suggestionExpiry(date),state:'current' as const};
      const importedDate='2026-10-22';
      const imported={date:importedDate,kind:'easy' as const,durationSeconds:1500};
      const importedSuggestion={...imported,id:suggestionId(imported),createdAt:now,updatedAt:now,revision:1,expiresOn:suggestionExpiry(importedDate),state:'current' as const};
      const db=await openDatabase(databaseName),tx=db.transaction(['coachSuggestions','sessions','coachSuggestionsV2'],'readwrite');
      await tx.objectStore('coachSuggestions').put(suggestion);
      await tx.objectStore('coachSuggestions').put(importedSuggestion);
      await tx.objectStore('sessions').put({id,title:`Séance ${id}`,sport:'RUNNING',date,durationSeconds:1800});
      await tx.done;db.close();
    };
    await addFixture(a.databaseName,'a');await addFixture(b.databaseName,'b');await bootstrap.selectProfile(a.id);
    return {a,b};
  });
  await page.addInitScript(()=>{
    const increment=()=>{(window as Window&{v1SuggestionWrites?:number}).v1SuggestionWrites=((window as Window&{v1SuggestionWrites?:number}).v1SuggestionWrites??0)+1;};
    for(const method of ['add','put','delete'] as const) {
      const original=IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method]=function(this:IDBObjectStore,...args:Parameters<typeof original>) {
        if(this.name==='coachSuggestions')increment();
        return original.apply(this,args);
      };
    }
  });
  await page.reload();await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveValue(fixture.a.id);await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.evaluate(async()=>{
    const {storageChanges}=await import(/* @vite-ignore */ '/runKLMrun/src/storage/changes.ts');
    storageChanges.subscribe(change=>{
      if(change.scopes.includes('suggestions')) {
        const target=window as Window&{v1SuggestionNotifications?:number};
        target.v1SuggestionNotifications=(target.v1SuggestionNotifications??0)+1;
      }
    });
  });
  const state=async(databaseName:string,id='suggestion:v1:2026-10-20:endurance:1800:-:-')=>page.evaluate(async ({databaseName,id})=>{
    const {openDatabase}=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');
    const db=await openDatabase(databaseName);const [suggestion,occurrences]=await Promise.all([db.get('coachSuggestions',id),db.getAll('coachSuggestionsV2')]);db.close();
    return {suggestion,hasActivityId:suggestion!==undefined&&Object.hasOwn(suggestion,'activityId'),occurrenceCount:occurrences.length,writes:(window as Window&{v1SuggestionWrites?:number}).v1SuggestionWrites??0,notifications:(window as Window&{v1SuggestionNotifications?:number}).v1SuggestionNotifications??0};
  },{databaseName,id});
  await expect.poll(()=>state(fixture.a.databaseName)).toEqual({suggestion:{date:'2026-10-20',kind:'endurance',durationSeconds:1800,id:'suggestion:v1:2026-10-20:endurance:1800:-:-',createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z',revision:1,expiresOn:'2026-10-28',state:'current'},hasActivityId:false,occurrenceCount:0,writes:0,notifications:0});
  await page.evaluate(async databaseName=>{const {createSessionRepository}=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');const sessions=createSessionRepository(databaseName);await sessions.addImported({id:'a-import',title:'Séance A importée',sport:'RUNNING',date:'2026-10-22',durationSeconds:1500});await sessions.save({id:'a',title:'Séance A déplacée',sport:'RUNNING',date:'2026-10-21',durationSeconds:1800});await sessions.remove('a');},fixture.a.databaseName);
  await expect.poll(()=>state(fixture.a.databaseName,'suggestion:v1:2026-10-22:easy:1500:-:-')).toMatchObject({suggestion:{revision:1},hasActivityId:false,occurrenceCount:0,writes:0,notifications:0});
  await expect.poll(()=>state(fixture.a.databaseName)).toMatchObject({suggestion:{revision:1},hasActivityId:false,occurrenceCount:0,writes:0,notifications:0});
  const select=page.getByRole('combobox',{name:'Profil actif'});await select.selectOption(fixture.b.id);await expect(select).toHaveValue(fixture.b.id);await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect.poll(()=>state(fixture.b.databaseName)).toMatchObject({suggestion:{revision:1},hasActivityId:false,occurrenceCount:0,writes:0,notifications:0});
  await page.evaluate(async databaseName=>{const {createSessionRepository}=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');await createSessionRepository(databaseName).remove('b');},fixture.b.databaseName);
  await expect.poll(()=>state(fixture.a.databaseName)).toMatchObject({suggestion:{revision:1},hasActivityId:false,occurrenceCount:0,writes:0,notifications:0});
});
