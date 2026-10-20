import { describe,expect,it } from 'vitest';
import { selectPrototypeSessions,type PrototypeGoal,type SessionStrategyInput } from './session-strategies-v2';
import { orchestratePrototypeSession,type PresentedSessionEvidence,type RecordedActivityEvidence } from './session-orchestrator-v2';
import { simulateAllSessionStrategies,type StrategySimulation } from './session-strategies-longitudinal';

const catalog=(goal:PrototypeGoal='speed')=>selectPrototypeSessions({goal,habitualReferenceSeconds:2700,evidence:'documented',
  experience:'experienced',availabilitySeconds:3600,preferredTerrain:'hills',observedSessionTypes:['long-run','intervals','hills'],
  targetDistanceMeters:10000,documentedDistanceMeters:8000,eventDate:'2026-12-01'});
const input=(overrides:Partial<Parameters<typeof orchestratePrototypeSession>[0]>={})=>({coachTemperament:'rentre-dedans' as const,referenceDate:'2026-01-20',goal:'speed' as const,
  habitualReferenceSeconds:2700,availabilitySeconds:3600,candidates:catalog(),activities:[],presented:[],...overrides});

function orchestrated(simulation:StrategySimulation) {
  const presented:PresentedSessionEvidence[]=[],selected=[] as NonNullable<ReturnType<typeof orchestratePrototypeSession>['selected']>[];
  for(const week of simulation.weeks) {
    const activities:RecordedActivityEvidence[]=simulation.actualObservations.filter(value=>value.date<=week.referenceDate)
      .map(value=>({date:value.date})); // Type volontairement inconnu.
    const result=orchestratePrototypeSession({coachTemperament:'rentre-dedans',referenceDate:week.referenceDate,goal:simulation.goal,
      habitualReferenceSeconds:week.referenceSeconds,availabilitySeconds:week.availabilitySeconds,
      candidates:week.candidates,activities,presented});
    if(result.selected) { selected.push(result.selected);presented.push({date:week.referenceDate,type:result.selected.type}); }
  }
  return selected;
}

describe('orchestrateur temporel expérimental des séances V2',()=>{
  const trajectories=simulateAllSessionStrategies();
  const find=(goal:StrategySimulation['goal'],profile:StrategySimulation['profile'],behaviour:StrategySimulation['behaviour'])=>
    trajectories.find(value=>value.goal===goal&&value.profile===profile&&value.behaviour===behaviour)!;

  it('ne déduit aucune séance structurée réalisée des présentations répétées',()=>{
    const speed=find('speed','experienced','stable'),race=find('race','experienced','stable');
    expect(speed.weeks.filter(value=>value.candidates.some(candidate=>candidate.type==='intervals'))).toHaveLength(12);
    expect(orchestrated(speed).filter(value=>value.type==='intervals')).toHaveLength(12);
    expect(race.weeks.filter(value=>value.candidates.some(candidate=>candidate.type==='hills'))).toHaveLength(12);
    // Le premier candidat spécialisé reste prioritaire : aucune alternance due à la consultation.
    expect(orchestrated(race).filter(value=>value.type==='long-run')).toHaveLength(12);
  });

  it.each([1,2,4])('utilise les dates réelles avec %i course(s) par semaine',frequency=>{
    const offsets=frequency===1?[0]:frequency===2?[0,3]:[0,2,4,6];
    const activities=offsets.map(offset=>({date:`2026-01-${String(13+offset).padStart(2,'0')}`}));
    const result=orchestratePrototypeSession(input({activities}));
    expect(result.selected===null).toBe(frequency===4); // Dernière activité la veille pour 4/semaine.
    expect(activities.every(value=>!('documentedType' in value))).toBe(true);
  });

  it('une suggestion ignorée ne crée ni repos sportif ni dette',()=>{
    const presented=[{date:'2026-01-20',type:'intervals' as const}];
    const nextDay=orchestratePrototypeSession(input({referenceDate:'2026-01-21',presented}));
    const nextWeek=orchestratePrototypeSession(input({referenceDate:'2026-01-27',presented}));
    expect(nextDay.selected?.type).toBe('intervals');
    expect(nextWeek.selected?.type).toBe('intervals');
    expect(nextWeek).not.toHaveProperty('debt');expect(nextWeek).not.toHaveProperty('replacement');
  });

  it('reste prudent après interruption et avec données insuffisantes',()=>{
    const interrupted=find('speed','experienced','interruption-resume');
    for(const week of interrupted.weeks.filter(value=>value.evidence==='insufficient'))
      expect(orchestrated({...interrupted,weeks:[week]}).some(value=>value.type==='intervals')).toBe(false);
    const insufficientInput:SessionStrategyInput={goal:'speed',habitualReferenceSeconds:2700,evidence:'insufficient',
      experience:'experienced',availabilitySeconds:3600,preferredTerrain:'hills',
      observedSessionTypes:['long-run','intervals','hills']};
    const insufficient=selectPrototypeSessions(insufficientInput);
    expect(orchestratePrototypeSession(input({candidates:insufficient})).selected?.type).toBe('easy-endurance');
  });

  it('gère les dates rapprochées et irrégulières sans numéro de semaine',()=>{
    expect(orchestratePrototypeSession(input({activities:[{date:'2026-01-19'}]}))).toEqual({selected:null,reason:'recent-activity'});
    const irregular=orchestratePrototypeSession(input({activities:[{date:'2026-01-02'},{date:'2026-01-11'}]}));
    expect(irregular.selected?.type).toBe('intervals');
  });

  it('un type inconnu ne prouve jamais une séance structurée réalisée',()=>{
    const unknown=orchestratePrototypeSession(input({activities:[{date:'2026-01-05'}]}));
    const documented=orchestratePrototypeSession(input({activities:[{date:'2026-01-10',documentedType:'intervals'}]}));
    expect(unknown.selected?.type).toBe('intervals');expect(documented.selected?.type).toBe('easy-endurance');
  });

  it('privilégie une séance facile après un fractionné réel sans créer de dette',()=>{
    const performed=orchestratePrototypeSession(input({referenceDate:'2026-01-12',activities:[{date:'2026-01-08',documentedType:'intervals'}]}));
    expect(performed.selected?.type).toBe('easy-endurance');expect(performed).not.toHaveProperty('debt');
    const ignored=orchestratePrototypeSession(input({referenceDate:'2026-01-12',presented:[{date:'2026-01-08',type:'intervals'}]}));
    expect(ignored.selected?.type).toBe('intervals');
    const later=orchestratePrototypeSession(input({referenceDate:'2026-01-24',activities:[
      {date:'2026-01-08',documentedType:'intervals'},{date:'2026-01-12',documentedType:'easy-endurance'}]}));
    expect(later.selected?.type).toBe('intervals');
  });

  it.each(['intervals','hills','steady-run','long-run'] as const)('conserve le délai sportif après une activité %s documentée',type=>{
    const candidates=catalog(type==='long-run'?'endurance':'speed');
    const gap=type==='long-run'?10:14;
    const activities=[{date:'2026-01-08',documentedType:type}];
    const date=(offset:number)=>new Date(Date.parse('2026-01-08T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
    expect(orchestratePrototypeSession(input({referenceDate:date(gap-1),candidates,activities})).selected?.type).toBe('easy-endurance');
    expect(orchestratePrototypeSession(input({referenceDate:date(gap),candidates,activities})).selected?.type)
      .toBe(type==='long-run'?'long-run':'intervals');
    const presented=[{date:date(gap-1),type}];
    expect(orchestratePrototypeSession(input({referenceDate:date(gap),candidates,activities,presented})))
      .toEqual(orchestratePrototypeSession(input({referenceDate:date(gap),candidates,activities})));
  });

  it.each(['intervals','hills','steady-run','long-run'] as const)('espace les intentions %s séparément des activités',type=>{
    const candidates=catalog(type==='long-run'?'endurance':'speed'),gap=type==='long-run'?10:14;
    const date=(offset:number)=>new Date(Date.parse('2026-01-08T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
    const source=input({candidates,activities:[],presented:[],envisaged:[{date:'2026-01-08',type}]});
    const before=structuredClone(source);
    expect(orchestratePrototypeSession({...source,referenceDate:date(1)}).selected).toBeNull();
    expect(orchestratePrototypeSession({...source,referenceDate:date(gap-1)}).selected?.type).toBe('easy-endurance');
    expect(orchestratePrototypeSession({...source,referenceDate:date(gap)}).selected?.type).toBe(type==='long-run'?'long-run':'intervals');
    expect(source).toEqual(before);expect(source.activities).toEqual([]);
  });

  it('une présentation seule ne bloque pas même le seul candidat structuré ou long',()=>{
    for(const goal of ['speed','endurance'] as const) {
      const candidates=catalog(goal).filter(value=>value.type!=='easy-endurance');
      const source=input({candidates,presented:[{date:'2026-01-20',type:candidates[0].type}]});
      const before=structuredClone(source);
      expect(orchestratePrototypeSession(source)).toEqual(orchestratePrototypeSession({...source,presented:[]}));
      expect(orchestratePrototypeSession(source).selected).not.toBeNull();expect(source).toEqual(before);
    }
  });

  it('ne modifie ni les durées ni les blocs du catalogue et ne crée aucune progression',()=>{
    const candidates=catalog(),result=orchestratePrototypeSession(input({candidates}));
    expect(result.selected).toMatchObject({type:candidates[1].type,totalDurationSeconds:candidates[1].totalDurationSeconds,structure:candidates[1].structure});
    expect(candidates).toEqual(catalog());
    const ignored=find('wellbeing','regular','ignored');
    expect(new Set(orchestrated(ignored).map(value=>value.durationSeconds))).toEqual(new Set([2100,900]));
    expect(ignored.actualObservations).toEqual([]);
  });
});

describe('préférence temporaire issue du ressenti réel',()=>{
  it.each([undefined,'easy','moderate'] as const)('ne modifie pas le choix avec un ressenti %s',effort=>{
    expect(orchestratePrototypeSession(input({activities:[{date:'2026-01-17',effort}]})))
      .toEqual(orchestratePrototypeSession(input({activities:[{date:'2026-01-17'}]})));
  });
  it.each(['hard','very-hard'] as const)('privilégie le facile pour %s sans modifier les candidats',effort=>{
    const source=input({activities:[{date:'2026-01-17',effort}]}),before=structuredClone(source);
    const result=orchestratePrototypeSession(source);
    expect(result.selected?.type).toBe('easy-endurance');
    expect(result.selected?.totalDurationSeconds).toBe(catalog()[0].totalDurationSeconds);
    expect(result.selected?.rationale.designChoices.join(' ')).toContain('17/01/2026');
    expect(source).toEqual(before);
  });
  it('borne la fenêtre à J-6 inclus, exclut J-7 et le futur',()=>{
    for(const date of ['2026-01-13','2026-01-21']){
      const source=input({activities:[{date,effort:'hard'}]});
      expect(orchestratePrototypeSession(source)).toEqual(orchestratePrototypeSession(input({activities:[{date}]})));
    }
    expect(orchestratePrototypeSession(input({activities:[{date:'2026-01-14',effort:'hard'}]})).selected?.type).toBe('easy-endurance');
  });
  it('ne crée ni récupération ni séance forcée et conserve les espacements et plafonds',()=>{
    const activities:RecordedActivityEvidence[]=[{date:'2026-01-17',effort:'hard'}];
    expect(orchestratePrototypeSession(input({activities:[{date:'2026-01-19',effort:'hard'}]}))).toMatchObject({selected:null,reason:'recent-activity'});
    expect(orchestratePrototypeSession(input({activities,availabilitySeconds:1})).selected).toBeNull();
    expect(orchestratePrototypeSession(input({activities,candidates:[]})).selected).toBeNull();
    const candidates=catalog().filter(value=>value.type==='intervals');
    // hard reste une préférence ; very-hard protège aussi sans alternative facile.
    expect(orchestratePrototypeSession(input({activities,candidates})).selected?.type).toBe('intervals');
    expect(orchestratePrototypeSession(input({activities:[{date:'2026-01-17',effort:'very-hard'}],candidates})))
      .toEqual({selected:null,reason:'very-hard-recovery'});
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('%s bloque une option exigeante seule après very-hard récent',coachTemperament=>{
    const demanding=catalog().filter(value=>value.type==='intervals');
    expect(orchestratePrototypeSession(input({coachTemperament,activities:[{date:'2026-01-17',effort:'very-hard'}],candidates:demanding})))
      .toEqual({selected:null,reason:'very-hard-recovery'});
    expect(orchestratePrototypeSession(input({coachTemperament,activities:[{date:'2026-01-13',effort:'very-hard'}],candidates:demanding})).selected?.type)
      .toBe('intervals');
  });
  it('ne justifie rien par le ressenti si une contrainte sportive imposait déjà le facile',()=>{
    const activity:RecordedActivityEvidence={date:'2026-01-17',documentedType:'intervals',effort:'hard'};
    expect(orchestratePrototypeSession(input({activities:[activity]})))
      .toEqual(orchestratePrototypeSession(input({activities:[{...activity,effort:undefined}]})));
  });
  it('ne lit aucun ressenti des présentations ou intentions',()=>{
    const source=input({presented:[{date:'2026-01-20',type:'intervals'}],envisaged:[{date:'2026-01-17',type:'easy-endurance'}]});
    expect(orchestratePrototypeSession(source).selected?.type).toBe('intervals');
    expect(orchestratePrototypeSession(source).selected?.rationale.designChoices.join(' ')).not.toContain('ressentie');
  });
});

describe('classement des tempéraments après admissibilité',()=>{
  it('classe une durée progressive déjà admissible sans changer les protections',()=>{
    const habitual=catalog('endurance')[0],progressed={...habitual,totalDurationSeconds:habitual.totalDurationSeconds+300,durationSeconds:habitual.durationSeconds+300,
      changedDimensions:['duration'] as const};
    expect(orchestratePrototypeSession(input({goal:'endurance',candidates:[habitual,progressed],coachTemperament:'pas-a-pas'})).selected?.totalDurationSeconds)
      .toBe(habitual.totalDurationSeconds);
    const activity={date:'2026-01-17',documentedType:'easy-endurance' as const};
    const active=orchestratePrototypeSession(input({goal:'endurance',candidates:[habitual,progressed],coachTemperament:'evolution-active',activities:[activity]}));
    expect(active.selected?.totalDurationSeconds).toBe(progressed.totalDurationSeconds);
    expect(active.selected?.rationale.designChoices.join(' ')).toContain('pratique réelle régulière');
    expect(orchestratePrototypeSession(input({goal:'endurance',candidates:[habitual,progressed],coachTemperament:'rentre-dedans'})).selected?.totalDurationSeconds)
      .toBe(progressed.totalDurationSeconds);
  });
  it.each([
    ['pas-a-pas','easy-endurance'],['evolution-active','intervals'],['rentre-dedans','intervals'],
  ] as const)('%s choisit %s sans modifier le catalogue', (coachTemperament,type)=>{
    const source=input({coachTemperament,activities:[{date:'2026-01-17',documentedType:'easy-endurance'}]}),before=structuredClone(source);
    expect(orchestratePrototypeSession(source).selected?.type).toBe(type);
    expect(source).toEqual(before);
  });
  it('le défaut est prudent ; la diversification nécessite un type réellement connu ou envisagé',()=>{
    expect(orchestratePrototypeSession(input({coachTemperament:undefined})).selected?.type).toBe('easy-endurance');
    const source=input({coachTemperament:'evolution-active',activities:[{date:'2026-01-17'}]});
    expect(orchestratePrototypeSession(source)).toEqual(orchestratePrototypeSession({...source,coachTemperament:'pas-a-pas'}));
  });
  it('Rentre dedans préfère la durée haute admissible, sans créer ni agrandir de séance',()=>{
    const first=catalog()[1],longer=catalog('endurance').find(value=>value.type==='long-run')!;
    const source=input({coachTemperament:'rentre-dedans',candidates:[catalog()[0],first,longer]});
    expect(orchestratePrototypeSession(source).selected?.totalDurationSeconds).toBe(3000);
    expect(orchestratePrototypeSession({...source,availabilitySeconds:2400}).selected?.type).toBe('intervals');
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('%s respecte ressenti, espacement et absence d’alternative',coachTemperament=>{
    const source=input({coachTemperament,activities:[{date:'2026-01-17',documentedType:'easy-endurance',effort:'very-hard'}]});
    expect(orchestratePrototypeSession(source).selected?.type).toBe('easy-endurance');
    expect(orchestratePrototypeSession({...source,activities:[{date:'2026-01-19'}]}).selected).toBeNull();
    expect(orchestratePrototypeSession({...source,availabilitySeconds:1}).selected).toBeNull();
    const only={...source,candidates:[catalog()[0]]};
    expect(orchestratePrototypeSession(only)).toEqual(orchestratePrototypeSession({...only,coachTemperament:'pas-a-pas'}));
  });
});

it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('les exclusions structurées restent communes à %s',coachTemperament=>{
  for(const type of ['intervals','long-run'] as const){
    const candidates=catalog(type==='long-run'?'endurance':'speed');
    const source=input({coachTemperament,candidates,activities:[{date:'2026-01-17',documentedType:type}]});
    expect(orchestratePrototypeSession(source).selected?.type).toBe('easy-endurance');
    expect(orchestratePrototypeSession({...source,candidates:candidates.filter(value=>value.type===type)}).selected).toBeNull();
  }
});
