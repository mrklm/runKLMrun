import { test, expect, type Page } from '@playwright/test';

const open=async(page:Page)=>{await page.goto('./#/parametres');await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible();const section=page.getByRole('region',{name:'Profils'}),panel=section.locator('> details');if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click();await expect(panel).toHaveAttribute('open','');return section;};
const addProfile=async(page:Page,name:string)=>page.evaluate(async name=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts'),d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts'),state=(await r.readProfileRegistry())!,active=state.profiles.find(profile=>profile.id===state.lastUsedProfileId)??state.profiles[0],profile=await r.createRunnerProfile({displayName:name});await d.createSessionRepository(active.databaseName).save({id:`${active.id}-session`,title:'Séance conservée',date:'2026-01-01',durationSeconds:1});await d.createSessionRepository(profile.databaseName).save({id:`${profile.id}-session`,title:'Séance supprimée',date:'2026-01-02',durationSeconds:1});return {active,profile};},name);
const registry=async(page:Page)=>page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!;});
const confirm=async(section:any,name:string)=>{await section.getByRole('button',{name:'Supprimer',exact:true}).click();const dialog=section.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByLabel(/Confirmez avec le pseudonyme/).fill(name);await dialog.getByRole('button',{name:'Supprimer définitivement'}).click();};

test('ne supprime pas le dernier profil et la sélection reste sans effet',async({page})=>{
 const section=await open(page),before=await registry(page),select=section.getByRole('combobox',{name:'Profil à supprimer'});await expect(section.getByRole('button',{name:'Supprimer',exact:true})).toBeDisabled();await select.selectOption(before.profiles[0].id);await expect(page.getByRole('dialog')).toHaveCount(0);expect((await registry(page)).profiles.map(profile=>profile.id)).toEqual(before.profiles.map(profile=>profile.id));
});

test('annule et ferme la confirmation sans modifier le registre',async({page})=>{
 await page.setViewportSize({width:390,height:844});let section=await open(page);const {profile}=await addProfile(page,'Destination');await page.reload();section=await open(page);const select=section.getByRole('combobox',{name:'Profil à supprimer'});await select.selectOption(profile.id);const before=await registry(page);
 await section.getByRole('button',{name:'Supprimer',exact:true}).click();const dialog=section.getByRole('dialog');await expect(dialog).toContainText('activités, chaussures, paramètres et données du Coach');await expect(dialog.getByRole('button',{name:'Supprimer définitivement'})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await section.getByRole('button',{name:'Supprimer',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await dialog.getByRole('button',{name:'Annuler'}).click();await expect(dialog).toHaveCount(0);expect((await registry(page)).profiles.map(value=>value.id)).toEqual(before.profiles.map(value=>value.id));
});

test('supprime un profil non actif, conserve le profil courant et actualise les listes',async({page})=>{
 let section=await open(page);const {active,profile}=await addProfile(page,'Secondaire');await page.reload();section=await open(page);await section.getByRole('combobox',{name:'Profil à supprimer'}).selectOption(profile.id);await confirm(section,profile.displayName);
 await expect.poll(async()=> (await registry(page)).profiles.map(value=>value.id)).toEqual([active.id]);await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveValue(active.id);await expect(section.getByRole('combobox',{name:'Profil à modifier'}).getByRole('option',{name:profile.displayName})).toHaveCount(0);await expect(section.getByRole('combobox',{name:'Profil à supprimer'})).toHaveValue(active.id);
 const sessions=await page.evaluate(async databaseName=>{const d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');return d.createSessionRepository(databaseName).list();},active.databaseName);expect(sessions.map(value=>value.title)).toContain('Séance conservée');
});

test('supprime le profil actif, bascule vers la destination et conserve ses données après rechargement',async({page})=>{
 let section=await open(page);const {active,profile}=await addProfile(page,'Destination active');await page.reload();section=await open(page);await section.getByRole('combobox',{name:'Profil à supprimer'}).selectOption(active.id);await confirm(section,active.displayName);
 await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveValue(profile.id);await expect.poll(async()=> (await registry(page)).profiles.map(value=>value.id)).toEqual([profile.id]);await page.reload();await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveValue(profile.id);await page.goto('./#/');await expect(page.getByRole('link',{name:'Séance supprimée',exact:true})).toBeVisible();
});

test('signale une suppression bloquée et interdit une seconde confirmation',async({page,context})=>{
 let section=await open(page);const {profile}=await addProfile(page,'Profil bloqué');const other=await context.newPage();await other.goto('./');await other.evaluate(async databaseName=>{const request=indexedDB.open(databaseName);const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});(window as Window&{profileDeletionBlocker?:IDBDatabase}).profileDeletionBlocker=database;},profile.databaseName);await page.reload();section=await open(page);await section.getByRole('combobox',{name:'Profil à supprimer'}).selectOption(profile.id);await confirm(section,profile.displayName);
 await expect(section.getByRole('alert')).toContainText('attend la fermeture d’un autre onglet');await expect(section.getByRole('button',{name:'Supprimer',exact:true})).toBeDisabled();await other.close();await expect.poll(async()=> (await registry(page)).profiles.some(value=>value.id===profile.id)).toBe(false);
});
