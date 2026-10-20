export type PrototypeGoal='begin'|'return'|'wellbeing'|'endurance'|'speed'|'distance'|'race';
export type PrototypeSessionType='easy-endurance'|'endurance-variations'|'long-run'|'steady-run'|'intervals'|'hills'|'recovery';
export type QualitativeIntensity='very-easy'|'easy'|'steady'|'controlled-hard';
export type QualitativeTerrain='flat'|'rolling'|'hills';
export type DifficultyDimension='duration'|'intensity'|'terrain';
export interface SessionBlock {
  repetitions?:number;
  durationSeconds:number;
  intensity:QualitativeIntensity;
  instruction:string;
}
export interface SessionStructure {
  warmUp?:SessionBlock;
  efforts:SessionBlock[];
  recoveries?:SessionBlock[];
  coolDown?:SessionBlock;
}
export interface SessionRationale {
  observedFacts:string[];
  runnerDeclarations:string[];
  designChoices:string[];
  uncertainties:string[];
}
export interface MeasurableObjectiveContext {
  targetDistanceMeters?:number;
  documentedDistanceMeters?:number;
  eventDate?:string;
}

export interface SessionStrategyInput {
  goal:PrototypeGoal;
  habitualReferenceSeconds:number|null;
  evidence:'insufficient'|'documented';
  experience?:'beginner'|'regular'|'experienced';
  availabilitySeconds:number;
  progressionState?:'maintien'|'progression-possible'|'recuperation';
  preferredTerrain?:QualitativeTerrain;
  /** Relief positif fiable observé sur une activité réelle ; jamais une préférence utilisateur. */
  observedTerrain?:'rolling';
  observedSessionTypes:readonly ('long-run'|'steady-run'|'intervals'|'hills')[];
  /** Faits de régularité calculés sur des activités réelles, jamais sur des suggestions. */
  intervalIntroduction?:{activityCount:number;activeWeeks:number;spanDays:number;eligible:boolean};
  targetDistanceMeters?:number;
  documentedDistanceMeters?:number;
  eventDate?:string;
}
export interface PrototypeSession {
  type:PrototypeSessionType;
  durationSeconds:number;
  totalDurationSeconds:number;
  intensity:QualitativeIntensity;
  terrain:QualitativeTerrain;
  shortSummary:string;
  optionalInstructions?:string[];
  structure?:SessionStructure;
  objectiveContext?:MeasurableObjectiveContext;
  changedDimensions:readonly DifficultyDimension[];
  rationale:SessionRationale;
  optional:true;
}

/** Choix éditoriaux du prototype, à tester et non validés scientifiquement. */
export const SESSION_STRATEGY_EXPERIMENT = Object.freeze({stepSeconds:300,beginningSeconds:1200,cautiousRatio:0.8});
const floorStep=(seconds:number)=>Math.floor(seconds/SESSION_STRATEGY_EXPERIMENT.stepSeconds)*SESSION_STRATEGY_EXPERIMENT.stepSeconds;
const duration=(wanted:number,available:number)=>Math.max(0,floorStep(Math.min(wanted,available)));
const labels:Record<PrototypeSessionType,string>={'easy-endurance':'Endurance facile','endurance-variations':'Endurance à variations modérées','long-run':'Sortie longue',
  'steady-run':'Sortie soutenue',intervals:'Fractionné',hills:'Côtes',recovery:'Récupération'};
const intensityLabels:Record<QualitativeIntensity,string>={'very-easy':'Très facile',easy:'Facile',steady:'Soutenue','controlled-hard':'Effort contrôlé'};
const terrainLabels:Record<QualitativeTerrain,string>={flat:'Plat',rolling:'Vallonné',hills:'Côtes'};
const summary=(type:PrototypeSessionType,seconds:number,intensity:QualitativeIntensity,terrain:QualitativeTerrain)=>
  `${labels[type]} · ${seconds/60} min · ${intensityLabels[intensity]} · ${terrainLabels[terrain]}`;
const session=(type:PrototypeSessionType,durationSeconds:number,intensity:QualitativeIntensity,terrain:QualitativeTerrain,
  changedDimensions:readonly DifficultyDimension[],rationale:SessionRationale,extra:Partial<PrototypeSession>={}):PrototypeSession=>
  ({type,durationSeconds,totalDurationSeconds:durationSeconds,intensity,terrain,shortSummary:summary(type,durationSeconds,intensity,terrain),
    changedDimensions,rationale,optional:true,...extra});
const rationale=(observedFacts:string[],runnerDeclarations:string[],designChoices:string[],uncertainties:string[]=[]):SessionRationale=>
  ({observedFacts,runnerDeclarations,designChoices,uncertainties});
const block=(durationSeconds:number,intensity:QualitativeIntensity,instruction:string,repetitions?:number):SessionBlock=>
  ({durationSeconds,intensity,instruction,...(repetitions===undefined?{}:{repetitions})});
const intervalsStructure=(total:number):SessionStructure=>({warmUp:block(600,'easy','Échauffement facile.'),
  efforts:[block(120,'controlled-hard','Effort dynamique et maîtrisé.',4)],
  recoveries:[block(120,'very-easy','Récupération très facile.',4)],coolDown:block(total-1560,'easy','Retour au calme.')});
const discoveryIntervalsStructure=(total:number):SessionStructure=>({warmUp:block(600,'easy','Échauffement facile.'),
  efforts:[block(60,'controlled-hard','Effort dynamique et maîtrisé, sans sprint.',6)],
  recoveries:[block(60,'very-easy','Récupération facile.',6)],coolDown:block(total-1320,'easy','Retour au calme.')});
const hillsStructure=(total:number):SessionStructure=>({warmUp:block(600,'easy','Échauffement facile.'),
  efforts:[block(60,'easy','Montée maîtrisée.',4)],recoveries:[block(120,'very-easy','Récupération très facile.',4)],
  coolDown:block(total-1320,'easy','Retour au calme.')});
const steadyStructure=(total:number):SessionStructure=>({warmUp:block(600,'easy','Échauffement facile.'),
  efforts:[block(total-900,'steady','Passage continu soutenu et maîtrisé.')],coolDown:block(300,'easy','Retour au calme.')});
const variationsStructure=(total:number):SessionStructure=>({warmUp:block(600,'easy','Échauffement facile.'),
  efforts:[block(120,'steady','Variation d’allure modérée et contrôlée.',3)],recoveries:[block(120,'easy','Retour à une allure confortable.',2)],
  coolDown:block(total-1200,'easy','Retour au calme.')});

export function sessionStructureDurationSeconds(structure:SessionStructure):number {
  const value=(entry:SessionBlock|undefined)=>entry?(entry.repetitions??1)*entry.durationSeconds:0;
  return value(structure.warmUp)+structure.efforts.reduce((sum,entry)=>sum+value(entry),0)
    +(structure.recoveries??[]).reduce((sum,entry)=>sum+value(entry),0)+value(structure.coolDown);
}
export function validatePrototypeSession(value:PrototypeSession):void {
  if(!Number.isSafeInteger(value.totalDurationSeconds)||value.totalDurationSeconds<=0||value.durationSeconds!==value.totalDurationSeconds)
    throw new Error('Durée totale de séance V2 invalide.');
  const blocks=[value.structure?.warmUp,...(value.structure?.efforts??[]),...(value.structure?.recoveries??[]),value.structure?.coolDown]
    .filter((entry):entry is SessionBlock=>entry!==undefined);
  if(blocks.some(entry=>!Number.isSafeInteger(entry.durationSeconds)||entry.durationSeconds<=0
    ||entry.repetitions!==undefined&&(!Number.isSafeInteger(entry.repetitions)||entry.repetitions<=0)))
    throw new Error('Bloc de séance V2 invalide.');
  const requiresStructure=value.type==='intervals'||value.type==='hills'||value.type==='steady-run'||value.type==='endurance-variations';
  if(requiresStructure&&!value.structure) throw new Error('Structure requise pour cette séance V2.');
  if(!requiresStructure&&value.structure) throw new Error('Une séance libre ne doit pas contenir de blocs.');
  if(value.structure&&sessionStructureDurationSeconds(value.structure)!==value.totalDurationSeconds)
    throw new Error('La somme des blocs diffère de la durée totale.');
}

/** Prototype isolé : reçoit un repère déjà calculé et ne connaît pas B 2G. */
export function selectPrototypeSessions(input:SessionStrategyInput):PrototypeSession[] {
  if(!Number.isSafeInteger(input.availabilitySeconds)||input.availabilitySeconds<=0
    || input.habitualReferenceSeconds!==null&&(!Number.isSafeInteger(input.habitualReferenceSeconds)||input.habitualReferenceSeconds<=0)
    || [input.targetDistanceMeters,input.documentedDistanceMeters].some(value=>value!==undefined&&(!Number.isFinite(value)||value<=0))
    || input.eventDate!==undefined&&!Number.isFinite(Date.parse(`${input.eventDate}T00:00:00Z`)))
    throw new Error('Entrée de stratégie V2 invalide.');
  const fallback=SESSION_STRATEGY_EXPERIMENT.beginningSeconds;
  const reference=input.habitualReferenceSeconds??fallback;
  // Une référence provisoire décrit déjà des durées réellement courues. Pour
  // l'endurance et les objectifs de durée, la réduire mécaniquement créerait
  // une boucle descendante. Débuter, reprendre, plaisir et vitesse conservent
  // une séance facile plus courte ; aucune séance exigeante n'est débloquée.
  const cautious=input.evidence==='insufficient'&&!['endurance','distance','race'].includes(input.goal);
  const baseDuration=duration(cautious?reference*SESSION_STRATEGY_EXPERIMENT.cautiousRatio:reference,input.availabilitySeconds);
  if(baseDuration<SESSION_STRATEGY_EXPERIMENT.stepSeconds) return [];
  const easyTerrain=input.preferredTerrain??input.observedTerrain??'flat';
  const terrainDeclarations=input.preferredTerrain===undefined?[]:[`Terrain préféré : ${terrainLabels[input.preferredTerrain]}.`];
  const terrainFacts=input.preferredTerrain===undefined&&input.observedTerrain==='rolling'
    ?['Relief positif documenté sur au moins une activité réelle.']:[];
  const terrainChoices=input.preferredTerrain!==undefined?['Aucune progression obligatoire.']
    :input.observedTerrain==='rolling'?['Terrain vallonné retenu sans créer de séance de côtes.']
      :['Terrain plat retenu prudemment faute de préférence ou de relief documenté.'];
  if(input.goal==='begin') return [session('easy-endurance',baseDuration,'easy','flat',[],
    rationale([],['Objectif débuter.'],['Amorçage facile sans séance exigeante.'],['Capacité actuelle non établie.']),
    {optionalInstructions:['Restez à une allure confortable.']})];
  if(input.goal==='return') return [session('recovery',baseDuration,'very-easy','flat',[],
    rationale([],['Objectif reprendre.'],['Reprise aisée sans réutiliser une ancienne capacité.'],['Cause et effets de l’interruption inconnus.']))];

  const objectiveContext:MeasurableObjectiveContext|undefined=input.goal==='distance'||input.goal==='race'?{
    ...(input.targetDistanceMeters===undefined?{}:{targetDistanceMeters:input.targetDistanceMeters}),
    ...(input.documentedDistanceMeters===undefined?{}:{documentedDistanceMeters:input.documentedDistanceMeters}),
    ...(input.eventDate===undefined?{}:{eventDate:input.eventDate}),
  }:undefined;
  const measurableComplete=input.goal==='distance'
    ? input.targetDistanceMeters!==undefined&&input.documentedDistanceMeters!==undefined
    : input.goal==='race'?input.targetDistanceMeters!==undefined&&input.documentedDistanceMeters!==undefined&&input.eventDate!==undefined:true;
  const uncertainties=measurableComplete?[]:['Informations mesurables incomplètes : aucune valeur n’est inventée.'];

  const easy=session('easy-endurance',baseDuration,'easy',easyTerrain,[],
    rationale([...terrainFacts,...(input.habitualReferenceSeconds===null?[]:[`Référence fournie : ${input.habitualReferenceSeconds} s.`])],
      terrainDeclarations,terrainChoices,uncertainties),
    objectiveContext?{objectiveContext}:{});
  const discoveryEligible=input.goal==='speed'&&input.intervalIntroduction?.eligible
    &&(input.experience==='regular'||input.experience==='experienced');
  if(input.goal==='wellbeing'||input.evidence==='insufficient'&&!discoveryEligible) return [easy];
  if(!measurableComplete) return [easy];
  const proposals:PrototypeSession[]=[easy];
  const canStructure=(input.experience==='regular'||input.experience==='experienced')&&input.evidence==='documented';
  const observed=(type:SessionStrategyInput['observedSessionTypes'][number])=>input.observedSessionTypes.includes(type);
  const shorter=duration(reference*SESSION_STRATEGY_EXPERIMENT.cautiousRatio,input.availabilitySeconds);
  const progressed=duration(reference+SESSION_STRATEGY_EXPERIMENT.stepSeconds,input.availabilitySeconds);
  if(input.progressionState==='progression-possible'&&progressed>reference)proposals.push(session('easy-endurance',progressed,'easy',easyTerrain,['duration'],
    rationale([`Référence confirmée : ${input.habitualReferenceSeconds} s.`],[],['Durée légèrement supérieure proposée à partir de la pratique réelle régulière.'])));

  const variationsEligible=['endurance','distance','race'].includes(input.goal)&&canStructure&&shorter>=1800
    &&input.intervalIntroduction?.eligible;
  if(variationsEligible) proposals.push(session('endurance-variations',shorter,'steady','flat',['intensity'],
    rationale([`${input.intervalIntroduction!.activityCount} sorties réelles sur 28 jours, réparties sur ${input.intervalIntroduction!.activeWeeks} semaines.`],
      ['Objectif endurance.'],['Variations d’allure modérées, sans fractionné rapide ni objectif de vitesse.'],['Le seuil de pratique régulière est expérimental.']),
    {structure:variationsStructure(shorter),optionalInstructions:['Gardez chaque variation contrôlée ; revenez à une allure confortable entre elles.']}));

  if((input.goal==='endurance'||input.goal==='distance'||input.goal==='race')&&observed('long-run')) {
    const longer=duration(reference+SESSION_STRATEGY_EXPERIMENT.stepSeconds,input.availabilitySeconds);
    if(longer>reference) proposals.push(session('long-run',longer,'easy','flat',['duration'],
      rationale(['Sorties longues documentées.'],[],['Seule la durée augmente.']),objectiveContext?{objectiveContext}:{}));
  }
  const experiencedEnough=input.experience==='regular'||input.experience==='experienced';
  if(input.goal==='speed'&&experiencedEnough&&shorter>=1800) {
    if(canStructure&&observed('intervals')) proposals.push(session('intervals',shorter,'controlled-hard','flat',['intensity'],
      rationale(['Fractionné documenté.'],[],['Seule l’intensité augmente.']),
      {structure:intervalsStructure(shorter),optionalInstructions:['Effectuez les efforts de façon maîtrisée.']}));
    else if(canStructure&&observed('steady-run')) proposals.push(session('steady-run',shorter,'steady','flat',['intensity'],
      rationale(['Sortie soutenue documentée.'],[],['Seule l’intensité augmente.']),{structure:steadyStructure(shorter)}));
    else if(input.intervalIntroduction?.eligible) proposals.push(session('intervals',shorter,'controlled-hard','flat',['intensity'],
      rationale([`${input.intervalIntroduction.activityCount} sorties réelles sur 28 jours, réparties sur ${input.intervalIntroduction.activeWeeks} semaines.`],
        ['Objectif améliorer la vitesse.'],['Première séance de fractionné accessible ; aucune pratique antérieure de fractionné n’est supposée.'],
        ['Le seuil de six sorties est expérimental.']),
      {structure:discoveryIntervalsStructure(shorter),optionalInstructions:['Restez dynamique et maîtrisé, sans sprint maximal.']}));
  }
  if(input.goal==='race'&&canStructure&&shorter>=1800) {
    if(observed('hills')) proposals.push(session('hills',shorter,'easy','hills',['terrain'],
      rationale(['Séance de côtes documentée.'],[],['Seul le terrain devient plus exigeant.']),
      {structure:hillsStructure(shorter),optionalInstructions:['Gardez les montées maîtrisées.'],objectiveContext}));
    else if(observed('steady-run')) proposals.push(session('steady-run',shorter,'steady','flat',['intensity'],
      rationale(['Sortie soutenue documentée.'],[],['Seule l’intensité augmente.']),{structure:steadyStructure(shorter),objectiveContext}));
  }
  proposals.forEach(validatePrototypeSession);
  return proposals;
}
