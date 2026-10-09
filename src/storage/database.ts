import { openDB, type DBSchema } from 'idb';
import type { RunningSession } from '../types/session';
import type { SessionRepository } from './contracts';

interface RunDatabase extends DBSchema {
  sessions: { key: string; value: RunningSession };
}

export const DATABASE_NAME = 'runklmrun';
const DATABASE_VERSION = 1;

/** L'ouverture est différée : importer ce module n'accède pas au navigateur. */
export function createSessionRepository(name = DATABASE_NAME): SessionRepository {
  const connect = () => openDB<RunDatabase>(name, DATABASE_VERSION, {
    upgrade(database) {
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
