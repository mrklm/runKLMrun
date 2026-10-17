import type { OptionalSessionFeeling } from '../types/evolving-coach';
import { sameFeeling, validateFeeling } from '../core/analysis/session-feeling';
import { DATABASE_NAME, openDatabase } from './database-connection';
import { storageChanges } from './changes';
export class FeelingConflictError extends Error {
  constructor() { super('Cette annotation a changé dans un autre onglet. Rechargez-la avant de réessayer.'); }
}
/** Modifie seulement l’annotation du résumé courant ; aucun accès au magasin des détails. */
export function createFeelingRepository(name = DATABASE_NAME) {
  return {
    async get(id: string) {
      const db = await openDatabase(name);
      try { return await db.get('sessions', id); } finally { db.close(); }
    },
    async save(id: string, value: OptionalSessionFeeling | undefined, expected: OptionalSessionFeeling | undefined) {
      if (value !== undefined) validateFeeling(value);
      const db = await openDatabase(name), tx = db.transaction('sessions', 'readwrite');
      try {
        const current = await tx.store.get(id);
        if (!current) throw new Error('Cette sortie n’est plus disponible.');
        if (!sameFeeling(current.feeling, expected)) throw new FeelingConflictError();
        const changed = !sameFeeling(current.feeling, value);
        if (changed) {
          if (value === undefined) delete current.feeling;
          else current.feeling = structuredClone(value);
          await tx.store.put(current);
        }
        await tx.done;
        if (changed) storageChanges.committed(name, ['feelings']);
        return current;
      } catch (error) {
        try { tx.abort(); } catch { /* Transaction terminée. */ }
        await tx.done.catch(() => undefined); throw error;
      } finally { db.close(); }
    },
  };
}
