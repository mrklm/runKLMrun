import { describe,expect,it } from 'vitest';
import type { RunningSession } from '../../../types/session';
import { intervalIntroductionEvidence } from '../catalog-integration-v2';
import { orchestratePrototypeSession } from './session-orchestrator-v2';
import { selectPrototypeSessions,type PrototypeSessionType } from './session-strategies-v2';

const today='2026-10-18',origin=Date.parse(`${today}T00:00:00Z`),DAY=86400000;
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const runs=(offsets:number[]):RunningSession[]=>offsets.map((offset,index)=>({id:`run-${index}`,title:'Course réelle',sport:'RUNNING',
  date:date(offset),durationSeconds:2400}));
const candidates=(sessions:RunningSession[])=>selectPrototypeSessions({goal:'speed',habitualReferenceSeconds:2400,evidence:'insufficient',
  experience:'regular',availabilitySeconds:1800,observedSessionTypes:[],intervalIntroduction:intervalIntroductionEvidence(sessions,today)});
const choose=(sessions:RunningSession[],activities:{date:string;documentedType?:PrototypeSessionType}[]=[],presented:{date:string;type:PrototypeSessionType}[]=[],referenceDate=today)=>
  orchestratePrototypeSession({coachTemperament:'rentre-dedans',referenceDate,goal:'speed',habitualReferenceSeconds:2400,availabilitySeconds:1800,
    candidates:candidates(sessions),activities,presented});

describe('introduction expérimentale du fractionné V2',()=>{
  const regular=runs([-26,-21,-16,-11,-6,-3]);

  it('A — introduit une séance pour six sorties réelles réparties',()=>{
    expect(intervalIntroductionEvidence(regular,today)).toMatchObject({activityCount:6,activeWeeks:4,spanDays:23,eligible:true});
    expect(candidates(regular).map(value=>value.type)).toEqual(['easy-endurance','intervals']);
  });

  it('B — reste facile sous le seuil ou avec une pratique groupée',()=>{
    expect(candidates(runs([-20,-15,-10,-5,-2])).map(value=>value.type)).toEqual(['easy-endurance']);
    expect(candidates(runs([-8,-7,-6,-5,-4,-3])).map(value=>value.type)).toEqual(['easy-endurance']);
  });

  it('C — une suggestion ignorée ne devient ni activité ni récupération obligatoire',()=>{
    const activities=regular.map(value=>({date:value.date!}));
    const before=structuredClone({regular,activities});
    // Six sorties réparties ; dernière activité à J-3, aucun type structuré documenté.
    expect(intervalIntroductionEvidence(regular,today)).toMatchObject({activityCount:6,activeWeeks:4,spanDays:23,eligible:true});
    const baseline=choose(regular,activities);
    expect(baseline.selected?.type).toBe('intervals');
    expect(baseline.selected!.totalDurationSeconds).toBeLessThanOrEqual(1800);
    for(const offset of [-4,0]){
      const presented=[{date:date(offset),type:'intervals' as const}],unchanged=structuredClone(presented);
      const result=choose(regular,activities,presented);
      expect(result).toEqual(baseline);
      expect(result.selected?.type).not.toBe('recovery');
      // La présentation ne lève pas non plus les contraintes des activités réelles.
      expect(choose(regular,[...activities,{date:date(-1)}],presented))
        .toMatchObject({selected:null,reason:'recent-activity'});
      expect(choose(regular,[...activities,{date:date(-4),documentedType:'intervals'}],presented).selected?.type)
        .toBe('easy-endurance');
      expect(presented).toEqual(unchanged);
    }
    expect({regular,activities}).toEqual(before);
  });

  it('D — après un fractionné réellement identifié, retient une séance facile',()=>{
    const result=choose(regular,[{date:date(-4),documentedType:'intervals'}]);
    expect(result.selected?.type).toBe('easy-endurance');
  });

  it('E — une activité douce puis le temps écoulé permettent de retrouver la variété normale',()=>{
    const result=choose(regular,[{date:date(-20),documentedType:'intervals'},{date:date(-16),documentedType:'easy-endurance'}]);
    expect(result.selected?.type).toBe('intervals');
  });

  it('F — un lien sans type fiable reste inconnu',()=>{
    const result=choose(regular,[{date:date(-4)}]);
    expect(result.selected?.type).toBe('intervals');
  });

  it('G — une interruption fait sortir les activités de la fenêtre sans supposer une perte de capacité',()=>{
    const old=runs([-56,-51,-46,-41,-36,-31]);
    expect(intervalIntroductionEvidence(old,today)).toMatchObject({activityCount:0,eligible:false});
    expect(candidates(old).map(value=>value.type)).toEqual(['easy-endurance']);
  });

  it('H — deux consultations identiques restent pures et déterministes',()=>{
    const before=structuredClone(regular),first=choose(regular),second=choose(regular);
    expect(second).toEqual(first);expect(regular).toEqual(before);
  });
});
