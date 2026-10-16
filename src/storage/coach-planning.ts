import { storageChanges } from './changes';
import { DATABASE_NAME, openDatabase } from './database-connection';
import type { CoachPlanningRepository } from './contracts';
import type { CoachPlanning } from '../types/coach-planning';
import { validateCoachPlanning } from '../core/coach/planning';
import { nextCoachRevision } from '../core/coach/configuration';
import { canActivateStructuredPlanning, structuredPlanningPolicy } from '../core/coach/foundations';
export class PlanningConflictError extends Error {
  constructor() { super('Le planning ou vos choix ont changé dans un autre onglet. Rechargez le planning avant de réessayer.'); }
}
export function createCoachPlanningRepository(name = DATABASE_NAME, now = () => new Date()): CoachPlanningRepository {
  return {
    async get() {
      const db=await openDatabase(name);
      try { const value=await db.get('coachPlanning','local'); if(value) validateCoachPlanning(value); return value; } finally { db.close(); }
    },
    async apply(action, expectedRevision) {
      const copy=structuredClone(action), time=now().toISOString();
      const db=await openDatabase(name), tx=db.transaction(['coachPlanning','evolvingCoach','coachProfile'],'readwrite');
      try {
        const previous=await tx.objectStore('coachPlanning').get('local');
        if(previous) validateCoachPlanning(previous);
        if(previous?.revision !== expectedRevision) throw new PlanningConflictError();
        const record: CoachPlanning=previous ?? {id:'local',revision:1,createdAt:time,updatedAt:time,sessions:[],dismissed:[]};
        if(copy.type==='accept' || copy.type==='dismiss') {
          const coach=await tx.objectStore('evolvingCoach').get('local'), profile=await tx.objectStore('coachProfile').get('local');
          if(coach?.revision!==copy.coachRevision || profile?.revision!==copy.profileRevision) throw new PlanningConflictError();
          if(!coach?.configuration || !canActivateStructuredPlanning(structuredPlanningPolicy(coach.configuration.goal),coach.configuration.structuredPlanningPreference)) throw new Error('Votre accord à la planification n’est plus actif. Rechargez vos choix.');
          const key=copy.type==='accept' ? copy.session.proposalKey : copy.key;
          if(record.dismissed.includes(key) || record.sessions.some(s=>s.proposalKey===key)) throw new PlanningConflictError();
          if(copy.type==='accept') {
            if(copy.session.status!=='planned') throw new Error('Statut initial invalide.');
            record.sessions.push({...copy.session,createdAt:time,updatedAt:time});
          } else record.dismissed.push(copy.key);
        } else {
          const session=record.sessions.find(s=>s.id===copy.id);
          if(!session) throw new PlanningConflictError();
          if(copy.type==='cancel') session.status='cancelled';
          else if(copy.type==='edit') { session.date=copy.date; session.durationSeconds=copy.durationSeconds; session.note=copy.note; }
          else throw new Error('Action de planning inconnue.');
          session.updatedAt=time;
        }
        record.revision=nextCoachRevision(previous?.revision); record.updatedAt=time;
        validateCoachPlanning(record);
        await tx.objectStore('coachPlanning').put(record); await tx.done; storageChanges.committed(name, ['planning']); return record;
      } catch(error) { try {tx.abort();} catch { /* Déjà terminée. */ } await tx.done.catch(()=>undefined); throw error; }
      finally {db.close();}
    },
  };
}
