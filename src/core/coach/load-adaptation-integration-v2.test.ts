import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { deleteDB } from 'idb';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot,type CoachV2ReadonlyResult } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2 } from './presentation-identity-v2';
import * as selection from './load-adaptation-selection-v2';
import { civilDate,ianaTimeZone,instantIso,observePresentationV2,selectCandidateV2,activitySportSignatureV2,
  type PersistableOccurrenceV2,type ImmutableSessionContentV2 } from './persistence-foundations-v2';
import { orchestratePrototypeSession } from './simulation/session-orchestrator-v2';
import { openDatabase } from '../../storage/database-connection';
import { calculateCoachV2Readonly } from '../../storage/coach-v2-readonly';
import { CoachV2SelectionChanged,createSuggestionV2Repository,presentCoachV2Selection } from '../../storage/coach-suggestions-v2';
import { createFeelingRepository } from '../../storage/session-feeling';
import type { CoachTemperament } from '../../types/evolving-coach';

const today='2026-11-04',DAY=86400000;
const date=(age:number)=>new Date(Date.parse(`${today}T00:00:00Z`)-age*DAY).toISOString().slice(0,10);
const snapshot=(coachTemperament:CoachTemperament='rentre-dedans'):CoachV2ApplicationSnapshot=>({coachTemperament,
  sessions:[26,21,16,11,6,2].map((age,index)=>({id:`run-${index}`,date:date(age),title:'Synthétique',sport:'RUNNING',
    durationSeconds:2400,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
  configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},
  profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},
    preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]});
const calculate=(source=snapshot(),reference=today)=>adaptCoachV2Readonly(source,reference);
function beforeLoad(source:CoachV2ApplicationSnapshot){
  // Le nouveau branchement est neutralisé, les filtres sportifs et classements historiques restent actifs.
  const spy=vi.spyOn(selection,'applyLoadAdaptationV2').mockImplementation(candidates=>[...candidates]);
  try{return calculate(source);}finally{spy.mockRestore();}
}
const selected=(result:CoachV2ReadonlyResult)=>({date:result.selectedDate,type:result.candidate?.type,
  seconds:result.candidate?.totalDurationSeconds,intensity:result.candidate?.intensity,terrain:result.candidate?.terrain});
const moment=(on=today)=>({presentedAt:instantIso(`${on}T08:00:00.000Z`),presentedOn:civilDate(on),
  timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation' as const});
const provenance=(source=snapshot())=>({engine:'coach-v2' as const,contractVersion:1 as const,referenceConfidence:'confirmed' as const,
  referenceSourceIds:source.sessions.map(value=>value.id),limitationCodes:[]});
async function occurrence(source:CoachV2ApplicationSnapshot,content:ImmutableSessionContentV2,suggestedFor=today,id='old'){
  const weekday=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(`${suggestedFor}T00:00:00Z`).getUTCDay()];
  return (await observePresentationV2({selection:selectCandidateV2({phase:'candidate',content,
    opportunity:{contractVersion:1,goal:'speed',suggestedFor:civilDate(suggestedFor),anchor:{kind:'bootstrap',referenceDate:civilDate(date(40))},
      availability:{weekday:weekday as 'sunday',maximumSeconds:3600},generation:1}}),moment:moment(suggestedFor),
    provenance:provenance(source),existing:[],createId:()=>id})).occurrence;
}
const content=(result:CoachV2ReadonlyResult):ImmutableSessionContentV2=>{
  const candidate=result.candidate!;
  return {type:candidate.type,totalDurationSeconds:candidate.totalDurationSeconds,intensity:candidate.intensity,
    terrain:candidate.terrain,shortSummary:candidate.shortSummary,...(candidate.structure?{structure:candidate.structure}:{})};
};
const databases:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(databases.splice(0).map(name=>deleteDB(name)));});
async function isolatedDatabase(source:CoachV2ApplicationSnapshot){
  const name=`d2b2-${crypto.randomUUID()}`;databases.push(name);
  const db=await openDatabase(name),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
  for(const session of source.sessions)await tx.objectStore('sessions').put(session);
  for(const value of source.occurrences)await tx.objectStore('coachSuggestionsV2').put(value);
  const metadata={id:'local' as const,revision:1,createdAt:'2026-09-01T08:00:00.000Z',updatedAt:'2026-09-01T08:00:00.000Z'};
  await tx.objectStore('coachProfile').put({...source.profile!,...metadata});
  await tx.objectStore('evolvingCoach').put({...metadata,configuration:source.configuration??null,coachTemperament:source.coachTemperament});
  await tx.done;db.close();return name;
}

describe('charge activée dans le pipeline D2b-2',()=>{
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('accumulation concordante : facile pour %s',temperament=>{
    const source=snapshot(temperament);source.sessions=[...source.sessions,{...source.sessions.at(-1)!,id:'second'}];
    const result=calculate(source),before=beforeLoad(source);
    expect(result.loadPoliciesByDate?.[today].decisions.preference).toBe('recovery');
    expect(result.loadPoliciesByDate?.[today].evidence.concentration.activityCount).toBe(2);
    expect(result.candidate?.type).toBe('easy-endurance');
    expect(result.admissibleSessionsByDate[today].every(value=>value.type==='easy-endurance')).toBe(true);
    expect(result.catalog).toEqual(before.catalog);
    if(temperament!=='pas-a-pas')expect(before.candidate?.type).toBe('intervals');
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('hausse isolée et données complètes : choix inchangé pour %s',temperament=>{
    const source=snapshot(temperament);source.sessions=source.sessions.map((value,index)=>index===5?{...value,durationSeconds:3000}:value);
    const result=calculate(source),before=beforeLoad(source);
    expect(result.loadPoliciesByDate?.[today].decisions.preference).toBe('unchanged');
    expect(selected(result)).toEqual(selected(before));
    expect(result.candidate).toEqual(before.candidate);
  });
  it.each(['hard','easy'] as const)('fractionné partiel %s : durée réelle et espacement inchangé',async effort=>{
    const source=snapshot(),advised=content(calculate(source));
    source.sessions=source.sessions.map((value,index)=>index===5?{...value,trainingType:'intervals',durationSeconds:900,feeling:{effort}}:value);
    const performed=source.sessions.at(-1)!;
    const stored=await occurrence({...source,sessions:source.sessions.slice(0,-1)},advised,performed.date);
    source.occurrences=[{...stored,state:'associated',activityId:performed.id,
      associationEvidence:{sportSignature:activitySportSignatureV2(performed)},realization:{result:'partial',proposalOrigin:'manual',confirmedBy:'user'}}];
    const result=calculate(source),policy=result.loadPoliciesByDate![today];
    expect(result.activityEvidence.at(-1)).toMatchObject({durationSeconds:900,documentedType:'intervals',confirmedRealization:{result:'partial'}});
    expect(policy.evidence.volumes.last7DaysSeconds).toBe(3300);
    expect(policy.decisions.structured).toEqual({status:'defer',notBefore:date(-12)});
    expect(result.candidate?.type).toBe('easy-endurance');
    expect(coachV2Perspectives(result).every(value=>value.session.type!=='intervals')).toBe(true);
    expect(policy.reasons.some(value=>value.code==='difficult-effort')).toBe(effort==='hard');
  });
  it('activité sans bilan : réévaluation, aucune charge ou fatigue inventée',()=>{
    const source=snapshot();source.sessions=source.sessions.map(({feeling:_feeling,trainingType:_type,...value})=>value);
    const before=beforeLoad(source),result=calculate(source);
    expect(before.candidate?.type).toBe('intervals');expect(result.candidate?.type).toBe('easy-endurance');
    expect(result.loadPoliciesByDate![today].decisions.structured.status).toBe('review');
    expect(result.loadPoliciesByDate![today].protections).toEqual([]);
  });
  it('historique insuffisant : même absence de référence, aucun retour vers un autre moteur',()=>{
    const source=snapshot();source.sessions=source.sessions.slice(-1);
    expect(selected(calculate(source))).toEqual(selected(beforeLoad(source)));
    expect(calculate(source).candidate).toBeNull();
  });
  it('les dates des perspectives réévaluent la concentration sans supposer les intentions réalisées',()=>{
    const source=snapshot();source.sessions=[...source.sessions,{...source.sessions.at(-1)!,id:'second'}];
    const result=calculate(source),plan=coachV2Perspectives(result);
    expect(plan[0].session.type).toBe('easy-endurance');
    expect(plan[1].date).toBe(date(-2));
    expect(result.loadPoliciesByDate![plan[1].date].evidence.concentration.activityCount).toBe(0);
    expect(plan[1].session.type).toBe('intervals');
    expect(plan.slice(2).every(value=>value.session.type!=='intervals')).toBe(true);
  });
  it('une même activité dupliquée ne crée pas une accumulation de charge',()=>{
    const source=snapshot(),original=calculate(source);
    source.sessions=[...source.sessions,source.sessions.at(-1)!];
    const result=calculate(source);
    expect(result.activityEvidence.filter(value=>value.id==='run-5')).toHaveLength(1);
    expect(result.loadPoliciesByDate![today].evidence).toEqual(original.loadPoliciesByDate![today].evidence);
    expect(selected(result)).toEqual(selected(original));
  });
  it.each([1,2])('respecte le minimum civil à J+%i',age=>{
    const source=snapshot();source.sessions=source.sessions.map((value,index)=>index===5?{...value,date:date(age)}:value);
    const result=calculate(source);
    expect(result.selectedDate).toBe(age===1?date(-1):today);
  });
  it.each([6,7])('protection très difficile à J+%i, sans délai ajouté',age=>{
    const source=snapshot();source.sessions=source.sessions.map((value,index)=>index===4?{...value,date:date(age),feeling:{effort:'very-hard'}}:value);
    const result=calculate(source),policy=result.loadPoliciesByDate![today];
    expect(policy.protections.some(value=>value.code==='very-hard-protection')).toBe(age<7);
    expect(result.candidate?.type).toBe(age<7?'easy-endurance':'intervals');
  });
  it.each([13,14])('fractionné documenté à J+%i',age=>{
    const source=snapshot();source.sessions=source.sessions.map((value,index)=>index===3?{...value,date:date(age),trainingType:'intervals'}:value);
    const result=calculate(source);
    expect(result.candidate?.type).toBe(age<14?'easy-endurance':'intervals');
  });
  it.each([9,10])('sortie longue documentée à J+%i',age=>{
    const source=snapshot();source.configuration={...source.configuration!,goal:{model:'evolving',kind:'race',distanceMeters:10000,eventDate:'2026-12-01'}};
    source.sessions=source.sessions.map((value,index)=>index===3?{...value,date:date(age),trainingType:'long-run'}:value);
    const result=calculate(source),policy=result.loadPoliciesByDate![today];
    expect(policy.decisions.longRun.status==='defer').toBe(age<10);
    expect(result.admissibleSessionsByDate[today].some(value=>value.type==='long-run')).toBe(age>=10);
  });
});

describe('aucun contournement par une occurrence active',()=>{
  it.each(['hard','very-hard',undefined] as const)('écarte une ancienne exigeante après %s sans toucher à son historique',async effort=>{
    const source=snapshot(),old=await occurrence(source,content(calculate(source)));
    expect(old.content.type).toBe('intervals');source.occurrences=[old];
    source.sessions=source.sessions.map((value,index)=>index===5?{...value,feeling:effort?{effort}:undefined}:value);
    const untouched=structuredClone(source),result=calculate(source);
    expect(reusableActiveOccurrenceV2(source.occurrences,result,today)).toBeUndefined();
    expect(coachV2Perspectives(result,old)[0].session.type).toBe('easy-endurance');
    expect(result.admissibleSessionsByDate[today].some(value=>value.type==='intervals')).toBe(false);
    expect(source).toEqual(untouched);
  });
  it('conserve une recommandation facile compatible',async()=>{
    const source=snapshot('pas-a-pas'),old=await occurrence(source,content(calculate(source)));
    source.occurrences=[old];source.sessions=source.sessions.map((value,index)=>index===5?{...value,feeling:{effort:'hard'}}:value);
    const result=calculate(source);
    expect(reusableActiveOccurrenceV2(source.occurrences,result,today)).toBe(old);
    expect(coachV2Perspectives(result,old)[0].session).toBe(old.content);
  });
  it('ne permet pas à la préférence de contourner les blocages quand aucune option facile n’existe',()=>{
    const source=snapshot();source.sessions=source.sessions.map((value,index)=>index===5?{...value,feeling:{effort:'very-hard'}}:value);
    const result=calculate(source);
    const onlyDemanding=result.catalog.sessions.filter(value=>value.type!=='easy-endurance'&&value.type!=='recovery');
    expect(onlyDemanding.length).toBeGreaterThan(0);
    expect(orchestratePrototypeSession({referenceDate:today,goal:'speed',habitualReferenceSeconds:2400,availabilitySeconds:3600,
      candidates:onlyDemanding,activities:result.activityEvidence,presented:[],loadPolicy:result.loadPoliciesByDate![today]}).selected).toBeNull();
  });
  it('refuse une politique calculée pour une autre date',()=>{
    const result=calculate();
    expect(()=>orchestratePrototypeSession({referenceDate:date(-1),goal:'speed',habitualReferenceSeconds:2400,availabilitySeconds:3600,
      candidates:result.catalog.sessions,activities:result.activityEvidence,presented:[],loadPolicy:result.loadPoliciesByDate![today]})).toThrow(/périmée/);
  });
  it('refuse un calcul périmé à la mémorisation puis crée une nouvelle occurrence sans altérer l’ancienne',async()=>{
    const source=snapshot(),stale=calculate(source),old=await occurrence(source,content(stale));source.occurrences=[old];
    const name=await isolatedDatabase(source),repository=createSuggestionV2Repository(name);
    const saved=await repository.listAll();
    await createFeelingRepository(name).save('run-5',{effort:'hard'},{effort:'moderate'});
    await expect(presentCoachV2Selection({result:stale,referenceDate:today,moment:moment(),provenance:provenance(source)},name))
      .rejects.toBeInstanceOf(CoachV2SelectionChanged);
    expect(await repository.listAll()).toEqual(saved);
    const fresh=await calculateCoachV2Readonly(today,name);
    expect(fresh.candidate?.type).toBe('easy-endurance');
    const created=await presentCoachV2Selection({result:fresh,referenceDate:today,moment:moment(),provenance:provenance(source),createId:()=> 'new-easy'},name);
    expect(created.occurrence.content.type).toBe('easy-endurance');
    expect(await repository.getById(old.id)).toEqual(old);
    expect(await repository.listAll()).toHaveLength(2);
    expect((await presentCoachV2Selection({result:fresh,referenceDate:today,moment:moment(),provenance:provenance(source)},name)).status).toBe('reused-active');
  });
  it('une ancienne association sans confirmation ne change ni le type réel ni les mesures',async()=>{
    const source=snapshot(),actual=source.sessions.at(-1)!;
    const old=await occurrence(source,content(calculate(source)),actual.date);
    const linked:PersistableOccurrenceV2={...old,state:'associated',activityId:actual.id,associationEvidence:{sportSignature:activitySportSignatureV2(actual)}};
    source.occurrences=[linked];const result=calculate(source);
    expect(result.activityEvidence.at(-1)).toMatchObject({documentedType:'easy-endurance',durationSeconds:2400});
    expect(result.activityEvidence.at(-1)).not.toHaveProperty('confirmedRealization');
    expect(result.loadPoliciesByDate![today].evidence.structuredActivityIds).toEqual([]);
    expect(source.occurrences[0]).toEqual(linked);
  });
  it('not-completed seul ne crée ni activité, ni repos supplémentaire, ni dette',async()=>{
    const source=snapshot(),before=calculate(source),old=await occurrence(source,content(before));
    source.occurrences=[{...old,realization:{result:'not-completed',proposalOrigin:'manual',confirmedBy:'user'}}];
    const result=calculate(source);
    expect(result.activityEvidence).toEqual(before.activityEvidence);
    expect(result.loadPoliciesByDate![today].evidence).toEqual(before.loadPoliciesByDate![today].evidence);
    expect(result.loadPoliciesByDate![today].protections).toEqual([]);
    expect(selected(result)).toEqual(selected(before));
  });
});
