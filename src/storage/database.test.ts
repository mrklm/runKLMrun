import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { createSessionRepository } from './database';
import type { RunningSession } from '../types/session';

const databaseNames: string[] = [];
function repository() {
  const name = `runklmrun-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return { name, repository: createSessionRepository(name) };
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => deleteDB(name)));
});

describe('stockage des sorties', () => {
  it('démarre sans aucune donnée sportive', async () => {
    expect(await repository().repository.list()).toEqual([]);
  });

  it('conserve une sortie après réouverture et met à jour sans doublon', async () => {
    const { name, repository: storage } = repository();
    // Jeu de test isolé, jamais chargé dans l'application.
    const session: RunningSession = {
      id: 'test-session', title: 'Sortie de test', date: '2026-01-01',
      distanceMeters: 1000, durationSeconds: 600,
    };
    await storage.save(session);
    const reopened = createSessionRepository(name);
    expect(await reopened.list()).toEqual([session]);
    await reopened.save({ ...session, title: 'Titre corrigé' });
    expect(await reopened.list()).toEqual([{ ...session, title: 'Titre corrigé' }]);
  });
});
