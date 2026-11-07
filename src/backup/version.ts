import type { BackupPayload, BackupSourceData } from '../types/backup';

/** Les anciens lecteurs rejettent ces propriétés et le nouveau type recovery. */
export function requiresBackupV7(data: BackupSourceData): boolean {
  return data.sessions.some(session => session.trainingDescription !== undefined || session.trainingType === 'recovery')
    || (data.coachSuggestionsV2 ?? []).some(occurrence => occurrence.realization !== undefined || occurrence.realizationProposal !== undefined);
}
/** Format 8 uniquement si une exclusion cardiaque existe : les sauvegardes sans elle restent lisibles par les versions précédentes. */
export function requiresBackupV8(data: BackupSourceData): boolean {
  return data.sessions.some(session => session.heartRateIgnored !== undefined);
}
export function backupFormatVersion(data: BackupSourceData): BackupPayload['formatVersion'] {
  return requiresBackupV8(data) ? 8 : requiresBackupV7(data) ? 7 : data.coachSuggestionsV2 !== undefined ? 6 : data.coachSuggestions !== undefined ? 5
    : data.coachPlanning !== undefined ? 4 : data.evolvingCoach !== undefined ? 3
      : data.shoes !== undefined || data.shoeAssignments !== undefined || data.shoeSettings !== undefined ? 2 : 1;
}
