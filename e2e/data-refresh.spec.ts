import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { test, expect, type Page } from '@playwright/test';
import { activeDatabase } from './helpers/active-database';
const testTime=new Date('2026-10-16T12:00:00Z');
async function prepareClock(page:Page){await page.clock.install({time:new Date(testTime.getTime()-1)});await page.clock.pauseAt(testTime);}
async function open(page:Page,path='/'){
 await page.goto(`./#${path}`);const splash=page.locator('.splash-screen');await expect(splash).toBeVisible();await page.clock.runFor(3000);await expect(splash).toHaveCount(0);
 await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
 await expect(page.getByRole('combobox',{name:'Profil actif',exact:true})).toBeVisible();
}
const tcx=(day:number)=>`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2026-10-${day}T10:00:00Z</Id><Lap StartTime="2026-10-${day}T10:00:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`;
async function seed(page:Page){
 const databaseName=await activeDatabase(page);
 await page.evaluate(async databaseName=>{
  const root='/runKLMrun/src/storage/';
  const {createCoachProfileRepository}=await import(/* @vite-ignore */ root+'coach-profile.ts');
  const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ root+'evolving-coach.ts');
  const {createSessionRepository}=await import(/* @vite-ignore */ root+'database.ts');
  await createCoachProfileRepository(databaseName).save({goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:45},preferences:{}},undefined);
  await createEvolvingCoachRepository(databaseName).save({goal:{model:'evolving',kind:'begin'},structuredPlanningPreference:'accepted'},undefined);
  await createSessionRepository(databaseName).save({id:'synthetic',title:'Sortie synthétique',date:'2026-10-15',durationSeconds:1800});
 },databaseName);
}
test.beforeEach(async({page})=>{await prepareClock(page);});
test('imports TCX successifs et écriture directe : actualisation locale et autre onglet',async({page,context})=>{
 await open(page,'/historique');await page.getByText('Importer des activités',{exact:true}).click();const other=await context.newPage();await prepareClock(other);await open(other);
 const databaseName=await activeDatabase(page);expect(await activeDatabase(other)).toBe(databaseName);
 await Promise.all([page.clock.resume(),other.clock.resume()]);
 for(const [i,day] of [14,15].entries()){
  await page.getByLabel('Sélectionner les fichiers').setInputFiles({name:`synthetic-${day}.TCX`,mimeType:'application/xml',buffer:Buffer.from(tcx(day))});
  await page.getByRole('button',{name:'Importer les séances',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Compte rendu'})).toContainText('1 séances ajoutées');
  await other.bringToFront();
  await expect(other.getByRole('group',{name:'Activités récentes',exact:true}).locator('.session-link')).toHaveCount(i+1);
  await page.getByRole('link',{name:'Accueil',exact:true}).click();await expect(page.getByRole('group',{name:'Activités récentes',exact:true}).locator('.session-link')).toHaveCount(i+1);
  await page.getByRole('link',{name:'Courses',exact:true}).click();
 }
 await page.getByRole('link',{name:'Accueil',exact:true}).click();
 await page.evaluate(async databaseName=>{const path='/runKLMrun/src/storage/database.ts';const {createSessionRepository}=await import(/* @vite-ignore */ path);const r=createSessionRepository(databaseName);await Promise.all([r.save({id:'direct-a',title:'Ajout direct A',date:'2026-10-16',durationSeconds:600}),r.save({id:'direct-b',title:'Ajout direct B',date:'2026-10-16',durationSeconds:600})]);},databaseName);
 await expect(page.getByRole('group',{name:'Activités récentes',exact:true}).locator('.session-link')).toHaveCount(4);await expect(other.getByRole('group',{name:'Activités récentes',exact:true}).locator('.session-link')).toHaveCount(4);
});
test('profil et configuration V2 cohérents dans deux onglets',async({page,context})=>{
 await open(page);await seed(page);await page.evaluate(()=>{location.hash='#/entrainement';});await expect(page.getByRole('heading',{name:'Coach',exact:true})).toBeVisible();
 const other=await context.newPage();await prepareClock(other);await open(other,'/entrainement');
 const databaseName=await activeDatabase(page);expect(await activeDatabase(other)).toBe(databaseName);
 await Promise.all([page.clock.resume(),other.clock.resume()]);
 await page.evaluate(async databaseName=>{
  const root='/runKLMrun/src/storage/';const {createCoachProfileRepository}=await import(/* @vite-ignore */ root+'coach-profile.ts');const r=createCoachProfileRepository(databaseName),p=await r.get();await r.save({...p,availability:{...p.availability,sessionsPerWeek:2}},p.revision);
  const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ root+'evolving-coach.ts');const c=createEvolvingCoachRepository(databaseName),v=await c.get();await c.save({...v.configuration,goal:{model:'evolving',kind:'return'}},v.revision);
 },databaseName);
 for(const p of [page,other]){
  await expect(p.getByRole('region',{name:'Votre profil de coureur',exact:true})).toContainText('2');
  await expect(p.getByRole('region',{name:'Votre accompagnement',exact:true})).toContainText('Reprendre');
 }
});
test('une lecture ancienne ne remplace pas une liste plus récente',async({page,context})=>{
 await page.addInitScript(() => {
  const original=IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll=function(...args){
   const request=original.apply(this,args);
   if(!(window as any).holdNextSessionRead||this.name!=='sessions')return request;
   (window as any).holdNextSessionRead=false;
   return new Promise((resolve,reject)=>{
    request.addEventListener('success',()=>{(window as any).releaseOldRead=()=>resolve(request.result);},{once:true});
    request.addEventListener('error',()=>reject(request.error),{once:true});
   });
  };
 });
 await open(page);await page.clock.resume();const other=await context.newPage();await prepareClock(other);await open(other);await other.clock.resume();const databaseName=await activeDatabase(page);expect(await activeDatabase(other)).toBe(databaseName);await page.evaluate(databaseName=>{
  (window as any).holdNextSessionRead=true;
 },databaseName);
 await other.evaluate(databaseName=>{
  const channel=new BroadcastChannel('runklmrun-storage-changed');
  channel.postMessage({database:databaseName,scopes:['sessions']});channel.close();
 },databaseName);
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).releaseOldRead)).toBe('function');
 await other.evaluate(async databaseName=>{const path='/runKLMrun/src/storage/database.ts';const {createSessionRepository}=await import(/* @vite-ignore */ path);await createSessionRepository(databaseName).save({id:'new',title:'Sortie récente conservée',date:'2026-10-16',durationSeconds:600});},databaseName);
 await page.bringToFront();
 const recentActivities=page.locator('details[aria-labelledby="activity-title"]');
 await recentActivities.locator('summary').click();
 await expect(recentActivities.getByRole('link',{name:'Sortie récente conservée',exact:true})).toBeVisible();
 await page.evaluate(()=>{(window as any).releaseOldRead();});
 await expect(recentActivities.getByRole('link',{name:'Sortie récente conservée',exact:true})).toBeVisible();
});

test('archive Polar via worker : les deux onglets voient le lot validé',async({page,context})=>{
 await open(page,'/historique');await page.getByText('Importer des activités',{exact:true}).click();const other=await context.newPage();await prepareClock(other);await open(other);
 await Promise.all([page.clock.resume(),other.clock.resume()]);
 const writer=new ZipWriter(new BlobWriter(),{useWebWorkers:false});
 for(const id of ['a','b'])await writer.add(`training-session_${id}.json`,new TextReader(JSON.stringify({exercises:[{sport:'RUNNING',startTime:'2026-10-15T10:00:00',duration:'PT10M'}]})));
 const zip=await writer.close();
 await page.getByLabel('Sélectionner les fichiers').setInputFiles({name:'synthetic.zip',mimeType:'application/zip',buffer:Buffer.from(await zip.arrayBuffer())});
await page.getByRole('button', {
  name: 'Importer les séances',
  exact: true
}).click();

// Attendre le worker avant de quitter la page (le démontage peut interrompre l’import).
await expect(page.getByRole('status').filter({hasText:'Compte rendu'})).toContainText('2 séances ajoutées');
await page.getByRole('link', {
  name: 'Accueil',
  exact: true
}).click();

await expect(page.getByRole('group',{name:'Activités récentes',exact:true}).locator('.session-link')).toHaveCount(2);

// Vérifier ensuite la propagation vers le second onglet.
await expect(other.getByRole('group',{name:'Activités récentes',exact:true}).locator('.session-link')).toHaveCount(2);
 });
