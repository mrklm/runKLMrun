import { seedLegacyPlanning } from './helpers/coach';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { test, expect, type Page } from '@playwright/test';
const open=async(p:Page,path='/')=>{await p.goto(`./#${path}`);await expect(p.locator('.splash-screen')).toHaveCount(0);};
const tcx=(day:number)=>`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2026-10-${day}T10:00:00Z</Id><Lap StartTime="2026-10-${day}T10:00:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`;
async function seed(page:Page){
 await page.evaluate(async()=>{
  const root='/runKLMrun/src/storage/';
  const {coachProfileRepository}=await import(/* @vite-ignore */ root+'coach-profile.ts');
  const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ root+'evolving-coach.ts');
  const {sessionRepository}=await import(/* @vite-ignore */ root+'database.ts');
  await coachProfileRepository.save({goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:45},preferences:{}},undefined);
  await createEvolvingCoachRepository().save({goal:{model:'evolving',kind:'begin'},structuredPlanningPreference:'accepted'},undefined);
  await sessionRepository.save({id:'synthetic',title:'Sortie synthétique',date:'2026-10-15',durationSeconds:1800});
 });
}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'));});
test('imports TCX successifs et écriture directe : actualisation locale et autre onglet',async({page,context})=>{
 await open(page,'/historique');await page.getByText('Importer des activités',{exact:true}).click();const other=await context.newPage();await open(other);
 for(const [i,day] of [14,15].entries()){
  await page.getByLabel('Sélectionner les fichiers').setInputFiles({name:`synthetic-${day}.TCX`,mimeType:'application/xml',buffer:Buffer.from(tcx(day))});
  await page.getByRole('button',{name:'Importer les séances',exact:true}).click();
  await expect(other.getByRole('region',{name:'Activités récentes'}).locator('.session-link')).toHaveCount(i+1);
  await page.getByRole('link',{name:'Accueil',exact:true}).click();await expect(page.getByRole('region',{name:'Activités récentes'}).locator('.session-link')).toHaveCount(i+1);
  await page.getByRole('link',{name:'Courses',exact:true}).click();
 }
 await page.getByRole('link',{name:'Accueil',exact:true}).click();
 await page.evaluate(async()=>{const path='/runKLMrun/src/storage/database.ts';const {sessionRepository:r}=await import(/* @vite-ignore */ path);await Promise.all([r.save({id:'direct-a',title:'Ajout direct A',date:'2026-10-16',durationSeconds:600}),r.save({id:'direct-b',title:'Ajout direct B',date:'2026-10-16',durationSeconds:600})]);});
 await expect(page.getByRole('region',{name:'Activités récentes'}).locator('.session-link')).toHaveCount(4);await expect(other.getByRole('region',{name:'Activités récentes'}).locator('.session-link')).toHaveCount(4);
});
test('profil, configuration et planning cohérents dans deux onglets',async({page,context})=>{
 await open(page);await seed(page);await page.getByRole('navigation').getByRole('link', { name: 'Accueil', exact: true }).click();await page.getByRole('link',{name:'Coach',exact:true}).click();
 const other=await context.newPage();await other.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'));await open(other,'/entrainement');
 await page.evaluate(async()=>{
  const root='/runKLMrun/src/storage/';const {coachProfileRepository:r}=await import(/* @vite-ignore */ root+'coach-profile.ts');const p=await r.get();await r.save({...p,availability:{...p.availability,sessionsPerWeek:2}},p.revision);
  const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ root+'evolving-coach.ts');const c=createEvolvingCoachRepository(),v=await c.get();await c.save({...v.configuration,goal:{model:'evolving',kind:'return'}},v.revision);
 });
 for(const p of [page,other]){
  await expect(p.getByRole('region',{name:'Observations du coach',exact:true})).toContainText('Vous souhaitez 2 sorties par semaine');
  await expect(p.getByRole('region',{name:'Votre accompagnement',exact:true})).toContainText('Reprendre');
 }
 const planning=(p:Page)=>p.getByRole('region',{name:'Ancien planning personnel',exact:true});
 await seedLegacyPlanning(page);
 await expect(planning(other).getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 await planning(other).getByRole('button',{name:'Modifier cette séance'}).click();await planning(other).getByLabel('Durée maximale (minutes)').fill('17');
 await planning(other).getByRole('button',{name:'Enregistrer la séance'}).click();
 await expect(planning(page)).toContainText('17 min maximum');
 await planning(page).getByRole('button',{name:'Annuler cette séance'}).click();await expect(planning(other)).toContainText('Annulée');
});
test('une lecture ancienne ne remplace pas une liste plus récente',async({page})=>{
 await open(page);await page.evaluate(async()=>{
  const root='/runKLMrun/src/storage/';const {sessionRepository:r}=await import(/* @vite-ignore */ root+'database.ts');const {storageChanges}=await import(/* @vite-ignore */ root+'changes.ts');
  const original=r.list.bind(r);let hold=true;
  r.list=async()=>{const snapshot=await original();if(hold){hold=false;await new Promise<void>(resolve=>{(window as any).releaseOldRead=resolve;});}return snapshot;};
  storageChanges.committed('runklmrun',['sessions']);
 });
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).releaseOldRead)).toBe('function');
 await page.evaluate(async()=>{const path='/runKLMrun/src/storage/database.ts';const {sessionRepository:r}=await import(/* @vite-ignore */ path);await r.save({id:'new',title:'Sortie récente conservée',date:'2026-10-16',durationSeconds:600});});
 await expect(page.getByRole('region',{name:'Activités récentes'}).getByRole('link',{name:'Sortie récente conservée',exact:true})).toBeVisible();
 await page.evaluate(()=>{(window as any).releaseOldRead();});
 await expect(page.getByRole('region',{name:'Activités récentes'}).getByRole('link',{name:'Sortie récente conservée',exact:true})).toBeVisible();
});

test('archive Polar via worker : les deux onglets voient le lot validé',async({page,context})=>{
 await open(page,'/historique');await page.getByText('Importer des activités',{exact:true}).click();const other=await context.newPage();await open(other);
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

await expect(page.getByRole('region',{name:'Activités récentes'}).locator('.session-link')).toHaveCount(2);

// Vérifier ensuite la propagation vers le second onglet.
await expect(other.getByRole('region',{name:'Activités récentes'}).locator('.session-link')).toHaveCount(2);
 });
