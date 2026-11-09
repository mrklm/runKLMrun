/** Identité locale du coureur. Elle ne remplace pas le profil de planification du Coach. */
/** Coefficients de la formule de Banister ; « unspecified » : moyenne des deux courbes. */
export type LoadCoefficients = 'female' | 'male' | 'unspecified';
export type RunnerProfileStatus = 'active' | 'deleting';
export interface RunnerProfileDeletion { operationId: string; destinationProfileId: string; startedAt: string; }
export interface RunnerProfile {
  id: string;
  displayName: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  /** Réglages déclarés, facultatifs, utilisés seulement pour estimer la charge cardiaque. */
  restingHeartRate?: number;
  maxHeartRate?: number;
  loadCoefficients?: LoadCoefficients;
  databaseName: string;
  createdAt: string;
  updatedAt: string;
  revision?: number;
  status?: RunnerProfileStatus;
  deletion?: RunnerProfileDeletion;
}

/** Informations de la fiche reprises dans une sauvegarde ; le pseudonyme n'est jamais restauré. */
export type RunnerProfileValues = Pick<RunnerProfile, 'displayName' | 'birthDate' | 'heightCm' | 'weightKg' | 'restingHeartRate' | 'maxHeartRate' | 'loadCoefficients'>;
export const RUNNER_PROFILE_VALUE_KEYS = ['displayName', 'birthDate', 'heightCm', 'weightKg', 'restingHeartRate', 'maxHeartRate', 'loadCoefficients'] as const;
export interface ProfileRegistryState {
  profiles: RunnerProfile[];
  lastUsedProfileId?: string;
  migration: 'pending' | 'copying' | 'complete';
}
