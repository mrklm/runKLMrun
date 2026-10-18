import { habitualReferenceV2, type ReferenceObservation } from './habitual-reference-v2';
import { selectPrototypeSessions, validatePrototypeSession, type PrototypeGoal, type PrototypeSession,
  type SessionStrategyInput } from './session-strategies-v2';

export type StrategyProfileId='beginner'|'occasional'|'regular'|'experienced';
export type StrategyBehaviour='stable'|'real-progression'|'ignored'|'interruption-resume'|'variable-availability';
export const strategyGoals:PrototypeGoal[]=['begin','return','wellbeing','endurance','speed','distance','race'];
export const strategyBehaviours:StrategyBehaviour[]=['stable','real-progression','ignored','interruption-resume','variable-availability'];

interface StrategyProfile {
  id:StrategyProfileId;
  experience:SessionStrategyInput['experience'];
  baselineSeconds:number;
  preferredTerrain:SessionStrategyInput['preferredTerrain'];
  observedSessionTypes:SessionStrategyInput['observedSessionTypes'];
  seed:ReferenceObservation[];
}
export interface StrategySimulationWeek {
  week:number;
  referenceDate:string;
  availabilitySeconds:number;
  referenceSeconds:number|null;
  evidence:SessionStrategyInput['evidence'];
  candidates:PrototypeSession[];
  realizedDurationSeconds:number|null;
}
export interface StrategySimulation {
  goal:PrototypeGoal;
  profile:StrategyProfileId;
  behaviour:StrategyBehaviour;
  weeks:StrategySimulationWeek[];
  actualObservations:ReferenceObservation[];
}

const START=Date.parse('2026-01-05T00:00:00Z');
const dateAt=(offset:number)=>new Date(START+offset*86400000).toISOString().slice(0,10);
const seed=(minutes:number,count:number,spacing:number)=>Array.from({length:count},(_,index)=>({
  id:`seed-${minutes}-${index}`,date:dateAt(-(count-index)*spacing),durationSeconds:minutes*60,role:'independent-unknown' as const,
}));
export const strategyProfiles=():StrategyProfile[]=>[
  {id:'beginner',experience:'beginner',baselineSeconds:1200,preferredTerrain:'flat',observedSessionTypes:[],seed:[]},
  {id:'occasional',experience:'regular',baselineSeconds:1800,preferredTerrain:'rolling',observedSessionTypes:[],seed:seed(30,3,10)},
  {id:'regular',experience:'regular',baselineSeconds:2100,preferredTerrain:'rolling',observedSessionTypes:['long-run'],seed:seed(35,4,7)},
  {id:'experienced',experience:'experienced',baselineSeconds:2700,preferredTerrain:'hills',
    observedSessionTypes:['long-run','steady-run','intervals','hills'],seed:seed(45,4,7)},
];
const availability=(behaviour:StrategyBehaviour,week:number)=>behaviour==='variable-availability'?[1200,1800,2700,3600][week%4]:3600;
const performed=(profile:StrategyProfile,behaviour:StrategyBehaviour,week:number,maximum:number):number|null=>{
  if(behaviour==='ignored') return null;
  if(behaviour==='interruption-resume'&&week>=3&&week<9) return null;
  const progression=behaviour==='real-progression'?Math.floor(week/4)*300:0;
  return Math.min(profile.baselineSeconds+progression,maximum);
};
const measurable=(goal:PrototypeGoal)=>goal==='distance'||goal==='race';

export function simulateSessionStrategies(goal:PrototypeGoal,profile:StrategyProfile,behaviour:StrategyBehaviour):StrategySimulation {
  const observations=[...profile.seed],actualObservations:ReferenceObservation[]=[],weeks:StrategySimulationWeek[]=[];
  for(let week=0;week<12;week++) {
    const referenceDate=dateAt(week*7),maximum=availability(behaviour,week);
    const reference=habitualReferenceV2(observations,referenceDate);
    const input:SessionStrategyInput={goal,habitualReferenceSeconds:reference.referenceSeconds,
      evidence:reference.referenceSeconds===null?'insufficient':'documented',experience:profile.experience,
      availabilitySeconds:maximum,preferredTerrain:profile.preferredTerrain,observedSessionTypes:profile.observedSessionTypes,
      ...(measurable(goal)?{targetDistanceMeters:10000,documentedDistanceMeters:goal==='distance'?7000:8000}:{}),
      ...(goal==='race'?{eventDate:'2026-05-01'}:{}),
    };
    const candidates=selectPrototypeSessions(input);candidates.forEach(validatePrototypeSession);
    const realizedDurationSeconds=performed(profile,behaviour,week,maximum);
    weeks.push({week:week+1,referenceDate,availabilitySeconds:maximum,referenceSeconds:reference.referenceSeconds,
      evidence:input.evidence,candidates,realizedDurationSeconds});
    if(realizedDurationSeconds!==null) {
      const observation:ReferenceObservation={id:`${profile.id}-${behaviour}-${week}`,date:dateAt(week*7+2),
        durationSeconds:realizedDurationSeconds,role:'independent-unknown'};
      observations.push(observation);actualObservations.push(observation);
    }
  }
  return {goal,profile:profile.id,behaviour,weeks,actualObservations};
}

export const simulateAllSessionStrategies=()=>strategyGoals.flatMap(goal=>strategyProfiles().flatMap(profile=>
  strategyBehaviours.map(behaviour=>simulateSessionStrategies(goal,profile,behaviour))));
