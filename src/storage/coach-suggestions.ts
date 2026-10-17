import { pastSuggestionInformation } from '../core/coach/past-suggestions';
import { canonicalJson } from '../backup/format';
import type { RunningSession } from '../types/session';
import type { CoachProfile } from '../types/coach-profile';
import type { EvolvingCoachRecord } from '../types/evolving-coach';
import type { CoachPlanning } from '../types/coach-planning';
import { DATABASE_NAME, openDatabase } from './database-connection';
import { storageChanges } from './changes';
import { localToday } from '../core/analysis/statistics-period';
import { validSessionDate } from '../core/analysis/session-summary';
import { nextCoachRevision } from '../core/coach/configuration';
import { replacementCandidates, suggestionId, suggestionExpiry, validatePresentedSuggestion, validateStoredSuggestion } from '../core/coach/suggestions';
import type { PresentedSuggestion, StoredSuggestion } from '../types/coach-suggestion';
import { matchingDate, suggestionAssociations } from '../core/coach/suggestion-matching';
export class SuggestionConflictError extends Error {
  constructor() { super('Cette suggestion a changé. Relisez les suggestions avant de réessayer.'); }
}
export interface PresentationContext {
  sessions: RunningSession[];
  profile?: CoachProfile;
  coach?: EvolvingCoachRecord;
  planning?: CoachPlanning;
}
export class SuggestionPresentationCancelled extends Error {
  constructor() { super('La présentation ou ses données ont changé.'); }
}
const contextKey = (context: PresentationContext) => canonicalJson({
  sessions: context.sessions.map(({ feeling: _feeling, ...session }) => session).sort((a,b)=>a.id.localeCompare(b.id)),
  profile: context.profile ?? null, coach: context.coach ?? null, planning: context.planning ?? null,
});
/** API explicite, jamais appelée par le calcul du Coach ni pendant un rendu React. */
export function createSuggestionRepository(name = DATABASE_NAME, now = () => new Date()) {
  async function update(id: string, revision: number, action: { state: 'superseded' } | { activityId: string }): Promise<StoredSuggestion> {
    const time = now().toISOString(), db = await openDatabase(name), tx = db.transaction(['coachSuggestions','sessions'],'readwrite');
    let changed = false;
    try {
      const record = await tx.objectStore('coachSuggestions').get(id);
      if (!record || record.revision !== revision) throw new SuggestionConflictError();
      validateStoredSuggestion(record);
      if ('activityId' in action) {
        const activity = await tx.objectStore('sessions').get(action.activityId);
        if (!activity) throw new Error('Activité associée introuvable.');
        if (matchingDate(activity) !== record.date
          || (await tx.objectStore('coachSuggestions').getAll()).some(s => s.id !== id && s.activityId === action.activityId)) {
          throw new SuggestionConflictError();
        }
      }
      if ('activityId' in action ? record.activityId !== action.activityId : record.state !== action.state) {
        Object.assign(record, action, { revision: nextCoachRevision(record.revision), updatedAt: time });
        validateStoredSuggestion(record); await tx.objectStore('coachSuggestions').put(record); changed = true;
      }
      await tx.done;
      if (changed) storageChanges.committed(name,['suggestions']);
      return record;
    } catch (error) { try {tx.abort();} catch { /* Déjà terminée. */ } await tx.done.catch(()=>undefined); throw error; }
    finally { db.close(); }
  }
  return {
    async pastInformation(today: string): Promise<StoredSuggestion[]> {
      const db = await openDatabase(name);
      try {
        const tx = db.transaction(['coachSuggestions', 'sessions'], 'readonly');
        const records = await tx.objectStore('coachSuggestions').getAll();
        records.forEach(validateStoredSuggestion);
        const sessions = records.length ? await tx.objectStore('sessions').getAll() : [];
        await tx.done;
        return pastSuggestionInformation(records, sessions, today);
      } finally { db.close(); }
    },
    /** Un instantané transactionnel des seuls résumés et suggestions. Les
     * transactions concurrentes (imports, restauration, autres onglets) sont
     * sérialisées par IndexedDB, sans écraser une révision lue hors transaction. */
    async reconcileActivities(): Promise<number> {
      const db = await openDatabase(name);
      const tx = db.transaction(['coachSuggestions', 'sessions'], 'readwrite');
      const store = tx.objectStore('coachSuggestions');
      try {
        const records = await store.getAll();
        records.forEach(validateStoredSuggestion);
        const sessions = records.length ? await tx.objectStore('sessions').getAll() : [];
        const associations = suggestionAssociations(records, sessions);
        let changed = 0;
        for (const record of records) {
          const activityId = associations.get(record.id);
          if (record.activityId === activityId) continue;
          const next = { ...record, revision: nextCoachRevision(record.revision), updatedAt: now().toISOString() };
          if (activityId === undefined) delete next.activityId;
          else next.activityId = activityId;
          validateStoredSuggestion(next);
          await store.put(next); changed++;
        }
        await tx.done;
        if (changed) storageChanges.committed(name, ['suggestions']);
        return changed;
      } catch (error) {
        try { tx.abort(); } catch { /* Déjà terminée. */ }
        await tx.done.catch(() => undefined); throw error;
      } finally { db.close(); }
    },
    async recordPresented(input: PresentedSuggestion, presentation?: {
      context: PresentationContext;
      isVisible: () => boolean;
    }): Promise<StoredSuggestion> {
      // Instantané figé avant toute attente ; vérifié dans la transaction d’écriture.
      const expected = presentation ? contextKey(presentation.context) : undefined;
      const copy = structuredClone(input), instant = now(); validatePresentedSuggestion(copy);
      const expiresOn = suggestionExpiry(copy.date);
      if (expiresOn <= localToday(instant)) throw new Error('Cette suggestion est déjà expirée.');
      const record: StoredSuggestion = {...copy,id:suggestionId(copy),createdAt:instant.toISOString(),updatedAt:instant.toISOString(),revision:1,expiresOn,state:'current'};
      validateStoredSuggestion(record);
      const db = await openDatabase(name);
      const tx = db.transaction(['coachSuggestions','sessions','coachProfile','evolvingCoach','coachPlanning'],'readwrite');
      const store = tx.objectStore('coachSuggestions');
      try {
        const previous = await store.get(record.id);
        if (previous) { validateStoredSuggestion(previous); await tx.done; return previous; }
        if (presentation) {
          const [sessions,profile,coach,planning,kept] = await Promise.all([
            tx.objectStore('sessions').getAll(),tx.objectStore('coachProfile').get('local'),
            tx.objectStore('evolvingCoach').get('local'),tx.objectStore('coachPlanning').get('local'),store.getAll(),
          ]);
          if (!presentation.isVisible() || expected !== contextKey({sessions,profile,coach,planning})) throw new SuggestionPresentationCancelled();
          // Le Coach propose un seul créneau. Une nouvelle identité réellement affichée
          // remplace les suggestions futures actives ; jamais les passées/associées/acceptées.
          for (const old of kept) {
            validateStoredSuggestion(old);
            const accepted = planning?.sessions.some(s => s.kind === old.kind && s.original.date === old.date && s.original.durationSeconds === old.durationSeconds);
            if (old.state !== 'current' || old.activityId || old.date < localToday(instant) || old.expiresOn <= localToday(instant) || accepted) continue;
            const obsolete: StoredSuggestion = {...old,state:'superseded',revision:nextCoachRevision(old.revision),updatedAt:instant.toISOString()};
            validateStoredSuggestion(obsolete); await store.put(obsolete);
          }
        }
        await store.add(record); await tx.done; storageChanges.committed(name,['suggestions']); return record;
      } catch(error) { try {tx.abort();} catch { /* Déjà terminée. */ } await tx.done.catch(()=>undefined); throw error; }
      finally {db.close();}
    },
    /** Une carte visible à la fois ; obsolescence seulement après présentation
     * de tous les membres de l’ensemble. Aucune insertion des cartes hors écran. */
    async recordPresentedSetMember(input: PresentedSuggestion, ensemble: readonly PresentedSuggestion[], presentation: {
      context: PresentationContext; isVisible: () => boolean;
    }): Promise<StoredSuggestion> {
      const expected = contextKey(presentation.context), copy = structuredClone(input), members = structuredClone(ensemble);
      validatePresentedSuggestion(copy); members.forEach(validatePresentedSuggestion);
      const ids = new Set(members.map(suggestionId)), id = suggestionId(copy);
      if (!members.length || members.length > 3 || ids.size !== members.length || !ids.has(id)) throw new Error('Ensemble de suggestions invalide.');
      const instant = now(), today = localToday(instant), timestamp = instant.toISOString();
      if (members.some(s => suggestionExpiry(s.date) <= today)) throw new SuggestionPresentationCancelled();
      const db = await openDatabase(name);
      const tx = db.transaction(['coachSuggestions','sessions','coachProfile','evolvingCoach','coachPlanning'],'readwrite');
      const store = tx.objectStore('coachSuggestions');
      try {
        const [sessions,profile,coach,planning,kept] = await Promise.all([
          tx.objectStore('sessions').getAll(),tx.objectStore('coachProfile').get('local'),
          tx.objectStore('evolvingCoach').get('local'),tx.objectStore('coachPlanning').get('local'),store.getAll(),
        ]);
        kept.forEach(validateStoredSuggestion);
        if (!presentation.isVisible() || expected !== contextKey({sessions,profile,coach,planning})) throw new SuggestionPresentationCancelled();
        let record = kept.find(s => s.id === id), changed = false;
        if (!record) {
          record = {...copy,id,createdAt:timestamp,updatedAt:timestamp,revision:1,expiresOn:suggestionExpiry(copy.date),state:'current'};
          validateStoredSuggestion(record); await store.add(record); kept.push(record); changed = true;
        }
        // Présentation passée du même contenu également valable : retour d’onglet
        // et StrictMode ne doivent pas réécrire les suggestions déjà mémorisées.
        if ([...ids].every(member => kept.some(s => s.id === member))) {
          for (const old of replacementCandidates(kept,members,today)) {
            if (planning?.sessions.some(s => s.kind === old.kind && s.original.date === old.date && s.original.durationSeconds === old.durationSeconds)) continue;
            const obsolete: StoredSuggestion = {...old,state:'superseded',revision:nextCoachRevision(old.revision),updatedAt:timestamp};
            validateStoredSuggestion(obsolete); await store.put(obsolete); changed = true;
          }
        }
        await tx.done;
        if (changed) storageChanges.committed(name,['suggestions']);
        return record;
      } catch(error) { try {tx.abort();} catch { /* Déjà terminée. */ } await tx.done.catch(()=>undefined); throw error; }
      finally {db.close();}
    },
    async list(): Promise<StoredSuggestion[]> {
      const db=await openDatabase(name);
      try { const records=await db.getAll('coachSuggestions');records.forEach(validateStoredSuggestion);return records.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)); }
      finally {db.close();}
    },
    markObsolete: (id: string, revision: number) => update(id, revision, {state:'superseded'}),
    associateActivity: (id: string, activityId: string, revision: number) => update(id, revision, {activityId}),
    /** Un lot borné par appel ; aucun entretien automatique en phase 5B.1. */
    async deleteExpired(today = localToday(now()), limit = 100): Promise<number> {
      if (!validSessionDate(today) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Limite de nettoyage invalide.');
      const db=await openDatabase(name),tx=db.transaction('coachSuggestions','readwrite');let count=0;
      try {
        let cursor=await tx.store.index('expiresOn').openCursor(IDBKeyRange.upperBound(today));
        while(cursor && count<limit) { validateStoredSuggestion(cursor.value);await cursor.delete();count++;cursor=await cursor.continue(); }
        await tx.done;if(count)storageChanges.committed(name,['suggestions']);return count;
      } catch(error) {try{tx.abort();}catch{/* Déjà terminée. */}await tx.done.catch(()=>undefined);throw error;}
      finally{db.close();}
    },
  };
}
