import { storageChanges } from './changes';
import { isTcxDuplicate } from '../importers/session-duplicate';
import { DATABASE_NAME, openDatabase } from './database-connection';
export { DATABASE_NAME } from './database-connection';
import type { SessionRepository } from './contracts';
import { activitySportSignatureV2,associationEvidenceMatchesV2,instantIso,invalidateAssociationV2 } from '../core/coach/persistence-foundations-v2';
import { matchingDate } from '../core/coach/suggestion-matching';

/** L'ouverture est différée et partagée avec le dépôt du profil. */
export function createSessionRepository(name = DATABASE_NAME): SessionRepository {
  const connect = () => openDatabase(name);

  return {
    beginImportBatch: () => storageChanges.batch(name),
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
        storageChanges.committed(name, ['sessions']);
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
        const tx=database.transaction(['sessions','coachSuggestionsV2'],'readwrite'),sessions=tx.objectStore('sessions'),suggestions=tx.objectStore('coachSuggestionsV2');
        const [previous,occurrences]=await Promise.all([sessions.get(session.id),suggestions.getAll()]);let associationChanged=false;
        const now=new Date().toISOString();
        const updated=occurrences.flatMap(occurrence=>occurrence.state==='associated'&&occurrence.activityId===session.id
          &&(matchingDate(session)!==occurrence.opportunity.suggestedFor
            ||(occurrence.associationEvidence!==undefined? !associationEvidenceMatchesV2(occurrence,session)
              :previous!==undefined&&activitySportSignatureV2(previous)!==activitySportSignatureV2(session)))?[occurrence]:[]);
        for(const occurrence of updated) {
          const updatedAt=instantIso(now>occurrence.updatedAt?now:occurrence.updatedAt);
          await suggestions.put(invalidateAssociationV2(occurrence,session.id,updatedAt,
            matchingDate(session)!==occurrence.opportunity.suggestedFor?'activity-replaced':'activity-modified'));
          associationChanged=true;
        }
        await sessions.put(session);await tx.done;
        storageChanges.committed(name,associationChanged?['sessions','suggestions-v2']:['sessions']);
      } finally {
        database.close();
      }
    },
    async remove(id) {
      const database=await connect();
      try {
        const tx=database.transaction(['sessions','details','shoeAssignments','coachSuggestionsV2'],'readwrite');
        const sessions=tx.objectStore('sessions');if(await sessions.getKey(id)===undefined) {await tx.done;return false;}
        await sessions.delete(id);await tx.objectStore('details').delete(id);await tx.objectStore('shoeAssignments').delete(id);
        const suggestions=tx.objectStore('coachSuggestionsV2'),now=new Date().toISOString();let associationChanged=false;
        for(const occurrence of await suggestions.getAll())if(occurrence.state==='associated'&&occurrence.activityId===id) {
          const updatedAt=instantIso(now>occurrence.updatedAt?now:occurrence.updatedAt);
          await suggestions.put(invalidateAssociationV2(occurrence,id,updatedAt,'activity-missing'));
          associationChanged=true;
        }
        await tx.done;storageChanges.committed(name,associationChanged?['sessions','suggestions-v2']:['sessions']);return true;
      } finally {database.close();}
    },
  };
}

export const sessionRepository = createSessionRepository();
