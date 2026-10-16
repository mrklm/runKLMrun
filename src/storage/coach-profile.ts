import { storageChanges } from './changes';
import type { CoachProfileRepository } from './contracts';
import { DATABASE_NAME, openDatabase } from './database-connection';
import { LOCAL_PROFILE_ID, type CoachProfile } from '../types/coach-profile';
import { validateProfile } from '../core/coach/profile';
import { localToday } from '../core/analysis/statistics-period';
export class ProfileConflictError extends Error {
  constructor() { super('Votre profil a été modifié dans un autre onglet. Vos saisies sont conservées ; rechargez le profil avant de réessayer.'); }
}
function checkStored(profile: CoachProfile | undefined): void {
  if (profile && (profile.id !== LOCAL_PROFILE_ID || !Number.isInteger(profile.revision) || profile.revision < 1
    || typeof profile.createdAt !== 'string' || !Number.isFinite(Date.parse(profile.createdAt))
    || typeof profile.updatedAt !== 'string' || !Number.isFinite(Date.parse(profile.updatedAt))
    || Object.keys(validateProfile(profile, '0001-01-01', profile)).length)) throw new Error('Profil enregistré invalide.');
}
export function createCoachProfileRepository(name = DATABASE_NAME, now: () => Date = () => new Date()): CoachProfileRepository {
  return {
    async get() {
      const database = await openDatabase(name);
      try { const profile = await database.get('coachProfile', LOCAL_PROFILE_ID); checkStored(profile); return profile; } finally { database.close(); }
    },
    async save(values, expectedRevision) {
      // Copier avant le premier await afin que les saisies ne changent pas pendant la transaction.
      const copy = structuredClone(values), time = now();
      const database = await openDatabase(name);
      const tx = database.transaction('coachProfile', 'readwrite');
      try {
        const previous = await tx.store.get(LOCAL_PROFILE_ID); checkStored(previous);
        if (previous?.revision !== expectedRevision) throw new ProfileConflictError();
        const errors = validateProfile(copy, localToday(time), previous);
        if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
        const profile: CoachProfile = { ...copy, id: LOCAL_PROFILE_ID, createdAt: previous?.createdAt ?? time.toISOString(), updatedAt: time.toISOString(), revision: (previous?.revision ?? 0) + 1 };
        await tx.store.put(profile); await tx.done; storageChanges.committed(name, ['profile']); return profile;
      } catch (error) {
        try { tx.abort(); } catch { /* La transaction peut être déjà annulée. */ }
        await tx.done.catch(() => undefined); throw error;
      } finally { database.close(); }
    },
  };
}
export const coachProfileRepository = createCoachProfileRepository();
