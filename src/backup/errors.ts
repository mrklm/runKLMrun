export class BackupError extends Error {}
/** Seulement les erreurs d’allocation identifiables ; un crash du processus reste indéterminé. */
export function memoryError(error: unknown): BackupError | undefined {
  if (error instanceof Error && !(error instanceof SyntaxError) && /out of memory|allocation failed|invalid string length|invalid array buffer length|not enough memory/i.test(error.message)) {
    return new BackupError('Mémoire insuffisante pendant la sauvegarde. Fermez les autres applications ou utilisez un appareil disposant de davantage de mémoire. Aucune restauration partielle n’a été conservée.');
  }
  return undefined;
}
