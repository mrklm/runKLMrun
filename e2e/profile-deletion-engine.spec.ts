import { test, expect } from '@playwright/test';

const open=async(page:any)=>{await page.goto('./');await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible();};
const prepare=async(page:any)=>page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts'),d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');const s=(await r.readProfileRegistry())!,a=s.profiles[0],b=await r.createRunnerProfile({displayName:'Destination'});await d.createSessionRepository(a.databaseName).save({id:'a',title:'A',date:'2026-01-01',durationSeconds:1});await d.createSessionRepository(b.databaseName).save({id:'b',title:'B',date:'2026-01-01',durationSeconds:1});await r.markRunnerProfileDeleting(a.id,b.id,a.revision??1,undefined,'operation');return {a,b};});
const createWitness=async(page:any)=>page.evaluate(async()=>{const name=`e2e-deletion-witness-${crypto.randomUUID()}`;const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('witness',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{await new Promise<void>((resolve,reject)=>{const transaction=database.transaction('witness','readwrite');transaction.objectStore('witness').put({id:'sentinel',value:'intact'});transaction.oncomplete=()=>resolve();transaction.onabort=transaction.onerror=()=>reject(transaction.error);});}finally{database.close();}return name;});
const readWitness=async(page:any,name:string)=>page.evaluate(async name=>{const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{return await new Promise<unknown>((resolve,reject)=>{const transaction=database.transaction('witness','readonly'),request=transaction.objectStore('witness').get('sentinel');transaction.oncomplete=()=>resolve(request.result);transaction.onabort=transaction.onerror=()=>reject(transaction.error);});}finally{database.close();}},name);
const deleteWitness=async(page:any,name:string)=>page.evaluate(async name=>await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=request.onblocked=()=>reject(request.error);}),name);

test('supprime uniquement la base ciblée et finalise le registre',async({page})=>{
 await open(page);const {a,b}=await prepare(page);const result=await page.evaluate(async({a,b})=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts'),d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');await r.deleteRunnerProfileDatabase(a.id,'operation');const state=await r.readProfileRegistry(),other=await d.createSessionRepository(b.databaseName).list(),names=await indexedDB.databases();return {ids:state!.profiles.map(x=>x.id),other,names:names.map(x=>x.name)};},{a,b});expect(result.ids).toEqual([b.id]);expect(result.other).toHaveLength(1);expect(result.names).not.toContain(a.databaseName);expect(result.names).not.toContain('runklmrun');
});

test('refuse la suppression sans Web Locks et conserve deleting',async({page})=>{
 await open(page);const {a,b}=await prepare(page);const result=await page.evaluate(async({a})=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');const locks=(navigator as any).locks;Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});let error='';try{await r.deleteRunnerProfileDatabase(a.id,'operation');}catch(e){error=(e as Error).message;}Object.defineProperty(navigator,'locks',{value:locks,configurable:true});return {error,status:(await r.readProfileRegistry())!.profiles.find((x:any)=>x.id===a.id)?.status};},{a,b});expect(result.error).toContain('coordination inter-onglets');expect(result.status).toBe('deleting');
});

test('conserve deleting puis finalise la première suppression après blocked',async({page,context})=>{
 await open(page);const other=await context.newPage();await open(other);const {a,b}=await prepare(page);
 await page.evaluate(async name=>{const request=indexedDB.open(name);await new Promise<void>((resolve,reject)=>{request.onsuccess=()=>{(window as any).blockedProfileConnection=request.result;resolve();};request.onerror=()=>reject(request.error);});},a.databaseName);
 await other.evaluate(async({id})=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');(window as any).deletionBlocked=false;(window as any).deletion=r.deleteRunnerProfileDatabase(id,'operation',()=>{(window as any).deletionBlocked=true;});},{id:a.id});await expect.poll(()=>other.evaluate(()=>Boolean((window as any).deletionBlocked))).toBe(true);
 const pending=await other.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.find((x:any)=>x.id===id)?.status;},a.id);expect(pending).toBe('deleting');
 await page.evaluate(()=>{(window as any).blockedProfileConnection.close();});await other.evaluate(()=> (window as any).deletion);
 const result=await other.evaluate(async({a,b})=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts'),d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');const state=await r.readProfileRegistry(),names=await indexedDB.databases(),destination=await d.createSessionRepository(b.databaseName).list();return {ids:state!.profiles.map((x:any)=>x.id),names:names.map(x=>x.name),destination};},{a,b});expect(result.ids).toEqual([b.id]);expect(result.names).not.toContain(a.databaseName);expect(result.names).not.toContain('runklmrun');expect(result.destination).toHaveLength(1);
});

test('refuse une ouverture mise en attente par la suppression après sa finalisation',async({page,context})=>{
 await open(page);const other=await context.newPage();await open(other);const {a,b}=await prepare(page),lockName=`runklmrun-profile-database-${a.databaseName}`;
 try {
  await other.evaluate(async name=>{const request=indexedDB.open(name);await new Promise<void>((resolve,reject)=>{request.onsuccess=()=>{(window as any).blockingConnection=request.result;resolve();};request.onerror=()=>reject(request.error);});},a.databaseName);
  await page.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');(window as any).deletionBlocked=false;(window as any).deletion=r.deleteRunnerProfileDatabase(id,'operation',()=>{(window as any).deletionBlocked=true;});},a.id);
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).deletionBlocked))).toBe(true);
  await other.evaluate(async name=>{const d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database-connection.ts');(window as any).lateOpenState='pending';(window as any).lateOpen=d.openDatabase(name).then(database=>{database.close();return 'opened';},error=>error.message);},a.databaseName);
  await expect.poll(()=>other.evaluate(async name=>{const locks=await navigator.locks.query();return {held:locks.held.some(lock=>lock.name===name),pending:locks.pending.some(lock=>lock.name===name),state:(window as any).lateOpenState};},lockName)).toEqual({held:true,pending:true,state:'pending'});
  await other.evaluate(()=>{(window as any).blockingConnection.close();});await page.evaluate(()=> (window as any).deletion);
  const result=await other.evaluate(async({a,b})=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts'),d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');const state=await r.readProfileRegistry(),names=await indexedDB.databases(),destination=await d.createSessionRepository(b.databaseName).list();return {lateOpen:await (window as any).lateOpen,ids:state!.profiles.map((profile:any)=>profile.id),names:names.map(database=>database.name),destination};},{a,b});
  expect(result.lateOpen).toContain('n’est plus disponible');expect(result.ids).toEqual([b.id]);expect(result.names).not.toContain(a.databaseName);expect(result.names).not.toContain('runklmrun');expect(result.destination).toHaveLength(1);
 } finally {await other.evaluate(()=>{(window as any).blockingConnection?.close();});}
});

test('sérialise deux suppressions concurrentes sans seconde suppression physique',async({page,context})=>{
 await open(page);const other=await context.newPage();await open(other);const {a,b}=await prepare(page),lockName=`runklmrun-profile-database-${a.databaseName}`;
 const trackDelete=async(target:any)=>target.evaluate(()=>{const original=indexedDB.deleteDatabase.bind(indexedDB);(window as any).deleteDatabaseCalls=0;Object.defineProperty(indexedDB,'deleteDatabase',{configurable:true,value:(name:string)=>{(window as any).deleteDatabaseCalls++;return original(name);}});});
 try {
  await Promise.all([trackDelete(page),trackDelete(other)]);
  await other.evaluate(async name=>{const request=indexedDB.open(name);await new Promise<void>((resolve,reject)=>{request.onsuccess=()=>{(window as any).blockingConnection=request.result;resolve();};request.onerror=()=>reject(request.error);});},a.databaseName);
  await page.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');(window as any).firstBlocked=false;(window as any).firstDeletion=r.deleteRunnerProfileDatabase(id,'operation',()=>{(window as any).firstBlocked=true;});},a.id);
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).firstBlocked))).toBe(true);
  await other.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');(window as any).secondDeletion=r.deleteRunnerProfileDatabase(id,'operation').then(()=>'fulfilled',error=>`rejected:${error.message}`);},a.id);
  await expect.poll(()=>other.evaluate(async name=>{const locks=await navigator.locks.query();return {held:locks.held.some(lock=>lock.name===name),pending:locks.pending.some(lock=>lock.name===name)};},lockName)).toEqual({held:true,pending:true});
  await other.evaluate(()=>{(window as any).blockingConnection.close();});await page.evaluate(()=> (window as any).firstDeletion);
  const result=await other.evaluate(async({a,b})=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts'),d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts');const state=await r.readProfileRegistry(),names=await indexedDB.databases(),destination=await d.createSessionRepository(b.databaseName).list();return {second:await (window as any).secondDeletion,secondCalls:(window as any).deleteDatabaseCalls,ids:state!.profiles.map((profile:any)=>profile.id),names:names.map(database=>database.name),destination};},{a,b});
  const firstCalls=await page.evaluate(()=> (window as any).deleteDatabaseCalls);expect(firstCalls).toBe(1);expect(result.secondCalls).toBe(0);expect(result.second).toContain('Suppression refusée');expect(result.ids).toEqual([b.id]);expect(result.names).not.toContain(a.databaseName);expect(result.destination).toHaveLength(1);
 } finally {await Promise.all([page.evaluate(()=>{delete (indexedDB as any).deleteDatabase;}),other.evaluate(()=>{(window as any).blockingConnection?.close();delete (indexedDB as any).deleteDatabase;})]);}
});

test('reprend au rechargement une suppression marquée mais non commencée',async({page})=>{
 await open(page);const witness=await createWitness(page);try {const {a,b}=await prepare(page);
  await page.reload();await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveValue(b.id);
  await expect.poll(()=>page.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.some((profile:any)=>profile.id===id);},a.id)).toBe(false);
  const result=await page.evaluate(async({a,b})=>{const d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts'),r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');const state=await r.readProfileRegistry(),names=await indexedDB.databases(),destination=await d.createSessionRepository(b.databaseName).list();return {ids:state!.profiles.map((profile:any)=>profile.id),names:names.map(database=>database.name),destination};},{a,b});
  expect(result.ids).toEqual([b.id]);expect(result.names).not.toContain(a.databaseName);expect(result.names).toContain(witness);expect(result.destination).toHaveLength(1);expect(await readWitness(page,witness)).toEqual({id:'sentinel',value:'intact'});
 } finally {await deleteWitness(page,witness);}
});

test('reprend après fermeture de l’onglet qui attendait une suppression bloquée',async({page,context})=>{
 await open(page);const witness=await createWitness(page);const other=await context.newPage();await open(other);const {a,b}=await prepare(page);
 let resumed:any;
 try {
  await page.evaluate(async name=>{const request=indexedDB.open(name);await new Promise<void>((resolve,reject)=>{request.onsuccess=()=>{(window as any).blockingConnection=request.result;resolve();};request.onerror=()=>reject(request.error);});},a.databaseName);
  await other.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');(window as any).deletionBlocked=false;(window as any).deletion=r.deleteRunnerProfileDatabase(id,'operation',()=>{(window as any).deletionBlocked=true;});void (window as any).deletion.catch(()=>{});},a.id);
  await expect.poll(()=>other.evaluate(()=>Boolean((window as any).deletionBlocked))).toBe(true);await other.close();
  resumed=await context.newPage();await open(resumed);await expect(resumed.getByRole('combobox',{name:'Profil actif'})).toHaveValue(b.id);
  const pending=await resumed.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.find((profile:any)=>profile.id===id)?.status;},a.id);expect(pending).toBe('deleting');
  await page.evaluate(()=>{(window as any).blockingConnection.close();});
  await expect.poll(()=>resumed.evaluate(async id=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.some((profile:any)=>profile.id===id);},a.id)).toBe(false);
  const result=await resumed.evaluate(async({a,b})=>{const d=await import(/* @vite-ignore */ '/runKLMrun/src/storage/database.ts'),r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');const state=await r.readProfileRegistry(),names=await indexedDB.databases(),destination=await d.createSessionRepository(b.databaseName).list();return {ids:state!.profiles.map((profile:any)=>profile.id),names:names.map(database=>database.name),destination};},{a,b});
  expect(result.ids).toEqual([b.id]);expect(result.names).not.toContain(a.databaseName);expect(result.names).toContain(witness);expect(result.destination).toHaveLength(1);expect(await readWitness(resumed,witness)).toEqual({id:'sentinel',value:'intact'});
 } finally {await page.evaluate(()=>{(window as any).blockingConnection?.close();});await resumed?.close();await deleteWitness(page,witness);}
});
