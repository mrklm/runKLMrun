import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { createCoachPlanningRepository, PlanningConflictError } from './coach-planning';
import { createEvolvingCoachRepository } from './evolving-coach';
import { openDatabase } from './database-connection';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { createBackup, canonicalJson, sha256 } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import type { BackupData } from '../types/backup';
import type { PlannedSession } from '../types/coach-planning';
const names: string[]=[];
const name=()=>{const n=`planning-${crypto.randomUUID()}`;names.push(n);return n;};
const now=()=>new Date('2026-10-15T12:00:00.000Z');
const session=(id='a',key='a'.repeat(64)): PlannedSession=>({id,proposalKey:key,date:'2026-10-16',durationSeconds:1200,kind:'easy',intention:'Sortie facultative',origin:'coach',status:'planned',note:'',createdAt:now().toISOString(),updatedAt:now().toISOString(),original:{date:'2026-10-16',durationSeconds:1200,explanation:'Repères synthétiques',policyVersion:1}});
async function setup(n=name()) {
  await createEvolvingCoachRepository(n,now).save({goal:{model:'evolving',kind:'begin'},structuredPlanningPreference:'accepted'},undefined);
  return {n,repo:createCoachPlanningRepository(n,now)};
}
const accept=(s=session())=>({type:'accept' as const,session:s,coachRevision:1,profileRevision:undefined});
const service=(n:string)=>createBackupService({export:data=>exportGzip(data,'0.6.0'),parse:file=>readBackupFile(file),prepare:(p,o)=>prepareNative(p,o,now())},n);
const empty=():BackupData=>({sessions:[],details:[],coachProfile:null});
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(names.splice(0).map(n=>deleteDB(n)));});
it('migration additive depuis v6 sans réécriture des résumés',async()=>{
 const n=name(),db=await openDB(n,6,{upgrade(d){d.createObjectStore('sessions',{keyPath:'id'});}});
 await db.put('sessions',{id:'old',date:'2020-01-01',durationSeconds:10,title:'Fictif'});db.close();
 const upgraded=await openDatabase(n);expect(upgraded.version).toBe(7);expect((await upgraded.get('sessions','old'))?.title).toBe('Fictif');upgraded.close();
});
it('acceptation, modification, déplacement, annulation et persistance sans statut déduit de la date',async()=>{
 const {n,repo}=await setup();let r=await repo.apply(accept(),undefined);
 r=await repo.apply({type:'edit',id:'a',date:'2020-01-01',durationSeconds:900,note:'À mon rythme'},r.revision);
 expect(r.sessions[0]).toMatchObject({status:'planned',date:'2020-01-01',durationSeconds:900});
 expect(r.sessions[0].original.durationSeconds).toBe(1200);
 r=await repo.apply({type:'cancel',id:'a'},r.revision);
 expect(await createCoachPlanningRepository(n).get()).toEqual(r);
});
it('refus persistant, aucune acceptation identique répétée',async()=>{
 const {repo}=await setup();const r=await repo.apply({type:'dismiss',key:'a'.repeat(64),coachRevision:1,profileRevision:undefined},undefined);
 expect(r.sessions).toEqual([]);await expect(repo.apply(accept(),r.revision)).rejects.toBeInstanceOf(PlanningConflictError);
});
it('deux onglets ne peuvent pas écraser leurs décisions',async()=>{
 const {repo}=await setup();const results=await Promise.allSettled([repo.apply(accept(),undefined),repo.apply(accept(session('b','b'.repeat(64))),undefined)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await repo.get())?.sessions).toHaveLength(1);
});
it('retrait du consentement bloque les nouvelles propositions, préserve et permet de gérer les anciennes',async()=>{
 const {n,repo}=await setup();const r=await repo.apply(accept(),undefined);
 await createEvolvingCoachRepository(n,now).save({goal:{model:'evolving',kind:'wellbeing'},structuredPlanningPreference:'declined'},1);
 await expect(repo.apply({...accept(session('b','b'.repeat(64))),coachRevision:2},r.revision)).rejects.toThrow();
 const cancelled=await repo.apply({type:'cancel',id:'a'},r.revision);expect(cancelled.sessions[0].status).toBe('cancelled');
});
it('validations strictes et erreurs techniques sans écriture partielle',async()=>{
 const {repo}=await setup();await expect(repo.apply(accept({...session(),durationSeconds:NaN}),undefined)).rejects.toThrow();expect(await repo.get()).toBeUndefined();
 const r=await repo.apply(accept(),undefined);const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new Error('Échec synthétique');});
 await expect(repo.apply({type:'cancel',id:'a'},r.revision)).rejects.toThrow();spy.mockRestore();expect(await repo.get()).toEqual(r);
});
it.each(['json','gzip'])('format 4 %s, SHA256, aperçu sans écriture et remplacement atomique',async format=>{
 const {n,repo}=await setup();await repo.apply(accept(),undefined);const data=await readBackupSnapshot(n);
 const blob=format==='gzip'?(await exportGzip(data,'0.6.0')).file:new Blob([JSON.stringify(await createBackup(data,'0.6.0'))]);
 const destination=name(),svc=service(destination),preview=await svc.preview(blob);expect(preview.backup.formatVersion).toBe(4);
 expect((await readBackupSnapshot(destination)).coachPlanning).toBeUndefined();
 await svc.restore(preview,{mode:'replace',profile:'restore'});expect((await readBackupSnapshot(destination)).coachPlanning?.sessions).toHaveLength(1);
 const corrupt=structuredClone(preview.backup);corrupt.data.coachPlanning!.sessions[0].durationSeconds=1;
 await expect(svc.preview(new Blob([JSON.stringify(corrupt)]))).rejects.toThrow(/intégrité/);
});
it('fusion conserve les modifications et annulations locales ; collision de clé également protégée',async()=>{
 const {n,repo}=await setup();let r=await repo.apply(accept(),undefined);
 const old=await createBackup(await readBackupSnapshot(n),'0.6.0');r=await repo.apply({type:'cancel',id:'a'},r.revision);
 const svc=service(n),preview=await svc.preview(new Blob([JSON.stringify(old)]));const report=await svc.restore(preview,{mode:'merge',profile:'keep'});
 expect(report.conflicts).toBeGreaterThan(0);expect((await repo.get())?.sessions[0].status).toBe('cancelled');
 const data=structuredClone(old.data) as BackupData;data.coachPlanning!.sessions[0].id='other';
 const p=await svc.preview(new Blob([JSON.stringify(await createBackup(data,'0.6.0'))]));await svc.restore(p,{mode:'merge',profile:'keep'});
 expect((await repo.get())?.sessions).toHaveLength(1);
});
it('anciens formats : fusion conserve le planning, remplacement le vide et invalide les anciennes révisions',async()=>{
 const {n,repo}=await setup();const r=await repo.apply(accept(),undefined),svc=service(n);
 const old=new Blob([JSON.stringify(await createBackup(empty(),'0.6.0'))]);
 await svc.restore(await svc.preview(old),{mode:'merge',profile:'keep'});expect((await repo.get())?.sessions).toHaveLength(1);
 await svc.restore(await svc.preview(old),{mode:'replace',profile:'restore'});expect((await repo.get())?.sessions).toHaveLength(0);
 await expect(repo.apply({type:'cancel',id:'a'},r.revision)).rejects.toBeInstanceOf(PlanningConflictError);
});
it('restauration : conflit après aperçu et rollback après échec',async()=>{
 const {n,repo}=await setup();let r=await repo.apply(accept(),undefined);const svc=service(n),blob=(await svc.exportData()).file;
 const preview=await svc.preview(blob);r=await repo.apply({type:'edit',id:'a',date:'2026-10-18',durationSeconds:800,note:''},r.revision);
 await expect(svc.restore(preview,{mode:'replace',profile:'restore'})).rejects.toThrow(/changé/);
 const next=await svc.preview(blob),before=await readBackupSnapshot(n),put=IDBObjectStore.prototype.put;
 vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<typeof put>){if(this.name==='coachPlanning')throw new Error('Échec synthétique');return put.apply(this,args);});
 await expect(svc.restore(next,{mode:'replace',profile:'restore'})).rejects.toThrow();vi.restoreAllMocks();expect(await readBackupSnapshot(n)).toEqual(before);
});
it('schéma strict même avec empreinte recalculée',async()=>{
 const {n,repo}=await setup();await repo.apply(accept(),undefined);const doc=await createBackup(await readBackupSnapshot(n),'0.6.0');
 Object.assign(doc.data.coachPlanning!.sessions[0],{unknown:true});const {integrity,...payload}=doc;integrity.digest=await sha256(canonicalJson(payload));
 await expect(service(name()).preview(new Blob([JSON.stringify(doc)]))).rejects.toThrow(/Planning/);
});

it('endurance : une séance proposée à 30 minutes reste modifiable manuellement à 17 minutes',async()=>{
 const {n,repo}=await setup();
 await createEvolvingCoachRepository(n,now).save({goal:{model:'evolving',kind:'endurance'},structuredPlanningPreference:'accepted'},1);
 const original={...session(),durationSeconds:1800,original:{...session().original,durationSeconds:1800}};
 const accepted=await repo.apply({...accept(original),coachRevision:2},undefined);
 const edited=await repo.apply({type:'edit',id:'a',date:original.date,durationSeconds:1020,note:'Choix personnel'},accepted.revision);
 expect(edited.sessions[0].durationSeconds).toBe(1020);
 expect(edited.sessions[0].original.durationSeconds).toBe(1800);
 expect(await repo.get()).toEqual(edited);
});
