import type { DocumentedActivityType } from '../types/session';
import { isDocumentedActivityType } from '../types/session';
import { DATABASE_NAME, openDatabase } from './database-connection';
import { storageChanges } from './changes';

export class TrainingTypeConflictError extends Error {
  constructor(){super('Le type d’entraînement a changé dans un autre onglet. Rechargez-le avant de réessayer.');}
}
/** Modifie seulement la qualification déclarée, sans toucher aux détails ni associations. */
export function createTrainingTypeRepository(name=DATABASE_NAME) {
  return {
    async get(id:string){const db=await openDatabase(name);try{return await db.get('sessions',id);}finally{db.close();}},
    async save(id:string,value:DocumentedActivityType|undefined,expected:DocumentedActivityType|undefined){
      if(value!==undefined&&!isDocumentedActivityType(value))throw new Error('Type d’entraînement invalide.');
      const db=await openDatabase(name),tx=db.transaction('sessions','readwrite');
      try {
        const current=await tx.store.get(id);
        if(!current)throw new Error('Cette sortie n’est plus disponible.');
        if(current.trainingType!==expected)throw new TrainingTypeConflictError();
        const changed=current.trainingType!==value;
        if(changed){if(value===undefined)delete current.trainingType;else current.trainingType=value;await tx.store.put(current);}
        await tx.done;if(changed)storageChanges.committed(name,['sessions']);return current;
      } catch(error){try{tx.abort();}catch{/* terminée */}await tx.done.catch(()=>undefined);throw error;}finally{db.close();}
    },
  };
}
