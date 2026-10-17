import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { createSuggestionRepository, SuggestionConflictError } from './coach-suggestions';
import { openDatabase } from './database-connection';
import { storageChanges } from './changes';
import { suggestionFollowUp, suggestionId, validateStoredSuggestion } from '../core/coach/suggestions';
import { productPolicy } from '../core/coach/product-policy';
import { proposeNextSession } from '../core/coach/proposals';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { createBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import { validateBackupData } from '../backup/validation';
import type { PresentedSuggestion } from '../types/coach-suggestion';
const names: string[] = [];
const name = () => { const n = `suggestions-${crypto.randomUUID()}`; names.push(n); return n; };
const now = () => new Date('2026-10-17T12:00:00.000Z');
const input: PresentedSuggestion = { date:'2026-10-18',kind:'endurance',durationSeconds:1800,terrain:{surface:'trail',relief:'free'} };
const service = (n:string) => createBackupService({export:data=>exportGzip(data,'0.6.1'),parse:file=>readBackupFile(file),prepare:(p,o)=>prepareNative(p,o,now())},n);
const json = async (n:string) => new Blob([JSON.stringify(await createBackup(await readBackupSnapshot(n),'0.6.1'))]);
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(names.splice(0).map(n=>deleteDB(n)));});
it('migration v7 additive : planning et autres magasins inchangés',async()=>{
 const n=name(),db=await openDB(n,7,{upgrade(d){d.createObjectStore('coachPlanning',{keyPath:'id'});d.createObjectStore('sessions',{keyPath:'id'});}});
 const planning={id:'local',sessions:[{status:'cancelled',note:'Note synthétique'}],dismissed:['refus'],revision:7};
 await db.put('coachPlanning',planning);await db.put('sessions',{id:'ancien'});db.close();
 const upgraded=await openDatabase(n);expect(upgraded.version).toBe(8);expect(await upgraded.get('coachPlanning','local')).toEqual(planning);
 expect(await upgraded.getAll('coachSuggestions')).toEqual([]);expect(await upgraded.get('sessions','ancien')).toEqual({id:'ancien'});upgraded.close();
});
it('identité stable, persistance, présentations répétées et concurrentes sans doublons ni notifications inutiles',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),spy=vi.spyOn(storageChanges,'committed');
 const [a,b]=await Promise.all([repo.recordPresented(input),createSuggestionRepository(n,now).recordPresented(input)]);
 expect(a).toEqual(b);expect(a.id).toBe(suggestionId(input));expect(spy).toHaveBeenCalledTimes(1);
 expect(await createSuggestionRepository(n,now).list()).toEqual([a]);expect(await repo.recordPresented(input)).toEqual(a);expect(spy).toHaveBeenCalledTimes(1);
 expect(suggestionId({...input,durationSeconds:2100})).not.toBe(a.id);
});
it('un calcul seul ne crée aucun stockage de suggestion',()=>{
 const open=vi.spyOn(indexedDB,'open');
 proposeNextSession({configuration:{goal:{model:'evolving',kind:'begin'},structuredPlanningPreference:'accepted'},historicalProfile:undefined,sessions:[],referenceDate:'2026-10-17',policy:productPolicy('begin')});
 expect(open).not.toHaveBeenCalled();
});
it('obsolescence explicite et contrôle des révisions concurrentes',async()=>{
 const repo=createSuggestionRepository(name(),now),a=await repo.recordPresented(input);
 const results=await Promise.allSettled([repo.markObsolete(a.id,1),repo.markObsolete(a.id,1)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toBeInstanceOf(SuggestionConflictError);
 const obsolete=(await repo.list())[0];expect(obsolete.state).toBe('superseded');expect(obsolete.revision).toBe(2);
 expect(await repo.markObsolete(a.id,2)).toEqual(obsolete);expect(await repo.recordPresented(input)).toEqual(obsolete);
});
it('association vérifie une activité réelle dans la transaction ; échec sans notification',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input),spy=vi.spyOn(storageChanges,'committed');
 await expect(repo.associateActivity(a.id,'absente',1)).rejects.toThrow(/introuvable/);expect(spy).not.toHaveBeenCalled();
 const db=await openDatabase(n);await db.put('sessions',{id:'run',date:'2026-10-18',title:'Synthétique',durationSeconds:1800});db.close();
 const linked=await repo.associateActivity(a.id,'run',1);expect(linked.activityId).toBe('run');expect(linked.revision).toBe(2);
 expect(suggestionFollowUp(linked,'2026-10-19')).toBe('associated');expect(await repo.associateActivity(a.id,'run',2)).toEqual(linked);expect(spy).toHaveBeenCalledTimes(1);
});
it('états déduits sans assimilation à une séance manquée, expiration et nettoyage borné explicite',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input);
 await repo.recordPresented({...input,durationSeconds:2100});
 expect(a.expiresOn).toBe('2026-10-26');expect(suggestionFollowUp(a,'2026-10-18')).toBe('current');
 expect(suggestionFollowUp(a,'2026-10-25')).toBe('past-unmatched');expect(suggestionFollowUp(a,'2026-10-26')).toBe('expired');
 expect(await repo.deleteExpired('2026-10-25')).toBe(0);expect(await createSuggestionRepository(n,()=>new Date('2026-11-01')).list()).toHaveLength(2);
 expect(await repo.deleteExpired('2026-10-26',1)).toBe(1);expect(await repo.deleteExpired('2026-10-26',1)).toBe(1);
 await expect(repo.recordPresented({...input,date:'2026-10-01'})).rejects.toThrow(/expirée/);
});
it('validations strictes, identité et expiration non falsifiables ; erreur transactionnelle sans écriture',async()=>{
 const repo=createSuggestionRepository(name(),now),a=await repo.recordPresented(input);
 for(const patch of [{id:'autre'},{expiresOn:'2026-11-01'},{durationSeconds:NaN},{revision:0},{terrain:{surface:'inconnue',relief:'free'}}])expect(()=>validateStoredSuggestion({...a,...patch})).toThrow();
 const spy=vi.spyOn(storageChanges,'committed'),put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new Error('Échec synthétique');});
 await expect(repo.markObsolete(a.id,1)).rejects.toThrow();put.mockRestore();expect(await repo.list()).toEqual([a]);expect(spy).not.toHaveBeenCalled();
});
it.each(['json','gzip'])('export %s format5, intégrité et restauration, aperçu sans écriture',async format=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input),data=await readBackupSnapshot(n);
 const blob=format==='json'?await json(n):(await exportGzip(data,'0.6.1')).file;
 const dest=name(),svc=service(dest),preview=await svc.preview(blob);expect(preview.backup.formatVersion).toBe(5);expect(await createSuggestionRepository(dest).list()).toEqual([]);
 await svc.restore(preview,{mode:'replace',profile:'restore'});expect(await createSuggestionRepository(dest).list()).toEqual([a]);
 const corrupt=structuredClone(preview.backup);corrupt.data.coachSuggestions![0].state='superseded';
 await expect(svc.preview(new Blob([JSON.stringify(corrupt)]))).rejects.toThrow(/intégrité/);
});
it('fusion sans doublon conserve état local, ajoute les nouvelles suggestions ; remplacement invalide les anciennes révisions',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input),old=await json(n);
 const changed=await repo.markObsolete(a.id,1),svc=service(n);
 const report=await svc.restore(await svc.preview(old),{mode:'merge',profile:'keep'});expect(report.conflicts).toBeGreaterThan(0);expect(await repo.list()).toEqual([changed]);
 const other=name();await createSuggestionRepository(other,now).recordPresented({...input,durationSeconds:2100});
 await svc.restore(await svc.preview(await json(other)),{mode:'merge',profile:'keep'});expect(await repo.list()).toHaveLength(2);
 await svc.restore(await svc.preview(old),{mode:'replace',profile:'restore'});expect((await repo.list())[0].revision).toBe(3);
 await expect(repo.markObsolete(a.id,1)).rejects.toBeInstanceOf(SuggestionConflictError);
});
it('ancienne sauvegarde sans suggestions : fusion conserve, remplacement efface explicitement',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now);await repo.recordPresented(input);const svc=service(n);
 const old=new Blob([JSON.stringify(await createBackup({sessions:[],details:[],coachProfile:null},'0.5.0'))]);
 await svc.restore(await svc.preview(old),{mode:'merge',profile:'keep'});expect(await repo.list()).toHaveLength(1);
 await svc.restore(await svc.preview(old),{mode:'replace',profile:'restore'});expect(await repo.list()).toEqual([]);
});
it('conflit après aperçu, annulation sans écriture et échec atomique de restauration',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input),svc=service(n),preview=await svc.preview(await json(n));
 expect(await repo.list()).toEqual([a]);await repo.markObsolete(a.id,1);
 await expect(svc.restore(preview,{mode:'replace',profile:'restore'})).rejects.toThrow(/changé/);
 const before=await readBackupSnapshot(n),fresh=await svc.preview(await json(n));
 const original=IDBObjectStore.prototype.add;
 const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<typeof original>){if(this.name==='coachSuggestions')throw new Error('Échec synthétique');return original.apply(this,args);});
 await expect(svc.restore(fresh,{mode:'replace',profile:'restore'})).rejects.toThrow();spy.mockRestore();expect(await readBackupSnapshot(n)).toEqual(before);
});
it('sauvegarde : doublons et associations orphelines rejetés',async()=>{
 const n=name(),a=await createSuggestionRepository(n,now).recordPresented(input),data=await readBackupSnapshot(n);
 expect(()=>validateBackupData({...data,coachSuggestions:[a,a]})).toThrow();expect(()=>validateBackupData({...data,coachSuggestions:[{...a,activityId:'absent'}]})).toThrow();
});
it('fusion : association ambiguë en conflit de résumé ignorée sans altérer la séance locale',async()=>{
 const source=name(),dest=name(),session={id:'run',date:'2026-10-18',title:'Synthétique',durationSeconds:1800};
 for(const [n,durationSeconds] of [[source,1800],[dest,2100]] as const){const db=await openDatabase(n);await db.put('sessions',{...session,durationSeconds});db.close();}
 const repo=createSuggestionRepository(source,now),a=await repo.recordPresented(input);await repo.associateActivity(a.id,'run',1);
 const svc=service(dest),report=await svc.restore(await svc.preview(await json(source)),{mode:'merge',profile:'keep'});
 expect(report.warnings.some(w=>w.includes('activité associée'))).toBe(true);expect(await createSuggestionRepository(dest).list()).toEqual([]);
 expect((await readBackupSnapshot(dest)).sessions[0].durationSeconds).toBe(2100);
});
it('sauvegarde expirée restaurée sans nettoyage implicite ; états de suivi préservés',async()=>{
 const source=name(),repo=createSuggestionRepository(source,()=>new Date('2026-09-01T12:00:00Z'));
 const a=await repo.recordPresented({...input,date:'2026-09-02'});await repo.markObsolete(a.id,1);
 const dest=name(),svc=service(dest);await svc.restore(await svc.preview(await json(source)),{mode:'replace',profile:'restore'});
 const restored=(await createSuggestionRepository(dest).list())[0];expect(restored.state).toBe('superseded');expect(suggestionFollowUp(restored,'2026-09-03')).toBe('superseded');
 expect(suggestionFollowUp(restored,'2026-10-17')).toBe('expired');
});
it('présentation : remplacement atomique, réaffichage sans écriture et aucun effet sur le planning',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input);
 const context={sessions:[]},spy=vi.spyOn(storageChanges,'committed');
 const b=await repo.recordPresented({...input,durationSeconds:2100},{context,isVisible:()=>true});
 expect((await repo.list()).find(s=>s.id===a.id)).toMatchObject({state:'superseded',revision:2});
 expect(spy).toHaveBeenCalledTimes(1);expect((await readBackupSnapshot(n)).coachPlanning).toBeUndefined();
 await repo.recordPresented({...input,durationSeconds:2100},{context,isVisible:()=>true});await repo.recordPresented(input,{context,isVisible:()=>true});
 expect(spy).toHaveBeenCalledTimes(1);expect((await repo.list()).find(s=>s.id===b.id)?.state).toBe('current');
});
it('présentation remplacée avant écriture ou contexte périmé : aucune écriture ni obsolescence',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input),spy=vi.spyOn(storageChanges,'committed');
 await expect(repo.recordPresented({...input,durationSeconds:2100},{context:{sessions:[]},isVisible:()=>false})).rejects.toThrow(/présentation/);
 const db=await openDatabase(n);await db.put('sessions',{id:'nouvelle',date:'2026-10-17',durationSeconds:900,title:'Synthétique'});db.close();
 await expect(repo.recordPresented({...input,durationSeconds:2100},{context:{sessions:[]},isVisible:()=>true})).rejects.toThrow(/présentation/);
 expect(await repo.list()).toEqual([a]);expect(spy).not.toHaveBeenCalled();
});
it('présentations simultanées entre onglets : une seule création/obsolescence et notification',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now);await repo.recordPresented(input);const spy=vi.spyOn(storageChanges,'committed');
 const next={...input,durationSeconds:2100},options={context:{sessions:[]},isVisible:()=>true};
 await Promise.all([repo.recordPresented(next,options),createSuggestionRepository(n,now).recordPresented(next,options)]);
 expect(await repo.list()).toHaveLength(2);expect((await repo.list()).filter(s=>s.state==='current')).toHaveLength(1);expect(spy).toHaveBeenCalledTimes(1);
});
it('échec du nouvel enregistrement : annule aussi son obsolescence',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),a=await repo.recordPresented(input);
 const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(()=>{throw new Error('Échec synthétique');});
 await expect(repo.recordPresented({...input,durationSeconds:2100},{context:{sessions:[]},isVisible:()=>true})).rejects.toThrow();
 spy.mockRestore();expect(await repo.list()).toEqual([a]);
});
it('remplacement préserve suggestions passées, associées et présentes dans le planning, sans modifier ce dernier',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now);
 const past=await repo.recordPresented({...input,date:'2026-10-16'});
 const accepted=await repo.recordPresented(input);
 const linked=await repo.recordPresented({...input,durationSeconds:2100});
 const db=await openDatabase(n),timestamp=now().toISOString();
 await db.put('sessions',{id:'run',date:'2026-10-18',title:'Synthétique',durationSeconds:2100});
 const planning={id:'local' as const,revision:1,createdAt:timestamp,updatedAt:timestamp,dismissed:[],sessions:[{id:'planned',proposalKey:'a'.repeat(64),date:'2026-10-20',kind:input.kind,durationSeconds:1500,note:'Conservée',intention:'Synthétique',origin:'coach' as const,status:'planned' as const,createdAt:timestamp,updatedAt:timestamp,original:{date:input.date,durationSeconds:1800,explanation:'Synthétique',policyVersion:1 as const}}]};
 await db.put('coachPlanning',planning);db.close();await repo.associateActivity(linked.id,'run',1);
 const snapshot=await readBackupSnapshot(n);
 await repo.recordPresented({...input,durationSeconds:2400},{context:{sessions:snapshot.sessions,planning},isVisible:()=>true});
 const records=await repo.list();expect(records.find(s=>s.id===past.id)).toEqual(past);expect(records.find(s=>s.id===accepted.id)).toEqual(accepted);
 expect(records.find(s=>s.id===linked.id)).toMatchObject({state:'current',activityId:'run'});expect((await readBackupSnapshot(n)).coachPlanning).toEqual(planning);
});
it('ensemble : chaque carte visible est ajoutée seule, les autres ne sont pas présumées vues',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),old=await repo.recordPresented({...input,durationSeconds:2400});
 const members=[input,{...input,date:'2026-10-20',durationSeconds:2100}];
 const options={context:{sessions:[]},isVisible:()=>true};
 await repo.recordPresentedSetMember(members[0],members,options);
 expect(await repo.list()).toHaveLength(2);expect((await repo.list()).find(s=>s.id===old.id)?.state).toBe('current');
 await repo.recordPresentedSetMember(members[1],members,options);
 const records=await repo.list();expect(records).toHaveLength(3);expect(records.filter(s=>s.state==='current')).toHaveLength(2);
 expect(records.find(s=>s.id===old.id)?.state).toBe('superseded');
 const spy=vi.spyOn(storageChanges,'committed');
 await repo.recordPresentedSetMember(members[0],members,options);await repo.recordPresentedSetMember(members[1],members,options);
 expect(await repo.list()).toEqual(records);expect(spy).not.toHaveBeenCalled();
});
it('ensemble : deux onglets mémorisent les cartes sans doublons ni obsolescence mutuelle',async()=>{
 const n=name(),a=createSuggestionRepository(n,now),b=createSuggestionRepository(n,now),members=[input,{...input,date:'2026-10-20'}],options={context:{sessions:[]},isVisible:()=>true};
 await Promise.all([a.recordPresentedSetMember(members[0],members,options),b.recordPresentedSetMember(members[1],members,options),b.recordPresentedSetMember(members[0],members,options)]);
 expect(await a.list()).toHaveLength(2);expect((await a.list()).every(s=>s.state==='current'&&s.revision===1)).toBe(true);
});
it('ensemble : carte masquée ou contexte devenu obsolète ne peut ni ajouter ni remplacer',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),old=await repo.recordPresented({...input,durationSeconds:2400});
 await expect(repo.recordPresentedSetMember(input,[input],{context:{sessions:[]},isVisible:()=>false})).rejects.toThrow(/présentation/);
 const db=await openDatabase(n);await db.put('sessions',{id:'concurrent',date:'2026-10-17',title:'Synthétique',durationSeconds:600});db.close();
 await expect(repo.recordPresentedSetMember(input,[input],{context:{sessions:[]},isVisible:()=>true})).rejects.toThrow(/présentation/);
 expect(await repo.list()).toEqual([old]);
});
it('ensemble : erreur pendant l’obsolescence annule la dernière insertion et ne notifie pas',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),old=await repo.recordPresented({...input,durationSeconds:2400});
 const spy=vi.spyOn(storageChanges,'committed'),put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new Error('Échec synthétique');});
 await expect(repo.recordPresentedSetMember(input,[input],{context:{sessions:[]},isVisible:()=>true})).rejects.toThrow();
 put.mockRestore();expect(await repo.list()).toEqual([old]);expect(spy).not.toHaveBeenCalled();
});
it('ensemble : préserve suggestions passées, associées et issues du planning historique',async()=>{
 const n=name(),repo=createSuggestionRepository(n,now),past=await repo.recordPresented({...input,date:'2026-10-16'}),accepted=await repo.recordPresented(input);
 const linked=await repo.recordPresented({...input,durationSeconds:2100}),db=await openDatabase(n),timestamp=now().toISOString();
 const session={id:'run',date:'2026-10-18',title:'Synthétique',durationSeconds:2100};await db.put('sessions',session);
 const planning={id:'local' as const,revision:1,createdAt:timestamp,updatedAt:timestamp,dismissed:['b'.repeat(64)],sessions:[{id:'planned',proposalKey:'a'.repeat(64),date:'2026-10-20',kind:input.kind,durationSeconds:1500,note:'Conservée',intention:'Synthétique',origin:'coach' as const,status:'cancelled' as const,createdAt:timestamp,updatedAt:timestamp,original:{date:input.date,durationSeconds:1800,explanation:'Synthétique',policyVersion:1 as const}}]};
 await db.put('coachPlanning',planning);db.close();await repo.associateActivity(linked.id,'run',1);
 const next={...input,durationSeconds:2400};await repo.recordPresentedSetMember(next,[next],{context:{sessions:[session],planning},isVisible:()=>true});
 const records=await repo.list();expect(records.find(s=>s.id===past.id)).toEqual(past);expect(records.find(s=>s.id===accepted.id)).toEqual(accepted);
 expect(records.find(s=>s.id===linked.id)).toMatchObject({state:'current',activityId:'run'});expect((await readBackupSnapshot(n)).coachPlanning).toEqual(planning);
});
it('ensemble : refuse ensemble vide, doublon ou carte étrangère sans toucher au stockage',async()=>{
 const repo=createSuggestionRepository(name(),now),options={context:{sessions:[]},isVisible:()=>true};
 for(const members of [[],[input,input],[{...input,date:'2026-10-20'}]])await expect(repo.recordPresentedSetMember(input,members,options)).rejects.toThrow();
 expect(await repo.list()).toEqual([]);
});
