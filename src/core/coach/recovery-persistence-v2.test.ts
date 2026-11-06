import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { deleteDB } from 'idb';
import * as adapter from './application-adapter-v2';
import type { CoachV2ApplicationSnapshot } from './application-adapter-v2';
import type { CoachTemperament } from '../../types/evolving-coach';
import { civilDate,ianaTimeZone,instantIso } from './persistence-foundations-v2';
import { openDatabase } from '../../storage/database-connection';
import { calculateCoachV2Readonly } from '../../storage/coach-v2-readonly';
import { CoachV2SelectionChanged,createSuggestionV2Repository,presentCoachV2Selection,replaceCoachV2Selection,SuggestionV2LifecycleConflict } from '../../storage/coach-suggestions-v2';
const today='2026-11-04',DAY=86400000;
const date=(age:number)=>new Date(Date.parse(`${today}T00:00:00Z`)-age*DAY).toISOString().slice(0,10);
const snapshot=(coachTemperament:CoachTemperament='rentre-dedans'):CoachV2ApplicationSnapshot=>({coachTemperament,
  sessions:[26,21,16,11,6,2].map((age,index)=>({id:`run-${index}`,date:date(age),title:'Synthétique',sport:'RUNNING',
    durationSeconds:2400,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
  configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},
  profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},
    preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]});
const moment=(on=today)=>({presentedAt:instantIso(`${on}T08:00:00.000Z`),presentedOn:civilDate(on),
  timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation' as const});
const provenance=(source=snapshot())=>({engine:'coach-v2' as const,contractVersion:1 as const,referenceConfidence:'confirmed' as const,
  referenceSourceIds:source.sessions.map(value=>value.id),limitationCodes:[]});
const databases:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(databases.splice(0).map(name=>deleteDB(name)));});
async function isolatedDatabase(source:CoachV2ApplicationSnapshot){
  const name=`d4b-${crypto.randomUUID()}`;databases.push(name);
  const db=await openDatabase(name),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
  for(const session of source.sessions)await tx.objectStore('sessions').put(session);
  for(const value of source.occurrences)await tx.objectStore('coachSuggestionsV2').put(value);
  const metadata={id:'local' as const,revision:1,createdAt:'2026-09-01T08:00:00.000Z',updatedAt:'2026-09-01T08:00:00.000Z'};
  await tx.objectStore('coachProfile').put({...source.profile!,...metadata});
  await tx.objectStore('evolvingCoach').put({...metadata,configuration:source.configuration??null,coachTemperament:source.coachTemperament});
  await tx.done;db.close();return name;
}

async function prepare(){
  const name=await isolatedDatabase(snapshot()),result=await calculateCoachV2Readonly(today,name);
  const first=await presentCoachV2Selection({result,referenceDate:today,moment:moment(),provenance:provenance(),createId:()=>'first'},name);
  return {name,result,first,replace:()=>replaceCoachV2Selection({previousId:first.occurrence.id,expectedRevision:1,
    result,moment:moment(),provenance:provenance(),createId:()=>'replacement'},name)};
}
async function changeEffort(name:string,effort:'very-hard'|'easy'){
  const db=await openDatabase(name);
  const run=await db.get('sessions','run-5');
  await db.put('sessions',{...run!,feeling:{effort}});db.close();
}
describe('politique commune avant mémorisation',()=>{
  it('remplacement valide : génération augmentée, historique conservé',async()=>{
    const {name,first,replace}=await prepare(),next=await replace();
    expect(next.status).toBe('created');expect(next.occurrence.opportunity.generation).toBe(2);
    expect(next.occurrence.supersedesId).toBe(first.occurrence.id);
    const old=await createSuggestionV2Repository(name).getById(first.occurrence.id);
    expect(old).toEqual({...first.occurrence,state:'obsolete',revision:2,supersededById:'replacement'});
  });
  it('refuse une sélection sportive devenue périmée sans toucher à son historique',async()=>{
    const {name,first,replace}=await prepare();
    await changeEffort(name,'very-hard');
    await expect(replace()).rejects.toBeInstanceOf(CoachV2SelectionChanged);
    expect(await createSuggestionV2Repository(name).listAll()).toEqual([first.occurrence]);
  });
  it.each(['present','replace'] as const)('concurrence après calcul, avant transaction : %s réévalue',async path=>{
    const {name,result,first,replace}=await prepare(),original=adapter.adaptCoachV2WithContinuity;
    const spy=vi.spyOn(adapter,'adaptCoachV2WithContinuity').mockImplementationOnce(async(...args)=>{
      const value=await original(...args);await changeEffort(name,'very-hard');return value;
    });
    const action=path==='replace'?replace():presentCoachV2Selection({result,referenceDate:today,moment:moment(),provenance:provenance()},name);
    await expect(action).rejects.toBeInstanceOf(CoachV2SelectionChanged);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await createSuggestionV2Repository(name).listAll()).toEqual([first.occurrence]);
  });
  it('concurrence compatible : relit puis remplace une seule fois',async()=>{
    const {name,replace}=await prepare(),original=adapter.adaptCoachV2WithContinuity;
    const spy=vi.spyOn(adapter,'adaptCoachV2WithContinuity').mockImplementationOnce(async(...args)=>{
      const value=await original(...args);await changeEffort(name,'easy');return value;
    });
    expect((await replace()).status).toBe('created');expect(spy).toHaveBeenCalledTimes(2);
    expect(await createSuggestionV2Repository(name).listAll()).toHaveLength(2);
  });
  it('deux remplacements concurrents : une seule nouvelle occurrence',async()=>{
    const {name,replace}=await prepare();
    const results=await Promise.allSettled([replace(),replace()]);
    expect(results.filter(value=>value.status==='fulfilled')).toHaveLength(1);
    const failed=results.find(value=>value.status==='rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(SuggestionV2LifecycleConflict);
    const rows=await createSuggestionV2Repository(name).listAll();
    expect(rows).toHaveLength(2);expect(rows.filter(value=>value.state==='active')).toHaveLength(1);
  });
});
