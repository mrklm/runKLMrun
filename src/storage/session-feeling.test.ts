import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { createFeelingRepository, FeelingConflictError } from './session-feeling';
import { createSessionRepository } from './database';
import { openDatabase } from './database-connection';
import { storageChanges } from './changes';
import { feelingFromFields, validateFeeling } from '../core/analysis/session-feeling';
import { fixture } from '../backup/test-fixture';
import { createBackup, verifyBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import { createBackupService, prepareNative, readBackupSnapshot } from './backup';
import { createSuggestionRepository } from './coach-suggestions';
import type { BackupData } from '../types/backup';
const names: string[] = [];
const name = () => { const n = `feelings-${crypto.randomUUID()}`; names.push(n); return n; };
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(names.splice(0).map(n => deleteDB(n))); });
async function setup() {
  const n=name(), data=fixture(), sessions=createSessionRepository(n), repo=createFeelingRepository(n);
  await sessions.addImported(data.sessions[0],data.details[0]);
  return {n,data,sessions,repo,id:data.sessions[0].id};
}
it('réutilise quatre niveaux et autorise un commentaire seul ou aucune annotation', () => {
  for (const effort of ['easy','moderate','hard','very-hard']) expect(feelingFromFields(effort,'')).toEqual({effort});
  expect(feelingFromFields('','Sensations libres\nTrès bien.')).toEqual({comment:'Sensations libres\nTrès bien.'});
  expect(feelingFromFields('','')).toBeUndefined();
  expect(()=>feelingFromFields('unknown','')).toThrow();expect(()=>feelingFromFields('','x'.repeat(2001))).toThrow();
  expect(()=>validateFeeling({effort:'easy',rpe:5})).toThrow();
});
it('ajoute, modifie, retire indépendamment les champs et persiste après réouverture', async () => {
  const {n,repo,id}=await setup();expect((await repo.get(id))?.feeling).toBeUndefined();
  await repo.save(id,{effort:'easy',comment:'Bien'},undefined);
  expect((await createFeelingRepository(n).get(id))?.feeling).toEqual({effort:'easy',comment:'Bien'});
  await repo.save(id,{comment:'Bien'},{effort:'easy',comment:'Bien'});
  await repo.save(id,{effort:'hard'},{comment:'Bien'});
  await repo.save(id,undefined,{effort:'hard'});expect((await repo.get(id))?.feeling).toBeUndefined();
});
it('préserve résumés, cardio, GPS et associations et ne notifie pas le Coach', async () => {
  const {n,repo,id,data,sessions}=await setup();const db=await openDatabase(n);
  await db.put('shoeAssignments',{sessionId:id,shoeId:'synthetic-shoe'});db.close();
  const spy=vi.spyOn(storageChanges,'committed');await repo.save(id,{effort:'moderate'},undefined);
  expect(await sessions.getDetails(id)).toEqual(data.details[0]);expect(await repo.get(id)).toEqual({...data.sessions[0],feeling:{effort:'moderate'}});
  const reopened=await openDatabase(n);expect(await reopened.get('shoeAssignments',id)).toEqual({sessionId:id,shoeId:'synthetic-shoe'});reopened.close();
  expect(spy.mock.calls).toEqual([[n,['feelings']]]);
  spy.mockClear();await repo.save(id,{effort:'moderate'},{effort:'moderate'});expect(spy).not.toHaveBeenCalled();
});
it('refuse les écritures concurrentes perdues et préserve les autres métadonnées récentes', async () => {
  const {n,repo,id,sessions,data}=await setup();
  const results=await Promise.allSettled([repo.save(id,{effort:'easy'},undefined),createFeelingRepository(n).save(id,{effort:'hard'},undefined)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toBeInstanceOf(FeelingConflictError);
  const current=(await repo.get(id))!;await sessions.save({...current,title:'Titre actualisé'});
  await repo.save(id,{comment:'Note'},current.feeling);expect((await repo.get(id))?.title).toBe('Titre actualisé');
  expect(await sessions.getDetails(id)).toEqual(data.details[0]);
});
it('échec transactionnel et activité supprimée : aucune notification ni perte', async () => {
  const {repo,id,data}=await setup();const spy=vi.spyOn(storageChanges,'committed');
  vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new Error('Panne synthétique');});
  await expect(repo.save(id,{comment:'Note'},undefined)).rejects.toThrow();expect(await repo.get(id)).toEqual(data.sessions[0]);
  await expect(repo.save('missing',{effort:'easy'},undefined)).rejects.toThrow();expect(spy).not.toHaveBeenCalled();
});
it('une annotation ne rend pas obsolète le contexte de visibilité du Coach', async () => {
  const {n,repo,id,data}=await setup();await repo.save(id,{comment:'Note'},undefined);
  const suggestion={date:'2026-10-19',kind:'easy' as const,durationSeconds:1800};
  await createSuggestionRepository(n,()=>new Date('2026-10-17T12:00:00Z')).recordPresented(suggestion,{context:{sessions:data.sessions},isVisible:()=>true});
  expect(await createSuggestionRepository(n).list()).toHaveLength(1);
});
it.each(['json','gzip'])('sauvegarde %s : intégrité, remplacement, fusion et ancien fichier', async format => {
  const {n,repo,id,data}=await setup();await repo.save(id,{effort:'hard',comment:'Locale'},undefined);
  const processor={export:(d:BackupData)=>exportGzip(d,'0.6.1'),parse:(file:Blob)=>readBackupFile(file),prepare:(p:Parameters<typeof prepareNative>[0],o:Parameters<typeof prepareNative>[1])=>prepareNative(p,o,new Date('2026-10-13T12:00:00Z'))};
  const svc=createBackupService(processor,n);
  const incoming=fixture();incoming.sessions[0].feeling={effort:'easy',comment:'Sauvegardée'};
  const document=await createBackup(incoming,'0.6.1');expect(await verifyBackup(document)).toEqual(document);
  const corrupted=structuredClone(document);corrupted.data.sessions[0].feeling!.comment='Altérée';await expect(verifyBackup(corrupted)).rejects.toThrow(/intégrité/);
  const blob=format==='json'?new Blob([JSON.stringify(document)]):(await exportGzip(incoming,'0.6.1')).file;
  expect((await readBackupFile((await svc.exportData()).file)).data.sessions[0].feeling).toEqual({effort:'hard',comment:'Locale'});
  const preview=await svc.preview(blob);expect((await repo.get(id))?.feeling?.comment).toBe('Locale');
  const report=await svc.restore(preview,{mode:'merge',profile:'keep'});expect(report.conflicts).toBeGreaterThan(0);expect((await repo.get(id))?.feeling?.comment).toBe('Locale');
  await svc.restore(await svc.preview(blob),{mode:'replace',profile:'restore'});expect((await repo.get(id))?.feeling).toEqual(incoming.sessions[0].feeling);
  const old=new Blob([JSON.stringify(await createBackup(data,'0.6.1'))]);await svc.restore(await svc.preview(old),{mode:'replace',profile:'restore'});
  expect((await readBackupSnapshot(n)).sessions).toEqual(data.sessions);expect((await readBackupSnapshot(n)).details).toEqual(data.details);
});
it('refuse une restauration préparée avant une modification du ressenti', async () => {
  const {n,repo,id,data}=await setup();
  const svc=createBackupService({export:(d:BackupData)=>exportGzip(d,'0.6.1'),parse:(file:Blob)=>readBackupFile(file),prepare:(p,o)=>prepareNative(p,o,new Date('2026-10-13T12:00:00Z'))},n);
  const preview=await svc.preview(new Blob([JSON.stringify(await createBackup(data,'0.6.1'))]));
  await repo.save(id,{comment:'Nouvelle annotation'},undefined);
  await expect(svc.restore(preview,{mode:'replace',profile:'restore'})).rejects.toThrow(/changé/);
  expect((await repo.get(id))?.feeling?.comment).toBe('Nouvelle annotation');
});
