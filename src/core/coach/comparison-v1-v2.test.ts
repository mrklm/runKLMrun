import { describe,expect,it } from 'vitest';
import type { CoachProfileValues } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
import { compareCoachVersionsReadonly } from './comparison-v1-v2';

const referenceDate='2026-10-18',origin=Date.parse(`${referenceDate}T00:00:00Z`),DAY=86400000;
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const sessions:RunningSession[]=[-26,-21,-16,-11,-6,-3].map((offset,index)=>({id:`run-${index}`,title:'Course',sport:'RUNNING',
  date:date(offset),durationSeconds:2400,distanceMeters:8000}));
const configuration:EvolvingCoachValues={goal:{model:'evolving',kind:'speed'},experience:'experienced',structuredPlanningPreference:'accepted'};
const profile:CoachProfileValues={goal:{kind:'regular'},availability:{sessionsPerWeek:3,days:['monday','wednesday','friday'],minutesPerSession:60},
  preferences:{terrain:'road'},accompanimentMode:'advisor'};

describe('comparaison V1/V2 strictement en lecture seule',()=>{
  it('compare le même instantané sans attribuer au V1 des dimensions absentes',()=>{
    const snapshot={coachTemperament:'rentre-dedans' as const,sessions,occurrences:[],configuration,profile},before=structuredClone(snapshot);
    const result=compareCoachVersionsReadonly(snapshot,referenceDate);
    expect(result).toMatchObject({readonly:true,sessionCount:6,goal:'speed'});
    expect(result.v1.suggestions.every(value=>value.engine==='V1')).toBe(true);
    expect(result.v2.suggestions).toHaveLength(3);
    expect(result.v2.suggestions[0]).toMatchObject({engine:'V2',type:'intervals',durationSeconds:1800,
      intensity:'controlled-hard',terrain:'flat'});
    expect(snapshot).toEqual(before);
  });

  it('reste déterministe et ne crée aucune occurrence ou association',()=>{
    const snapshot={coachTemperament:'rentre-dedans' as const,sessions,occurrences:[],configuration,profile};
    expect(compareCoachVersionsReadonly(snapshot,referenceDate)).toEqual(compareCoachVersionsReadonly(snapshot,referenceDate));
    expect(snapshot.occurrences).toEqual([]);
  });
});
