import type { RunningSession, DocumentedActivityType } from '../types/session';
import type { OptionalSessionFeeling } from '../types/evolving-coach';
import { validateFeeling } from '../core/analysis/session-feeling';
import { isDocumentedActivityType } from '../types/session';
import { validateTrainingDescription, validateRealization, validateRealizationProposal, type Realization, type RealizationProposal } from '../core/analysis/session-review';
import { activitySportSignatureV2, instantIso, validateOccurrenceShapeV2, type PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import { matchingDate } from '../core/coach/suggestion-matching';
import { canonicalJson } from '../backup/format';
import { openDatabase, DATABASE_NAME } from './database-connection';
import { storageChanges } from './changes';

export interface SessionReviewSnapshot {
  database: string;
  session: RunningSession;
  occurrence?: PersistableOccurrenceV2;
}
/** Propriété omise : conserver ; null : effacer. Les entrées sont copiées avant tout await. */
export interface SessionReviewPatch {
  feeling?: OptionalSessionFeeling | null;
  trainingType?: DocumentedActivityType | null;
  trainingDescription?: string | null;
  realization?: Realization | null;
  realizationProposal?: RealizationProposal | null;
}
export class SessionReviewConflictError extends Error {
  constructor() { super('Le bilan ou l’activité a changé. Rechargez les informations avant de réessayer.'); }
}

/** Base obligatoire : aucun repli vers la base historique ou le profil actif. */
export function createSessionReviewRepository(database: string) {
  if (typeof database !== 'string' || !database.trim() || database === DATABASE_NAME)
    throw new Error('Une base de profil explicite est requise pour le bilan.');
  return {
    async get(sessionId: string, occurrenceId?: string): Promise<SessionReviewSnapshot> {
      const db = await openDatabase(database);
      try {
        const tx = db.transaction(['sessions', 'coachSuggestionsV2'], 'readonly');
        const session = await tx.objectStore('sessions').get(sessionId);
        const occurrence = occurrenceId === undefined ? undefined : await tx.objectStore('coachSuggestionsV2').get(occurrenceId);
        await tx.done;
        if (!session || occurrenceId !== undefined && !occurrence) throw new Error('Activité ou recommandation introuvable.');
        if (occurrence) validateOccurrenceShapeV2(occurrence);
        return { database, session, ...(occurrence ? { occurrence } : {}) };
      } finally { db.close(); }
    },
    async save(expected: SessionReviewSnapshot, changes: SessionReviewPatch): Promise<SessionReviewSnapshot> {
      const snapshot = structuredClone(expected), patch = structuredClone(changes);
      if (snapshot.database !== database) throw new SessionReviewConflictError();
      if (Object.keys(patch).some(key => !['feeling', 'trainingType', 'trainingDescription', 'realization', 'realizationProposal'].includes(key)))
        throw new Error('Champ de bilan inconnu.');
      if (patch.feeling != null) validateFeeling(patch.feeling);
      if (patch.trainingType != null && !isDocumentedActivityType(patch.trainingType)) throw new Error('Type d’entraînement invalide.');
      if (patch.trainingDescription != null) validateTrainingDescription(patch.trainingDescription);
      if (patch.realization != null) validateRealization(patch.realization);
      if (patch.realizationProposal != null) validateRealizationProposal(patch.realizationProposal);
      if ((patch.realization !== undefined || patch.realizationProposal !== undefined) && !snapshot.occurrence)
        throw new Error('Une recommandation est requise.');
      const db = await openDatabase(database);
      const tx = db.transaction(['sessions', 'coachSuggestionsV2'], 'readwrite');
      try {
        const sessions = tx.objectStore('sessions'), occurrences = tx.objectStore('coachSuggestionsV2');
        const current = await sessions.get(snapshot.session.id);
        if (!current || canonicalJson(current) !== canonicalJson(snapshot.session)) throw new SessionReviewConflictError();
        const occurrence = snapshot.occurrence ? await occurrences.get(snapshot.occurrence.id) : undefined;
        if (snapshot.occurrence && (!occurrence || canonicalJson(occurrence) !== canonicalJson(snapshot.occurrence))) throw new SessionReviewConflictError();
        const session = { ...current };
        for (const key of ['feeling', 'trainingType', 'trainingDescription'] as const) {
          if (patch[key] === null) delete session[key];
          else if (patch[key] !== undefined) Object.assign(session, { [key]: patch[key] });
        }
        let next: { -readonly [K in keyof PersistableOccurrenceV2]: PersistableOccurrenceV2[K] } | undefined = occurrence;
        if (occurrence && (patch.realization !== undefined || patch.realizationProposal !== undefined)) {
          validateOccurrenceShapeV2(occurrence);
          if (occurrence.state === 'obsolete' && (patch.realization != null || patch.realizationProposal != null))
            throw new Error('Cette recommandation est obsolète.');
          if (occurrence.activityId !== undefined && occurrence.activityId !== session.id)
            throw new Error('Cette recommandation est associée à une autre activité.');
          if ((patch.realization != null || patch.realizationProposal != null) && matchingDate(session) !== occurrence.opportunity.suggestedFor) throw new Error('La date de l’activité ne correspond pas.');
          const now = new Date().toISOString();
          next = { ...occurrence, revision: occurrence.revision + 1, updatedAt: instantIso(now > occurrence.updatedAt ? now : occurrence.updatedAt) };
          if (patch.realizationProposal === null) delete next.realizationProposal;
          else if (patch.realizationProposal !== undefined) next = { ...next, realizationProposal: patch.realizationProposal };
          if (patch.realization !== undefined) {
            const { realization: _response, activityId: _activity, associationEvidence: _evidence, ...presentation } = next;
            if (patch.realization === null) {
              // Effacer une confirmation retire son lien ; une association historique reste indépendante.
              next = occurrence.realization && occurrence.state === 'associated'
                ? { ...presentation, state: 'active' } : { ...next };
              delete next.realization;
            } else if (patch.realization.result === 'not-completed') {
              next = { ...presentation, state: 'active', realization: patch.realization };
            } else {
              if ((await occurrences.getAll()).some(item => item.id !== occurrence.id && item.activityId === session.id))
                throw new Error('Cette activité est déjà associée à une autre recommandation.');
              next = { ...presentation, state: 'associated', activityId: session.id,
                associationEvidence: { sportSignature: activitySportSignatureV2(session) }, realization: patch.realization };
            }
          }
          validateOccurrenceShapeV2(next);
          await occurrences.put(next);
        }
        if (canonicalJson(session) !== canonicalJson(current)) await sessions.put(session);
        await tx.done;
        storageChanges.committed(database, ['sessions', 'feelings', ...(next !== occurrence ? ['suggestions-v2' as const] : [])]);
        return { database, session, ...(next ? { occurrence: next } : {}) };
      } catch (error) {
        try { tx.abort(); } catch { /* Transaction terminée. */ }
        await tx.done.catch(() => undefined);
        throw error;
      } finally { db.close(); }
    },
  };
}
