import { describe,expect,it } from 'vitest';
import { selectPrototypeSessions,type SessionStrategyInput } from './session-strategies-v2';

const base=(overrides:Partial<SessionStrategyInput>={}):SessionStrategyInput=>({goal:'endurance',habitualReferenceSeconds:2400,
  evidence:'documented',experience:'experienced',availabilitySeconds:3600,preferredTerrain:'rolling',
  observedSessionTypes:['long-run','steady-run','intervals','hills'],...overrides});

describe('prototype V2 de séances différenciées',()=>{
  it('différencie réellement endurance et vitesse avec le même profil',()=>{
    const endurance=selectPrototypeSessions(base({goal:'endurance'}));
    const speed=selectPrototypeSessions(base({goal:'speed'}));
    expect(endurance.map(value=>value.type)).toEqual(['easy-endurance','long-run']);
    expect(speed.map(value=>value.type)).toEqual(['easy-endurance','intervals']);
    expect(endurance[1]).toMatchObject({durationSeconds:2700,intensity:'easy',terrain:'flat'});
    expect(speed[1]).toMatchObject({durationSeconds:1800,intensity:'controlled-hard',terrain:'flat'});
  });

  it('ne propose aucune séance exigeante à un débutant',()=>{
    const result=selectPrototypeSessions(base({goal:'begin',experience:'beginner',evidence:'insufficient',habitualReferenceSeconds:null}));
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({type:'easy-endurance',intensity:'easy',terrain:'flat'});
  });

  it('réduit le choix à une endurance facile lorsque les références sont insuffisantes',()=>{
    const result=selectPrototypeSessions(base({goal:'speed',evidence:'insufficient'}));
    expect(result).toHaveLength(1);expect(result[0].type).toBe('easy-endurance');
  });

  it('conserve un terrain qualitatif sans dénivelé numérique',()=>{
    const result=selectPrototypeSessions(base({goal:'race',observedSessionTypes:['hills']}));
    expect(result[1]).toMatchObject({type:'hills',terrain:'hills',intensity:'easy'});
    expect(result[1]).not.toHaveProperty('ascentMeters');expect(Object.keys(result[1])).not.toContain('gradient');
  });

  it('une sortie longue reste facile et n’augmente que la durée',()=>{
    const long=selectPrototypeSessions(base({goal:'distance',observedSessionTypes:['long-run']}))[1];
    expect(long).toMatchObject({type:'long-run',intensity:'easy',terrain:'flat',changedDimensions:['duration']});
  });

  it('plaisir et forme conserve le repère sans imposer de progression',()=>{
    const result=selectPrototypeSessions(base({goal:'wellbeing'}));
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({type:'easy-endurance',durationSeconds:2400,changedDimensions:[]});
  });

  it('aucune proposition n’augmente simultanément plusieurs dimensions',()=>{
    for(const goal of ['begin','return','wellbeing','endurance','speed','distance','race'] as const)
      for(const proposal of selectPrototypeSessions(base({goal}))) expect(proposal.changedDimensions.length).toBeLessThanOrEqual(1);
  });

  it('respecte la disponibilité et ne transforme pas un objectif en justification suffisante',()=>{
    const constrained=selectPrototypeSessions(base({goal:'race',availabilitySeconds:1800,observedSessionTypes:[]}));
    expect(constrained.every(value=>value.durationSeconds<=1800)).toBe(true);expect(constrained).toHaveLength(1);
    const undocumented=selectPrototypeSessions(base({goal:'speed',experience:'experienced',observedSessionTypes:[]}));
    expect(undocumented.map(value=>value.type)).toEqual(['easy-endurance']);
  });
});
