export type PrototypeGoal='begin'|'return'|'wellbeing'|'endurance'|'speed'|'distance'|'race';
export type PrototypeSessionType='easy-endurance'|'long-run'|'steady-run'|'intervals'|'hills'|'recovery';
export type QualitativeIntensity='very-easy'|'easy'|'steady'|'controlled-hard';
export type QualitativeTerrain='flat'|'rolling'|'hills';
export type DifficultyDimension='duration'|'intensity'|'terrain';

export interface SessionStrategyInput {
  goal:PrototypeGoal;
  habitualReferenceSeconds:number|null;
  evidence:'insufficient'|'documented';
  experience:'beginner'|'regular'|'experienced';
  availabilitySeconds:number;
  preferredTerrain:QualitativeTerrain;
  observedSessionTypes:readonly ('long-run'|'steady-run'|'intervals'|'hills')[];
}
export interface PrototypeSession {
  type:PrototypeSessionType;
  durationSeconds:number;
  intensity:QualitativeIntensity;
  terrain:QualitativeTerrain;
  changedDimensions:readonly DifficultyDimension[];
  rationale:string;
  optional:true;
}

/** Choix éditoriaux du prototype, à tester et non validés scientifiquement. */
export const SESSION_STRATEGY_EXPERIMENT = Object.freeze({stepSeconds:300,beginningSeconds:1200,cautiousRatio:0.8});
const floorStep=(seconds:number)=>Math.floor(seconds/SESSION_STRATEGY_EXPERIMENT.stepSeconds)*SESSION_STRATEGY_EXPERIMENT.stepSeconds;
const duration=(wanted:number,available:number)=>Math.max(0,floorStep(Math.min(wanted,available)));
const session=(type:PrototypeSessionType,durationSeconds:number,intensity:QualitativeIntensity,terrain:QualitativeTerrain,
  changedDimensions:readonly DifficultyDimension[],rationale:string):PrototypeSession=>
  ({type,durationSeconds,intensity,terrain,changedDimensions,rationale,optional:true});

/** Prototype isolé : reçoit un repère déjà calculé et ne connaît pas B 2G. */
export function selectPrototypeSessions(input:SessionStrategyInput):PrototypeSession[] {
  if(!Number.isSafeInteger(input.availabilitySeconds)||input.availabilitySeconds<=0
    || input.habitualReferenceSeconds!==null&&(!Number.isSafeInteger(input.habitualReferenceSeconds)||input.habitualReferenceSeconds<=0))
    throw new Error('Entrée de stratégie V2 invalide.');
  const fallback=SESSION_STRATEGY_EXPERIMENT.beginningSeconds;
  const reference=input.habitualReferenceSeconds??fallback;
  const baseDuration=duration(input.evidence==='documented'?reference:reference*SESSION_STRATEGY_EXPERIMENT.cautiousRatio,input.availabilitySeconds);
  if(baseDuration<SESSION_STRATEGY_EXPERIMENT.stepSeconds) return [];
  const easyTerrain=input.preferredTerrain==='hills'?'rolling':input.preferredTerrain;
  if(input.goal==='begin') return [session('easy-endurance',baseDuration,'easy','flat',[],
    'Découverte prudente sans supposer une tolérance aux séances exigeantes.')];
  if(input.goal==='return') return [session('recovery',baseDuration,'very-easy','flat',[],
    'Reprise aisée sans réutiliser une ancienne capacité supposée.')];

  const easy=session('easy-endurance',baseDuration,'easy',easyTerrain,[],
    'Durée fondée sur le repère fourni, sans progression obligatoire.');
  if(input.goal==='wellbeing'||input.evidence==='insufficient') return [easy];
  const proposals:PrototypeSession[]=[easy];
  const canStructure=input.experience!=='beginner'&&input.evidence==='documented';
  const observed=(type:SessionStrategyInput['observedSessionTypes'][number])=>input.observedSessionTypes.includes(type);
  const shorter=duration(reference*SESSION_STRATEGY_EXPERIMENT.cautiousRatio,input.availabilitySeconds);

  if((input.goal==='endurance'||input.goal==='distance'||input.goal==='race')&&observed('long-run')) {
    const longer=duration(reference+SESSION_STRATEGY_EXPERIMENT.stepSeconds,input.availabilitySeconds);
    if(longer>reference) proposals.push(session('long-run',longer,'easy','flat',['duration'],
      'Option plus longue étayée par des sorties longues déjà observées.'));
  }
  if(input.goal==='speed'&&canStructure) {
    if(observed('intervals')) proposals.push(session('intervals',shorter,'controlled-hard','flat',['intensity'],
      'Séance structurée admise uniquement parce que cette pratique est déjà documentée.'));
    else if(observed('steady-run')) proposals.push(session('steady-run',shorter,'steady','flat',['intensity'],
      'Effort soutenu admis uniquement parce que cette pratique est déjà documentée.'));
  }
  if(input.goal==='race'&&canStructure) {
    if(observed('hills')) proposals.push(session('hills',shorter,'easy','hills',['terrain'],
      'Relief spécifique déjà documenté, sans objectif chiffré de dénivelé.'));
    else if(observed('steady-run')) proposals.push(session('steady-run',shorter,'steady','flat',['intensity'],
      'Effort soutenu déjà documenté, sans augmenter aussi la durée ou le relief.'));
  }
  return proposals;
}
