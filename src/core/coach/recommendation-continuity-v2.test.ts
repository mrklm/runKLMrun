import { describe,expect,it } from 'vitest';
import type { RunningSession } from '../../types/session';
import { buildRecommendationContinuityV2 as memory } from './recommendation-continuity-v2';
import { activitySportSignatureV2,civilDate,ianaTimeZone,instantIso,observePresentationV2,selectCandidateV2,
  occurrenceId,invalidateAssociationV2,type PersistableOccurrenceV2 } from './persistence-foundations-v2';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { coachV2Perspectives } from './perspectives-v2';

const run=(patch:Partial<RunningSession>={}):RunningSession=>({id:'run',date:'2026-10-20',title:'Synthétique',durationSeconds:1200,
  distanceMeters:2300,trainingType:'easy-endurance',feeling:{effort:'hard'},...patch});
async function proposal(id='proposal') {
  return (await observePresentationV2({existing:[],createId:()=>id,
    selection:selectCandidateV2({phase:'candidate',content:{type:'intervals',totalDurationSeconds:1800,intensity:'controlled-hard',terrain:'flat',shortSummary:'Synthétique',
      structure:{warmUp:{durationSeconds:600,intensity:'easy',instruction:'Préparer'},
        efforts:[{repetitions:3,durationSeconds:120,intensity:'controlled-hard',instruction:'Fraction'}],
        recoveries:[{repetitions:2,durationSeconds:120,intensity:'very-easy',instruction:'Repos'}],
        coolDown:{durationSeconds:600,intensity:'easy',instruction:'Terminer'}}},
      opportunity:{contractVersion:1,goal:'speed',suggestedFor:civilDate('2026-10-20'),
        anchor:{kind:'bootstrap',referenceDate:civilDate('2026-10-18')},availability:{weekday:'tuesday'},generation:1}}),
    moment:{presentedAt:instantIso('2026-10-18T08:30:00.000Z'),presentedOn:civilDate('2026-10-18'),
      timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',referenceSourceIds:[],limitationCodes:[]}})).occurrence;
}
async function associated(result?:'completed'|'partial',activity=run(),id='proposal'):Promise<PersistableOccurrenceV2> {
  return {...await proposal(id),state:'associated',activityId:activity.id,
    ...(result?{associationEvidence:{sportSignature:activitySportSignatureV2(activity)},
      realization:{result,proposalOrigin:'manual',confirmedBy:'user'}}:{})};
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;
}

describe('mémoire calculée D3b',()=>{
  it('ne crée pas une présentation depuis une activité seule',async()=>{
    const result=await memory({sessions:[run()],occurrences:[]});
    expect(result.recommendations).toEqual([]);expect(result.activities).toHaveLength(1);expect(result.issues).toEqual([]);
  });
  it('sépare proposition et activité indépendante du même jour',async()=>{
    const result=await memory({sessions:[run()],occurrences:[await proposal()]});
    expect(result.recommendations[0]).toMatchObject({state:'unconfirmed-proposal',lifecycle:'active',suggestedFor:'2026-10-20'});
    expect(result.recommendations[0].activityId).toBeUndefined();
  });
  it('une proposition automatique n’est pas une confirmation',async()=>{
    const result=await memory({sessions:[],occurrences:[{...await proposal(),realizationProposal:{result:'completed',origin:'automatic'}}]});
    expect(result.recommendations[0].state).toBe('unconfirmed-proposal');expect(result.recommendations[0].confirmation).toBeUndefined();
  });
  it.each([false,true])('association historique, signature présente : %s',async signed=>{
    const value={...await associated(),...(signed?{associationEvidence:{sportSignature:activitySportSignatureV2(run())}}:{})};
    const result=await memory({sessions:[run()],occurrences:[value]});
    expect(result.recommendations[0]).toMatchObject({state:'unconfirmed-association',activityId:'run',associationVerification:signed?'sport-signature':'date-and-id'});
    expect(result.recommendations[0].confirmation).toBeUndefined();
  });
  it.each(['completed','partial'] as const)('conserve %s et les mesures réelles sans déduire les blocs ou la tolérance',async status=>{
    const result=await memory({sessions:[run()],occurrences:[await associated(status)]});
    expect(result.recommendations[0]).toMatchObject({state:status,confirmation:{result:status,confirmedBy:'user'},prescription:{status:'known',content:{type:'intervals',totalDurationSeconds:1800}}});
    expect(result.activities).toEqual([{id:'run',date:'2026-10-20',durationSeconds:1200,distanceMeters:2300,documentedType:'easy-endurance',effort:'hard'}]);
  });
  it('la non-réalisation ne crée aucun effort et ne s’associe pas à une autre activité',async()=>{
    const occurrence={...await proposal(),realization:{result:'not-completed',proposalOrigin:'manual',confirmedBy:'user'}};
    const empty=await memory({sessions:[],occurrences:[occurrence]});
    expect(empty.activities).toEqual([]);expect(empty.recommendations[0].state).toBe('not-completed');
    const actual=await memory({sessions:[run()],occurrences:[occurrence]});
    expect(actual.activities).toHaveLength(1);expect(actual.recommendations[0].activityId).toBeUndefined();
  });
  it('recalcule completed → partial → association sans confirmation → proposition',async()=>{
    const full=await associated('completed');
    expect((await memory({sessions:[run()],occurrences:[full]})).recommendations[0].state).toBe('completed');
    const partial={...full,realization:{...full.realization!,result:'partial' as const}};
    expect((await memory({sessions:[run()],occurrences:[partial]})).recommendations[0].state).toBe('partial');
    const {realization:_confirmation,...historical}=partial;
    expect((await memory({sessions:[run()],occurrences:[historical]})).recommendations[0].state).toBe('unconfirmed-association');
    const result=await memory({sessions:[run()],occurrences:[await proposal()]});
    expect(result.recommendations[0].state).toBe('unconfirmed-proposal');expect(result.recommendations[0].confirmation).toBeUndefined();
  });
  it('supprimer l’activité retire la confirmation exploitable',async()=>{
    const result=await memory({sessions:[],occurrences:[await associated('completed')]});
    expect(result.recommendations[0].state).toBe('invalid-link');expect(result.recommendations[0].confirmation).toBeUndefined();
    expect(result.issues).toContainEqual({source:'occurrence',id:'proposal',code:'missing-activity'});
  });
  it.each([
    {date:'2026-10-21'}, {durationSeconds:1300}, {date:'2026-02-30'}, {startTime:'not-a-date'},
    {startTime:'2026-10-19T23:59:00Z'},
  ])('rejette le lien modifié ou daté incorrectement %j',async patch=>{
    const result=await memory({sessions:[run(patch)],occurrences:[await associated('completed')]});
    expect(result.recommendations[0].state).toBe('invalid-link');expect(result.recommendations[0].activityId).toBeUndefined();
  });
  it('les corrections d’annotations actuelles remplacent le ressenti et le type sans inventer le contenu réel',async()=>{
    const result=await memory({sessions:[run({feeling:{effort:'easy'},trainingType:'recovery'})],occurrences:[await associated('partial')]});
    expect(result.recommendations[0].state).toBe('partial');expect(result.activities[0]).toMatchObject({effort:'easy',documentedType:'recovery'});
  });
  it('conserve une présentation obsolète et remplacée sans la rendre actuelle',async()=>{
    const old={...await proposal('old'),state:'obsolete',supersededById:occurrenceId('new')};
    const next={...await proposal('new'),supersedesId:occurrenceId('old')};
    const result=await memory({sessions:[],occurrences:[old,next]});
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations.find(x=>x.id==='old')).toMatchObject({lifecycle:'obsolete',state:'unconfirmed-proposal',supersededById:'new'});
    expect(result.recommendations[0].prescription).toEqual(result.recommendations[1].prescription);
  });
  it('une invalidation persistée ne ressuscite pas la confirmation même si l’activité réapparaît',async()=>{
    const old=invalidateAssociationV2(await associated('partial'),'run',instantIso('2026-10-21T08:00:00.000Z'),'activity-missing');
    const result=await memory({sessions:[run()],occurrences:[old]});
    expect(result.recommendations[0]).toMatchObject({state:'invalid-link',lifecycle:'obsolete'});
    expect(result.recommendations[0].confirmation).toBeUndefined();expect(result.activities).toHaveLength(1);
  });
  it.each([{},null,{id:'old',content:{type:'intervals'}},{id:'old',schemaVersion:1}])('données historiques insuffisantes %j',async value=>{
    const result=await memory({sessions:[],occurrences:[value]});
    expect(result.issues.length).toBeGreaterThan(0);
    for(const entry of result.recommendations){expect(entry.state).toBe('insufficient-data');expect(entry.presentation).toBeUndefined();}
  });
  it('rejette les empreintes et confirmations falsifiées ou sans signature',async()=>{
    const base=await associated('completed');
    for(const bad of [{...base,content:{...base.content,shortSummary:'Autre'}},
      {...base,realization:{...base.realization,confirmedBy:'automatic'}},{...base,associationEvidence:undefined},
      {...base,presentation:{...base.presentation,presentedOn:'2026-02-30'}}]){
      const result=await memory({sessions:[run()],occurrences:[bad]});
      expect(result.recommendations[0].state).toBe('insufficient-data');expect(result.recommendations[0].confirmation).toBeUndefined();
    }
  });
  it('les mesures invalides et annotations absentes restent inconnues',async()=>{
    const activity=run({durationSeconds:NaN,distanceMeters:-1,feeling:undefined,trainingType:undefined});
    const result=await memory({sessions:[activity],occurrences:[await associated('partial',activity)]});
    expect(result.activities).toEqual([{id:'run',date:'2026-10-20'}]);expect(result.recommendations[0].state).toBe('partial');
  });
  it('déduplique les activités et occurrences identiques indépendamment de l’ordre des propriétés',async()=>{
    const occurrence=await associated('completed'),activity=run();
    const reverse=(v:object)=>Object.fromEntries(Object.entries(v).reverse());
    const result=await memory({sessions:[activity,reverse(activity) as RunningSession],occurrences:[occurrence,reverse(occurrence)]});
    expect(result.activities).toHaveLength(1);expect(result.recommendations).toHaveLength(1);expect(result.issues).toEqual([]);
  });
  it('exclut les activités contradictoires sans élire la première',async()=>{
    const occurrences=[await associated('partial')],sessions=[run(),run({durationSeconds:1500})];
    const result=await memory({sessions,occurrences});
    expect(result.activities).toEqual([]);expect(result.recommendations[0].state).toBe('invalid-link');
    expect(await memory({sessions:[...sessions].reverse(),occurrences})).toEqual(result);
  });
  it('ne confond pas NaN avec null lors de la déduplication',async()=>{
    const result=await memory({sessions:[run({durationSeconds:NaN}),run({durationSeconds:null as unknown as number})],occurrences:[]});
    expect(result.activities).toEqual([]);expect(result.issues[0].code).toBe('conflicting-id');
  });
  it('une occurrence contradictoire ne conserve pas une ancienne confirmation',async()=>{
    const first=await associated('completed'),second={...first,realization:{...first.realization!,result:'partial'}};
    const result=await memory({sessions:[run()],occurrences:[first,second]});
    expect(result.recommendations[0]).toEqual({id:'proposal',state:'insufficient-data'});expect(result.activities).toHaveLength(1);
    expect(await memory({sessions:[run()],occurrences:[second,first]})).toEqual(result);
  });
  it('plusieurs revendications, y compris malformées, invalident le lien sans perdre l’effort',async()=>{
    for(const other of [await associated('partial',run(),'other'),{id:'old',activityId:'run'},{activityId:'run'}]) {
      const result=await memory({sessions:[run()],occurrences:[await associated('completed'),other]});
      expect(result.recommendations.find(x=>x.id==='proposal')?.state).toBe('invalid-link');expect(result.activities).toHaveLength(1);
    }
  });
  it('ordre déterministe, sources gelées, plusieurs activités le même jour',async()=>{
    const sessions=freeze([run(),run({id:'second',startTime:'2026-10-20T23:59:00+02:00'})]);
    const occurrences=freeze([await associated('partial'),await proposal('another')]);
    const before=structuredClone({sessions,occurrences}),result=await memory({sessions,occurrences});
    expect(await memory({sessions:[...sessions].reverse(),occurrences:[...occurrences].reverse()})).toEqual(result);
    expect({sessions,occurrences}).toEqual(before);expect(result.activities).toHaveLength(2);
    Object.assign(result.recommendations[0].presentation!,{presentedOn:civilDate('2026-01-01')});
    expect({sessions,occurrences}).toEqual(before);
  });
});

it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('D3b ne change ni décisions ni réutilisation ni perspectives : %s',async coachTemperament=>{
  const today='2026-11-04';
  const source:CoachV2ApplicationSnapshot={coachTemperament,occurrences:[],
    sessions:['2026-10-09','2026-10-14','2026-10-19','2026-10-24','2026-10-29','2026-11-02'].map((date,index)=>
      run({id:String(index),date,durationSeconds:2400,feeling:{effort:'moderate'}})),
    configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},
    profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'}};
  const first=adaptCoachV2Readonly(source,today);
  const occurrence=(await observePresentationV2({selection:selectedApplicationSuggestionV2(first,1),existing:[],createId:()=> 'synthetic',
    moment:{presentedOn:civilDate(today),presentedAt:instantIso(today+'T08:00:00.000Z'),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:first.reference.sourceIds,limitationCodes:[]}})).occurrence;
  source.occurrences=[occurrence];const before=adaptCoachV2Readonly(source,today),copy=structuredClone(source);
  const retained=reusableActiveOccurrenceV2(source.occurrences,before,today),plan=coachV2Perspectives(before,retained);
  expect(retained).toBe(occurrence);await memory(freeze(source));
  const after=adaptCoachV2Readonly(source,today);
  expect(after).toEqual(before);expect(source).toEqual(copy);
  expect(reusableActiveOccurrenceV2(source.occurrences,after,today)).toEqual(retained);
  expect(coachV2Perspectives(after,retained)).toEqual(plan);
});
