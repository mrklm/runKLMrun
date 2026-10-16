import type { CoachGoal, DeclaredExperience } from '../../types/evolving-coach';
import type { Terrain } from '../../types/coach-profile';
import type { RunningSession } from '../../types/session';
import type { SessionSuggestion } from '../../types/coach-proposal';

/** Arrondi métier des nouvelles suggestions, jamais des activités ou saisies personnelles. */
export function roundProposalDuration(maximum: number, available = maximum): number {
  if (![maximum,available].every(v=>Number.isFinite(v) && v >= 0)) throw new Error('Plafond de proposition invalide.');
  return Math.floor(Math.min(maximum,available) / 300) * 300;
}
/** Sans arrondi supplémentaire : le moteur fournit déjà des minutes entières. */
export const proposalDurationLabel = (seconds: number) => `${(seconds/60).toLocaleString('fr-FR')} min`;
export function proposalCopy(goal: CoachGoal | null) {
  const kind=goal?.model==='evolving'?goal.kind:undefined;
  const objectives={begin:'Découvrir la course à pied.',return:'Retrouver vos repères de course.',endurance:'Entretenir votre endurance.',speed:'Entretenir votre rythme avant de travailler la vitesse.',distance:'Entretenir votre endurance pour préparer votre distance.',race:'Entretenir votre endurance pour préparer votre course.',wellbeing:'Courir pour le plaisir.'};
  return { objective:kind?objectives[kind]:'Entretenir votre rythme.', instruction:'Effectuez cette sortie à un rythme confortable, sans chercher à accélérer.' };
}
export interface RecommendedTerrain {
  surface: Terrain;
  relief: 'flat-or-gentle' | 'free';
  label: string;
  reasons: string[];
}
/** Seuls les sports explicitement documentés renseignent une surface, jamais un relief. */
export function recommendTerrain(goal: CoachGoal, experience: DeclaredExperience | undefined, kind: SessionSuggestion['kind'], preference: Terrain | undefined, recent: readonly RunningSession[]): RecommendedTerrain {
  const sports:Record<string,Terrain>={ROAD_RUNNING:'road',TRAIL_RUNNING:'trail',TREADMILL_RUNNING:'treadmill'};
  const surfaces=recent.map(s=>s.sport && Object.hasOwn(sports,s.sport) ? sports[s.sport]:undefined);
  const observed=surfaces.length && surfaces[0] && surfaces.every(s=>s===surfaces[0]) ? surfaces[0]:undefined;
  const surface=preference && preference!=='none'?preference:observed??'none';
  const introductory=kind==='discovery' || experience==='beginner' || (goal.model==='evolving' && (goal.kind==='begin'||goal.kind==='return'));
  const relief=introductory?'flat-or-gentle':'free';
  const surfaceLabel=surface==='trail'?'Chemins':surface==='road'?'Route':surface==='treadmill'?'Tapis':'';
  const label=introductory ? `${surfaceLabel ? `${surfaceLabel} · `:''}Plat ou peu vallonné` : surfaceLabel?`${surfaceLabel} · Relief libre`:'Terrain libre';
  return {surface,relief,label,reasons:[
    preference && preference!=='none'?'Surface choisie selon votre préférence enregistrée.':observed?'Surface renseignée de façon concordante dans les séances récentes retenues.':'Aucune surface imposée : les données ne permettent pas de connaître vos habitudes de terrain.',
    introductory?'Pour cette découverte ou reprise, privilégiez un terrain plat ou peu vallonné.':'Cette sortie facile ne nécessite pas de relief particulier.',
    'La surface ne renseigne pas le relief. Aucun relief passé ni itinéraire n’est déduit du dénivelé ou du nom des séances.',
  ]};
}
