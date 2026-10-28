import type { EvolvingCoachRecord } from '../types/evolving-coach';
import type { Shoe, ShoeAssignment, ShoeSettings } from '../types/shoe';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RunningSession, SessionDetails } from '../types/session';
import type { CoachProfile } from '../types/coach-profile';
import { readProfileRegistry, isProfileActive, withProfileDatabaseLock } from './profile-registry';
export interface RunDatabase extends DBSchema {
  coachSuggestionsV2: { key: string; value: import('../core/coach/persistence-foundations-v2').PersistableOccurrenceV2;
    indexes: { presentationKey: string; presentedOn: string } };
  coachSuggestions: { key: string; value: import('../types/coach-suggestion').StoredSuggestion; indexes: { expiresOn: string } };
  coachPlanning: { key: string; value: import('../types/coach-planning').CoachPlanning };
  evolvingCoach: { key: string; value: EvolvingCoachRecord };
  shoeSettings: { key: string; value: ShoeSettings };
  shoes: { key: string; value: Shoe };
  shoeAssignments: { key: string; value: ShoeAssignment };
  sessions: { key: string; value: RunningSession };
  details: { key: string; value: SessionDetails };
  coachProfile: { key: string; value: CoachProfile };
}
export const DATABASE_NAME = 'runklmrun';
export const DATABASE_VERSION = 9;
export class StorageBlockedError extends Error {
  constructor() { super('La mise à jour du stockage est bloquée. Fermez les autres onglets de runKLMrun, puis réessayez.'); }
}
export class ProfileDatabaseUnavailableError extends Error { constructor() { super('Ce profil n’est plus disponible.'); } }
async function assertProfileDatabaseAvailable(name:string) {
  if(name===DATABASE_NAME||!name.startsWith('runklmrun-user-'))return;
  const registry=await readProfileRegistry(),profile=registry?.profiles.find(value=>value.databaseName===name);
  if(!profile||!isProfileActive(profile))throw new ProfileDatabaseUnavailableError();
}
/** Migration additive commune aux deux dépôts. Une ouverture tardive bloquée ne lance aucune écriture. */
export function openDatabase(name = DATABASE_NAME): Promise<IDBPDatabase<RunDatabase>> {
  const open=():Promise<IDBPDatabase<RunDatabase>>=>assertProfileDatabaseAvailable(name).then(() => new Promise<IDBPDatabase<RunDatabase>>((resolve, reject) => {
    let blocked = false;
    openDB<RunDatabase>(name, DATABASE_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('coachSuggestionsV2')) {
          const suggestionsV2=database.createObjectStore('coachSuggestionsV2',{keyPath:'id'});
          suggestionsV2.createIndex('presentationKey','presentationKey',{unique:true});
          suggestionsV2.createIndex('presentedOn','presentation.presentedOn');
        }
        if (!database.objectStoreNames.contains('coachSuggestions')) database.createObjectStore('coachSuggestions', { keyPath: 'id' }).createIndex('expiresOn', 'expiresOn');
        if (!database.objectStoreNames.contains('coachPlanning')) database.createObjectStore('coachPlanning', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('evolvingCoach')) database.createObjectStore('evolvingCoach', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('shoeSettings')) database.createObjectStore('shoeSettings', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('shoes')) database.createObjectStore('shoes', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('shoeAssignments')) database.createObjectStore('shoeAssignments', { keyPath: 'sessionId' });
        if (!database.objectStoreNames.contains('sessions')) database.createObjectStore('sessions', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('details')) database.createObjectStore('details', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('coachProfile')) database.createObjectStore('coachProfile', { keyPath: 'id' });
      },
      blocked() { blocked = true; reject(new StorageBlockedError()); },
      blocking(_current, _next, event) { (event.target as IDBDatabase).close(); },
    }).then(database => { if (blocked) database.close(); else resolve(database); }, reject);
  }));
  return name===DATABASE_NAME||!name.startsWith('runklmrun-user-') ? open() : withProfileDatabaseLock(name,open);
}
