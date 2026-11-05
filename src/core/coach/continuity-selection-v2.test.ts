import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { openDatabase } from '../../storage/database-connection';
import { calculateCoachV2Readonly } from '../../storage/coach-v2-readonly';
import { createSuggestionV2Repository,presentCoachV2Selection } from '../../storage/coach-suggestions-v2';
import { describe,it,expect } from 'vitest';
import { selectContinuityV2 } from './continuity-selection-v2';
import { buildRecommendationContinuityV2 } from './recommendation-continuity-v2';
import { sportingContentIdentityV2 } from './sporting-content-identity-v2';
import { orchestratePrototypeSession } from './simulation/session-orchestrator-v2';
import { adaptCoachV2WithContinuity,adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { reusableActiveOccurrenceV2 } from './presentation-identity-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { civilDate,ianaTimeZone,instantIso,observePresentationV2,selectCandidateV2,activitySportSignatureV2,
  type PersistableOccurrenceV2,type ImmutableSessionContentV2 } from './persistence-foundations-v2';
import type { PrototypeSession } from './simulation/session-strategies-v2';
import type { RunningSession } from '../../types/session';

const today='2026-11-04';
const date=(age:number)=>new Date(Date.parse(today)-age*86400000).toISOString().slice(0,10);
const a:PrototypeSession={type:'intervals',durationSeconds:1800,totalDurationSeconds:1800,intensity:'controlled-hard',terrain:'flat',shortSummary:'Synthétique',
  structure:{warmUp:{durationSeconds:600,intensity:'easy',instruction:'Préparer'},
    efforts:[{repetitions:3,durationSeconds:120,intensity:'controlled-hard',instruction:'Effort'}],
    recoveries:[{repetitions:2,durationSeconds:120,intensity:'very-easy',instruction:'Repos'}],
    coolDown:{durationSeconds:600,intensity:'easy',instruction:'Fin'}},
  changedDimensions:[],optional:true,rationale:{observedFacts:[],runnerDeclarations:[],designChoices:[],uncertainties:[]}};
const b:PrototypeSession={...a,structure:{...a.structure!,efforts:[{repetitions:6,durationSeconds:60,intensity:'controlled-hard',instruction:'Autre'}]}};
const easy:PrototypeSession={...a,type:'easy-endurance',intensity:'easy',structure:undefined};
const content=(value:PrototypeSession):ImmutableSessionContentV2=>({type:value.type,totalDurationSeconds:value.totalDurationSeconds,
  intensity:value.intensity,terrain:value.terrain,shortSummary:value.shortSummary,...(value.structure?{structure:value.structure}:{})});
async function occurrence(value=a,age=14,id='old'):Promise<PersistableOccurrenceV2>{
  const on=date(age),weekday=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(on).getUTCDay()] as 'sunday';
  return (await observePresentationV2({existing:[],createId:()=>id,
    selection:selectCandidateV2({phase:'candidate',content:content(value),opportunity:{contractVersion:1,goal:'speed',suggestedFor:civilDate(on),
      anchor:{kind:'bootstrap',referenceDate:civilDate(date(40))},availability:{weekday,maximumSeconds:3600},generation:1}}),
    moment:{presentedAt:instantIso(`${on}T08:00:00.000Z`),presentedOn:civilDate(on),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:[],limitationCodes:[]}})).occurrence;
}
const run=(effort?:'easy'|'hard'|'very-hard',age=14):RunningSession=>({id:'actual',date:date(age),title:'Synthétique',durationSeconds:900,
  trainingType:'intervals',...(effort?{feeling:{effort}}:{})});
async function memory(result?:'partial'|'completed'|'not-completed',effort?:'easy'|'hard'|'very-hard',age=14){
  const actual=run(effort,age),old=await occurrence(a,age);
  const linked:PersistableOccurrenceV2=result==='not-completed'?{...old,realization:{result,proposalOrigin:'manual',confirmedBy:'user'}}
    :{...old,state:'associated',activityId:actual.id,associationEvidence:{sportSignature:activitySportSignatureV2(actual)},
      ...(result?{realization:{result,proposalOrigin:'manual',confirmedBy:'user'}}:{})};
  return buildRecommendationContinuityV2({sessions:result==='not-completed'?[]:[actual],occurrences:[linked]});
}
const input={referenceDate:today,goal:'speed' as const,habitualReferenceSeconds:1800,availabilitySeconds:3600,
  candidates:[a,b],activities:[],presented:[]};
const snapshot=():CoachV2ApplicationSnapshot=>({coachTemperament:'rentre-dedans',sessions:[26,21,16,11,6,2].map((age,index)=>({id:`run-${index}`,
  date:date(age),title:'Synthétique',sport:'RUNNING',durationSeconds:2400,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
  configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
    days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]});

describe('D3c, continuité calculée après D2',()=>{
  it.each(['hard','easy',undefined] as const)('partiel %s : variante comparable, aucune dette',async effort=>{
    const history=await memory('partial',effort);
    const choice=selectContinuityV2({selected:a,candidates:[a,b],memory:history,date:today});
    expect(choice.selected).toBe(b);expect(choice.decision.status).toBe('avoidable-repeat');
    expect(choice.decision.sources[0]).toMatchObject({state:'partial',activityId:'actual',actualType:'intervals',effort});
    expect(history.activities[0].durationSeconds).toBe(900);
  });
  it('complète très difficile : D2 conserve le facile, sans difficulté déduite du statut',async()=>{
    const history=await memory('completed','very-hard',2);
    const result=orchestratePrototypeSession({...input,candidates:[a,b,easy],activities:history.activities,continuity:history,coachTemperament:'rentre-dedans'});
    expect(result.selected?.type).toBe('easy-endurance');
    expect(orchestratePrototypeSession({...input,activities:history.activities,continuity:history}).selected).toBeNull();
  });
  it.each(['not-completed',undefined] as const)('%s : proposition seulement, aucune confirmation inventée',async status=>{
    const history=await memory(status);
    const choice=selectContinuityV2({selected:a,candidates:[a,b],memory:history,date:today});
    expect(choice.selected).toBe(b);expect(choice.decision.sources[0].state).toBe(status??'unconfirmed-association');
    if(status==='not-completed'){expect(history.activities).toEqual([]);expect(choice.decision.sources[0].activityId).toBeUndefined();}
    else expect(history.recommendations[0].confirmation).toBeUndefined();
  });
  it('identifiants et textes différents : même sport ; blocs différents : autre variante',async()=>{
    const history=await memory('partial');
    const same={...a,shortSummary:'Autre texte',id:'different'};
    expect(sportingContentIdentityV2(same)).toEqual(sportingContentIdentityV2(a));
    expect(selectContinuityV2({selected:a,candidates:[same],memory:history,date:today}).decision.status).toBe('repeat-without-alternative');
    expect(sportingContentIdentityV2(b)).not.toEqual(sportingContentIdentityV2(a));
  });
  it('sans alternative ou avec intensité différente : répétition autorisée',async()=>{
    const history=await memory('partial');
    for(const candidates of [[a],[a,{...b,terrain:'rolling' as const}],[a,easy]]){
      expect(selectContinuityV2({selected:a,candidates,memory:history,date:today}).selected).toBe(a);
    }
  });
  it('variantes toutes récentes : classement initial conservé',async()=>{
    const history=await buildRecommendationContinuityV2({sessions:[],occurrences:[await occurrence(),await occurrence(b,12,'other')]});
    expect(selectContinuityV2({selected:a,candidates:[a,b],memory:history,date:today}).decision.status).toBe('relevant-repeat');
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('avant/après, %s : seul le départage change',async coachTemperament=>{
    const history=await memory('partial');
    expect(orchestratePrototypeSession({...input,coachTemperament}).selected).toEqual(a);
    const after=orchestratePrototypeSession({...input,coachTemperament,continuity:history});
    expect(after.selected?.structure).toEqual(b.structure);expect(after.continuityDecision?.status).toBe('avoidable-repeat');
  });
  it.each([1,2,6,7,9,10,13,14])('frontière D2 J+%i inchangée',async age=>{
    const history=await memory('partial','hard',age);
    const before=orchestratePrototypeSession({...input,candidates:[a,b,easy],activities:history.activities});
    const after=orchestratePrototypeSession({...input,candidates:[a,b,easy],activities:history.activities,continuity:history});
    expect(after.selected?.type).toBe(before.selected?.type);expect(after.reason).toBe(before.reason);
    if(age<14)expect(after.selected?.type).not.toBe('intervals');
  });
  it.each([-1,0,27,28])('fenêtre observation J+%i, aucun délai obligatoire',async age=>{
    const history=await memory('not-completed',undefined,age);
    expect(selectContinuityV2({selected:a,candidates:[a,b],memory:history,date:today}).decision.status)
      .toBe(age>=0&&age<28?'avoidable-repeat':'insufficient-data');
  });
  it('ordre des données et candidats sans effet sur le départage',async()=>{
    const history=await buildRecommendationContinuityV2({sessions:[],occurrences:[await occurrence(a,14,'z'),await occurrence(a,15,'a')]});
    const first=selectContinuityV2({selected:a,candidates:[a,b],memory:history,date:today});
    expect(selectContinuityV2({selected:a,candidates:[b,a],memory:{...history,recommendations:[...history.recommendations].reverse()},date:today})).toEqual(first);
  });
  it('historique absent ou contenu incomplet : aucun départage inventé',()=>{
    const history={recommendations:[],activities:[],issues:[]};
    expect(selectContinuityV2({selected:a,candidates:[a,b],memory:history,date:today}).decision.status).toBe('insufficient-data');
    expect(selectContinuityV2({selected:{...a,structure:undefined},candidates:[b],memory:history,date:today}).decision.status).toBe('insufficient-data');
  });
  it('corrections et suppressions : aucune source ni pénalité résiduelle',async()=>{
    const old=await occurrence();let actual=run('hard');
    const associated:PersistableOccurrenceV2={...old,state:'associated',activityId:actual.id,
      associationEvidence:{sportSignature:activitySportSignatureV2(actual)},realization:{result:'completed',proposalOrigin:'manual',confirmedBy:'user'}};
    const decide=async(occurrences:PersistableOccurrenceV2[],sessions:RunningSession[])=>selectContinuityV2({selected:a,candidates:[a,b],date:today,
      memory:await buildRecommendationContinuityV2({sessions,occurrences})}).decision;
    expect((await decide([associated],[actual])).sources[0].state).toBe('completed');
    expect((await decide([{...associated,realization:{...associated.realization!,result:'partial'}}],[actual])).sources[0].state).toBe('partial');
    expect((await decide([{...associated,realization:undefined}],[actual])).sources[0].state).toBe('unconfirmed-association');
    actual={...actual,feeling:{effort:'easy'},trainingType:'easy-endurance'};
    expect((await decide([associated],[actual])).sources[0]).toMatchObject({effort:'easy',actualType:'easy-endurance'});
    expect((await decide([associated],[])).status).toBe('insufficient-data');
    expect((await decide([], [actual])).sources).toEqual([]);
  });
  it('actives réévaluées : pertinente réutilisée, ancienne variante écartée, remplacement stable',async()=>{
    const source=snapshot(),base=await adaptCoachV2WithContinuity(source,today);
    const old=await occurrence(a,0,'active'),past=await occurrence(a,14,'past');
    const history=await buildRecommendationContinuityV2({sessions:[],occurrences:[old,past]});
    const result={...base,continuity:history,admissibleSessionsByDate:{[today]:[a,b]}};
    expect(reusableActiveOccurrenceV2([old],result,today)).toBeUndefined();
    const replacement=await occurrence(b,0,'replacement');
    result.continuity=await buildRecommendationContinuityV2({sessions:[],occurrences:[old,past,replacement]});
    expect(reusableActiveOccurrenceV2([old,replacement],result,today)).toBe(replacement);
    result.continuity=await buildRecommendationContinuityV2({sessions:[],occurrences:[old]});
    expect(reusableActiveOccurrenceV2([old],result,today)).toBe(old);
  });
  it('pipeline courant et perspectives : mémoire transmise sans réalisations fictives',async()=>{
    const source=snapshot(),before=adaptCoachV2Readonly(source,today);
    source.occurrences=[await occurrence(before.candidate!,14)];
    const saved=structuredClone(source),after=await adaptCoachV2WithContinuity(source,today);
    expect(after.continuity?.recommendations).toHaveLength(1);
    expect(after.continuityDecisionsByDate?.[today].status).toBe('repeat-without-alternative');
    expect(after.candidate?.type).toBe(before.candidate?.type);
    const plan=coachV2Perspectives(after);
    expect(plan.length).toBeGreaterThan(1);expect(plan.slice(1).every(value=>value.continuityDecision)).toBe(true);
    expect(source).toEqual(saved);expect(after.continuity?.activities).toHaveLength(source.sessions.length);
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('catalogue réel : alternative facile existante pour %s',async coachTemperament=>{
    const source=snapshot();source.coachTemperament=coachTemperament;
    source.configuration={...source.configuration!,goal:{model:'evolving',kind:'endurance'},experience:'beginner'};
    source.sessions=source.sessions.map(value=>({...value,ascentMeters:80}));
    const before=adaptCoachV2Readonly(source,today);
    expect(before.candidate?.type).toBe('easy-endurance');
    source.occurrences=[await occurrence(before.candidate!,14)];
    const after=await adaptCoachV2WithContinuity(source,today);
    const decision=after.continuityDecisionsByDate![today];
    expect(decision.status).toBe(coachTemperament==='evolution-active'?'repeat-without-alternative':'avoidable-repeat');
    if(coachTemperament==='evolution-active')expect(sportingContentIdentityV2(after.candidate)).toEqual(sportingContentIdentityV2(before.candidate));
    else expect(sportingContentIdentityV2(after.candidate)).not.toEqual(sportingContentIdentityV2(before.candidate));
    expect(after.candidate!.totalDurationSeconds).toBeLessThanOrEqual(before.candidate!.totalDurationSeconds);
    expect(after.admissibleSessionsByDate[today]).toEqual(before.admissibleSessionsByDate[today]);
  });

  it('stockage isolé : relecture D3c, ancienne active conservée, nouvelle occurrence réutilisée',async()=>{
    const name=`d3c-${crypto.randomUUID()}`,source=snapshot();
    source.coachTemperament='pas-a-pas';source.configuration={goal:{model:'evolving',kind:'endurance'},experience:'beginner'};
    source.sessions=source.sessions.map(value=>({...value,ascentMeters:80}));
    const before=adaptCoachV2Readonly(source,today);
    const past=await occurrence(before.candidate!,14,'past');
    // Construire les occurrences avec l'objectif courant sans modifier une empreinte persistée.
    const make=async(on:string,id:string)=>{
      const selected={...before,selectedDate:on};
      const {selectedApplicationSuggestionV2}=await import('./presentation-identity-v2');
      return (await observePresentationV2({existing:[],createId:()=>id,selection:selectedApplicationSuggestionV2(selected,1),
        moment:{...past.presentation,presentedOn:civilDate(on),presentedAt:instantIso(`${on}T08:00:00.000Z`)},provenance:past.provenance})).occurrence;
    };
    const old=await make(today,'active'),history=await make(date(14),'history');
    const db=await openDatabase(name);
    try{
      const tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
      for(const session of source.sessions)await tx.objectStore('sessions').put(session);
      for(const value of [old,history])await tx.objectStore('coachSuggestionsV2').put(value);
      const metadata={id:'local' as const,revision:1,createdAt:'2026-09-01T08:00:00.000Z',updatedAt:'2026-09-01T08:00:00.000Z'};
      await tx.objectStore('coachProfile').put({...source.profile!,...metadata});
      await tx.objectStore('evolvingCoach').put({...metadata,configuration:source.configuration,coachTemperament:source.coachTemperament});
      await tx.done;db.close();
      const fresh=await calculateCoachV2Readonly(today,name);
      expect(fresh.continuityDecisionsByDate![today].status).toBe('avoidable-repeat');
      expect(reusableActiveOccurrenceV2([old,history],fresh,today)).toBeUndefined();
      const request={result:fresh,referenceDate:today,moment:old.presentation,provenance:old.provenance,createId:()=> 'replacement'};
      const created=await presentCoachV2Selection(request,name);
      expect(created.status).toBe('created');
      const repository=createSuggestionV2Repository(name);
      expect(await repository.getById(old.id)).toEqual(old);
      for(let attempt=0;attempt<3;attempt++){
        const result=await calculateCoachV2Readonly(today,name);
        expect((await presentCoachV2Selection({...request,result},name)).status).toBe('reused-active');
      }
      expect(await repository.listAll()).toHaveLength(3);
    }finally{db.close();await deleteDB(name);}
  });

  it('perspective : variante choisie après les intentions, sans nouvelle activité',async()=>{
    const result=await adaptCoachV2WithContinuity(snapshot(),today);
    result.candidate=easy;result.selectedDate=today;
    result.continuity=await memory('not-completed');
    result.admissibleSessionsByDate={[today]:[easy],[date(-2)]:[a,b]};
    const untouched=structuredClone(result.continuity);
    const plan=coachV2Perspectives(result);
    expect(plan).toHaveLength(2);
    expect(plan[1].session.structure).toEqual(b.structure);
    expect(plan[1].continuityDecision?.status).toBe('avoidable-repeat');
    expect(result.continuity).toEqual(untouched);
  });

});
