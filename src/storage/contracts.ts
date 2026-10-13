import type { BackupExport, RestorePreview, RestoreOptions, RestoreReport } from '../types/backup';
import type { CoachProfile, CoachProfileValues } from '../types/coach-profile';
import type { RunningSession, SessionDetails } from '../types/session';

/** Contrat indépendant d'IndexedDB et de React. */
export interface SessionRepository {
  addImported(session: RunningSession, details?: SessionDetails): Promise<boolean>;
  getDetails(id: string): Promise<SessionDetails | undefined>;
  list(): Promise<RunningSession[]>;
  save(session: RunningSession): Promise<void>;
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
