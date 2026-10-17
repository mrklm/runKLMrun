/** Prototype 2C uniquement. Aucune de ces valeurs n'est une norme scientifique. */
export interface HabitualReferenceParameters {
  confirmationCount: number;
  meaningfulDifferenceSeconds: number;
  expiryDays: number;
  displayStepSeconds: number;
}

export const EXPERIMENTAL_REFERENCE_PARAMETERS: HabitualReferenceParameters = Object.freeze({
  confirmationCount: 4,
  meaningfulDifferenceSeconds: 300,
  expiryDays: 42,
  displayStepSeconds: 300,
});

export interface ReferenceObservation {
  id: string;
  date: string;
  durationSeconds: number;
  /** Provenance du prototype. `independent-unknown` décrit une course réelle
   * sans suggestion ce jour-là ; il ne lui invente aucun type sportif. */
  role: 'habitual' | 'easy-suggestion' | 'independent-unknown' | 'suggestion-linked' | 'ambiguous';
}

export interface HabitualReferenceSnapshot {
  status: 'insufficient' | 'stable' | 'revised' | 'expired';
  referenceSeconds: number | null;
  suggestionSeconds: number | null;
  sourceIds: string[];
  lastHabitualDate: string | null;
  revisions: { date: string; fromSeconds: number; toSeconds: number; sourceIds: string[] }[];
}

const DAY = 86_400_000;
const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / DAY;
const median = (values: readonly number[]) => {
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : sorted[middle-1]/2+sorted[middle]/2;
};

function validate(parameters: HabitualReferenceParameters, observations: readonly ReferenceObservation[], referenceDate: string) {
  if (!Number.isFinite(day(referenceDate))
    || !Number.isSafeInteger(parameters.confirmationCount) || parameters.confirmationCount < 2
    || !Number.isSafeInteger(parameters.meaningfulDifferenceSeconds) || parameters.meaningfulDifferenceSeconds < 1
    || !Number.isSafeInteger(parameters.expiryDays) || parameters.expiryDays < 1
    || !Number.isSafeInteger(parameters.displayStepSeconds) || parameters.displayStepSeconds < 1
    || observations.some(o => !o.id || !Number.isFinite(day(o.date)) || !Number.isSafeInteger(o.durationSeconds) || o.durationSeconds <= 0)) {
    throw new Error('Paramètres ou observations du prototype V2 invalides.');
  }
  if (new Set(observations.map(o=>o.id)).size !== observations.length) throw new Error('Identifiants d’observation dupliqués.');
}

/**
 * Référence par épisode avec hystérésis. Les séances faciles restent observées
 * mais ne peuvent ni créer ni réviser la référence habituelle. Une révision
 * exige une série de preuves habituelles allant toutes dans le même sens.
 */
export function habitualReferenceV2(
  observations: readonly ReferenceObservation[],
  referenceDate: string,
  parameters: HabitualReferenceParameters = EXPERIMENTAL_REFERENCE_PARAMETERS,
): HabitualReferenceSnapshot {
  validate(parameters,observations,referenceDate);
  const eligible=observations.filter(o=>o.date<=referenceDate
    && (o.role==='habitual' || o.role==='independent-unknown'))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  // Un silence supérieur à la borne ouvre un nouvel épisode. Une seule sortie
  // de reprise ne réactive donc pas automatiquement une ancienne référence.
  const episode:ReferenceObservation[]=[];
  for(const observation of eligible) {
    if(episode.length && day(observation.date)-day(episode.at(-1)!.date)>parameters.expiryDays) episode.length=0;
    episode.push(observation);
  }
  const lastHabitualDate=eligible.at(-1)?.date??null;
  if(lastHabitualDate!==null && day(referenceDate)-day(lastHabitualDate)>parameters.expiryDays) return {status:'expired',referenceSeconds:null,suggestionSeconds:null,sourceIds:[],lastHabitualDate,revisions:[]};
  if(episode.length<parameters.confirmationCount) return {status:'insufficient',referenceSeconds:null,suggestionSeconds:null,sourceIds:[],lastHabitualDate,revisions:[]};

  const seed=episode.slice(0,parameters.confirmationCount);
  let reference=median(seed.map(o=>o.durationSeconds)),sourceIds=seed.map(o=>o.id);
  const revisions:HabitualReferenceSnapshot['revisions']=[];
  let direction: -1|0|1=0,candidates:ReferenceObservation[]=[];
  for(const observation of episode.slice(parameters.confirmationCount)) {
    const difference=observation.durationSeconds-reference;
    const nextDirection: -1|0|1=difference>=parameters.meaningfulDifferenceSeconds?1:difference<=-parameters.meaningfulDifferenceSeconds?-1:0;
    if(nextDirection===0) { direction=0;candidates=[];continue; }
    if(nextDirection!==direction) { direction=nextDirection;candidates=[]; }
    candidates.push(observation);
    if(candidates.length===parameters.confirmationCount) {
      const fromSeconds=reference;
      reference=median(candidates.map(o=>o.durationSeconds));sourceIds=candidates.map(o=>o.id);
      revisions.push({date:observation.date,fromSeconds,toSeconds:reference,sourceIds:[...sourceIds]});
      direction=0;candidates=[];
    }
  }
  return {status:revisions.length?'revised':'stable',referenceSeconds:reference,
    suggestionSeconds:Math.floor(reference/parameters.displayStepSeconds)*parameters.displayStepSeconds,
    sourceIds,lastHabitualDate,revisions};
}
