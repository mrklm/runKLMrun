/** Planning personnel, indépendant des activités importées. */
export interface PlannedSession {
  id: string;
  proposalKey: string;
  date: string;
  durationSeconds: number;
  kind: 'discovery' | 'easy' | 'endurance';
  intention: string;
  origin: 'coach';
  status: 'planned' | 'cancelled';
  note: string;
  createdAt: string;
  updatedAt: string;
  original: { date: string; durationSeconds: number; explanation: string; policyVersion: 1 };
}
export interface CoachPlanning {
  id: 'local';
  revision: number;
  createdAt: string;
  updatedAt: string;
  sessions: PlannedSession[];
  /** Empreintes de contexte refusées ; ne sont pas des séances manquées. */
  dismissed: string[];
}
export type PlanningAction =
  | { type: 'accept'; session: PlannedSession; coachRevision: number; profileRevision: number | undefined }
  | { type: 'dismiss'; key: string; coachRevision: number; profileRevision: number | undefined }
  | { type: 'edit'; id: string; date: string; durationSeconds: number; note: string }
  | { type: 'cancel'; id: string };
