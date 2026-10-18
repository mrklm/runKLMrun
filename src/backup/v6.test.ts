import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { deleteDB } from 'idb';
import { canonicalJson,createBackup,parseBackup,sha256,verifyBackup } from './format';
import { exportGzip,readBackupFile } from './compression';
import { prepareRestore } from './merge';
import type { BackupData,BackupDocument } from '../types/backup';
import { activitySportSignatureV2,civilDate,ianaTimeZone,instantIso,observePresentationV2,selectCandidateV2,type CandidateV2,
  type ImmutableSessionContentV2,type OccurrenceProvenanceV2,type PersistableOccurrenceV2,
  type PresentationMomentV2,type PresentationOpportunityV2 } from '../core/coach/persistence-foundations-v2';
import { createSuggestionV2Repository } from '../storage/coach-suggestions-v2';
import { createSuggestionRepository } from '../storage/coach-suggestions';
import { createBackupService,prepareNative,readBackupSnapshot } from '../storage/backup';
import { openDatabase } from '../storage/database-connection';

const names:string[]=[];
const name=()=>{const value=`backup-v6-${crypto.randomUUID()}`;names.push(value);return value;};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(names.splice(0).map(value=>deleteDB(value)));});
const empty=():BackupData=>({sessions:[],details:[],coachProfile:null});
const content=(duration=1800):ImmutableSessionContentV2=>({type:'easy-endurance',totalDurationSeconds:duration,intensity:'easy',terrain:'flat',shortSummary:`Endurance · ${duration/60} min`});
const opportunity=(generation=1):PresentationOpportunityV2=>({contractVersion:1,goal:'endurance',suggestedFor:civilDate('2026-10-20'),
  anchor:{kind:'bootstrap',referenceDate:civilDate('2026-10-18')},availability:{weekday:'tuesday',maximumSeconds:3600},generation});
const candidate=(duration=1800,generation=1):CandidateV2=>({phase:'candidate',content:content(duration),opportunity:opportunity(generation)});
const moment:PresentationMomentV2={presentedAt:instantIso('2026-10-18T08:00:00.000Z'),presentedOn:civilDate('2026-10-18'),
  timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'};
const provenance:OccurrenceProvenanceV2={engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',referenceSourceIds:['run-1'],limitationCodes:['reference-provisional']};
async function occurrence(id='occurrence-1',duration=1800,generation=1):Promise<PersistableOccurrenceV2> {
  return (await observePresentationV2({selection:selectCandidateV2(candidate(duration,generation)),moment,provenance,existing:[],createId:()=>id})).occurrence;
}
const service=(database:string)=>createBackupService({export:data=>exportGzip(data,'0.7.0',undefined,'2026-10-18T12:00:00.000Z'),
  parse:file=>readBackupFile(file),prepare:(preview,options)=>prepareNative(preview,options,new Date('2026-10-18T12:00:00.000Z'))},database);
async function resign(document:BackupDocument):Promise<BackupDocument> {
  const {integrity:_integrity,...payload}=document;return {...payload,integrity:{algorithm:'SHA-256',digest:await sha256(canonicalJson(payload))}};
}

describe('sauvegardes V6 des suggestions V2',()=>{
  it('exporte et relit V6 en JSON sans modifier les occurrences',async()=>{
    const value=await occurrence(),data={...empty(),coachSuggestionsV2:[value]},before=structuredClone(data);
    const document=await createBackup(data,'0.7.0','2026-10-18T12:00:00.000Z');
    expect(document.formatVersion).toBe(6);expect((await parseBackup(JSON.stringify(document))).data).toEqual(data);expect(data).toEqual(before);
  });

  it('exporte et relit V6 en gzip',async()=>{
    const value=await occurrence(),exported=await exportGzip({...empty(),coachSuggestionsV2:[value]},'0.7.0',undefined,'2026-10-18T12:00:00.000Z');
    const restored=await readBackupFile(exported.file);expect(restored.formatVersion).toBe(6);expect(restored.data.coachSuggestionsV2).toEqual([value]);
  });

  it('préserve les métadonnées de cycle de vie lors d’un aller-retour V6',async()=>{
    const base=await occurrence(),associated:PersistableOccurrenceV2={...base,state:'associated',activityId:'run-20',revision:2,
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')};
    const document=await createBackup({...empty(),sessions:[{id:'run-20',title:'Course',date:'2026-10-20',durationSeconds:1800}],
      coachSuggestionsV2:[associated]},'0.7.0','2026-10-20T19:00:00.000Z');
    expect((await parseBackup(JSON.stringify(document))).data.coachSuggestionsV2).toEqual([associated]);
  });

  it('refuse une association V2 orpheline avant toute restauration',async()=>{
    const base=await occurrence(),orphan:PersistableOccurrenceV2={...base,state:'associated',activityId:'absent',revision:2,
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')};
    await expect(createBackup({...empty(),coachSuggestionsV2:[orphan]},'0.7.0','2026-10-20T19:00:00.000Z'))
      .rejects.toThrow(/association V2/i);
  });

  it('préserve une preuve sportive cohérente et refuse une preuve devenue obsolète',async()=>{
    const session={id:'run-evidence',title:'Course',date:'2026-10-20',durationSeconds:1800,distanceMeters:5000};
    const base=await occurrence(),associated:PersistableOccurrenceV2={...base,state:'associated',activityId:session.id,revision:2,
      updatedAt:instantIso('2026-10-20T18:00:00.000Z'),associationEvidence:{sportSignature:activitySportSignatureV2(session)}};
    const valid=await createBackup({...empty(),sessions:[session],coachSuggestionsV2:[associated]},'0.7.0','2026-10-20T19:00:00.000Z');
    expect((await parseBackup(JSON.stringify(valid))).data.coachSuggestionsV2?.[0].associationEvidence).toEqual(associated.associationEvidence);
    await expect(createBackup({...empty(),sessions:[{...session,distanceMeters:6000}],coachSuggestionsV2:[associated]},'0.7.0',
      '2026-10-20T19:00:00.000Z')).rejects.toThrow(/caractéristiques sportives/i);
  });

  it('restaure ensemble suggestions V1 et V2 en préservant identifiants et dates',async()=>{
    const source=name(),destination=name(),v2=createSuggestionV2Repository(source);
    const created=await v2.recordPresented({selection:selectCandidateV2(candidate()),moment,provenance,createId:()=> 'stable-v2'});
    await createSuggestionRepository(source,()=>new Date('2026-10-18T08:00:00.000Z')).recordPresented({date:'2026-10-20',kind:'easy',durationSeconds:1800});
    const exported=await service(source).exportData(),preview=await service(destination).preview(exported.file);
    expect(preview.backup.formatVersion).toBe(6);await service(destination).restore(preview,{mode:'replace',profile:'restore'});
    expect(await createSuggestionV2Repository(destination).getById('stable-v2')).toEqual(created.occurrence);
    expect(await createSuggestionRepository(destination).list()).toHaveLength(1);
  });

  it('fusionne un doublon identique sans réécriture et conserve le local lors des conflits',async()=>{
    const local=await occurrence(),same=prepareRestore({...empty(),coachSuggestionsV2:[local]},
      {...empty(),coachSuggestionsV2:[structuredClone(local)]},{mode:'merge',profile:'keep'},'2026-10-18T12:00:00.000Z');
    expect(same.report.conflicts).toBe(0);expect(same.data.coachSuggestionsV2).toEqual([local]);
    const sameIdDifferent=await occurrence(local.id,2100,2),identityConflict=prepareRestore({...empty(),coachSuggestionsV2:[local]},
      {...empty(),coachSuggestionsV2:[sameIdDifferent]},{mode:'merge',profile:'keep'},'2026-10-18T12:00:00.000Z');
    expect(identityConflict.report.conflicts).toBe(1);expect(identityConflict.data.coachSuggestionsV2).toEqual([local]);
    const sameKeyDifferentId={...await occurrence('other'),id:'other' as PersistableOccurrenceV2['id']};
    const keyConflict=prepareRestore({...empty(),coachSuggestionsV2:[local]},
      {...empty(),coachSuggestionsV2:[sameKeyDifferentId]},{mode:'merge',profile:'keep'},'2026-10-18T12:00:00.000Z');
    expect(keyConflict.report.conflicts).toBe(1);expect(keyConflict.data.coachSuggestionsV2).toEqual([local]);
  });

  it('rejette doublons internes, empreinte incohérente et version future',async()=>{
    const value=await occurrence(),duplicate=await createBackup({...empty(),coachSuggestionsV2:[value]},'0.7.0');
    duplicate.data.coachSuggestionsV2!.push(structuredClone(value));
    await expect(verifyBackup(await resign(duplicate))).rejects.toThrow(/dupliquée/);
    const invalid=await createBackup({...empty(),coachSuggestionsV2:[value]},'0.7.0');
    (invalid.data.coachSuggestionsV2![0].content as {shortSummary:string}).shortSummary='Altération cohérente extérieurement';
    await expect(verifyBackup(await resign(invalid))).rejects.toThrow(/occurrence/i);
    const future={...await createBackup(empty(),'0.7.0'),formatVersion:7} as unknown as BackupDocument;
    await expect(verifyBackup(await resign(future))).rejects.toThrow(/version/);
  });

  it('annule toute la transaction si l’écriture V2 échoue',async()=>{
    const destination=name(),source=name(),db=await openDatabase(destination);
    await db.put('sessions',{id:'local',title:'Locale',date:'2026-10-01',durationSeconds:600});db.close();
    const sourceDb=await openDatabase(source),value=await occurrence();
    await sourceDb.put('sessions',{id:'incoming',title:'Entrante',date:'2026-10-02',durationSeconds:900});
    await sourceDb.add('coachSuggestionsV2',value);sourceDb.close();
    const backup=await service(source).exportData(),target=service(destination),preview=await target.preview(backup.file),before=await readBackupSnapshot(destination);
    const original=IDBObjectStore.prototype.add;
    const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<typeof original>){
      if(this.name==='coachSuggestionsV2')throw new Error('Échec V2 synthétique');return original.apply(this,args);
    });
    await expect(target.restore(preview,{mode:'replace',profile:'restore'})).rejects.toThrow('Échec V2');spy.mockRestore();
    expect(await readBackupSnapshot(destination)).toEqual(before);
  });
});
