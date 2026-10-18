import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { deleteDB,openDB } from 'idb';
import { civilDate,ianaTimeZone,instantIso,operationalStatusV2,selectCandidateV2,type CandidateV2,type ImmutableSessionContentV2,
  type OccurrenceProvenanceV2,type PresentationMomentV2,type PresentationOpportunityV2 } from '../core/coach/persistence-foundations-v2';
import { createSuggestionRepository } from './coach-suggestions';
import { createSuggestionV2Repository } from './coach-suggestions-v2';
import { createSessionRepository } from './database';
import { openDatabase } from './database-connection';

const names:string[]=[];
const name=()=>{const value=`suggestions-v2-${crypto.randomUUID()}`;names.push(value);return value;};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(names.splice(0).map(value=>deleteDB(value)));});
const content=(duration=1800):ImmutableSessionContentV2=>({type:'easy-endurance',totalDurationSeconds:duration,
  intensity:'easy',terrain:'flat',shortSummary:`Endurance facile · ${duration/60} min`});
const opportunity=(generation=1):PresentationOpportunityV2=>({contractVersion:1,goal:'endurance',suggestedFor:civilDate('2026-10-20'),
  anchor:{kind:'activity',id:'run-1',date:civilDate('2026-10-18')},availability:{weekday:'tuesday',maximumSeconds:3600},generation});
const candidate=(duration=1800,generation=1):CandidateV2=>({phase:'candidate',content:content(duration),opportunity:opportunity(generation)});
const moment:PresentationMomentV2={presentedAt:instantIso('2026-10-18T08:00:00.000Z'),presentedOn:civilDate('2026-10-18'),
  timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'};
const provenance:OccurrenceProvenanceV2={engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:['run-1'],limitationCodes:[]};
const record=(repository:ReturnType<typeof createSuggestionV2Repository>,duration=1800,generation=1,id='occurrence-1')=>
  repository.recordPresented({selection:selectCandidateV2(candidate(duration,generation)),moment,provenance,createId:()=>id});

describe('stockage transactionnel isolé des suggestions V2',()=>{
  it('crée et relit par identifiant, clé et période',async()=>{
    const repository=createSuggestionV2Repository(name()),created=await record(repository);
    expect(created.status).toBe('created');
    expect(await repository.getById(created.occurrence.id)).toEqual(created.occurrence);
    expect(await repository.getByPresentationKey(created.occurrence.presentationKey)).toEqual(created.occurrence);
    expect(await repository.listPresentedBetween('2026-10-18','2026-10-18')).toEqual([created.occurrence]);
    expect(await repository.listPresentedBetween('2026-10-19','2026-10-20')).toEqual([]);
  });

  it('déduplique deux transactions concurrentes simulées par fake-indexeddb',async()=>{
    const database=name(),a=createSuggestionV2Repository(database),b=createSuggestionV2Repository(database);
    const [left,right]=await Promise.all([record(a,1800,1,'left'),record(b,1800,1,'right')]);
    expect([left.status,right.status].sort()).toEqual(['created','existing']);
    expect(left.occurrence.id).toBe(right.occurrence.id);
    expect(await a.listPresentedBetween('2026-10-01','2026-10-31')).toHaveLength(1);
  });

  it('retourne un conflit explicite pour un contenu différent sous la même clé',async()=>{
    const repository=createSuggestionV2Repository(name()),first=await record(repository);
    const conflict=await record(repository,2100,1,'other');
    expect(conflict).toEqual({status:'content-conflict',occurrence:first.occurrence});
  });

  it('autorise une occurrence légitime avec une génération explicite différente',async()=>{
    const repository=createSuggestionV2Repository(name());await record(repository);
    expect((await record(repository,2100,2,'replacement')).status).toBe('created');
    expect(await repository.listPresentedBetween('2026-10-01','2026-10-31')).toHaveLength(2);
  });

  it('conserve le contenu stocké immuable après mutation d’une valeur relue',async()=>{
    const repository=createSuggestionV2Repository(name()),created=await record(repository);
    const read=await repository.getById(created.occurrence.id);(read!.content as {shortSummary:string}).shortSummary='Mutation locale';
    expect((await repository.getById(created.occurrence.id))?.content.shortSummary).toBe('Endurance facile · 30 min');
  });

  it('refuse les données invalides avant insertion',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database);
    const invalid=structuredClone(selectCandidateV2(candidate()));
    (invalid.opportunity as {suggestedFor:string}).suggestedFor='2026-02-30';
    await expect(repository.recordPresented({selection:invalid,moment,provenance,createId:()=> 'bad'})).rejects.toThrow(/date civile/);
    const db=await openDatabase(database);expect(await db.count('coachSuggestionsV2')).toBe(0);db.close();
  });

  it('évite les doublons après fermeture et réouverture',async()=>{
    const database=name(),first=createSuggestionV2Repository(database),created=await record(first);
    const reopened=createSuggestionV2Repository(database),again=await record(reopened,1800,1,'new-id');
    expect(again).toEqual({status:'existing',occurrence:created.occurrence});
  });

  it('préserve les suggestions V1 et migre une base existante sans conversion',async()=>{
    const database=name(),old=await openDB(database,8,{upgrade(db){
      db.createObjectStore('coachSuggestions',{keyPath:'id'}).createIndex('expiresOn','expiresOn');
      db.createObjectStore('sessions',{keyPath:'id'});db.createObjectStore('details',{keyPath:'id'});
    }});
    const v1={id:'suggestion:v1:2026-10-20:easy:1800:-:-',date:'2026-10-20',kind:'easy',durationSeconds:1800,
      createdAt:'2026-10-18T08:00:00.000Z',updatedAt:'2026-10-18T08:00:00.000Z',revision:1,expiresOn:'2026-10-28',state:'current'};
    await old.put('coachSuggestions',v1);old.close();
    const repository=createSuggestionV2Repository(database);await record(repository);
    expect(await createSuggestionRepository(database).list()).toEqual([v1]);
    const db=await openDatabase(database);expect(db.version).toBe(9);expect(await db.count('coachSuggestionsV2')).toBe(1);db.close();
  });

  it('une consultation ciblée n’ajoute aucune occurrence',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),db=await openDatabase(database);db.close();
    const add=vi.spyOn(IDBObjectStore.prototype,'add');
    expect(await repository.getById('absent')).toBeUndefined();
    expect(await repository.listPresentedBetween('2026-10-01','2026-10-31')).toEqual([]);
    expect(add).not.toHaveBeenCalled();
  });
});

describe('cycle de vie des suggestions V2',()=>{
  it('réaffiche la même occurrence sans modifier sa première présentation',async()=>{
    const repository=createSuggestionV2Repository(name()),first=await record(repository);
    const again=await repository.recordPresented({selection:selectCandidateV2(candidate()),moment:{...moment,
      presentedAt:instantIso('2026-10-19T09:00:00.000Z'),presentedOn:civilDate('2026-10-19')},provenance,createId:()=> 'ignored'});
    expect(again).toEqual({status:'existing',occurrence:first.occurrence});
    expect(again.occurrence).toMatchObject({state:'active',revision:1,presentation:moment,updatedAt:moment.presentedAt});
  });

  it('remplace explicitement par une nouvelle occurrence liée et rend l’ancienne obsolète',async()=>{
    const repository=createSuggestionV2Repository(name()),first=await record(repository);
    const replacement=await repository.replacePresented({previousId:first.occurrence.id,expectedRevision:1,
      selection:selectCandidateV2(candidate(2100,2)),moment:{...moment,presentedAt:instantIso('2026-10-19T08:00:00.000Z'),
        presentedOn:civilDate('2026-10-19')},provenance,createId:()=> 'replacement'});
    expect(replacement).toMatchObject({status:'created',occurrence:{id:'replacement',state:'active',supersedesId:first.occurrence.id}});
    expect(await repository.getById(first.occurrence.id)).toMatchObject({state:'obsolete',revision:2,
      supersededById:'replacement',presentation:moment,content:first.occurrence.content});
  });

  it('signale l’ambiguïté et exige une association explicite à une activité réelle',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),created=await record(repository),db=await openDatabase(database);
    await db.put('sessions',{id:'run-a',title:'Course A',date:'2026-10-20',durationSeconds:1800});
    await db.put('sessions',{id:'run-b',title:'Course B',date:'2026-10-20',durationSeconds:1900});db.close();
    expect(await repository.inspectAssociation(created.occurrence.id)).toEqual({status:'ambiguous',activityIds:['run-a','run-b']});
    expect((await repository.getById(created.occurrence.id))?.state).toBe('active');
    const associated=await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'run-a',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    expect(associated).toMatchObject({state:'associated',activityId:'run-a',revision:2});
    expect(await repository.inspectAssociation(created.occurrence.id)).toEqual({status:'associated',activityId:'run-a'});
  });

  it('n’associe ni une simple proximité de date ni une suggestion ignorée',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),created=await record(repository),db=await openDatabase(database);
    await db.put('sessions',{id:'nearby',title:'Course proche',date:'2026-10-21',durationSeconds:1800});db.close();
    expect(await repository.inspectAssociation(created.occurrence.id)).toEqual({status:'no-candidate'});
    await expect(repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'nearby',
      updatedAt:instantIso('2026-10-21T18:00:00.000Z')})).rejects.toThrow(/date civile/);
    expect(await repository.getById(created.occurrence.id)).toEqual(created.occurrence);
  });

  it('distingue obsolescence et éligibilité future sans supprimer après 42 jours',async()=>{
    const repository=createSuggestionV2Repository(name()),created=await record(repository);
    expect(created.occurrence.retainUntil).toBe('2026-12-02');
    expect(operationalStatusV2(created.occurrence,'2026-12-01')).toEqual({withinWindow:true,deletionEligible:false});
    expect(operationalStatusV2(created.occurrence,'2026-12-02')).toEqual({withinWindow:false,deletionEligible:true});
    const obsolete=await repository.markObsolete(created.occurrence.id,1,instantIso('2026-12-02T08:00:00.000Z'));
    expect(obsolete).toMatchObject({state:'obsolete',revision:2});
    expect(await repository.getById(created.occurrence.id)).toEqual(obsolete);
  });

  it('conserve sans limite de purge automatique une occurrence associée',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),created=await record(repository),db=await openDatabase(database);
    await db.put('sessions',{id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800});db.close();
    const associated=await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    expect(operationalStatusV2(associated,'2027-01-01')).toEqual({withinWindow:false,deletionEligible:false});
    await expect(repository.markObsolete(associated.id,2,instantIso('2027-01-01T00:00:00.000Z'))).rejects.toThrow(/associée/);
  });

  it('invalide explicitement le lien dans la transaction de suppression sans réassociation',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),sessions=createSessionRepository(database),created=await record(repository);
    await sessions.save({id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800});
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    expect(await sessions.remove?.('real-run')).toBe(true);
    expect(await repository.getById(created.occurrence.id)).toMatchObject({state:'obsolete',revision:3,
      associationInvalidation:{activityId:'real-run',reason:'activity-missing'}});
  });

  it('conserve une association après une correction descriptive, un ressenti ou des chaussures',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),sessions=createSessionRepository(database),created=await record(repository);
    await sessions.save({id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800});
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    await sessions.save({id:'real-run',title:'Titre corrigé',date:'2026-10-20',durationSeconds:1800});
    expect((await repository.getById(created.occurrence.id))?.state).toBe('associated');
    const db=await openDatabase(database),current=(await db.get('sessions','real-run'))!;
    await db.put('sessions',{...current,feeling:{effort:'easy'}});await db.put('shoeAssignments',{sessionId:'real-run',shoeId:'shoe-a'});db.close();
    expect((await repository.getById(created.occurrence.id))?.state).toBe('associated');
  });

  it.each([
    ['durée',{durationSeconds:1900}],['distance',{distanceMeters:5000}],['dénivelé',{ascentMeters:120}],
    ['métadonnée d’import',{polarId:'polar-replaced'}],
  ])('invalide atomiquement une association après modification significative de %s',async(_label,change)=>{
    const database=name(),repository=createSuggestionV2Repository(database),sessions=createSessionRepository(database),created=await record(repository);
    const base={id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800};await sessions.save(base);
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    await sessions.save({...base,...change});
    expect(await repository.getById(created.occurrence.id)).toMatchObject({state:'obsolete',revision:3,
      associationInvalidation:{activityId:'real-run',reason:'activity-modified'},associationEvidence:{sportSignature:expect.any(String)}});
  });

  it('invalide un lien si le remplacement change la date civile',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),sessions=createSessionRepository(database),created=await record(repository);
    await sessions.save({id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800});
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    await sessions.save({id:'real-run',title:'Course déplacée',date:'2026-10-21',durationSeconds:1900});
    expect(await repository.getById(created.occurrence.id)).toMatchObject({state:'obsolete',revision:3,
      associationInvalidation:{activityId:'real-run',reason:'activity-replaced'}});
  });

  it('annule aussi la modification sportive si l’invalidation V2 échoue',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),sessions=createSessionRepository(database),created=await record(repository);
    const base={id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800,distanceMeters:5000};await sessions.save(base);
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    const original=IDBObjectStore.prototype.put;
    const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<typeof original>){
      if(this.name==='coachSuggestionsV2')throw new Error('Échec synthétique V2');return original.apply(this,args);
    });
    await expect(sessions.save({...base,distanceMeters:6000})).rejects.toThrow('Échec synthétique V2');spy.mockRestore();
    const db=await openDatabase(database);expect(await db.get('sessions','real-run')).toEqual(base);db.close();
    expect(await repository.getById(created.occurrence.id)).toMatchObject({state:'associated',activityId:'real-run',revision:2});
  });

  it('détecte et invalide les associations orphelines écrites hors du dépôt',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),created=await record(repository),db=await openDatabase(database);
    await db.put('sessions',{id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800});db.close();
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    const raw=await openDatabase(database);await raw.delete('sessions','real-run');raw.close();
    expect(await repository.inspectAssociation(created.occurrence.id)).toEqual({status:'invalid-association',activityId:'real-run'});
    expect(await repository.invalidateMissingAssociations(instantIso('2026-10-21T08:00:00.000Z'))).toEqual({invalidated:1});
    expect((await repository.getById(created.occurrence.id))?.state).toBe('obsolete');
  });

  it('détecte une modification sportive écrite hors du dépôt et la réconcilie sans réassociation',async()=>{
    const database=name(),repository=createSuggestionV2Repository(database),created=await record(repository),db=await openDatabase(database);
    await db.put('sessions',{id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800,distanceMeters:5000});db.close();
    await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'real-run',
      updatedAt:instantIso('2026-10-20T18:00:00.000Z')});
    const raw=await openDatabase(database);await raw.put('sessions',{id:'real-run',title:'Course',date:'2026-10-20',durationSeconds:1800,distanceMeters:6000});raw.close();
    expect(await repository.inspectAssociation(created.occurrence.id)).toEqual({status:'invalid-association',activityId:'real-run'});
    expect(await repository.invalidateMissingAssociations(instantIso('2026-10-21T08:00:00.000Z'))).toEqual({invalidated:1});
    const invalidated=await repository.getById(created.occurrence.id);
    expect(invalidated).toMatchObject({state:'obsolete',associationInvalidation:{activityId:'real-run',reason:'activity-modified'}});
    expect(invalidated).not.toHaveProperty('activityId');
  });
});
