import type { RunningSession } from '../types/session';

/** Contrat indépendant d'IndexedDB et de React. */
export interface SessionRepository {
  list(): Promise<RunningSession[]>;
  save(session: RunningSession): Promise<void>;
}

/** Point d'extension uniquement : sauvegarde et restauration non implémentées. */
export interface BackupService {
  exportData(): Promise<Blob>;
  restoreData(file: Blob): Promise<void>;
}
