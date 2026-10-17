import type { Terrain } from './coach-profile';
/** Projection minimale d’une suggestion effectivement présentée, sans diagnostic moteur. */
export interface PresentedSuggestion {
  date: string;
  kind: 'discovery' | 'easy' | 'endurance';
  durationSeconds: number;
  terrain?: { surface: Terrain; relief: 'flat-or-gentle' | 'free' };
}
export interface StoredSuggestion extends PresentedSuggestion {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  /** Premier jour civil où l’enregistrement est expiré. */
  expiresOn: string;
  state: 'current' | 'superseded';
  activityId?: string;
}
export type SuggestionFollowUp = 'current' | 'past-unmatched' | 'associated' | 'superseded' | 'expired';
