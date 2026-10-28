import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { deleteDB } from 'idb';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
import { activitySportSignatureV2,civilDate,ianaTimeZone,instantIso,observePresentationV2,retentionLimitV2,selectCandidateV2,type CandidateV2,
  type PersistableOccurrenceV2 } from './persistence-foundations-v2';
import { adaptCoachV2Readonly,habitualReferenceFromOccurrencesV2,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { calculateCoachV2Readonly } from '../../storage/coach-v2-readonly';
import { openDatabase } from '../../storage/database-connection';

const today='2026-10-18',DAY=86400000,origin=Date.parse(`${today}T00:00:00Z`),names:string[]=[];
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,minutes=40):RunningSession=>({id,title:'Course',sport:'RUNNING',date:date(offset),durationSeconds:minutes*60});
const profile:CoachProfileValues={goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
  days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'trail'},accompanimentMode:'advisor'};
const config=(kind:EvolvingCoachValues['goal']['kind']='endurance'):EvolvingCoachValues=>({goal:{model:'evolving',kind} as EvolvingCoachValues['goal'],
  experience:'experienced',structuredPlanningPreference:'accepted'});
async function occurrence(sources:string[],presentedOn='2026-10-14',confidence:'confirmed'|'provisional'='confirmed',id='occurrence',
  type:CandidateV2['content']['type']='easy-endurance'):Promise<PersistableOccurrenceV2> {
  const candidate:CandidateV2={phase:'candidate',content:{type,totalDurationSeconds:1800,
    intensity:type==='intervals'?'controlled-hard':'easy',terrain:'flat',shortSummary:type==='intervals'?'Fractionné':'Facile',
    ...(type==='intervals'?{structure:{warmUp:{durationSeconds:600,intensity:'easy',instruction:'Facile'},
      efforts:[{durationSeconds:60,repetitions:6,intensity:'controlled-hard',instruction:'Dynamique'}],
      recoveries:[{durationSeconds:60,repetitions:6,intensity:'very-easy',instruction:'Facile'}],
      coolDown:{durationSeconds:480,intensity:'easy',instruction:'Facile'}}}: {})},
    opportunity:{contractVersion:1,goal:'endurance',suggestedFor:civilDate('2026-10-16'),anchor:{kind:'bootstrap',referenceDate:civilDate('2026-10-10')},
      availability:{weekday:'friday',maximumSeconds:3600},generation:1}};
  return (await observePresentationV2({selection:selectCandidateV2(candidate),moment:{presentedAt:instantIso(`${presentedOn}T08:00:00.000Z`),
    presentedOn:civilDate(presentedOn),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:confidence,referenceSourceIds:sources,limitationCodes:[]},
    existing:[],createId:()=>id})).occurrence;
}
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(names.splice(0).map(name=>deleteDB(name)));});

describe('adaptateur applicatif V2 en lecture seule',()=>{
  it.each([undefined,'long-run'] as const)('ne déduit pas un fractionné réalisé du conseil associé (type réel : %s)',async realType=>{
    const sessions=[-8,-6,-4,-2].map((offset,index)=>run(`actual-${index}`,offset));
    const advised=await occurrence(sessions.map(value=>value.id),'2026-10-14','confirmed','advised','intervals');
    const associated:PersistableOccurrenceV2={...advised,state:'associated',activityId:sessions[3].id};
    const snapshot:CoachV2ApplicationSnapshot={sessions,occurrences:[associated],configuration:config('speed'),profile,
      ...(realType?{documentedActivityTypes:{[sessions[3].id]:realType}}:{})};
    const before=structuredClone(snapshot),result=adaptCoachV2Readonly(snapshot,today);
    expect(result.catalog.adaptedInput?.observedSessionTypes).toEqual(realType?[realType]:[]);
    expect(result.catalog.sessions.some(value=>value.type==='intervals')).toBe(false);
    expect(snapshot).toEqual(before);
  });
  it('produit une référence confirmée depuis une provenance V2 explicite',async()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`run-${index}`,offset,40)),stored=await occurrence(sessions.map(value=>value.id));
    const result=adaptCoachV2Readonly({sessions,occurrences:[stored],configuration:config(),profile},today);
    expect(result.reference).toMatchObject({confidence:'confirmed',referenceSeconds:2400});
    expect(result.candidate).toMatchObject({type:'easy-endurance',intensity:'easy',terrain:'flat'});
    expect(result).toMatchObject({selectedDate:'2026-10-19',dailyMaximumSeconds:3600,
      temporalAnchor:{kind:'presentation',id:'occurrence',date:'2026-10-14'}});
  });

  it('confirme un historique réel suffisant sans provenance V2 préexistante',()=>{
    const provisional=adaptCoachV2Readonly({sessions:[-8,-7,-6,-5].map((offset,index)=>run(`p-${index}`,offset)),occurrences:[],configuration:config(),profile},today);
    expect(provisional.reference.confidence).toBe('confirmed');expect(provisional.candidate?.type).toBe('easy-endurance');
    const unavailable=adaptCoachV2Readonly({sessions:[run('only',-5)],occurrences:[],configuration:config(),profile},today);
    expect(unavailable).toMatchObject({reference:{confidence:'unavailable'},candidate:null,reason:'catalog-unavailable'});
  });

  it('conserve la médiane exacte des imports sans ressenti, indépendamment de leur ordre',()=>{
    const sessions=[2100,2190,2196,2196,2400,2400].map((seconds,index)=>({
      ...run(`import-${index}`,-12+index),durationSeconds:seconds,source:'tcx' as const}));
    const input={sessions,occurrences:[]},before=structuredClone(input);
    const result=habitualReferenceFromOccurrencesV2(input,today);
    expect(result).toMatchObject({confidence:'confirmed',referenceSeconds:2196});
    expect(habitualReferenceFromOccurrencesV2({...input,sessions:[...sessions].reverse()},today)).toEqual(result);
    expect(input).toEqual(before);
  });

  it('arrondit la médiane fractionnaire des imports avant le recalcul du Coach',()=>{
    const sessions=[2100,2100,2101,2101].map((seconds,index)=>({...run(`fractional-${index}`,-8+index),durationSeconds:seconds,source:'tcx' as const}));
    const input={sessions,occurrences:[],configuration:config(),profile};
    const result=adaptCoachV2Readonly(input,today);
    expect(result.reference.referenceSeconds).toBe(2101);
    expect(result.candidate).not.toBeNull();
    const reordered=adaptCoachV2Readonly({...input,sessions:[...sessions].reverse()},today);
    expect(reordered.reference.referenceSeconds).toBe(result.reference.referenceSeconds);
    expect(reordered.candidate).toEqual(result.candidate);
  });

  it('arrondit la médiane fractionnaire d’une référence confirmée avant la stratégie',async()=>{
    const sessions=[2100,2100,2101,2101].map((seconds,index)=>({...run(`confirmed-fractional-${index}`,-8+index),durationSeconds:seconds}));
    const confirmed=await occurrence(sessions.map(session=>session.id),'2026-10-14','confirmed','confirmed-fractional');
    const result=adaptCoachV2Readonly({sessions,occurrences:[confirmed],configuration:config(),profile},today);
    expect(result.reference).toMatchObject({confidence:'confirmed',referenceSeconds:2101});
    expect(result.candidate).not.toBeNull();
  });

  it('conserve la médiane entière d’un nombre impair d’imports',()=>{
    const sessions=[2100,2101,2102,2103,2104].map((seconds,index)=>({...run(`odd-${index}`,-9+index),durationSeconds:seconds,source:'tcx' as const}));
    expect(habitualReferenceFromOccurrencesV2({sessions,occurrences:[]},today).referenceSeconds).toBe(2102);
  });

  it.each([
    {label:'insuffisant',offsets:[-8,-6,-4],minutes:[40,40,40]},
    {label:'ancien',offsets:[-50,-49,-48,-43],minutes:[40,40,40,40]},
    {label:'interruption supérieure à 42 jours',offsets:[-60,-59,-58,-57,-3],minutes:[40,40,40,40,40]},
    {label:'dispersé',offsets:[-8,-6,-4,-2],minutes:[20,40,40,60]},
  ])('ne confirme pas un épisode $label',({offsets,minutes})=>{
    const sessions=offsets.map((offset,index)=>run(`invalid-${index}`,offset,minutes[index]));
    expect(habitualReferenceFromOccurrencesV2({sessions,occurrences:[]},today).available).toBe(false);
  });

  it('ignore les activités hors épisode et les entrées non admissibles',()=>{
    const sessions=[run('old',-60,90),...[-8,-6,-4,-2].map((offset,index)=>run(`recent-${index}`,offset)),
      run('future',1,90),{...run('bike',-3,90),sport:'CYCLING'},
      {...run('bad-date',-3,90),date:'2026-10-99'},{...run('bad-duration',-3),durationSeconds:0}];
    expect(habitualReferenceFromOccurrencesV2({sessions,occurrences:[]},today))
      .toMatchObject({confidence:'confirmed',referenceSeconds:2400,sourceIds:['recent-0','recent-1','recent-2','recent-3']});
  });

  it('ne compte ni les suggestions non réalisées ni les activités ambiguës',async()=>{
    const suggestion=await occurrence([],'2026-10-14','provisional');
    expect(habitualReferenceFromOccurrencesV2({sessions:[],occurrences:[suggestion]},today).available).toBe(false);
    const sessions=[-8,-6,-4,-2].map((offset,index)=>run(`ambiguous-${index}`,offset));
    expect(habitualReferenceFromOccurrencesV2({sessions,occurrences:[suggestion]},today).available).toBe(false);
  });

  it('ne confirme pas une association incorrecte même hors de la date conseillée',async()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`wrong-${index}`,offset));
    const suggestion={...await occurrence([],'2026-10-14','provisional'),state:'associated' as const,activityId:sessions[0].id};
    expect(habitualReferenceFromOccurrencesV2({sessions,occurrences:[suggestion]},today).confidence).toBe('provisional');
  });

  it('n’invente aucun type à partir des activités et bloque les candidats structurés',async()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`speed-${index}`,offset)),stored=await occurrence(sessions.map(value=>value.id));
    const result=adaptCoachV2Readonly({sessions,occurrences:[stored],configuration:config('speed'),profile},today);
    expect(result.catalog.adaptedInput?.observedSessionTypes).toEqual([]);
    expect(result.catalog.sessions.map(value=>value.type)).toEqual(['easy-endurance']);
  });

  it('transmet seulement le type explicitement déclaré par une activité réelle',()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>({...run(`typed-${index}`,offset),
      ...(index===3?{trainingType:'intervals' as const}:{})}));
    const result=adaptCoachV2Readonly({coachTemperament:'rentre-dedans',sessions,occurrences:[],configuration:config('speed'),profile},today);
    expect(result.catalog.adaptedInput?.observedSessionTypes).toEqual(['intervals']);
    expect(result.activityEvidence.find(value=>value.date===sessions[3].date)).toMatchObject({documentedType:'intervals'});
    const untypedSessions:RunningSession[]=sessions.map(session=>{const copy:RunningSession={...session};delete copy.trainingType;return copy;});
    const untyped=adaptCoachV2Readonly({coachTemperament:'rentre-dedans',sessions:untypedSessions,
      occurrences:[],configuration:config('speed'),profile},today);
    expect(untyped.catalog.adaptedInput?.observedSessionTypes).toEqual([]);
  });

  it('n’utilise pas une qualification déclarée sur une activité future',()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`past-${index}`,offset));
    sessions.push({...run('future-type',1),trainingType:'intervals'});
    const result=adaptCoachV2Readonly({sessions,occurrences:[],configuration:config('speed'),profile},today);
    expect(result.catalog.adaptedInput?.observedSessionTypes).toEqual([]);
  });

  it('utilise les présentations V2 existantes sans en créer une nouvelle',async()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`run-${index}`,offset)),recent=await occurrence(sessions.map(value=>value.id),'2026-10-17');
    const before=structuredClone(recent),result=adaptCoachV2Readonly({sessions,occurrences:[recent],configuration:config(),profile},today);
    expect(result).toMatchObject({selectedDate:'2026-10-19',reason:'selected'});expect(recent).toEqual(before);
  });

  it('signale les disponibilités insuffisantes et les activités trop récentes',()=>{
    const sessions=[-8,-7,-6,-1].map((offset,index)=>run(`run-${index}`,offset));
    expect(adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile:{...profile,availability:{days:['monday']}}},today))
      .toMatchObject({candidate:null,reason:'no-available-date'});
    expect(adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile},today)).toMatchObject({selectedDate:'2026-10-19',reason:'selected'});
  });

  it('applique le plafond propre à chaque disponibilité irrégulière avant de calculer la séance',()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`custom-${index}`,offset,40));
    const custom:CoachProfileValues={...profile,availability:{sessionsPerWeek:2,days:['monday','wednesday'],durationMode:'custom',
      maxMinutesByDay:{monday:20,wednesday:35}}};
    const result=adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile:custom},today);
    expect(result).toMatchObject({selectedDate:'2026-10-19',dailyMaximumSeconds:1200,candidate:{totalDurationSeconds:1200}});
    expect(result.candidate!.totalDurationSeconds).toBeLessThanOrEqual(result.dailyMaximumSeconds!);
  });

  it('distingue un plafond trop court et l’absence de disponibilité déclarée',()=>{
    const sessions=[-8,-7,-6,-5].map((offset,index)=>run(`limit-${index}`,offset,40));
    const tooShort:CoachProfileValues={...profile,availability:{sessionsPerWeek:1,days:['monday'],minutesPerSession:20}};
    expect(adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile:tooShort},today))
      .toMatchObject({candidate:{totalDurationSeconds:1200},selectedDate:'2026-10-19',dailyMaximumSeconds:1200});
    expect(adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile:{...profile,availability:{}}},today))
      .toMatchObject({candidate:null,reason:'no-available-date',selectedDate:null});
  });

  it('retourne une absence d’ancre explicite sans activité ni présentation persistée',()=>{
    const result=adaptCoachV2Readonly({sessions:[],occurrences:[],configuration:config(),profile},today);
    expect(result).toMatchObject({candidate:null,reason:'missing-temporal-anchor',temporalAnchor:null});
    expect(result.temporalAnchorReason).toMatch(/Aucune activité ou présentation/);
  });

  it('amorce un débutant depuis la création persistée de sa configuration',()=>{
    const snapshot:CoachV2ApplicationSnapshot={sessions:[],occurrences:[],configuration:config('begin'),profile:{...profile,availability:{sessionsPerWeek:2,
      days:['monday','thursday'],minutesPerSession:30}},configurationCreatedOn:'2026-10-17'};
    const first=adaptCoachV2Readonly(snapshot,today),second=adaptCoachV2Readonly(snapshot,today);
    expect(first).toEqual(second);expect(first).toMatchObject({temporalAnchor:{kind:'bootstrap',referenceDate:'2026-10-17'},
      selectedDate:'2026-10-19',candidate:{type:'easy-endurance',totalDurationSeconds:900}});
    expect(first.reference.confidence).toBe('unavailable');
  });

  it('reste stable aux consultations répétées et aux limites civiles de changement d’heure',()=>{
    const sessions=[run('midnight',-5),run('dst-a',-4),run('dst-b',-3),run('dst-c',-2)];
    const sundayProfile:CoachProfileValues={...profile,availability:{sessionsPerWeek:1,days:['sunday'],minutesPerSession:45}};
    const first=adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile:sundayProfile},'2026-10-24');
    const second=adaptCoachV2Readonly({sessions,occurrences:[],configuration:config(),profile:sundayProfile},'2026-10-24');
    expect(first).toEqual(second);
    expect(first).toMatchObject({selectedDate:'2026-10-25',dailyMaximumSeconds:2700,
      temporalAnchor:{kind:'activity',id:'dst-c'}});
  });

  it('retient lundi après une activité vendredi malgré la présentation du dimanche, sans modifier les sources',async()=>{
    const sessions=[-8,-6,-4,-2].map((offset,index)=>run(`gap-${index}`,offset));
    const recent=await occurrence(sessions.map(value=>value.id),'2026-10-18');
    const input:CoachV2ApplicationSnapshot={sessions,occurrences:[recent],configuration:config(),profile:{...profile,
      availability:{days:['monday','wednesday'],minutesPerSession:45}}};
    const before=structuredClone(input),result=adaptCoachV2Readonly(input,today);
    expect(result).toMatchObject({selectedDate:'2026-10-19',dailyMaximumSeconds:2700,reason:'selected'});
    expect(adaptCoachV2Readonly({...input,occurrences:[]},today).selectedDate).toBe(result.selectedDate);
    expect(adaptCoachV2Readonly(input,today)).toEqual(result);
    expect(result.facts.sessionIds).toEqual(sessions.map(value=>value.id));expect(input).toEqual(before);
    expect(adaptCoachV2Readonly({...input,sessions:[...sessions,run('actual-sunday',0)]},today))
      .toMatchObject({selectedDate:'2026-10-21',reason:'selected'});
  });

  it('reste déterministe sur douze semaines sans persistance ni progression issue des suggestions',()=>{
    const sessions=[-24,-17,-10,-3].map((offset,index)=>run(`base-${index}`,offset,40)),durations:number[]=[];
    for(let week=0;week<12;week++) {
      const reference=new Date(origin+week*7*DAY).toISOString().slice(0,10),snapshot={sessions:[...sessions],occurrences:[],configuration:config(),profile};
      const result=adaptCoachV2Readonly(snapshot,reference);if(result.candidate){durations.push(result.candidate.totalDurationSeconds);expect(result.selectedDate).not.toBeNull();}
      sessions.push({id:`actual-${week}`,title:'Course personnelle',sport:'RUNNING',date:new Date(origin+(week*7+4)*DAY).toISOString().slice(0,10),durationSeconds:2400});
    }
    expect(durations.length).toBeGreaterThan(0);expect(new Set(durations)).toEqual(new Set([2400]));
  });

  it('lit un instantané IndexedDB atomique sans aucune écriture',async()=>{
    const name=`coach-v2-read-${crypto.randomUUID()}`;names.push(name);const db=await openDatabase(name),sessions=[-8,-7,-6,-5].map((offset,index)=>run(`db-${index}`,offset));
    for(const session of sessions)await db.put('sessions',session);
    await db.put('coachProfile',{...profile,id:'local',revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z'});
    await db.put('evolvingCoach',{id:'local',configuration:config(),revision:1,createdAt:'2026-10-01T08:00:00.000Z',updatedAt:'2026-10-01T08:00:00.000Z'});
    await db.add('coachSuggestionsV2',await occurrence(sessions.map(value=>value.id)));db.close();
    const add=vi.spyOn(IDBObjectStore.prototype,'add'),put=vi.spyOn(IDBObjectStore.prototype,'put'),remove=vi.spyOn(IDBObjectStore.prototype,'delete');
    const result=await calculateCoachV2Readonly(today,name);
    expect(result.reference.confidence).toBe('confirmed');expect(result.facts).toMatchObject({sessionIds:sessions.map(value=>value.id),occurrenceIds:['occurrence']});
    expect(add).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();
  });

  it('n’utilise plus une association dont les caractéristiques sportives ont changé',async()=>{
    const actual=[-8,-7,-6,-5].map((offset,index)=>run(`associated-${index}`,offset,40));
    const linked=await Promise.all(actual.map(async(session,index)=>{const base=await occurrence([],'2026-10-14','provisional',`linked-${index}`);
      const value={...base,presentationKey:`presentation:v2:${String(index+1).padStart(64,'0')}` as PersistableOccurrenceV2['presentationKey'],
        opportunity:{...base.opportunity,suggestedFor:civilDate(session.date)},state:'associated' as const,activityId:session.id,
        associationEvidence:{sportSignature:activitySportSignatureV2(session)}};
      return {...value,retainUntil:retentionLimitV2(value.opportunity,value.presentation)};}));
    const modified=actual.map((session,index)=>index===0?{...session,durationSeconds:3000}:session);
    const result=habitualReferenceFromOccurrencesV2({sessions:modified,occurrences:linked},today);
    expect(result.available).toBe(false);expect(result.sourceIds).not.toContain(actual[0].id);
    expect(habitualReferenceFromOccurrencesV2({sessions:modified,occurrences:[]},today).available).toBe(true);
  });

  it('exige un type documenté indépendamment du conseil, même avec une association valide',async()=>{
    const history=[-26,-21,-16,-11,-6].map((offset,index)=>run(`history-${index}`,offset,40));
    const performed=run('performed',-4,30),base=await occurrence(history.map(value=>value.id),'2026-09-30','confirmed','interval-occurrence','intervals');
    const linkedBase={...base,opportunity:{...base.opportunity,suggestedFor:civilDate(performed.date)},state:'associated' as const,
      activityId:performed.id,associationEvidence:{sportSignature:activitySportSignatureV2(performed)}};
    const linked:PersistableOccurrenceV2={...linkedBase,retainUntil:retentionLimitV2(linkedBase.opportunity,linkedBase.presentation)};
    const valid=adaptCoachV2Readonly({coachTemperament:'rentre-dedans',sessions:[...history,performed],occurrences:[linked],configuration:config('speed'),profile},today);
    expect(valid.catalog.adaptedInput?.observedSessionTypes).toEqual([]);
    expect(valid.candidate?.type).toBe('intervals'); // Introduction fondée sur les activités réelles, pas sur l'association.
    const documented=adaptCoachV2Readonly({coachTemperament:'rentre-dedans',sessions:[...history,performed],occurrences:[linked],configuration:config('speed'),profile,
      documentedActivityTypes:{[performed.id]:'intervals'}},today);
    expect(documented.catalog.adaptedInput?.observedSessionTypes).toEqual(['intervals']);
    expect(documented.candidate?.type).toBe('easy-endurance');
    const invalid={...performed,durationSeconds:performed.durationSeconds+300};
    const changed=adaptCoachV2Readonly({coachTemperament:'rentre-dedans',sessions:[...history,invalid],occurrences:[linked],configuration:config('speed'),profile},today);
    expect(changed.catalog.adaptedInput?.observedSessionTypes).toEqual([]);
    expect(changed.candidate?.type).toBe('intervals');
  });
});
