import { isTcxDuplicate } from '../importers/session-duplicate';
import { DATABASE_NAME, openDatabase } from './database-connection';
export { DATABASE_NAME } from './database-connection';
import type { SessionRepository } from './contracts';

/** L'ouverture est différée et partagée avec le dépôt du profil. */
export function createSessionRepository(name = DATABASE_NAME): SessionRepository {
  const connect = () => openDatabase(name);

  return {
    async getDetails(id) {
      const database = await connect();
      try { return await database.get('details', id); } finally { database.close(); }
    },
    async addImported(session, details) {
      const database = await connect();
      try {
        const tx = database.transaction(['sessions', 'details'], 'readwrite');
        if (await tx.objectStore('sessions').getKey(session.id)) { await tx.done; return false; }
        // Contrôle TCX dans la même transaction : imports concurrents sérialisés.
        // Le chemin ZIP/JSON conserve sa politique historique par identifiant.
        if (session.source === 'tcx') {
          const existing = await tx.objectStore('sessions').getAll();
          if (existing.some(item => isTcxDuplicate(session, item))) { await tx.done; return false; }
        }
        await tx.objectStore('sessions').add(session);
        if (details) await tx.objectStore('details').add(details);
        await tx.done;
        return true;
      } finally { database.close(); }
    },
    async list() {
      const database = await connect();
      try {
        return await database.getAll('sessions');
      } finally {
        database.close();
      }
    },
    async save(session) {
      const database = await connect();
      try {
        await database.put('sessions', session);
      } finally {
        database.close();
      }
    },
  };
}

export const sessionRepository = createSessionRepository();
