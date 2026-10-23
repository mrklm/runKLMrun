import { describe,expect,it } from 'vitest';
import { selectPrototypeSessions,sessionStructureDurationSeconds,validatePrototypeSession,
  type SessionStrategyInput,type PrototypeSession } from './session-strategies-v2';

const base=(overrides:Partial<SessionStrategyInput>={}):SessionStrategyInput=>({goal:'endurance',habitualReferenceSeconds:2400,
  evidence:'documented',experience:'experienced',availabilitySeconds:3600,preferredTerrain:'rolling',
  observedSessionTypes:['long-run','steady-run','intervals','hills'],targetDistanceMeters:10000,
  documentedDistanceMeters:8000,eventDate:'2026-12-01',...overrides});

describe('prototype V2 de séances différenciées',()=>{
  it.each([{availabilitySeconds:0},{habitualReferenceSeconds:2100.5},{targetDistanceMeters:0},{documentedDistanceMeters:NaN},{eventDate:'invalid'}])
    ('conserve le rejet des autres entrées invalides : %j',overrides=>{
      expect(()=>selectPrototypeSessions(base(overrides))).toThrow('Entrée de stratégie V2 invalide.');
    });
  it.each([
    {reference:2196,available:2700,evidence:'documented' as const,regular:true,expected:true},
    {reference:2400,available:2700,evidence:'insufficient' as const,regular:true,expected:false},
    {reference:2400,available:2700,evidence:'documented' as const,regular:false,expected:false},
    {reference:2400,available:1799,evidence:'documented' as const,regular:true,expected:false},
    {reference:1500,available:2700,evidence:'documented' as const,regular:true,expected:false},
    {reference:2250,available:2700,evidence:'documented' as const,regular:true,expected:true},
    {reference:3000,available:2700,evidence:'documented' as const,regular:true,expected:true},
  ])('conserve le budget des variations et leurs phases : %j',({reference,available,evidence,regular,expected})=>{
    const input=base({habitualReferenceSeconds:reference,availabilitySeconds:available,evidence,observedSessionTypes:[],
      intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:18,eligible:regular}});
    const candidates=selectPrototypeSessions(input),variation=candidates.find(value=>value.type==='endurance-variations');
    expect(Boolean(variation)).toBe(expected);
    expect(selectPrototypeSessions(input)).toEqual(candidates);
    if(!variation)return;
    const structure=variation.structure!;
    expect(structure.warmUp).toMatchObject({durationSeconds:600,intensity:'easy'});
    expect(structure.efforts).toMatchObject([{durationSeconds:120,repetitions:3,intensity:'steady'}]);
    expect(structure.recoveries).toMatchObject([{durationSeconds:120,repetitions:2,intensity:'easy'}]);
    expect(structure.coolDown?.durationSeconds).toBeGreaterThanOrEqual(600);
    expect(structure.coolDown?.intensity).toBe('easy');
    expect(sessionStructureDurationSeconds(structure)).toBe(variation.totalDurationSeconds);
    expect(variation.totalDurationSeconds-360).toBeGreaterThan(variation.totalDurationSeconds/2);
    expect(variation.totalDurationSeconds).toBe(reference===2196?1800:Math.floor(Math.min(reference*0.8,available)/300)*300);
    validatePrototypeSession(variation);
  });
  it.each([
    [2100,2700,false], [2175,2700,true], [2196,2700,true], [2249,2700,true], [2250,2700,true],
    [2196,1740,false], [2196,1800,false],
  ] as const)('applique seulement aux variations le palier expérimental %i s / %i s', (reference,availability,expected)=>{
    const variation=selectPrototypeSessions(base({habitualReferenceSeconds:reference,availabilitySeconds:availability,observedSessionTypes:[],
      intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:18,eligible:true}})).find(value=>value.type==='endurance-variations');
    expect(Boolean(variation)).toBe(expected);
    if(variation)expect(variation.totalDurationSeconds).toBe(1800);
  });
  it('ne relève pas les autres séances structurées au palier des variations',()=>{
    const candidates=selectPrototypeSessions(base({habitualReferenceSeconds:2196,availabilitySeconds:2700,intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:18,eligible:true}}));
    expect(candidates.map(value=>value.type)).toEqual(['easy-endurance','endurance-variations','long-run']);
  });
  it('différencie réellement endurance et vitesse avec le même profil',()=>{
    const endurance=selectPrototypeSessions(base({goal:'endurance'}));
    const speed=selectPrototypeSessions(base({goal:'speed'}));
    expect(endurance.map(value=>value.type)).toEqual(['easy-endurance','long-run','intervals','steady-run','hills']);
    expect(speed.map(value=>value.type)).toEqual(['easy-endurance','intervals']);
    expect(endurance[1]).toMatchObject({durationSeconds:2700,intensity:'easy',terrain:'flat'});
    expect(speed[1]).toMatchObject({durationSeconds:1800,intensity:'controlled-hard',terrain:'flat'});
  });

  it('ouvre les méthodes documentées en endurance sans modifier leurs blocs',()=>{
    const candidates=selectPrototypeSessions(base({intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:18,eligible:true}}));
    expect(candidates.map(value=>value.type)).toEqual(['easy-endurance','endurance-variations','long-run','intervals','steady-run','hills']);
    for(const type of ['intervals','steady-run','hills'] as const){
      const session=candidates.find(value=>value.type===type)!;
      const previous=selectPrototypeSessions(base({goal:type==='hills'?'race':'speed',observedSessionTypes:[type]})).find(value=>value.type===type)!;
      expect(session.structure).toEqual(previous.structure);
      expect(session.totalDurationSeconds).toBe(previous.totalDurationSeconds);
      validatePrototypeSession(session);
    }
  });

  it.each([
    {evidence:'insufficient' as const}, {experience:'beginner' as const},
    {habitualReferenceSeconds:2196}, {availabilitySeconds:1500}, {observedSessionTypes:[]},
  ])('ne débloque pas les méthodes structurées sans leurs preuves : %j',overrides=>{
    const types=selectPrototypeSessions(base({...overrides,intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:18,eligible:true}})).map(value=>value.type);
    expect(types).not.toContain('intervals');expect(types).not.toContain('steady-run');expect(types).not.toContain('hills');
  });

  it('conserve la reprise prudente malgré toutes les preuves disponibles',()=>{
    expect(selectPrototypeSessions(base({goal:'return'})).map(value=>value.type)).toEqual(['recovery']);
  });

  it('ne propose aucune séance exigeante à un débutant',()=>{
    const result=selectPrototypeSessions(base({goal:'begin',experience:'beginner',evidence:'insufficient',habitualReferenceSeconds:null}));
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({type:'easy-endurance',intensity:'easy',terrain:'flat'});
  });

  it('réduit le choix à une endurance facile lorsque les références sont insuffisantes',()=>{
    const result=selectPrototypeSessions(base({goal:'speed',evidence:'insufficient'}));
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({type:'easy-endurance',durationSeconds:1800});
    const endurance=selectPrototypeSessions(base({goal:'endurance',evidence:'insufficient'}));
    expect(endurance[0]).toMatchObject({type:'easy-endurance',durationSeconds:2400});
  });

  it('ajoute des variations modérées seulement après une pratique réelle répartie',()=>{
    const evidence={activityCount:6,activeWeeks:3,spanDays:18,eligible:true};
    const sessions=selectPrototypeSessions(base({goal:'endurance',intervalIntroduction:evidence}));
    const variation=sessions.find(value=>value.type==='endurance-variations')!;
    expect(variation).toMatchObject({intensity:'steady',terrain:'flat',totalDurationSeconds:1800});
    expect(sessionStructureDurationSeconds(variation.structure!)).toBe(variation.totalDurationSeconds);
    expect(variation.rationale.designChoices.join(' ')).toMatch(/sans fractionné rapide/i);
    expect(selectPrototypeSessions(base({goal:'endurance',intervalIntroduction:{...evidence,eligible:false}})).map(value=>value.type))
      .not.toContain('endurance-variations');
  });

  it('n’ajoute une durée supérieure qu’en progression possible, avec le palier existant',()=>{
    const common={goal:'endurance' as const,observedSessionTypes:[] as const,intervalIntroduction:{activityCount:6,activeWeeks:3,spanDays:18,eligible:true}};
    const durations=(state:'maintien'|'progression-possible'|'recuperation',availability=3600)=>selectPrototypeSessions(base({...common,progressionState:state,availabilitySeconds:availability}))
      .filter(value=>value.type==='easy-endurance').map(value=>value.totalDurationSeconds);
    expect(durations('maintien')).toEqual([2400]);expect(durations('recuperation')).toEqual([2400]);
    expect(durations('progression-possible')).toEqual([2400,2700]);
    expect(durations('progression-possible',2400)).toEqual([2400]);
    expect(durations('progression-possible')).toEqual(durations('progression-possible'));
  });

  it('conserve un terrain qualitatif sans dénivelé numérique',()=>{
    const result=selectPrototypeSessions(base({goal:'race',observedSessionTypes:['hills']}));
    expect(result[1]).toMatchObject({type:'hills',terrain:'hills',intensity:'easy'});
    expect(result[1]).not.toHaveProperty('ascentMeters');expect(Object.keys(result[1])).not.toContain('gradient');
  });

  it('ajoute des variantes faciles de 35 et 30 min lorsque le relief est seulement observé',()=>{
    const variants=selectPrototypeSessions(base({goal:'endurance',habitualReferenceSeconds:2196,availabilitySeconds:2700,
      preferredTerrain:undefined,observedTerrain:'rolling',observedSessionTypes:[]})).filter(value=>value.type==='easy-endurance');
    expect(variants.map(value=>[value.totalDurationSeconds,value.terrain,value.intensity])).toEqual([
      [2100,'rolling','easy'],[2100,'flat','easy'],[1800,'rolling','easy']]);
    expect(variants.every(value=>value.totalDurationSeconds<=2700)).toBe(true);
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

  it('enrichit les séances avec un résumé et des consignes réellement facultatives',()=>{
    const speed=selectPrototypeSessions(base({goal:'speed'}));
    expect(speed[1].shortSummary).toBe('Fractionné · 30 min · Effort contrôlé · Plat');
    expect(speed[1].optionalInstructions).toEqual(['Effectuez les efforts de façon maîtrisée.']);
    expect(selectPrototypeSessions(base({goal:'wellbeing'}))[0].optionalInstructions).toBeUndefined();
  });

  it('garantit une somme exacte des blocs structurés et rejette une incohérence',()=>{
    const structured=selectPrototypeSessions(base({goal:'speed'}))[1];
    expect(sessionStructureDurationSeconds(structured.structure!)).toBe(structured.totalDurationSeconds);
    expect(()=>validatePrototypeSession({...structured,totalDurationSeconds:structured.totalDurationSeconds+1})).toThrow(/durée totale/i);
    const invalid:PrototypeSession={...structured,structure:{...structured.structure!,efforts:[{...structured.structure!.efforts[0],repetitions:0}]}};
    expect(()=>validatePrototypeSession(invalid)).toThrow(/bloc/i);
  });

  it('n’impose aucun bloc aux séances libres',()=>{
    for(const goal of ['begin','return','wellbeing','endurance','distance'] as const) {
      const free=selectPrototypeSessions(base({goal}));
      expect(free.filter(value=>value.type==='easy-endurance'||value.type==='long-run'||value.type==='recovery')
        .every(value=>value.structure===undefined)).toBe(true);
    }
  });

  it('distingue une sortie facile en côtes d’une séance structurée de côtes',()=>{
    const free=selectPrototypeSessions(base({goal:'wellbeing',preferredTerrain:'hills'}))[0];
    const structured=selectPrototypeSessions(base({goal:'race',preferredTerrain:'hills',observedSessionTypes:['hills']}))[1];
    expect(free).toMatchObject({type:'easy-endurance',terrain:'hills'});expect(free.structure).toBeUndefined();
    expect(structured).toMatchObject({type:'hills',terrain:'hills'});
    expect(sessionStructureDurationSeconds(structured.structure!)).toBe(structured.totalDurationSeconds);
  });

  it('conserve séparément les données mesurables présentes et n’invente pas les absentes',()=>{
    const complete=selectPrototypeSessions(base({goal:'distance',observedSessionTypes:['long-run']}));
    expect(complete[1].objectiveContext).toEqual({targetDistanceMeters:10000,documentedDistanceMeters:8000,eventDate:'2026-12-01'});
    const missing=selectPrototypeSessions(base({goal:'distance',targetDistanceMeters:undefined,eventDate:undefined}));
    expect(missing).toHaveLength(1);
    expect(missing[0].objectiveContext).toEqual({documentedDistanceMeters:8000});
    expect(missing[0].rationale.uncertainties).toEqual(['Informations mesurables incomplètes : aucune valeur n’est inventée.']);
    const raceWithoutDate=selectPrototypeSessions(base({goal:'race',eventDate:undefined}));
    expect(raceWithoutDate.map(value=>value.type)).toEqual(['easy-endurance']);
  });

  it('refuse toujours les séances exigeantes à un débutant même si des types sont annoncés',()=>{
    const result=selectPrototypeSessions(base({goal:'speed',experience:'beginner',observedSessionTypes:['intervals','steady-run']}));
    expect(result.map(value=>value.type)).toEqual(['easy-endurance']);
  });

  it('propose un fractionné découverte sans antécédent lorsque la pratique récente est répartie',()=>{
    const result=selectPrototypeSessions(base({goal:'speed',observedSessionTypes:[],intervalIntroduction:{
      activityCount:6,activeWeeks:3,spanDays:18,eligible:true}}));
    expect(result.map(value=>value.type)).toEqual(['easy-endurance','intervals']);
    const discovery=result[1];
    expect(discovery).toMatchObject({totalDurationSeconds:1800,intensity:'controlled-hard',terrain:'flat'});
    expect(discovery.optionalInstructions).toContain('Restez dynamique et maîtrisé, sans sprint maximal.');
    expect(discovery.structure).toMatchObject({warmUp:{durationSeconds:600},efforts:[{durationSeconds:60,repetitions:6}],
      recoveries:[{durationSeconds:60,repetitions:6}],coolDown:{durationSeconds:480}});
    expect(sessionStructureDurationSeconds(discovery.structure!)).toBe(1800);
  });

  it('ne débloque pas la découverte sous le seuil ou avec des sorties mal réparties',()=>{
    for(const intervalIntroduction of [
      {activityCount:5,activeWeeks:3,spanDays:18,eligible:false},
      {activityCount:6,activeWeeks:2,spanDays:18,eligible:false},
      {activityCount:6,activeWeeks:3,spanDays:8,eligible:false},
    ]) expect(selectPrototypeSessions(base({goal:'speed',observedSessionTypes:[],intervalIntroduction})).map(value=>value.type))
      .toEqual(['easy-endurance']);
  });
});
