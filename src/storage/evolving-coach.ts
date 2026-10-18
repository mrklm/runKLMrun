import { storageChanges } from './changes';
import type { EvolvingCoachRepository } from './contracts';
import type { CoachTemperament, EvolvingCoachRecord, EvolvingCoachValues } from '../types/evolving-coach';
import { validateEvolvingCoachRecord, validateEvolvingCoachValues, nextCoachRevision, resolveCoachTemperament } from '../core/coach/configuration';
import { DATABASE_NAME, openDatabase } from './database-connection';
import { ProfileConflictError } from './coach-profile';

export function createEvolvingCoachRepository(name = DATABASE_NAME, now: () => Date = () => new Date()): EvolvingCoachRepository {
  async function write(values: EvolvingCoachValues | null | undefined, expectedRevision: number | undefined, temperament?: CoachTemperament) {
    const copy = structuredClone(values), time = now().toISOString();
    if (copy !== null && copy !== undefined) validateEvolvingCoachValues(copy);
    const db = await openDatabase(name), tx = db.transaction('evolvingCoach', 'readwrite');
    try {
      const previous = await tx.store.get('local');
      if (previous) validateEvolvingCoachRecord(previous);
      if (previous?.revision !== expectedRevision) throw new ProfileConflictError();
      const record: EvolvingCoachRecord = { id: 'local', configuration: copy === undefined ? previous?.configuration ?? null : copy,
        ...((temperament ?? previous?.coachTemperament) !== undefined ? { coachTemperament: temperament ?? previous?.coachTemperament } : {}),
        revision: nextCoachRevision(previous?.revision), createdAt: previous?.createdAt ?? time, updatedAt: time };
      validateEvolvingCoachRecord(record);
      if (temperament !== undefined && previous && resolveCoachTemperament(previous) === temperament) { await tx.done; return previous; }
      await tx.store.put(record); await tx.done; storageChanges.committed(name, ['configuration']); return record;
    } catch (error) {
      try { tx.abort(); } catch { /* Transaction déjà terminée. */ }
      await tx.done.catch(() => undefined); throw error;
    } finally { db.close(); }
  }
  return {
    async get() {
      const db = await openDatabase(name);
      try { const record = await db.get('evolvingCoach', 'local'); if (record) validateEvolvingCoachRecord(record); return record; }
      finally { db.close(); }
    },
    async save(values, revision) { validateEvolvingCoachValues(values); return write(values, revision); },
    saveTemperament: (value, revision) => write(undefined, revision, value),
    remove: revision => write(null, revision),
  };
}
