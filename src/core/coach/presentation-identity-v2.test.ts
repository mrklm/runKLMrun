import { calculateCoachV2Readonly } from '../../storage/coach-v2-readonly';
import { CoachV2TemperamentChanged } from '../../storage/coach-suggestions-v2';
import { createEvolvingCoachRepository } from '../../storage/evolving-coach';
import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { deleteDB } from 'idb';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { RunningSession } from '../../types/session';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import { adaptCoachV2Readonly } from './application-adapter-v2';
import { civilDate,ianaTimeZone,instantIso,type OccurrenceProvenanceV2,type PresentationMomentV2 } from './persistence-foundations-v2';
import { presentCoachV2Selection,replaceCoachV2Selection,createSuggestionV2Repository } from '../../storage/coach-suggestions-v2';
import { openDatabase } from '../../storage/database-connection';
import { reusableActiveOccurrenceV2 } from './presentation-identity-v2';

const databases:string[]=[];
const database=async(values=configuration,rows=sessions)=>{
  const name=`coach-v2-identity-${crypto.randomUUID()}`;databases.push(name);
  const db=await openDatabase(name),tx=db.transaction(['sessions','coachProfile','evolvingCoach'],'readwrite');
  for(const row of rows)await tx.objectStore('sessions').put(row);
  const metadata={id:'local' as const,revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z'};
  await tx.objectStore('coachProfile').put({...profile,...metadata});
  await tx.objectStore('evolvingCoach').put({...metadata,configuration:values});await tx.done;db.close();return name;
};
const saveActivity=async(name:string,activity:RunningSession)=>{const db=await openDatabase(name);await db.put('sessions',activity);db.close();};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(databases.splice(0).map(value=>deleteDB(value)));});
const profile:CoachProfileValues={goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['monday','wednesday','friday'],
  minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'};
const configuration:EvolvingCoachValues={goal:{model:'evolving',kind:'endurance'},experience:'experienced',structuredPlanningPreference:'accepted'};
const sessions:RunningSession[]=['2026-10-10','2026-10-11','2026-10-12','2026-10-13'].map((date,index)=>
  ({id:`run-${index}`,title:'Course',sport:'RUNNING',date,durationSeconds:2400}));
const moment=(at='2026-10-18T08:00:00.000Z',on='2026-10-18'):PresentationMomentV2=>({presentedAt:instantIso(at),presentedOn:civilDate(on),
  timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'});
const provenance:OccurrenceProvenanceV2={engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',
  referenceSourceIds:sessions.map(value=>value.id),limitationCodes:[]};
const calculate=(occurrences:Awaited<ReturnType<ReturnType<typeof createSuggestionV2Repository>['listAll']>>=[],values=profile,
  referenceDate='2026-10-18')=>adaptCoachV2Readonly({sessions,occurrences,configuration,profile:values},referenceDate);

// Les deux appels doivent avoir lu l'état initial avant de pouvoir préparer leur écriture.
function overlapPreparations(){
  const digest=crypto.subtle.digest.bind(crypto.subtle);let arrived=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{
    if(arrived<2){arrived++;if(arrived===2)release();await gate;}
    return digest(algorithm,data);
  });
  return()=>arrived;
}

describe('identité applicative et génération V2',()=>{
  it('conserve la même identité après une activité compatible importée tardivement',async()=>{
    const name=await database(),first=await presentCoachV2Selection({result:calculate(),referenceDate:'2026-10-18',moment:moment(),provenance,
      createId:()=> 'kept'},name),repository=createSuggestionV2Repository(name),stored=await repository.listAll();
    const lateActivity:RunningSession={id:'late-import',date:'2026-10-15',title:'Course importée le 18',sport:'RUNNING',durationSeconds:2400};
    await saveActivity(name,lateActivity);
    for(let consultation=0;consultation<3;consultation++){
      const result=adaptCoachV2Readonly({sessions:[...sessions,lateActivity],occurrences:stored,configuration,profile},'2026-10-18');
      expect(reusableActiveOccurrenceV2(stored,result,'2026-10-18')).toEqual(first.occurrence);
      expect(await presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'forbidden'},name))
        .toEqual({status:'reused-active',occurrence:first.occurrence});
    }
    expect(await repository.listAll()).toEqual(stored);
  });

  it('écarte une suggestion incompatible sans la supprimer et permet son association tardive',async()=>{
    const name=await database(),first=await presentCoachV2Selection({result:calculate(),referenceDate:'2026-10-18',moment:moment(),provenance,
      createId:()=> 'old'},name),repository=createSuggestionV2Repository(name),stored=await repository.listAll();
    const actual:RunningSession={id:'actual',date:'2026-10-18',title:'Course réelle',sport:'RUNNING',durationSeconds:2400};
    await saveActivity(name,actual);
    const result=adaptCoachV2Readonly({sessions:[...sessions,actual],occurrences:stored,configuration,profile},'2026-10-18');
    expect(reusableActiveOccurrenceV2(stored,result,'2026-10-18')).toBeUndefined();
    expect(result.selectedDate).toBe('2026-10-21');
    const next=await presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'next'},name);
    expect(next.occurrence.id).toBe('next');expect(await repository.getById('old')).toEqual(first.occurrence);
    const all=await repository.listAll();
    const again=adaptCoachV2Readonly({sessions:[...sessions,actual],occurrences:all,configuration,profile},'2026-10-18');
    expect(reusableActiveOccurrenceV2(all,again,'2026-10-18')?.id).toBe('next');
    expect(await presentCoachV2Selection({result:again,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'forbidden'},name))
      .toMatchObject({status:'reused-active',occurrence:{id:'next'}});
    const db=await openDatabase(name);await db.put('sessions',{...actual,id:'late-association',date:'2026-10-19',durationSeconds:1500});db.close();
    await repository.associateActivity({occurrenceId:'old',expectedRevision:1,activityId:'late-association',updatedAt:instantIso('2026-10-22T08:00:00.000Z')});
    expect(await repository.getById('old')).toMatchObject({state:'associated',activityId:'late-association',content:first.occurrence.content});
    expect(await repository.listAll()).toHaveLength(2);
  });

  it('contrôle la durée et les disponibilités actuelles sans imposer la nouvelle date sélectionnée',async()=>{
    const future={...profile,availability:{...profile.availability,days:['wednesday'] as CoachProfileValues['availability']['days']}};
    const name=await database(),first=await presentCoachV2Selection({result:calculate([],future),referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'future'},name);
    const stored=await createSuggestionV2Repository(name).listAll(),result=calculate(stored);
    expect(result.selectedDate).toBe('2026-10-19');
    expect(reusableActiveOccurrenceV2(stored,result,'2026-10-18')).toEqual(first.occurrence);
    const reduced=calculate(stored,{...profile,availability:{...profile.availability,minutesPerSession:20}});
    expect(reusableActiveOccurrenceV2(stored,reduced,'2026-10-18')).toBeUndefined();
  });

  it('réapplique le délai structuré réel à une occurrence de fractionné déjà présentée',async()=>{
    const runs:RunningSession[]=['2026-10-01','2026-10-04','2026-10-07','2026-10-10','2026-10-13','2026-10-16']
      .map((date,index)=>({id:`run-${index}`,date,title:'Course',sport:'RUNNING',durationSeconds:2400}));
    const values={...configuration,goal:{model:'evolving',kind:'speed'} as const};
    const initial=adaptCoachV2Readonly({coachTemperament:'rentre-dedans',sessions:runs,occurrences:[],configuration:values,profile},'2026-10-18');
    expect(initial.candidate?.type).toBe('intervals');
    const name=await database(values,runs);await createEvolvingCoachRepository(name).saveTemperament('rentre-dedans',1);await presentCoachV2Selection({result:initial,referenceDate:'2026-10-18',moment:moment(),
      provenance:{...provenance,referenceSourceIds:runs.map(run=>run.id)},createId:()=> 'intervals'},name);
    const stored=await createSuggestionV2Repository(name).listAll();
    const result=adaptCoachV2Readonly({sessions:[...runs,{id:'real-intervals',date:'2026-10-17',title:'Fractionné réel',sport:'RUNNING',durationSeconds:2400}],
      occurrences:stored,configuration:values,profile,documentedActivityTypes:{'real-intervals':'intervals'}},'2026-10-18');
    expect(result).toMatchObject({selectedDate:'2026-10-19',candidate:{type:'easy-endurance'}});
    expect(reusableActiveOccurrenceV2(stored,result,'2026-10-18')).toBeUndefined();
    expect(await createSuggestionV2Repository(name).listAll()).toEqual(stored);
  });
  it('conserve après 18 h la suggestion déjà mémorisée pour aujourd’hui sans réécriture',async()=>{
    const name=await database(),morning=calculate([],profile,'2026-10-19');
    const first=await presentCoachV2Selection({result:morning,referenceDate:'2026-10-19',
      moment:moment('2026-10-19T15:59:00.000Z','2026-10-19'),provenance,createId:()=> 'today'},name);
    const repository=createSuggestionV2Repository(name),stored=await repository.listAll(),before=structuredClone(stored);
    const add=vi.spyOn(IDBObjectStore.prototype,'add'),put=vi.spyOn(IDBObjectStore.prototype,'put'),remove=vi.spyOn(IDBObjectStore.prototype,'delete');
    const evening=adaptCoachV2Readonly({sessions,occurrences:stored,configuration,profile},{date:'2026-10-19',minuteOfDay:1080});
    expect(evening.selectedDate).toBe('2026-10-21');
    expect(reusableActiveOccurrenceV2(stored,evening,'2026-10-19')).toEqual(first.occurrence);
    expect(stored).toEqual(before);expect(await repository.listAll()).toEqual(before);
    expect(add).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();
  });
  it('la consultation reste sans écriture, puis la première présentation est persistée explicitement',async()=>{
    const name=await database(),result=calculate(),add=vi.spyOn(IDBObjectStore.prototype,'add');
    expect(result.selectedDate).toBe('2026-10-19');expect(add).not.toHaveBeenCalled();
    const created=await presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'first'},name);
    expect(created).toMatchObject({status:'created',occurrence:{id:'first',opportunity:{generation:1}}});
  });

  it('réutilise l’occurrence active après consultation et changement mineur de profil sans boucle d’ancrage',async()=>{
    const name=await database(),first=await presentCoachV2Selection({result:calculate(),referenceDate:'2026-10-18',moment:moment(),provenance,
      createId:()=> 'first'},name),stored=await createSuggestionV2Repository(name).listAll();
    const changed={...profile,availability:{...profile.availability,minutesPerSession:55}};
    const recalculated=calculate(stored,changed);
    expect(recalculated.temporalAnchor).toMatchObject({kind:'presentation',id:'first'});
    const reused=await presentCoachV2Selection({result:recalculated,referenceDate:'2026-10-18',moment:moment('2026-10-18T09:00:00.000Z'),
      provenance,createId:()=> 'forbidden'},name);
    expect(reused).toEqual({status:'reused-active',occurrence:first.occurrence});
    expect(await createSuggestionV2Repository(name).listAll()).toHaveLength(1);
  });

  it('une activité plus récente ouvre une nouvelle occasion lorsque l’ancienne date est passée',async()=>{
    const name=await database();await presentCoachV2Selection({result:calculate(),referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'first'},name);
    const laterSessions=[...sessions,{id:'real-new',title:'Course',sport:'RUNNING',date:'2026-10-20',durationSeconds:2400}];
    await saveActivity(name,laterSessions.at(-1)!);
    const occurrences=await createSuggestionV2Repository(name).listAll();
    const result=adaptCoachV2Readonly({sessions:laterSessions,occurrences,configuration,profile},'2026-10-22');
    const created=await presentCoachV2Selection({result,referenceDate:'2026-10-22',moment:moment('2026-10-22T08:00:00.000Z','2026-10-22'),
      provenance:{...provenance,referenceSourceIds:[...provenance.referenceSourceIds,'real-new']},createId:()=> 'second'},name);
    expect(created).toMatchObject({status:'created',occurrence:{id:'second',opportunity:{anchor:{kind:'activity',id:'real-new'}}}});
  });

  it('attribue une seule génération lors de deux présentations concurrentes simulées',async()=>{
    const name=await database(),result=calculate();
    const arrived=overlapPreparations();
    const [left,right]=await Promise.all([
      presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'left'},name),
      presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'right'},name),
    ]);
    expect([left.status,right.status].sort()).toEqual(['created','reused-active']);
    expect(left.occurrence.id).toBe(right.occurrence.id);expect(left.occurrence.opportunity.generation).toBe(1);
    expect(arrived()).toBe(2);expect(await createSuggestionV2Repository(name).listAll()).toEqual([left.occurrence]);
  });

  it.each([false,true])('coordonne deux dates et clés distinctes, ordre inversé : %s',async reverse=>{
    const name=await database(),early=calculate(),future=calculate([],{...profile,
      availability:{...profile.availability,days:['wednesday']}});
    expect(early.selectedDate).toBe('2026-10-19');expect(future.selectedDate).toBe('2026-10-21');
    const results=reverse?[future,early]:[early,future],arrived=overlapPreparations();
    const calls=await Promise.all(results.map((result,index)=>presentCoachV2Selection({result,referenceDate:'2026-10-18',
      moment:moment(`2026-10-18T0${8+index}:00:00.000Z`),provenance,createId:()=>`tab-${index}`},name)));
    const winner=calls.find(value=>value.status==='created')!;
    expect(arrived()).toBe(2);expect(calls.map(value=>value.status).sort()).toEqual(['created','reused-active']);
    expect(calls[0].occurrence).toEqual(calls[1].occurrence);
    expect(await createSuggestionV2Repository(name).listAll()).toEqual([winner.occurrence]);
    expect(winner.occurrence.presentation.presentedAt).toBe(winner.occurrence.id==='tab-0'?'2026-10-18T08:00:00.000Z':'2026-10-18T09:00:00.000Z');
  });

  it('réutilise une occurrence future compatible même absente des dates examinées par l’autre onglet',async()=>{
    const name=await database(),early=calculate(),future=calculate([],{...profile,availability:{...profile.availability,days:['wednesday']}});
    // Simuler un résultat partiel/périmé : la transaction doit relire la compatibilité.
    delete early.admissibleSessionsByDate['2026-10-21'];
    const first=await presentCoachV2Selection({result:future,referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'future'},name);
    const second=await presentCoachV2Selection({result:early,referenceDate:'2026-10-18',moment:moment('2026-10-18T09:00:00.000Z'),provenance,createId:()=> 'forbidden'},name);
    expect(second).toEqual({status:'reused-active',occurrence:first.occurrence});
    expect(await createSuggestionV2Repository(name).listAll()).toEqual([first.occurrence]);
  });

  it('préserve une occurrence associée lors de deux nouvelles présentations concurrentes',async()=>{
    const name=await database(),repository=createSuggestionV2Repository(name);
    const first=await presentCoachV2Selection({result:calculate(),referenceDate:'2026-10-18',moment:moment(),provenance,createId:()=> 'history'},name);
    const actual:RunningSession={id:'actual-history',date:'2026-10-19',title:'Réalisée',sport:'RUNNING',durationSeconds:2400};
    await saveActivity(name,actual);
    const associated=await repository.associateActivity({occurrenceId:first.occurrence.id,expectedRevision:1,activityId:actual.id,updatedAt:instantIso('2026-10-20T08:00:00.000Z')});
    const result=adaptCoachV2Readonly({sessions:[...sessions,actual],occurrences:[associated],configuration,profile},'2026-10-22');
    overlapPreparations();
    const calls=await Promise.all(['a','b'].map(id=>presentCoachV2Selection({result,referenceDate:'2026-10-22',
      moment:moment('2026-10-22T08:00:00.000Z','2026-10-22'),provenance,createId:()=>id},name)));
    expect(calls[0].occurrence).toEqual(calls[1].occurrence);
    expect(await repository.getById('history')).toEqual(associated);expect(await repository.listAll()).toHaveLength(2);
  });

  it('un remplacement explicite crée la génération suivante et préserve la première présentation',async()=>{
    const name=await database(),first=await presentCoachV2Selection({result:calculate(),referenceDate:'2026-10-18',moment:moment(),provenance,
      createId:()=> 'first'},name);
    const replacement=await replaceCoachV2Selection({previousId:first.occurrence.id,expectedRevision:1,result:calculate(),
      moment:moment('2026-10-18T10:00:00.000Z'),provenance,createId:()=> 'replacement'},name);
    expect(replacement).toMatchObject({status:'created',occurrence:{id:'replacement',supersedesId:'first',opportunity:{generation:2}}});
    expect(await createSuggestionV2Repository(name).getById('first')).toMatchObject({state:'obsolete',presentation:moment()});
  });

  it('refuse de présenter un résultat incomplet et ne touche pas aux suggestions V1',async()=>{
    const name=await database(),result=adaptCoachV2Readonly({sessions:[],occurrences:[],configuration,profile},'2026-10-18');
    await expect(presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance},name)).rejects.toThrow(/incomplète/);
    const db=await openDatabase(name);expect(await db.count('coachSuggestionsV2')).toBe(0);expect(await db.count('coachSuggestions')).toBe(0);db.close();
  });
});


it('refuse un tempérament périmé puis conserve l’occurrence présentée malgré un nouveau changement',async()=>{
  const name=await database(),repo=createEvolvingCoachRepository(name);
  const stale=await calculateCoachV2Readonly('2026-10-18',name);
  const changed=await repo.saveTemperament('rentre-dedans',1);
  await expect(presentCoachV2Selection({result:stale,referenceDate:'2026-10-18',moment:moment(),provenance},name))
    .rejects.toBeInstanceOf(CoachV2TemperamentChanged);
  expect(await createSuggestionV2Repository(name).listAll()).toEqual([]);
  const fresh=await calculateCoachV2Readonly('2026-10-18',name);
  overlapPreparations();
  const pair=await Promise.all([0,1].map(()=>presentCoachV2Selection({result:fresh,referenceDate:'2026-10-18',moment:moment(),provenance},name)));
  expect(pair[0].occurrence).toEqual(pair[1].occurrence);
  await repo.saveTemperament('pas-a-pas',changed.revision);
  const reused=await presentCoachV2Selection({result:fresh,referenceDate:'2026-10-18',moment:moment(),provenance},name);
  expect(reused).toMatchObject({status:'reused-active',occurrence:pair[0].occurrence});
  expect(await createSuggestionV2Repository(name).listAll()).toEqual([pair[0].occurrence]);
});

it('revérifie le tempérament dans la transaction si un autre onglet le change pendant la préparation',async()=>{
  const name=await database(),repo=createEvolvingCoachRepository(name);
  const result=await calculateCoachV2Readonly('2026-10-18',name);
  const digest=crypto.subtle.digest.bind(crypto.subtle);let changed=false;
  vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{
    if(!changed){changed=true;await repo.saveTemperament('evolution-active',1);}
    return digest(algorithm,data);
  });
  await expect(presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:moment(),provenance},name))
    .rejects.toBeInstanceOf(CoachV2TemperamentChanged);
  expect(changed).toBe(true);expect(await createSuggestionV2Repository(name).listAll()).toEqual([]);
});
