import { validateSessionContentV2,type ImmutableSessionContentV2,type SessionBlockV2 } from './persistence-foundations-v2';

type SportingBlockV2=Pick<SessionBlockV2,'durationSeconds'|'intensity'> & {readonly repetitions:number};
export interface SportingContentV2 {
  readonly type:ImmutableSessionContentV2['type'];
  readonly totalDurationSeconds:number;
  readonly intensity:ImmutableSessionContentV2['intensity'];
  readonly terrain:ImmutableSessionContentV2['terrain'];
  readonly structure:{readonly kind:'free'}|{
    readonly kind:'structured';readonly warmUp:SportingBlockV2|null;
    readonly efforts:readonly SportingBlockV2[];readonly recoveries:readonly SportingBlockV2[];
    readonly coolDown:SportingBlockV2|null;
  };
}
export type SportingIdentityV2=
  |{readonly status:'known';readonly content:SportingContentV2;readonly key:string}
  |{readonly status:'incomparable';readonly reason:'unrecognized-fields'|'invalid-sporting-content'};
export type SportingDifferenceV2='type'|'totalDurationSeconds'|'intensity'|'terrain'|'structure';
export type SportingComparisonV2=
  |{readonly relation:'identical'|'same-family'|'different';readonly differences:readonly SportingDifferenceV2[]}
  |{readonly relation:'incomparable';readonly reasons:readonly ('unrecognized-fields'|'invalid-sporting-content')[]};
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'
  &&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const contentFields=new Set(['type','totalDurationSeconds','intensity','terrain','structure','shortSummary','optionalInstructions',
  // Métadonnées connues des prototypes ; aucun objet occurrence n'est implicitement déballé.
  'id','durationSeconds','objectiveContext','changedDimensions','rationale','optional']);
const blockFields=new Set(['repetitions','durationSeconds','intensity','instruction']);
const structureFields=new Set(['warmUp','efforts','recoveries','coolDown']);
class UnrecognizedFields extends Error {}
function knownFields(value:Record<string,unknown>,allowed:Set<string>){
  if(Object.keys(value).some(key=>!allowed.has(key)))throw new UnrecognizedFields();
}
function sportingBlock(value:unknown):Record<string,unknown>{
  if(!record(value))throw new Error('Bloc non reconnu.');
  knownFields(value,blockFields);
  // Le validateur historique exige une consigne ; seul ce texte est neutralisé.
  return {...value,instruction:'Sport'};
}
function blocks(value:unknown):Record<string,unknown>[] {
  if(!Array.isArray(value))throw new Error('Liste de blocs non reconnue.');
  // Array.from examine aussi les trous : une case absente n'est pas un bloc vide.
  return Array.from(value,sportingBlock);
}
function sportingStructure(value:unknown):Record<string,unknown>{
  if(!record(value))throw new Error('Structure non reconnue.');
  knownFields(value,structureFields);
  return {efforts:blocks(value.efforts),
    ...(value.warmUp===undefined?{}:{warmUp:sportingBlock(value.warmUp)}),
    ...(value.recoveries===undefined?{}:{recoveries:blocks(value.recoveries)}),
    ...(value.coolDown===undefined?{}:{coolDown:sportingBlock(value.coolDown)})};
}
const normalizeBlock=(value:SessionBlockV2):SportingBlockV2=>({repetitions:value.repetitions??1,
  durationSeconds:value.durationSeconds,intensity:value.intensity});

/** Identité de prescription calculée uniquement. Ne remplace aucune empreinte
 * persistée, ne lit aucun bilan et n'interprète aucun texte libre.
 * Entrée : contenu d'occurrence ou prototype (éventuellement historique/incomplet).
 */
export function sportingContentIdentityV2(value:unknown):SportingIdentityV2 {
  try {
    if(!record(value))throw new Error('Contenu non reconnu.');
    knownFields(value,contentFields);
    if(value.durationSeconds!==undefined&&value.durationSeconds!==value.totalDurationSeconds)
      throw new Error('Durées contradictoires.');
    const content={type:value.type,totalDurationSeconds:value.totalDurationSeconds,intensity:value.intensity,terrain:value.terrain,
      shortSummary:'Sport',...(value.structure===undefined?{}:{structure:sportingStructure(value.structure)})};
    // Réutilise les règles de types, nombres, structures requises/interdites et somme des blocs.
    validateSessionContentV2(content);
    const structure=content.structure;
    const normalized:SportingContentV2={type:content.type,totalDurationSeconds:content.totalDurationSeconds,
      intensity:content.intensity,terrain:content.terrain,structure:structure?{kind:'structured',
        warmUp:structure.warmUp?normalizeBlock(structure.warmUp):null,
        efforts:structure.efforts.map(normalizeBlock),recoveries:(structure.recoveries??[]).map(normalizeBlock),
        coolDown:structure.coolDown?normalizeBlock(structure.coolDown):null}:{kind:'free'}};
    return {status:'known',content:normalized,key:`sporting-content:v1:${JSON.stringify(normalized)}`};
  }catch(error){
    return {status:'incomparable',reason:error instanceof UnrecognizedFields?'unrecognized-fields':'invalid-sporting-content'};
  }
}

/** Relation symétrique. La famille est strictement le type reconnu, pas une
 * équivalence de difficulté. Aucune fusion/réorganisation des blocs n'est inférée. */
export function compareSportingContentsV2(left:unknown,right:unknown):SportingComparisonV2 {
  const a=sportingContentIdentityV2(left),b=sportingContentIdentityV2(right);
  if(a.status==='incomparable'||b.status==='incomparable')return {relation:'incomparable',
    reasons:[...new Set([a,b].flatMap(value=>value.status==='incomparable'?[value.reason]:[]))].sort()};
  const fields:SportingDifferenceV2[]=['type','totalDurationSeconds','intensity','terrain','structure'];
  const differences=fields.filter(field=>JSON.stringify(a.content[field])!==JSON.stringify(b.content[field]));
  return {relation:a.key===b.key?'identical':a.content.type===b.content.type?'same-family':'different',differences};
}
