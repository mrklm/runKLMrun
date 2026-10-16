import type { CoachGoal, DeclaredExperience, EvidenceHorizon, ObservedCoachProfile } from './evolving-coach';
import type { Terrain } from './coach-profile';

/** Paramètres à valider avant intégration produit. Aucun réglage implicite du moteur. */
export interface ProposalPolicy {
  /** Horizon court, entre 1 et 14 jours, à partir du lendemain de la référence. */
  horizonDays: number;
  /** Plafond d'ancienneté : les données au-delà restent uniquement historiques. */
  evidenceAgeLimitDays: number;
  rhythmIntervals: number;
  recentCycles: number;
  staleCycles: number;
  /** Limite éditoriale, pas une durée physiologique minimale. */
  minimumSuggestionSeconds: number;
  /** Facultatif : sans durée de découverte approuvée, aucune durée n'est inventée. */
  discoverySeconds?: number;
  /** Choix éditoriaux obligatoires, exposés sans prétention physiologique. */
  duration: {
    minimumReferences: number;
    freshCycles: number;
    maximumDurationSpread: number;
    maximumGapSpread: number;
    supportedFraction: number;
    cautiousFraction: number;
    cautiousMaximumSeconds: number;
  };
}
export interface ProposalEvidence {
  observed: ObservedCoachProfile;
  horizons: EvidenceHorizon[];
  /** Rythme descriptif, y compris hors du plafond d'ancienneté. */
  historicalMedianGapDays: number | null;
  /** Rythme actuel uniquement ; null si les références ont vieilli. */
  medianGapDays: number | null;
  latestAgeDays: number | null;
  durationRangeSeconds: { min: number; max: number } | null;
  gapRangeDays: { min: number; max: number } | null;
  medianDurationSeconds: number | null;
  knownDurations: number;
  recentWindowDays: number | null;
  staleAfterDays: number | null;
  possibleGap: boolean;
  declaredExperience?: DeclaredExperience;
  criteria: string[];
}
export interface SessionSuggestion {
  date: string;
  kind: 'discovery' | 'easy' | 'endurance';
  intention: string;
  durationSeconds: number;
  durationBasis: {
    observedMedianSeconds: number | null;
    proposedMaximumSeconds: number;
    availableMaximumSeconds: number | null;
    /** Trace transitoire de calcul, jamais copiée dans le planning ou les sauvegardes. */
    diagnostic?: {
      freshnessLimitDays?: number | null;
      editorialMinimumApplied: boolean;
      coefficient: number | null;
      coefficientReasons: string[];
      durationSpread: number | null;
      gapSpread: number | null;
      afterCoefficientSeconds: number | null;
      prudentCapSeconds: number | null;
      afterCapsSeconds: number;
    };
    assessment: 'discovery' | 'supported' | 'cautious';
    reasons: string[];
  };
  intensity: { kind: 'easy'; description: string };
  optional: true;
  terrainPreference?: Terrain;
  recommendedTerrain: import('../core/coach/proposal-presentation').RecommendedTerrain;
  reasons: string[];
  referenceSessionIds: string[];
  limitations: string[];
}
/** Résultat transitoire, sans engagement, identifiant persisté ou modèle de planning. */
export interface CoachProposal {
  /** Trace éphémère, y compris sans suggestion ; jamais persistée. */
  diagnostic?: {
    availability?: import('./coach-profile').CoachProfileValues['availability'];
    durationBasis?: Omit<SessionSuggestion['durationBasis'], 'availableMaximumSeconds' | 'diagnostic'> & {
      diagnostic: Omit<NonNullable<SessionSuggestion['durationBasis']['diagnostic']>, 'afterCapsSeconds'>;
    };
    freshnessLimitDays?: number | null;
    roundedBeforeAvailability?: number;
    attempts: { date: string; availableMaximumSeconds: number | null; afterCapsSeconds: number; roundedSeconds: number }[];
  };
  status: 'not-enabled' | 'possible' | 'cautious' | 'insufficient-data' | 'unavailable';
  goal: CoachGoal | null;
  horizon: { from: string; to: string };
  suggestions: SessionSuggestion[];
  reasons: string[];
  limitations: string[];
  constraints: string[];
  evidence: ProposalEvidence;
  policy: ProposalPolicy;
}
