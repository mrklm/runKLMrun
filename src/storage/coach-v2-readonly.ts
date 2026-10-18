import { validateEvolvingCoachRecord } from '../core/coach/configuration';
import type { CoachV2ApplicationSnapshot,CoachV2ReadonlyResult } from '../core/coach/application-adapter-v2';
import { adaptCoachV2Readonly } from '../core/coach/application-adapter-v2';
import { validateOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import { validateProfile } from '../core/coach/profile';
import { DATABASE_NAME,openDatabase } from './database-connection';
import { validateCoachPlanning } from '../core/coach/planning';
import { compareCoachVersionsReadonly,type CoachVersionsComparison } from '../core/coach/comparison-v1-v2';
import type { CoachV2Reference } from '../core/coach/local-reference-v2';

/** Instantané atomique et strictement readonly des seules sources du pipeline V2. */
export async function readCoachV2Snapshot(name=DATABASE_NAME):Promise<CoachV2ApplicationSnapshot> {
  const db=await openDatabase(name),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2','coachPlanning'],'readonly');
  try {
    const [sessions,profiles,configurations,occurrences,planning]=await Promise.all([
      tx.objectStore('sessions').getAll(),tx.objectStore('coachProfile').getAll(),
      tx.objectStore('evolvingCoach').getAll(),tx.objectStore('coachSuggestionsV2').getAll(),tx.objectStore('coachPlanning').get('local'),
    ]);await tx.done;
    if(profiles.length>1||configurations.length>1)throw new Error('Instantané Coach V2 incohérent.');
    const profile=profiles[0],configuration=configurations[0];
    if(profile&&Object.keys(validateProfile(profile,'0001-01-01',profile)).length)throw new Error('Profil Coach invalide.');
    if(configuration)validateEvolvingCoachRecord(configuration);
    if(planning)validateCoachPlanning(planning);
    for(const occurrence of occurrences)await validateOccurrenceV2(occurrence);
    return {sessions:structuredClone(sessions),occurrences:structuredClone(occurrences),
      ...(profile?{profile:structuredClone(profile)}:{}),
      ...(planning?{planning:structuredClone(planning)}:{}),
      ...(configuration?{configuration:structuredClone(configuration.configuration),
        ...(configuration.configuration?{configurationCreatedOn:configuration.createdAt.slice(0,10)}:{})}: {})};
  } finally {db.close();}
}

/** Lecture + calcul seulement. Aucun appel à un dépôt d'écriture. */
export async function calculateCoachV2Readonly(referenceTime:CoachV2Reference,name=DATABASE_NAME):Promise<CoachV2ReadonlyResult> {
  return adaptCoachV2Readonly(await readCoachV2Snapshot(name),referenceTime);
}

/** Une transaction readonly commune garantit que V1 et V2 comparent le même instantané. */
export async function calculateCoachVersionsComparisonReadonly(referenceTime:CoachV2Reference,name=DATABASE_NAME):Promise<CoachVersionsComparison> {
  return compareCoachVersionsReadonly(await readCoachV2Snapshot(name),referenceTime);
}
