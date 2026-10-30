import type { EvolvingCoachRecord } from './evolving-coach';
import type { Shoe, ShoeAssignment, ShoeSettings } from './shoe';
import type { CoachProfile } from './coach-profile';
import type { RunningSession, SessionDetails } from './session';

export interface BackupData {
  coachSuggestionsV2?: import('../core/coach/persistence-foundations-v2').PersistableOccurrenceV2[];
  coachSuggestions?: import('./coach-suggestion').StoredSuggestion[];
  coachPlanning?: import('./coach-planning').CoachPlanning;
  evolvingCoach?: EvolvingCoachRecord;
  shoes?: Shoe[];
  shoeSettings?: ShoeSettings;
  shoeAssignments?: ShoeAssignment[];
  sessions: RunningSession[];
  details: SessionDetails[];
  coachProfile: CoachProfile | null;
}
/** Certaines sauvegardes peuvent contenir un résumé sans date exploitable.
 * La date absente est représentée par une chaîne vide uniquement après vérification.
 */
export interface BackupSourceData extends Omit<BackupData, 'sessions'> {
  sessions: (Omit<RunningSession, 'date'> & { date?: string })[];
}
export interface RestoreRetention {
  recentDetails: number;
  ignoredDetails: number;
  uncertainDetails: number;
  uncertainSessions: number;
}
export interface BackupPayload {
  format: 'runKLMrun-backup';
  formatVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  exportedAt: string;
  appVersion: string;
  data: BackupSourceData;
}
export interface BackupDocument extends BackupPayload {
  integrity: { algorithm: 'SHA-256'; digest: string };
}
export interface RestoreOptions {
  mode: 'replace' | 'merge';
  /** En fusion, keep est le choix initial, même sans profil local. */
  profile: 'keep' | 'restore';
}
export interface RestoreReport {
  shoesAdded: number;
  assignmentsAdded: number;
  retention: RestoreRetention;
  added: number;
  retained: number;
  conflicts: number;
  detailsAdded: number;
  profile: 'kept' | 'restored' | 'removed';
  warnings: string[];
}
export interface RestorePreview {
  backup: BackupDocument;
  /** Instantané de comparaison : toute modification locale impose une nouvelle prévisualisation. */
  local: BackupData;
  mergeReport?: RestoreReport;
}

export interface BackupExport { file: Blob; jsonBytes: number }
