import type { CoachProfileValues } from './coach-profile';

/** Contrats en mémoire uniquement. Aucun changement du profil persisté. */
export type CoachGoal =
  | { model: 'legacy'; value: CoachProfileValues['goal'] }
  | { model: 'evolving'; kind: 'begin' | 'wellbeing' | 'endurance' | 'speed' | 'return' }
  | { model: 'evolving'; kind: 'distance'; distanceMeters: number; targetDate?: string }
  | { model: 'evolving'; kind: 'race'; distanceMeters: number; eventDate: string; targetSeconds?: number };
export type StructuredPlanningPreference = 'accepted' | 'declined' | 'unexpressed';
export type StructuredPlanningPolicy = 'undetermined' | 'excluded' | 'requires-explicit-preference';
export type DeclaredExperience = 'beginner' | 'intermediate' | 'experienced' | 'observe';
export interface DeclaredCoachProfile {
  goal: CoachGoal;
  experience?: DeclaredExperience;
  /** Choix révisable, indépendant du mode historique et de l’analyse factuelle. */
  structuredPlanningPreference?: StructuredPlanningPreference;
  availability: CoachProfileValues['availability'];
  preferences: CoachProfileValues['preferences'];
  legacyMode?: CoachProfileValues['accompanimentMode'];
}
export type Measurement =
  | { status: 'absent' | 'invalid' }
  | { status: 'available' | 'partial'; value: number; origin: 'provided' | 'estimated' };
export interface ObservedActivity {
  id: string;
  date: string;
  ageDays: number;
  calendarMonth: number;
  distanceMeters: Measurement;
  durationSeconds: Measurement;
  ascentMeters: Measurement;
  averageHeartRate: Measurement;
}
/** Une sélection future doit exposer ses critères ; aucune fenêtre par défaut. */
export interface EvidenceHorizon {
  kind: 'older' | 'recent' | 'latest';
  sessionIds: string[];
  rationale: string[];
  limitations: string[];
}
export interface ObservedCoachProfile {
  referenceDate: string;
  activities: ObservedActivity[];
  excluded: { id: string; reason: 'invalid-date' | 'future-date' }[];
  rhythm: { activeDates: string[]; gapsDays: number[]; daysSinceLatest: number | null };
  durationRangeSeconds: { min: number; max: number; known: number; total: number } | null;
  horizons: { status: 'undetermined'; reason: string };
  limitations: string[];
}
export type WeatherContext =
  | { status: 'unknown' }
  | { status: 'measured'; measuredAt: string; source: string; temperatureCelsius?: number; humidityPercent?: number; windMetersPerSecond?: number };
/** État des repères, jamais catégorie ou note du coureur. Aucun seuil automatique ici. */
export interface CoachingStrategy {
  readiness: { status: 'undetermined'; reason: string }
    | { status: 'discovery' | 'first-reference-points' | 'evolving-support'; evidenceSessionIds: string[]; rationale: string[]; limitations: string[] };
  intentions: string[];
  claims: { status: 'hypothesis' | 'supported'; text: string; evidenceSessionIds: string[]; limitations: string[] }[];
  missingInformation: string[];
}
export type OptionalSessionFeeling = { effort: 'easy' | 'moderate' | 'hard' | 'very-hard'; comment?: string };

/** Choix durables uniquement ; disponibilités et préférences restent dans coachProfile. */
export interface EvolvingCoachValues {
  goal: Extract<CoachGoal, { model: 'evolving' }>;
  experience?: DeclaredExperience;
  structuredPlanningPreference?: StructuredPlanningPreference;
}
/** configuration:null = suppression explicite ; la révision empêche la résurrection par un ancien onglet. */
export interface EvolvingCoachRecord {
  id: 'local';
  configuration: EvolvingCoachValues | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
