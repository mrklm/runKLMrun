import { readFile } from 'node:fs/promises';
import { readBackupFile } from '../src/backup/compression';
import { test,expect,type Page } from '@playwright/test';
const planning=(p:Page)=>p.getByRole('region',{name:'Votre planning personnel',exact:true});
async function open(p:Page){await p.goto('./#/entrainement');await expect(p.locator('.splash-screen')).toHaveCount(0);await expect(planning(p).getByText('Chargement du planning…')).toHaveCount(0);}
async function seed(p:Page,kind='begin',preference='accepted'){
 await p.evaluate(async({kind,preference})=>new Promise<void>((resolve,reject)=>{
  const r=indexedDB.open('runklmrun');r.onerror=()=>reject(r.error);r.onsuccess=()=>{
   const db=r.result,tx=db.transaction(['coachProfile','evolvingCoach'],'readwrite'),time=new Date().toISOString();
   tx.objectStore('coachProfile').put({id:'local',goal:{},availability:{days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:45},preferences:{},revision:1,createdAt:time,updatedAt:time});
   tx.objectStore('evolvingCoach').put({id:'local',configuration:{goal:{model:'evolving',kind},structuredPlanningPreference:preference},revision:1,createdAt:time,updatedAt:time});
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };
 }),{kind,preference});await p.reload();await expect(p.locator('.splash-screen')).toHaveCount(0);await expect(planning(p).getByText('Chargement du planning…')).toHaveCount(0);
}
test('aucune séance fictive sans choix, consentement ou disponibilité',async({page})=>{
 await open(page);await expect(planning(page).getByRole('button',{name:'Accepter',exact:true})).toHaveCount(0);
 await seed(page,'begin','declined');await expect(planning(page).getByText('Aucun accord explicite', {exact:false})).toBeVisible();
 await seed(page,'wellbeing');await expect(planning(page).getByText('Plaisir et forme : aucune planification structurée.', {exact:true})).toBeVisible();
 await seed(page,'begin');
 await page.evaluate(async()=>new Promise<void>(resolve=>{const r=indexedDB.open('runklmrun');r.onsuccess=()=>{const db=r.result,tx=db.transaction('coachProfile','readwrite'),s=tx.objectStore('coachProfile'),q=s.get('local');q.onsuccess=()=>s.put({...q.result,availability:{days:[]}});tx.oncomplete=()=>{db.close();resolve();};};}));
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(planning(page).getByRole('button',{name:'Accepter',exact:true})).toHaveCount(0);
});
test('acceptation, modification, déplacement volontaire, persistance et annulation sur mobile',async({page})=>{
 await page.setViewportSize({width:390,height:900});await open(page);await seed(page);const p=planning(page);
 await expect(p.getByRole('button',{name:'Accepter',exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Accepter',exact:true}).click();await expect(p.getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 await p.getByRole('button',{name:'Modifier cette séance'}).click();await p.getByLabel('Date prévue').fill('2020-01-01');await p.getByLabel('Durée maximale (minutes)').fill('17');await p.getByLabel('Note personnelle').fill('Séance adaptée');
 await p.getByRole('button',{name:'Enregistrer la séance'}).click();await expect(p.getByText('Date passée — réalisation non renseignée',{exact:false})).toBeVisible();
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(p.getByText('Séance adaptée',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.getByRole('button',{name:'Annuler cette séance'}).click();await expect(p.getByRole('article').getByText('Annulée',{exact:false})).toBeVisible();
 await expect(p.getByRole('button',{name:'Accepter',exact:true})).toHaveCount(0);
});
test('refus conservé après rechargement sans remplacement',async({page})=>{
 await open(page);await seed(page);await planning(page).getByRole('button',{name:'Refuser',exact:true}).click();await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);
 await expect(planning(page).getByText('Cette proposition a déjà été traitée.',{exact:false})).toBeVisible();await expect(planning(page).getByRole('button',{name:'Accepter',exact:true})).toHaveCount(0);
});
test('déplacement hors disponibilité non bloquant et modification avant acceptation',async({page})=>{
 await open(page);await seed(page);
 await page.evaluate(async()=>new Promise<void>(resolve=>{const r=indexedDB.open('runklmrun');r.onsuccess=()=>{const db=r.result,tx=db.transaction('coachProfile','readwrite'),store=tx.objectStore('coachProfile'),q=store.get('local');q.onsuccess=()=>store.put({...q.result,revision:2,availability:{days:['monday'],minutesPerSession:45}});tx.oncomplete=()=>{db.close();resolve();};};}));
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);const p=planning(page);
 await p.getByRole('button',{name:'Déplacer',exact:true}).click();await p.getByLabel('Date prévue').fill('2026-10-20');await p.getByLabel('Durée maximale (minutes)').fill('25');
 await expect(p.getByText('Ce jour ne fait pas partie',{exact:false})).toBeVisible();await p.getByRole('button',{name:'Accepter cette modification'}).click();await expect(p.getByRole('article',{name:'Séance du 20/10/2026'})).toBeVisible();
});
test('conflit entre onglets conserve la saisie et exige un rechargement',async({page,context})=>{
 await open(page);await seed(page);await planning(page).getByRole('button',{name:'Accepter',exact:true}).click();
 const second=await context.newPage();await open(second);const a=planning(page),b=planning(second);
 await a.getByRole('button',{name:'Modifier cette séance'}).click();await a.getByLabel('Note personnelle').fill('Brouillon conservé');
 await b.getByRole('button',{name:'Annuler cette séance'}).click();await expect(b.getByRole('article').getByText('Annulée',{exact:false})).toBeVisible();
 await a.getByRole('button',{name:'Enregistrer la séance'}).click();await expect(a.getByRole('alert')).toContainText('autre onglet');await expect(a.getByLabel('Note personnelle')).toHaveValue('Brouillon conservé');
 await a.getByRole('button',{name:'Recharger le planning'}).click();await expect(a.getByRole('article').getByText('Annulée',{exact:false})).toBeVisible();
});
test('changement d’objectif et retrait du consentement conservent les séances acceptées',async({page})=>{
 await open(page);await seed(page);const p=planning(page);await p.getByRole('button',{name:'Accepter',exact:true}).click();
 const c=page.getByRole('region',{name:'Votre accompagnement',exact:true});await c.getByRole('button',{name:'Modifier mes choix'}).click();await c.getByLabel('Votre préférence d’accompagnement').selectOption('declined');await c.getByRole('button',{name:'Enregistrer mes choix'}).click();
 await expect(p.getByRole('button',{name:'Accepter',exact:true})).toHaveCount(0);await expect(p.getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 await c.getByRole('button',{name:'Modifier mes choix'}).click();await c.getByRole('combobox',{name:'Votre objectif',exact:true}).selectOption('wellbeing');await c.getByRole('button',{name:'Enregistrer mes choix'}).click();
 await expect(p.getByText('Plaisir et forme : aucune planification structurée.',{exact:true})).toBeVisible();await expect(p.getByRole('button',{name:'Annuler cette séance'})).toBeVisible();
});

test('planning sauvegardé gzip, restauré JSON en fusion puis gzip en remplacement',async({page})=>{
 await open(page);await seed(page);await planning(page).getByRole('button',{name:'Accepter',exact:true}).click();await expect(planning(page).getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 await page.getByRole('link',{name:'Paramètres',exact:true}).click();const b=page.getByRole('region',{name:'Données et sauvegardes',exact:true});
 const downloading=page.waitForEvent('download');await b.getByRole('button',{name:'Exporter mes données'}).click();const download=await downloading;
 const buffer=await readFile((await download.path())!),doc=await readBackupFile(new Blob([new Uint8Array(buffer)]));
 expect(doc.formatVersion).toBe(4);expect(doc.data.coachPlanning?.sessions).toHaveLength(1);
 await page.getByRole('link',{name:'Coach',exact:true}).click();await planning(page).getByRole('button',{name:'Annuler cette séance'}).click();await expect(planning(page).getByRole('article').getByText('Annulée',{exact:false})).toBeVisible();
 for(const mode of ['merge','replace'] as const){
  await page.getByRole('link',{name:'Paramètres',exact:true}).click();
  const chooserPromise=page.waitForEvent('filechooser');await b.getByRole('button',{name:'Restaurer une sauvegarde'}).click();const chooser=await chooserPromise;
  await chooser.setFiles({name:mode==='merge'?'synthetique.json':'synthetique.json.gz',mimeType:mode==='merge'?'application/json':'application/gzip',buffer:mode==='merge'?Buffer.from(JSON.stringify(doc)):buffer});
  await expect(b.getByRole('heading',{name:'Prévisualisation de la sauvegarde'})).toBeVisible();await expect(b.getByText('Séances du planning',{exact:true})).toBeVisible();
  if(mode==='replace')await b.getByRole('radio',{name:'Remplacer les données locales',exact:true}).check();
  await b.getByRole('checkbox',{name:/^Je confirme/}).check();await b.getByRole('button',{name:'Confirmer la restauration'}).click();await expect(b.getByRole('status')).toContainText('La restauration est terminée');
  await page.getByRole('link',{name:'Coach',exact:true}).click();
  if(mode==='merge')await expect(planning(page).getByRole('article').getByText('Annulée',{exact:false})).toBeVisible();
  else await expect(planning(page).getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 }
});
test('ergonomie : arrondi réellement stocké, discours, terrain, ordre et durée personnelle inchangée',async({page})=>{
 await page.setViewportSize({width:390,height:900});await open(page);await seed(page,'return');
 await page.evaluate(async()=>new Promise<void>(resolve=>{
  const r=indexedDB.open('runklmrun');r.onsuccess=()=>{const db=r.result,tx=db.transaction('coachProfile','readwrite'),store=tx.objectStore('coachProfile'),q=store.get('local');
   q.onsuccess=()=>store.put({...q.result,availability:{...q.result.availability,minutesPerSession:18},preferences:{terrain:'trail'}});
   tx.oncomplete=()=>{db.close();resolve();};};
 }));
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);const p=planning(page);
 await expect(p.getByText('15 min · Allure tranquille · Chemins · Plat ou peu vallonné',{exact:true})).toBeVisible();
 await expect(p.getByText('Effectuez cette sortie à un rythme confortable, sans chercher à accélérer.',{exact:true})).toBeVisible();
 await expect(p.getByText('C’est une proposition :',{exact:false})).toHaveCount(1);
 await expect(p.getByText('Proposition prudente :',{exact:false})).toHaveCount(0);
 const why=p.getByText('Pourquoi cette séance ?', {exact:true});await expect(why).toBeVisible();
 expect(await why.evaluate(el=>(el.parentElement as HTMLDetailsElement).open)).toBe(false);
 await why.click();expect(await why.evaluate(el=>(el.parentElement as HTMLDetailsElement).open)).toBe(true);await why.click();
 await expect(page.getByRole('heading',{name:'Observations du coach',exact:true})).toBeVisible();
 const headings=await page.locator('h2,h3').allTextContents();
 expect(headings.indexOf('Votre planning personnel')).toBeLessThan(headings.indexOf('Proposition du Coach :'));
 expect(headings.indexOf('Proposition du Coach :')).toBeLessThan(headings.indexOf('Observations du coach'));
 expect(headings.indexOf('Observations du coach')).toBeLessThan(headings.indexOf('Votre accompagnement'));
 await p.getByRole('button',{name:'Accepter',exact:true}).click();await expect(p.getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 async function stored(){return page.evaluate(async()=>new Promise<{durationSeconds:number;original:{durationSeconds:number}}>(resolve=>{const r=indexedDB.open('runklmrun');r.onsuccess=()=>{const db=r.result,tx=db.transaction('coachPlanning'),q=tx.objectStore('coachPlanning').get('local');tx.oncomplete=()=>{db.close();resolve(q.result.sessions[0]);};};}));}
 expect(await stored()).toMatchObject({durationSeconds:900,original:{durationSeconds:900}});
 await p.getByRole('button',{name:'Modifier cette séance'}).click();await p.getByLabel('Durée maximale (minutes)').fill('17.5');await p.getByRole('button',{name:'Enregistrer la séance'}).click();await expect(p.getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 expect((await stored()).durationSeconds).toBe(1050);
 await expect(p.getByText('17 min 30 s maximum', {exact:false})).toBeVisible();
 const beforeDisplay=await stored();await p.getByText('Proposition initiale',{exact:true}).click();expect(await stored()).toEqual(beforeDisplay);
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);expect((await stored()).durationSeconds).toBe(1050);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for (const width of [390,1280]) test(`présentation compacte et explications lisibles à ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await open(page);const p=planning(page);
 await expect(p.locator('.coach-proposal-note')).toHaveCount(0);
 await seed(page);await expect(p.getByRole('heading',{name:'Proposition du Coach :',exact:true})).toBeVisible();
 await expect(p.getByRole('heading',{name:'Séances acceptées',exact:true})).toHaveCount(0);
 await expect(p.getByText(/Aucune séance acceptée|Aucun programme n’est rempli automatiquement/)).toHaveCount(0);
 const note=p.locator('.coach-proposal-note');await expect(note).toHaveCount(1);
 expect(await note.evaluate(el=>el.previousElementSibling?.classList.contains('coach-proposal-card'))).toBe(true);
 await expect(p.locator('.coach-proposal-card .coach-proposal-note')).toHaveCount(0);
 await p.getByText('Pourquoi cette séance ?', {exact:true}).click();
 const explanations=p.locator('details').filter({has:page.locator('summary').getByText('Pourquoi cette séance ?', {exact:true})});await expect(explanations.locator('h5')).toHaveText(['Votre rythme','La durée','L’intensité','Le terrain']);
 expect(await explanations.innerText()).not.toMatch(/\b\d+ s\b|C’est une proposition|Effectuez cette sortie/);
 for(const block of await explanations.locator('.coach-explanation').all()){
  expect((await block.innerText()).length).toBeLessThan(360);
  expect(await block.evaluate(el=>{const c=getComputedStyle(el);return parseFloat(c.lineHeight)>=1.5*parseFloat(c.fontSize)&&parseFloat(c.marginTop)>=16;})).toBe(true);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.getByRole('button',{name:'Accepter',exact:true}).click();
 await expect(p.getByRole('heading',{name:'Séances acceptées',exact:true})).toBeVisible();
 await expect(note).toHaveCount(0);await expect(p.getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
});
