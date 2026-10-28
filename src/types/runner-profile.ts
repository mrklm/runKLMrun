/** Identité locale du coureur. Elle ne remplace pas le profil de planification du Coach. */
export type RunnerProfileStatus = 'active' | 'deleting';
export interface RunnerProfileDeletion { operationId: string; destinationProfileId: string; startedAt: string; }
export interface RunnerProfile {
  id: string;
  displayName: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  databaseName: string;
  createdAt: string;
  updatedAt: string;
  revision?: number;
  status?: RunnerProfileStatus;
  deletion?: RunnerProfileDeletion;
}

export interface ProfileRegistryState {
  profiles: RunnerProfile[];
  lastUsedProfileId?: string;
  migration: 'pending' | 'copying' | 'complete';
}
