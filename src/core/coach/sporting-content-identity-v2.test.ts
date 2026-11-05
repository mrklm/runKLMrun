import { describe,expect,it } from 'vitest';
import { compareSportingContentsV2 as compare,sportingContentIdentityV2 as identity } from './sporting-content-identity-v2';
import { contentFingerprintV2,type ImmutableSessionContentV2 } from './persistence-foundations-v2';
import { selectPrototypeSessions,type PrototypeGoal } from './simulation/session-strategies-v2';
import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { civilDate,ianaTimeZone,instantIso,observePresentationV2 } from './persistence-foundations-v2';
const free=():ImmutableSessionContentV2=>({type:'easy-endurance',totalDurationSeconds:1800,intensity:'easy',terrain:'flat',shortSummary:'Facile'});
const intervals=():ImmutableSessionContentV2=>({type:'intervals',totalDurationSeconds:1800,intensity:'controlled-hard',terrain:'flat',shortSummary:'Fractionné',
  structure:{warmUp:{durationSeconds:600,intensity:'easy',instruction:'Échauffement'},
    efforts:[{repetitions:3,durationSeconds:120,intensity:'controlled-hard',instruction:'Effort'}],
    recoveries:[{repetitions:2,durationSeconds:120,intensity:'very-easy',instruction:'Repos'}],
    coolDown:{durationSeconds:600,intensity:'easy',instruction:'Retour au calme'}}});
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;
}

describe('identité sportive calculée D3a',()=>{
  it('ignore les identifiants et conserve les entrées gelées',()=>{
    const a=freeze({...intervals(),id:'one'}),b=freeze({...intervals(),id:'two'}),before=structuredClone([a,b]);
    expect(compare(a,b)).toEqual({relation:'identical',differences:[]});expect([a,b]).toEqual(before);
  });
  it('ignore tous les textes explicatifs sans changer les empreintes persistées',async()=>{
    const a=intervals(),b={...a,shortSummary:'Autre texte',optionalInstructions:['Description libre'],
      structure:{...a.structure!,efforts:a.structure!.efforts.map(block=>({...block,instruction:'Autre consigne'}))}};
    const before=await contentFingerprintV2(a);
    expect(compare(a,b).relation).toBe('identical');
    expect(await contentFingerprintV2(b)).not.toBe(before);
    expect(await contentFingerprintV2(a)).toBe(before);
  });
  it('compare les données sportives même sans textes historiques',()=>{
    const a=intervals(),{shortSummary:_text,...b}=a;
    const stripped={...b,structure:{...b.structure!,efforts:b.structure!.efforts.map(({instruction:_instruction,...block})=>block)}};
    expect(compare(a,stripped).relation).toBe('identical');
  });
  it('distingue les blocs même avec le même type et la même durée',()=>{
    const a=intervals(),b={...a,structure:{...a.structure!,efforts:[{repetitions:2,durationSeconds:180,intensity:'controlled-hard',instruction:'Effort'}]}};
    expect(compare(a,b)).toEqual({relation:'same-family',differences:['structure']});
  });
  it('ne fusionne pas un bloc répété et une liste de blocs',()=>{
    const a=intervals(),b={...a,structure:{...a.structure!,efforts:Array.from({length:3},()=>({durationSeconds:120,intensity:'controlled-hard',instruction:'Effort'}))}};
    expect(compare(a,b).relation).toBe('same-family');
  });
  it('préserve l’ordre des blocs et leur rôle',()=>{
    const a=intervals(),efforts=[{durationSeconds:120,intensity:'steady',instruction:'A'},{durationSeconds:240,intensity:'controlled-hard',instruction:'B'}];
    expect(compare({...a,structure:{...a.structure!,efforts}},{...a,structure:{...a.structure!,efforts:[...efforts].reverse()}}).relation).toBe('same-family');
    expect(compare(a,{...a,structure:{...a.structure!,warmUp:{...a.structure!.warmUp!,durationSeconds:300},coolDown:{...a.structure!.coolDown!,durationSeconds:900}}}).relation).toBe('same-family');
  });
  it.each([
    {intensity:'steady'},{terrain:'rolling'},{totalDurationSeconds:2100},
  ])('distingue les dimensions globales %j',patch=>{
    expect(compare(free(),{...free(),...patch}).relation).toBe('same-family');
  });
  it('distingue les intensités des fractions et les récupérations',()=>{
    const a=intervals();
    for(const field of ['efforts','recoveries'] as const){
      const b={...a,structure:{...a.structure!,[field]:a.structure![field]!.map(block=>({...block,intensity:'easy'}))}};
      expect(compare(a,b).relation).toBe('same-family');
    }
  });
  it('distingue les types sans inventer une famille plus large',()=>{
    expect(compare(free(),{...free(),type:'recovery'})).toEqual({relation:'different',differences:['type']});
    expect(compare(intervals(),{...intervals(),type:'endurance-variations'}).relation).toBe('different');
  });
  it('normalise répétitions omises à une et récupérations absentes à une liste vide',()=>{
    const a={...intervals(),totalDurationSeconds:1560,structure:{...intervals().structure!,recoveries:undefined}};
    const b={...a,structure:{...a.structure,warmUp:{...a.structure.warmUp!,repetitions:1},recoveries:[]}};
    expect(compare(a,b).relation).toBe('identical');
  });
  it('ne confond pas une structure libre reconnue avec une structure inconnue',()=>{
    expect(identity(free()).status).toBe('known');
    for(const structure of [null,{},[],{efforts:[]},'unknown'])expect(compare(free(),{...free(),structure}).relation).toBe('incomparable');
    expect(compare(intervals(),{...intervals(),structure:undefined}).relation).toBe('incomparable');
  });
  it.each(['type','totalDurationSeconds','intensity','terrain'])('exige le champ sportif %s',field=>{
    const value:Record<string,unknown>={...free()};delete value[field];
    expect(compare(free(),value).relation).toBe('incomparable');
  });
  it.each([0,-1,NaN,Infinity,1.5,undefined])('refuse une durée invalide : %s',totalDurationSeconds=>{
    expect(identity({...free(),totalDurationSeconds}).status).toBe('incomparable');
  });
  it.each([0,-1,1.5,1001,null])('refuse des répétitions invalides : %s',repetitions=>{
    const a=intervals();expect(identity({...a,structure:{...a.structure!,efforts:[{...a.structure!.efforts[0],repetitions}]}}).status).toBe('incomparable');
  });
  it('refuse les sommes incohérentes, les listes trouées et les blocs inconnus',()=>{
    const a=intervals();
    for(const structure of [{...a.structure!,efforts:[]},{...a.structure!,efforts:[null]},
      {...a.structure!,efforts:new Array(1)},{...a.structure!,recoveries:[{distanceMeters:200}]}])
      expect(identity({...a,structure}).status).toBe('incomparable');
    expect(identity({...a,totalDurationSeconds:1801}).status).toBe('incomparable');
    expect(identity({...free(),durationSeconds:900}).status).toBe('incomparable');
  });
  it('refuse les nouvelles dimensions inconnues au lieu de les effacer',()=>{
    const a=intervals();
    for(const value of [{...a,targetPace:300},{...a,structure:{...a.structure!,repeat:2}},
      {...a,structure:{...a.structure!,efforts:[{...a.structure!.efforts[0],distanceMeters:400}]}}])
      expect(identity(value)).toEqual({status:'incomparable',reason:'unrecognized-fields'});
  });
  it.each([null,undefined,[],{},'3 × 2 minutes',{type:'unknown'}, {content:free(),id:'occurrence'}])('ne déduit aucun contenu à partir de %j',value=>{
    expect(compare(value,free()).relation).toBe('incomparable');
  });
  it('reste symétrique et déterministe, même pour deux contenus invalides',()=>{
    const values=[free(),intervals(),{...free(),totalDurationSeconds:2400},null,{...free(),futureSportingField:1}];
    for(const a of values)for(const b of values){
      expect(compare(a,b)).toEqual(compare(b,a));expect(compare(a,b)).toEqual(compare(a,b));
    }
    const a=intervals(),reordered={terrain:a.terrain,intensity:a.intensity,totalDurationSeconds:a.totalDurationSeconds,type:a.type,structure:a.structure};
    expect(identity(a)).toEqual(identity(reordered));
  });
  it('reconnaît les contenus représentatifs de tous les types du catalogue',()=>{
    const seen=new Set<string>();
    for(const goal of ['begin','return','wellbeing','endurance','speed','distance','race'] as PrototypeGoal[]){
      const candidates=selectPrototypeSessions({goal,habitualReferenceSeconds:3600,evidence:'documented',experience:'experienced',
        availabilitySeconds:5400,observedSessionTypes:['intervals','long-run','steady-run','hills'],
        intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:20,eligible:true},targetDistanceMeters:10000,
        documentedDistanceMeters:8000,eventDate:'2026-12-01',observedTerrain:'rolling'});
      for(const candidate of candidates){
        seen.add(candidate.type);expect(identity(candidate).status).toBe('known');
        expect(compare(candidate,structuredClone(candidate)).relation).toBe('identical');
      }
    }
    expect([...seen].sort()).toEqual(['easy-endurance','endurance-variations','hills','intervals','long-run','recovery','steady-run']);
  });
});

it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('aucun effet sur le Coach, la réutilisation ou les perspectives : %s',async coachTemperament=>{
  const today='2026-11-04';
  const source:CoachV2ApplicationSnapshot={coachTemperament,occurrences:[],
    sessions:['2026-10-09','2026-10-14','2026-10-19','2026-10-24','2026-10-29','2026-11-02'].map((date,index)=>
      ({id:String(index),date,title:'Synthétique',durationSeconds:2400,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
    configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},
    profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'}};
  const first=adaptCoachV2Readonly(source,today);
  const occurrence=(await observePresentationV2({selection:selectedApplicationSuggestionV2(first,1),existing:[],createId:()=> 'synthetic',
    moment:{presentedOn:civilDate(today),presentedAt:instantIso(today+'T08:00:00.000Z'),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:first.reference.sourceIds,limitationCodes:[]}})).occurrence;
  source.occurrences=[occurrence];const before=adaptCoachV2Readonly(source,today),copy=structuredClone(source);
  const retained=reusableActiveOccurrenceV2(source.occurrences,before,today);
  expect(retained).toBe(occurrence);
  const plan=coachV2Perspectives(before,retained);
  for(const candidate of before.catalog.sessions)compare(freeze(candidate),freeze(occurrence.content));
  const after=adaptCoachV2Readonly(source,today);
  expect(after).toEqual(before);expect(source).toEqual(copy);
  expect(reusableActiveOccurrenceV2(source.occurrences,after,today)).toEqual(retained);
  expect(coachV2Perspectives(after,retained)).toEqual(plan);
});
