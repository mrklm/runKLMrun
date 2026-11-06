import { afterAll,describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { adaptCoachV2WithContinuity,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from './presentation-identity-v2';
import { civilDate,instantIso,ianaTimeZone,observePresentationV2 } from './persistence-foundations-v2';
import { orchestratePrototypeSession,type RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import type { PrototypeSession } from './simulation/session-strategies-v2';
import type { CoachTemperament } from '../../types/evolving-coach';

const today='2026-11-04';
const date=(age:number)=>new Date(Date.parse(today)-age*86400000).toISOString().slice(0,10);
const snapshot=():CoachV2ApplicationSnapshot=>({sessions:[26,21,16,11,6,2].map((age,index)=>({id:`run-${index}`,date:date(age),title:'Synthétique',sport:'RUNNING',
  durationSeconds:2400,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
  configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},
  profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},
    preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]});
type Scenario={name:string;mutate:(value:CoachV2ApplicationSnapshot)=>void;evening?:boolean;history?:boolean};
const scenarios:Scenario[]=[{name:'baseline',mutate:()=>{}},
  ...[0,1,2].map(age=>({name:`activity-${age}`,mutate:(s:CoachV2ApplicationSnapshot)=>{s.sessions=[...s.sessions.slice(0,-1),{...s.sessions.at(-1)!,date:date(age)}];}})),
  ...(['hard','very-hard'] as const).flatMap(effort=>[6,7].map(age=>({name:`${effort}-${age}`,mutate:(s:CoachV2ApplicationSnapshot)=>{
    s.sessions=[...s.sessions,{...s.sessions[0],id:'feeling',date:date(age),feeling:{effort}}];}}))),
  ...(['intervals','steady-run','hills','endurance-variations'] as const).flatMap(trainingType=>[13,14].map(age=>({name:`${trainingType}-${age}`,mutate:(s:CoachV2ApplicationSnapshot)=>{
    s.sessions=[...s.sessions,{...s.sessions[0],id:'structured',date:date(age),trainingType}];}}))),
  ...[9,10].map(age=>({name:`long-${age}`,mutate:(s:CoachV2ApplicationSnapshot)=>{
    s.configuration={...s.configuration!,goal:{model:'evolving',kind:'race',distanceMeters:10000,eventDate:'2026-12-01'}};
    s.sessions=[...s.sessions,{...s.sessions[0],id:'long',date:date(age),trainingType:'long-run'}];}})),
  {name:'alternating-structured',mutate:s=>{s.sessions=[...s.sessions,{...s.sessions[0],id:'hills',date:date(5),trainingType:'hills'},
    {...s.sessions[0],id:'intervals',date:date(13),trainingType:'intervals'}];}},
  {name:'missing-effort',mutate:s=>{s.sessions=s.sessions.map(value=>({...value,feeling:undefined}));}},
  {name:'missing-type',mutate:s=>{s.sessions=s.sessions.map(value=>({...value,trainingType:undefined}));}},
  {name:'missing-duration',mutate:s=>{s.sessions=[...s.sessions,{...s.sessions[0],id:'duration',date:date(2),durationSeconds:NaN}];}},
  {name:'future-activity',mutate:s=>{s.sessions=[...s.sessions,{...s.sessions[0],id:'future',date:date(-2),trainingType:'intervals',feeling:{effort:'very-hard'}}];}},
  {name:'excluded-sport',mutate:s=>{s.sessions=[...s.sessions,{...s.sessions[0],id:'other',date:today,sport:'CYCLING',feeling:{effort:'very-hard'}}];}},
  {name:'duplicate',mutate:s=>{s.sessions=[...s.sessions,s.sessions.at(-1)!];}},
  {name:'concentrated-volume',mutate:s=>{s.sessions=[...s.sessions,{...s.sessions.at(-1)!,id:'second',durationSeconds:3600}];}},
  {name:'insufficient-reference',mutate:s=>{s.sessions=s.sessions.slice(-1);}},
  {name:'beginning',mutate:s=>{s.sessions=[];s.configuration={goal:{model:'evolving',kind:'begin'},experience:'beginner'};s.configurationCreatedOn=date(1);}},
  {name:'return',mutate:s=>{s.configuration={goal:{model:'evolving',kind:'return'},experience:'experienced'};}},
  {name:'evening',mutate:()=>{},evening:true},
  {name:'continuity',mutate:s=>{s.configuration={goal:{model:'evolving',kind:'endurance'},experience:'beginner'};
    s.sessions=s.sessions.map(value=>({...value,ascentMeters:80}));},history:true},
];
const captured:Record<string,unknown>={};
// Ces empreintes sont figées AVANT D4b. La capture optionnelle garde les objets
// complets en /tmp pour expliquer une divergence, sans alourdir les fixtures.
function compare(name:string,value:unknown){
  captured[name]=value;
  expect(createHash('sha256').update(JSON.stringify(value)).digest('hex')).toMatchSnapshot(name);
}
afterAll(()=>{
  if(process.env.D4B_CAPTURE==='before'||process.env.D4B_CAPTURE==='after')
    writeFileSync(`/tmp/d4b-${process.env.D4B_CAPTURE}-decisions.json`,JSON.stringify(captured,null,2));
});

describe('décisions sportives figées avant D4b',()=>{
  for(const temperament of ['pas-a-pas','evolution-active','rentre-dedans'] as const)for(const scenario of scenarios){
    it(`${temperament} / ${scenario.name}`,async()=>{
      const source=snapshot();source.coachTemperament=temperament;scenario.mutate(source);
      const reference=scenario.evening?{date:today,minuteOfDay:1081}:today;
      const before=await adaptCoachV2WithContinuity(source,reference);
      if(before.candidate&&scenario.name!=='duplicate'){
        const on=scenario.history?date(14):today;
        const stored=await observePresentationV2({existing:[],createId:()=> 'historical',
          selection:selectedApplicationSuggestionV2(scenario.history?{...before,selectedDate:on}:before,1),
          moment:{presentedAt:instantIso(`${on}T08:00:00.000Z`),presentedOn:civilDate(on),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation'},
          provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:before.reference.confidence==='confirmed'?'confirmed':'provisional',referenceSourceIds:[...new Set(before.reference.sourceIds)],limitationCodes:[]}});
        source.occurrences=[stored.occurrence];
      }
      const after=await adaptCoachV2WithContinuity(source,reference),active=reusableActiveOccurrenceV2(source.occurrences,after,today);
      compare(`${temperament}/${scenario.name}`,{before,after,active:active??null,perspectives:coachV2Perspectives(after,active)});
    });
  }
  const easy:PrototypeSession={type:'easy-endurance',durationSeconds:1800,totalDurationSeconds:1800,intensity:'easy',terrain:'flat',shortSummary:'Synthétique',optional:true,
    changedDimensions:[],rationale:{observedFacts:[],runnerDeclarations:[],designChoices:[],uncertainties:[]}};
  const interval:PrototypeSession={...easy,type:'intervals',intensity:'controlled-hard'};
  for(const effort of ['hard','very-hard',undefined] as const)for(const gentle of [false,true])for(const temperament of ['pas-a-pas','evolution-active','rentre-dedans'] as const){
    it(`orchestrateur historique ${effort}/${gentle}/${temperament}`,()=>{
      const activities:RecordedActivityEvidence[]=[{date:date(2),effort}];
      compare(`legacy/${effort}/${gentle}/${temperament}`,orchestratePrototypeSession({referenceDate:today,goal:'speed',habitualReferenceSeconds:1800,
        availabilitySeconds:3600,candidates:gentle?[easy,interval]:[interval],activities,presented:[],coachTemperament:temperament as CoachTemperament}));
    });
  }
});
