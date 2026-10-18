import type { BackupExport, RestorePreview, RestoreOptions, RestoreReport } from '../types/backup';
import type { CoachProfile, CoachProfileValues } from '../types/coach-profile';
import type { RunningSession, SessionDetails } from '../types/session';

/** Contrat indépendant d'IndexedDB et de React. */
export interface SessionRepository {
  /** Regroupe les invalidations, sans regrouper les transactions. */
  beginImportBatch?(): () => void;
  addImported(session: RunningSession, details?: SessionDetails): Promise<boolean>;
  getDetails(id: string): Promise<SessionDetails | undefined>;
  list(): Promise<RunningSession[]>;
  save(session: RunningSession): Promise<void>;
  remove?(id:string):Promise<boolean>;
}

/** Sauvegarde versionnée, prévisualisation sans écriture et restauration atomique. */
export interface BackupService {
  exportData(): Promise<BackupExport>;
  preview(file: Blob, signal?: AbortSignal): Promise<RestorePreview>;
  restore(preview: RestorePreview, options: RestoreOptions): Promise<RestoreReport>;
}

/** Profil unique ; la révision évite d'écraser les modifications d'un autre onglet. */
export interface CoachProfileRepository {
  get(): Promise<CoachProfile | undefined>;
  save(values: CoachProfileValues, expectedRevision: number | undefined): Promise<CoachProfile>;
}

/** Absence initiale : undefined ; suppression : configuration null avec révision conservée. */
export interface EvolvingCoachRepository {
  get(): Promise<import('../types/evolving-coach').EvolvingCoachRecord | undefined>;
  save(values: import('../types/evolving-coach').EvolvingCoachValues, expectedRevision: number | undefined): Promise<import('../types/evolving-coach').EvolvingCoachRecord>;
  remove(expectedRevision: number | undefined): Promise<import('../types/evolving-coach').EvolvingCoachRecord>;
}

export interface CoachPlanningRepository {
  get(): Promise<import('../types/coach-planning').CoachPlanning | undefined>;
  apply(action: import('../types/coach-planning').PlanningAction, expectedRevision: number | undefined): Promise<import('../types/coach-planning').CoachPlanning>;
}
