import type { RestorePreview, RestoreReport } from '../types/backup';
import type { RunnerProfile } from '../types/runner-profile';
import type { BackupService } from './contracts';
import { BackupError } from '../backup/validation';
import { readBackupSnapshot } from './backup';
import { createRunnerProfile, deleteRunnerProfileDatabase, markRunnerProfileDeleting, profileRevision } from './profile-registry';

export const NEW_PROFILE_NAME_LIMIT = 200;
/** Pseudonyme proposé : celui de la fiche sauvegardée, sinon un nom générique. */
export const proposedProfileName = (preview: RestorePreview) => preview.backup.data.runnerProfile?.displayName ?? 'Profil importé';
/** Le choix de destination n'est proposé que si la sauvegarde ne vient pas, à l'évidence, du profil actif. */
export const backupNeedsDestinationChoice = (preview: RestorePreview, activeName: string) =>
  preview.backup.data.runnerProfile?.displayName !== activeName;

/** Crée un profil puis y restaure toute la sauvegarde (remplacement d'une base vide).
 * En cas d'échec, le profil créé est supprimé par la procédure durable existante,
 * qui reprend d'elle-même au prochain démarrage si elle est interrompue. Le profil actif n'est jamais touché. */
export async function restoreIntoNewProfile(input: {
  preview: RestorePreview; displayName: string; fallbackProfileId: string; serviceFor: (database: string) => BackupService;
}): Promise<{ profile: RunnerProfile; report: RestoreReport }> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new BackupError('Le pseudonyme du nouveau profil est obligatoire.');
  if (displayName.length > NEW_PROFILE_NAME_LIMIT) throw new BackupError(`Le pseudonyme ne doit pas dépasser ${NEW_PROFILE_NAME_LIMIT} caractères.`);
  const { displayName: _ignored, ...card } = input.preview.backup.data.runnerProfile ?? {};
  const profile = await createRunnerProfile({ ...card, displayName });
  try {
    const local = await readBackupSnapshot(profile.databaseName);
    const report = await input.serviceFor(profile.databaseName).restore({ backup: input.preview.backup, local }, { mode: 'replace', profile: 'restore' });
    return { profile, report };
  } catch (error) {
    try {
      const marked = await markRunnerProfileDeleting(profile.id, input.fallbackProfileId, profileRevision(profile));
      await deleteRunnerProfileDatabase(marked.id, marked.deletion!.operationId);
    } catch { /* Marqueur durable : la suppression reprendra automatiquement. */ }
    throw error;
  }
}
