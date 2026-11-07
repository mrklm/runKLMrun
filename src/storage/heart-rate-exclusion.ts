import { openDatabase } from './database-connection';
import { storageChanges } from './changes';

export class HeartRateExclusionConflictError extends Error {
  constructor() { super('Cette activité a changé dans un autre onglet. Vérifiez son état avant de réessayer.'); }
}

/** Modifie seulement l'indicateur du résumé : aucune mesure ni aucun détail n'est lu, modifié ou supprimé.
 * Le nom de base est obligatoire : jamais de base par défaut. */
export function createHeartRateExclusionRepository(name: string) {
  return {
    async save(id: string, ignored: boolean, expected: boolean) {
      const db = await openDatabase(name), tx = db.transaction('sessions', 'readwrite');
      try {
        const current = await tx.store.get(id);
        if (!current) throw new Error('Cette activité n’est plus disponible.');
        if ((current.heartRateIgnored === true) !== expected) throw new HeartRateExclusionConflictError();
        const changed = expected !== ignored;
        if (changed) {
          if (ignored) current.heartRateIgnored = true;
          else delete current.heartRateIgnored;
          await tx.store.put(current);
        }
        await tx.done;
        if (changed) storageChanges.committed(name, ['sessions']);
        return current;
      } catch (error) {
        try { tx.abort(); } catch { /* Transaction terminée. */ }
        await tx.done.catch(() => undefined); throw error;
      } finally { db.close(); }
    },
  };
}
