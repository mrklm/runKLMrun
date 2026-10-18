import { describe,expect,it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { sessionStructureDurationSeconds } from './session-strategies-v2';
import { simulateAllSessionStrategies,simulateSessionStrategies,strategyProfiles,type StrategySimulation } from './session-strategies-longitudinal';

const results=simulateAllSessionStrategies();
const profile=(id:'beginner'|'occasional'|'regular'|'experienced')=>strategyProfiles().find(value=>value.id===id)!;
const find=(goal:StrategySimulation['goal'],profileId:StrategySimulation['profile'],behaviour:StrategySimulation['behaviour'])=>
  results.find(value=>value.goal===goal&&value.profile===profileId&&value.behaviour===behaviour)!;
const demanding=(type:string)=>type==='intervals'||type==='steady-run';

function report() {
  let text='| Objectif | Types, profil expérimenté stable | Candidats structurés / 12 semaines |\n|---|---|---:|\n';
  for(const goal of ['begin','return','wellbeing','endurance','speed','distance','race'] as const) {
    const simulation=find(goal,'experienced','stable'),types=[...new Set(simulation.weeks.flatMap(week=>week.candidates.map(value=>value.type)))];
    const structured=simulation.weeks.flatMap(week=>week.candidates).filter(value=>value.structure).length;
    text+=`| ${goal} | ${types.join(', ')} | ${structured} |\n`;
  }
  return text;
}

describe('simulation longitudinale des stratégies de séances V2',()=>{
  it('croise sept objectifs, quatre profils, cinq comportements et douze semaines',()=>{
    expect(results).toHaveLength(140);expect(results.every(value=>value.weeks.length===12)).toBe(true);
  });

  it('ne transforme jamais un candidat en activité réalisée',()=>{
    for(const simulation of results.filter(value=>value.behaviour==='ignored')) expect(simulation.actualObservations).toEqual([]);
    expect(find('speed','experienced','stable').actualObservations.every(value=>value.id.includes('stable'))).toBe(true);
  });

  it('respecte toutes les disponibilités, y compris variables',()=>{
    for(const simulation of results) for(const week of simulation.weeks)
      expect(week.candidates.every(value=>value.totalDurationSeconds<=week.availabilitySeconds)).toBe(true);
  });

  it('plaisir et forme ne progresse qu’après une progression réelle explicitement simulée',()=>{
    const stable=find('wellbeing','regular','stable'),progression=find('wellbeing','regular','real-progression');
    expect(new Set(stable.weeks.flatMap(value=>value.candidates.map(candidate=>candidate.durationSeconds)))).toEqual(new Set([2100]));
    expect(progression.actualObservations.some(value=>value.durationSeconds>2100)).toBe(true);
    expect(progression.weeks.at(-1)!.referenceSeconds).toBeGreaterThan(2100);
  });

  it('les suggestions ignorées ne font pas évoluer la référence',()=>{
    const ignored=find('endurance','regular','ignored');
    expect(ignored.actualObservations).toHaveLength(0);
    expect(ignored.weeks.filter(value=>value.referenceSeconds!==null).every(value=>value.referenceSeconds===2100)).toBe(true);
  });

  it('différencie les objectifs lorsque le profil documenté le permet',()=>{
    const types=(goal:StrategySimulation['goal'])=>new Set(find(goal,'experienced','stable').weeks.flatMap(week=>week.candidates.map(value=>value.type)));
    expect(types('endurance')).toContain('long-run');expect(types('speed')).toContain('intervals');expect(types('race')).toContain('hills');
    expect(types('wellbeing')).toEqual(new Set(['easy-endurance']));
  });

  it('reste prudent pendant et après une interruption',()=>{
    const interrupted=find('speed','experienced','interruption-resume');
    expect(interrupted.weeks.slice(7).some(value=>value.evidence==='insufficient')).toBe(true);
    for(const week of interrupted.weeks.filter(value=>value.evidence==='insufficient'))
      expect(week.candidates.some(value=>demanding(value.type))).toBe(false);
  });

  it('conserve des durées et structures cohérentes sur toutes les trajectoires',()=>{
    for(const simulation of results) for(const week of simulation.weeks) for(const candidate of week.candidates) {
      expect(candidate.durationSeconds).toBe(candidate.totalDurationSeconds);
      if(candidate.structure) expect(sessionStructureDurationSeconds(candidate.structure)).toBe(candidate.totalDurationSeconds);
    }
  });

  it('rend visibles les données insuffisantes et protège les débutants',()=>{
    for(const goal of ['speed','race'] as const) {
      const beginner=simulateSessionStrategies(goal,profile('beginner'),'stable');
      expect(beginner.weeks.flatMap(value=>value.candidates).some(value=>demanding(value.type))).toBe(false);
    }
    expect(find('distance','occasional','ignored').weeks[0].evidence).toBe('insufficient');
  });

  it('détecte la répétition hebdomadaire de candidats structurés sans inventer de calendrier',()=>{
    const speed=find('speed','experienced','stable');
    expect(speed.weeks.filter(week=>week.candidates.some(value=>value.type==='intervals'))).toHaveLength(12);
    expect(speed.weeks.every(week=>!('date' in week)&&!('missed' in week)&&!('debt' in week))).toBe(true);
  });

  it('génère le tableau documentaire seulement sur demande',()=>{
    const content=report();expect(content).toContain('| speed | easy-endurance, intervals | 12 |');
    if(process.env.COACH_V2_STRATEGIES_REPORT) writeFileSync(process.env.COACH_V2_STRATEGIES_REPORT,content);
  });
});
