import type { RunningSession, SessionDetails } from '../types/session';

/** Contrat indépendant d'IndexedDB et de React. */
export interface SessionRepository {
  addImported(session: RunningSession, details: SessionDetails): Promise<boolean>;
  getDetails(id: string): Promise<SessionDetails | undefined>;
  list(): Promise<RunningSession[]>;
  save(session: RunningSession): Promise<void>;
}

/** Point d'extension uniquement : sauvegarde et restauration non implémentées. */
export interface BackupService {
  exportData(): Promise<Blob>;
  restoreData(file: Blob): Promise<void>;
}
