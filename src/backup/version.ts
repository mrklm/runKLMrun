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
/** Format 9 uniquement si un effort perçu 0 à 10 existe : les anciennes versions rejetteraient `rpe`. */
export function requiresBackupV9(data: BackupSourceData): boolean {
  return data.sessions.some(session => session.feeling?.rpe !== undefined);
}
/** Format 10 dès que la fiche du profil accompagne la sauvegarde. */
export function requiresBackupV10(data: BackupSourceData): boolean {
  return data.runnerProfile !== undefined;
}
export function backupFormatVersion(data: BackupSourceData): BackupPayload['formatVersion'] {
  return requiresBackupV10(data) ? 10 : requiresBackupV9(data) ? 9 : requiresBackupV8(data) ? 8 : requiresBackupV7(data) ? 7 : data.coachSuggestionsV2 !== undefined ? 6 : data.coachSuggestions !== undefined ? 5
    : data.coachPlanning !== undefined ? 4 : data.evolvingCoach !== undefined ? 3
      : data.shoes !== undefined || data.shoeAssignments !== undefined || data.shoeSettings !== undefined ? 2 : 1;
}
