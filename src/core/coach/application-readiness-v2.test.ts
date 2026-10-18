import {describe,expect,it} from 'vitest';
import type {CoachProfileValues} from '../../types/coach-profile';
import type {EvolvingCoachValues} from '../../types/evolving-coach';
import type {RunningSession} from '../../types/session';
import {adaptCoachV2Readonly,type CoachV2ApplicationSnapshot} from './application-adapter-v2';

const DAY=86_400_000,origin=Date.parse('2026-01-04T12:00:00Z');
const date=(days:number)=>new Date(origin+days*DAY).toISOString().slice(0,10);
const run=(id:string,days:number,minutes:number):RunningSession=>({id,title:'Course synthétique',sport:'RUNNING',date:date(days),durationSeconds:minutes*60});
const configuration=(kind:EvolvingCoachValues['goal']['kind'],experience:EvolvingCoachValues['experience']='experienced'):EvolvingCoachValues=>({
  goal:{model:'evolving',kind} as EvolvingCoachValues['goal'],experience,structuredPlanningPreference:'accepted',
});
const profile=(minutes=60,days:CoachProfileValues['availability']['days']=['monday','wednesday','friday']):CoachProfileValues=>({
  goal:{kind:'endurance'},availability:{sessionsPerWeek:days.length,days,minutesPerSession:minutes},preferences:{terrain:'trail'},accompanimentMode:'advisor',
});
type Scenario={name:string;goal:EvolvingCoachValues['goal']['kind'];sessions:RunningSession[];profile:CoachProfileValues;
  experience?:EvolvingCoachValues['experience'];perform:(week:number,suggestionSeconds:number|null)=>number|null};

function simulate(source:Scenario) {
  const sessions=[...source.sessions],suggestions:(number|null)[]=[],references:(number|null)[]=[],counts:number[]=[];
  for(let week=0;week<12;week++) {
    const referenceDate=date(week*7),snapshot:CoachV2ApplicationSnapshot={sessions:[...sessions],occurrences:[],
      configuration:configuration(source.goal,source.experience),profile:source.profile,
      ...(source.goal==='begin'?{configurationCreatedOn:date(-1)}:{})};
    const result=adaptCoachV2Readonly(snapshot,referenceDate),suggested=result.candidate?.totalDurationSeconds??null;
    suggestions.push(suggested);references.push(result.reference.referenceSeconds);counts.push(sessions.length);
    const performed=source.perform(week,suggested);
    if(performed!==null)sessions.push(run(`${source.name}-${week}`,week*7+1,performed));
  }
  return {suggestions,references,counts,sessions};
}

const stableHistory=(prefix:string,minutes=40)=>[-28,-21,-14,-7].map((day,index)=>run(`${prefix}-${index}`,day,minutes));

describe('préparation globale du pipeline applicatif Coach V2 sur douze semaines',()=>{
  it('couvre six trajectoires sans transformer une lecture ou une suggestion ignorée en activité',()=>{
    const scenarios:Scenario[]=[
      {name:'beginner',goal:'begin',sessions:[],profile:profile(30,['monday','thursday']),experience:'beginner',perform:()=>null},
      {name:'return',goal:'return',sessions:stableHistory('old',35).map(value=>({...value,date:date(Number(value.id.at(-1))!-120)})),profile:profile(35),perform:(week,value)=>week>=4&&week%2===0&&value?value/60:null},
      {name:'regular',goal:'endurance',sessions:stableHistory('regular'),profile:profile(60),perform:(_,value)=>value?value/60:null},
      {name:'irregular',goal:'wellbeing',sessions:stableHistory('irregular',35),profile:profile(45,['monday','saturday']),perform:(week,value)=>week%3===0&&value?value/60:null},
      {name:'progress',goal:'distance',sessions:stableHistory('progress',35),profile:profile(60),perform:week=>35+week},
      {name:'reduction',goal:'endurance',sessions:stableHistory('reduction',50),profile:profile(60),perform:week=>Math.max(35,50-week)},
    ];
    const results=Object.fromEntries(scenarios.map(item=>[item.name,simulate(item)]));
    expect(Object.values(results).every(value=>value.suggestions.length===12&&value.references.length===12)).toBe(true);
    expect(results.beginner.suggestions.every(value=>value!==null)).toBe(true);
    expect(results.beginner.counts.every(value=>value===0)).toBe(true);
    expect(results.irregular.counts.at(-1)!-results.irregular.counts[0]).toBe(4);
    expect(results.regular.suggestions.filter(Boolean).length).toBeGreaterThan(0);
    expect(results.progress.references.at(-1)!).toBeGreaterThan(results.progress.references.find(value=>value!==null)!);
    expect(results.reduction.references.at(-1)!).toBeLessThan(results.reduction.references.find(value=>value!==null)!);
    expect(new Set(results.regular.suggestions.filter((value):value is number=>value!==null))).toEqual(new Set([40*60]));
  });

  it('différencie prudemment endurance et vitesse avec une référence provisoire',()=>{
    const sessions=stableHistory('typed',40),documentedActivityTypes=Object.fromEntries(sessions.map(value=>[value.id,'steady-run' as const]));
    const base={sessions,occurrences:[],profile:profile(60),documentedActivityTypes};
    const endurance=adaptCoachV2Readonly({...base,configuration:configuration('endurance')},date(0));
    const speed=adaptCoachV2Readonly({...base,configuration:configuration('speed')},date(0));
    expect(endurance.reference.confidence).toBe('provisional');expect(speed.reference.confidence).toBe('provisional');
    expect(endurance.candidate).toMatchObject({type:'easy-endurance',totalDurationSeconds:2400,intensity:'easy'});
    expect(speed.candidate).toMatchObject({type:'easy-endurance',totalDurationSeconds:1800,intensity:'easy'});
    const withoutRoles=adaptCoachV2Readonly({sessions,occurrences:[],profile:profile(60),configuration:configuration('speed')},date(0));
    expect(withoutRoles.catalog.sessions.every(value=>value.type==='easy-endurance')).toBe(true);
  });

  it('respecte les plafonds et ne cumule pas plusieurs difficultés injustifiées',()=>{
    const sessions=stableHistory('limits',45),result=adaptCoachV2Readonly({sessions,occurrences:[],configuration:configuration('speed'),profile:profile(35),
      documentedActivityTypes:Object.fromEntries(sessions.map(value=>[value.id,'steady-run' as const]))},date(0));
    expect(result.candidate?.totalDurationSeconds).toBeLessThanOrEqual(35*60);
    for(const candidate of result.catalog.sessions)if(candidate.intensity==='controlled-hard')
      expect(candidate.totalDurationSeconds).toBeLessThanOrEqual(result.reference.referenceSeconds!);
    expect(result.catalog.sessions.every(value=>!('elevationGain' in value))).toBe(true);
  });
});
