import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { createChangeBus, storageChanges } from './changes';
import { createSessionRepository } from './database';
import { createCoachProfileRepository } from './coach-profile';
import { createEvolvingCoachRepository } from './evolving-coach';
import { createCoachPlanningRepository } from './coach-planning';
import { createBackupService, prepareNative } from './backup';
import { createBackup } from '../backup/format';
import { readBackupFile, exportGzip } from '../backup/compression';
import { importPolarArchive } from '../importers/archive';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
const names:string[]=[];
const name=()=>{const n=`changes-${crypto.randomUUID()}`;names.push(n);return n;};
const pause=()=>new Promise(resolve=>setTimeout(resolve,10));
const session={id:'a',date:'2026-10-16',durationSeconds:600,title:'Synthétique'};
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();await pause();await Promise.all(names.splice(0).map(n=>deleteDB(n)));});
it('regroupe les lots imbriqués et concurrents, sans notification pour un lot vide',async()=>{
 const bus=createChangeBus(false),seen=vi.fn(),off=bus.subscribe(seen);
 const a=bus.batch('db'),b=bus.batch('db');bus.committed('db',['sessions']);a();a();await pause();expect(seen).not.toHaveBeenCalled();
 bus.committed('db',['sessions']);b();await pause();expect(seen).toHaveBeenCalledTimes(1);expect(seen.mock.calls[0][0].scopes).toEqual(['sessions']);
 bus.batch('db')();await pause();expect(seen).toHaveBeenCalledTimes(1);off();
});
it.each(['sessions', 'suggestions', 'feelings'] as const)('invalide les autres contextes pour %s sans boucle ni doublon',async scope=>{
 const channels=new Set<FakeChannel>();let messages=0;
 class FakeChannel { onmessage?: (event:{data:unknown})=>void;constructor(public name:string){channels.add(this);}close(){channels.delete(this);}postMessage(data:unknown){messages++;for(const c of channels)if(c!==this&&c.name===this.name)c.onmessage?.({data});} }
 vi.stubGlobal('BroadcastChannel',FakeChannel);
 const a=createChangeBus(true),b=createChangeBus(true),local=vi.fn(),remote=vi.fn(),offA=a.subscribe(local),offB=b.subscribe(remote);
 a.committed('db',[scope]);await pause();expect(local).toHaveBeenCalledTimes(1);expect(remote).toHaveBeenCalledTimes(1);expect(messages).toBe(1);
 b.committed('db',['planning']);await pause();expect(local).toHaveBeenCalledTimes(2);expect(remote).toHaveBeenCalledTimes(2);expect(messages).toBe(2);
 offA();offB();expect(channels.size).toBe(0);
});
it('notifie uniquement après validation, ni doublon ni écriture échouée',async()=>{
 const n=name(),repo=createSessionRepository(n),spy=vi.spyOn(storageChanges,'committed');
 expect(await repo.addImported(session)).toBe(true);expect(await repo.list()).toHaveLength(1);expect(spy).toHaveBeenCalledWith(n,['sessions']);spy.mockClear();
 expect(await repo.addImported(session)).toBe(false);expect(spy).not.toHaveBeenCalled();
 const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new Error('échec synthétique');});
 await expect(repo.save(session)).rejects.toThrow();expect(spy).not.toHaveBeenCalled();put.mockRestore();
 await Promise.all([repo.save({...session,title:'B'}),repo.save({...session,title:'C'})]);expect(spy).toHaveBeenCalledTimes(2);
});
it('archive : un événement pour deux ajouts puis aucun pour le réimport',async()=>{
 const n=name(),repo=createSessionRepository(n),seen=vi.fn(),off=storageChanges.subscribe(e=>{if(e.database===n)seen(e);});
 const writer=new ZipWriter(new BlobWriter(),{useWebWorkers:false});
 for(const id of ['a','b'])await writer.add(`training-session_${id}.json`,new TextReader(JSON.stringify({exercises:[{sport:'RUNNING',startTime:'2026-10-16T10:00:00',duration:'PT10M'}]})));
 const file=await writer.close();expect((await importPolarArchive(file,repo,()=>{})).imported).toBe(2);await pause();expect(seen).toHaveBeenCalledTimes(1);
 await importPolarArchive(file,repo,()=>{});await pause();expect(seen).toHaveBeenCalledTimes(1);off();
});
it('profil, configuration, refus et annulation : événements après validation seulement',async()=>{
 const n=name(),spy=vi.spyOn(storageChanges,'committed');
 const profile=createCoachProfileRepository(n),coach=createEvolvingCoachRepository(n),planning=createCoachPlanningRepository(n);
 await profile.save({goal:{},availability:{},preferences:{}},undefined);
 await coach.save({goal:{model:'evolving',kind:'begin'},structuredPlanningPreference:'accepted'},undefined);
 const p=await planning.apply({type:'dismiss',key:'a'.repeat(64),coachRevision:1,profileRevision:1},undefined);
 expect(spy.mock.calls.map(c=>c[1])).toEqual([['profile'],['configuration'],['planning']]);spy.mockClear();
 await expect(profile.save({goal:{},availability:{},preferences:{}},undefined)).rejects.toThrow();
 await expect(planning.apply({type:'cancel',id:'absent'},p.revision)).rejects.toThrow();expect(spy).not.toHaveBeenCalled();
});
it.each(['merge','replace'] as const)('restauration %s : aperçu silencieux, événement unique après transaction',async mode=>{
 const n=name(),service=createBackupService({export:d=>exportGzip(d,'0.6.0'),parse:file=>readBackupFile(file),prepare:(p,o)=>prepareNative(p,o)},n),spy=vi.spyOn(storageChanges,'committed');
 const preview=await service.preview(new Blob([JSON.stringify(await createBackup({sessions:[session],details:[],coachProfile:null},'0.6.0'))]));
 expect(spy).not.toHaveBeenCalled();await service.restore(preview,{mode,profile:mode==='merge'?'keep':'restore'});
 expect(spy).toHaveBeenCalledTimes(1);expect(spy).toHaveBeenCalledWith(n,['sessions','profile','configuration','planning','shoes','suggestions']);
 spy.mockClear();await expect(service.restore(preview,{mode,profile:mode==='merge'?'keep':'restore'})).rejects.toThrow();expect(spy).not.toHaveBeenCalled();
});

it('un import en cours ne retarde pas le profil',async()=>{
 const bus=createChangeBus(false),seen=vi.fn(),off=bus.subscribe(seen),end=bus.batch('db');
 bus.committed('db',['sessions']);bus.committed('db',['profile']);await pause();
 expect(seen).toHaveBeenCalledTimes(1);expect(seen.mock.calls[0][0].scopes).toEqual(['profile']);
 end();await pause();expect(seen).toHaveBeenCalledTimes(2);off();
});
