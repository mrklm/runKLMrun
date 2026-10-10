import { isTcxDuplicate } from '../importers/session-duplicate';
import { openDB, type DBSchema } from 'idb';
import type { RunningSession, SessionDetails } from '../types/session';
import type { SessionRepository } from './contracts';

interface RunDatabase extends DBSchema {
  details: { key: string; value: SessionDetails };
  sessions: { key: string; value: RunningSession };
}

export const DATABASE_NAME = 'runklmrun';
const DATABASE_VERSION = 2;

/** L'ouverture est différée : importer ce module n'accède pas au navigateur. */
export function createSessionRepository(name = DATABASE_NAME): SessionRepository {
  const connect = () => openDB<RunDatabase>(name, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('details')) database.createObjectStore('details', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' });
      }
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // Libérer la connexion si un autre onglet doit migrer la base.
      (event.target as IDBDatabase).close();
    },
  });

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
        await tx.objectStore('details').add(details);
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
