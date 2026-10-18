import { activitySportSignatureV2,associationEvidenceMatchesV2,civilDate,invalidateAssociationV2,observePresentationV2,validateOccurrenceShapeV2,validateOccurrenceV2,type OccurrenceProvenanceV2,
  occurrenceId,type InstantIso,type PersistableOccurrenceV2,type PresentationMomentV2,type PresentationKey,type SelectedSuggestionV2 } from '../core/coach/persistence-foundations-v2';
import { matchingDate } from '../core/coach/suggestion-matching';
import { DATABASE_NAME,openDatabase } from './database-connection';
import { storageChanges } from './changes';
import { adaptCoachV2Readonly,type CoachV2ReadonlyResult } from '../core/coach/application-adapter-v2';
import { readCoachV2Snapshot } from './coach-v2-readonly';
import { nextGenerationV2,reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from '../core/coach/presentation-identity-v2';

export type StoredPresentationResultV2=
  |{readonly status:'created';readonly occurrence:PersistableOccurrenceV2}
  |{readonly status:'existing';readonly occurrence:PersistableOccurrenceV2}
  |{readonly status:'content-conflict';readonly occurrence:PersistableOccurrenceV2};
export type ApplicationPresentationResultV2=StoredPresentationResultV2|{readonly status:'reused-active';readonly occurrence:PersistableOccurrenceV2};
export type AssociationInspectionV2=
  |{readonly status:'associated';readonly activityId:string}
  |{readonly status:'invalid-association';readonly activityId:string}
  |{readonly status:'no-candidate'}
  |{readonly status:'confirmation-required';readonly activityId:string}
  |{readonly status:'ambiguous';readonly activityIds:readonly string[]};

export class SuggestionV2LifecycleConflict extends Error {
  constructor(message:string) {super(message);this.name='SuggestionV2LifecycleConflict';}
}

async function checked(value:PersistableOccurrenceV2|undefined):Promise<PersistableOccurrenceV2|undefined> {
  if(value)await validateOccurrenceV2(value);return value;
}

/** Dépôt V2 isolé. Il reçoit une occasion, une ancre et une génération déjà
 * décidées ; il ne les déduit jamais et ne constate aucune visibilité. */
export function createSuggestionV2Repository(name=DATABASE_NAME) {
  return {
    async recordPresented(input:{selection:SelectedSuggestionV2;moment:PresentationMomentV2;provenance:OccurrenceProvenanceV2;
      createId?:()=>string}):Promise<StoredPresentationResultV2> {
      const prepared=await observePresentationV2({...input,existing:[],createId:input.createId??(()=>crypto.randomUUID())});
      const candidate=prepared.occurrence,db=await openDatabase(name),tx=db.transaction('coachSuggestionsV2','readwrite');
      try {
        const store=tx.store,existing=await store.index('presentationKey').get(candidate.presentationKey);
        if(existing) {
          await tx.done;await validateOccurrenceV2(existing);
          return {status:existing.contentFingerprint===candidate.contentFingerprint?'existing':'content-conflict',occurrence:existing};
        }
        await store.add(candidate);await tx.done;storageChanges.committed(name,['suggestions-v2']);return {status:'created',occurrence:candidate};
      } catch(error) {
        try {tx.abort();} catch { /* Transaction déjà terminée. */ }
        await tx.done.catch(()=>undefined);
        // Filet de sécurité pour une contrainte gagnée dans un autre contexte.
        if(error instanceof DOMException&&error.name==='ConstraintError') {
          const winner=await this.getByPresentationKey(candidate.presentationKey);
          if(winner)return {status:winner.contentFingerprint===candidate.contentFingerprint?'existing':'content-conflict',occurrence:winner};
        }
        throw error;
      } finally {db.close();}
    },
    async getById(id:string):Promise<PersistableOccurrenceV2|undefined> {
      const db=await openDatabase(name);
      try {return await checked(await db.get('coachSuggestionsV2',id));} finally {db.close();}
    },
    async getByPresentationKey(key:PresentationKey):Promise<PersistableOccurrenceV2|undefined> {
      const db=await openDatabase(name);
      try {return await checked(await db.getFromIndex('coachSuggestionsV2','presentationKey',key));} finally {db.close();}
    },
    async listPresentedBetween(from:string,to:string):Promise<PersistableOccurrenceV2[]> {
      const start=civilDate(from),end=civilDate(to);if(start>end)throw new Error('Période de présentations V2 invalide.');
      const db=await openDatabase(name);
      try {
        const values=await db.getAllFromIndex('coachSuggestionsV2','presentedOn',IDBKeyRange.bound(start,end));
        for(const value of values)await validateOccurrenceV2(value);
        return values.sort((a,b)=>a.presentation.presentedOn.localeCompare(b.presentation.presentedOn)||a.id.localeCompare(b.id));
      } finally {db.close();}
    },
    async listAll():Promise<PersistableOccurrenceV2[]> {
      const db=await openDatabase(name);
      try {const values=await db.getAll('coachSuggestionsV2');for(const value of values)await validateOccurrenceV2(value);return values;}
      finally {db.close();}
    },
    async replacePresented(input:{previousId:string;expectedRevision:number;selection:SelectedSuggestionV2;moment:PresentationMomentV2;
      provenance:OccurrenceProvenanceV2;createId?:()=>string}):Promise<StoredPresentationResultV2> {
      const prepared=await observePresentationV2({selection:input.selection,moment:input.moment,provenance:input.provenance,
        existing:[],createId:input.createId??(()=>crypto.randomUUID())});
      const base=prepared.occurrence,db=await openDatabase(name),tx=db.transaction('coachSuggestionsV2','readwrite');
      try {
        const previous=await tx.store.get(input.previousId);
        if(!previous)throw new SuggestionV2LifecycleConflict('Occurrence remplacée introuvable.');
        validateOccurrenceShapeV2(previous);
        if(previous.revision!==input.expectedRevision)throw new SuggestionV2LifecycleConflict('Occurrence modifiée simultanément.');
        if(previous.state!=='active')throw new SuggestionV2LifecycleConflict('Seule une occurrence active peut être remplacée.');
        if(base.opportunity.generation<=previous.opportunity.generation)throw new SuggestionV2LifecycleConflict('La génération de remplacement doit augmenter.');
        const winner=await tx.store.index('presentationKey').get(base.presentationKey);
        if(winner) {
          validateOccurrenceShapeV2(winner);
          if(winner.contentFingerprint===base.contentFingerprint&&winner.supersedesId===previous.id
            &&previous.supersededById===winner.id) {await tx.done;return {status:'existing',occurrence:winner};}
          throw new SuggestionV2LifecycleConflict('Clé de présentation déjà utilisée par une autre occurrence.');
        }
        const replacement:PersistableOccurrenceV2={...base,supersedesId:previous.id};
        const obsolete:PersistableOccurrenceV2={...previous,state:'obsolete',revision:previous.revision+1,
          updatedAt:input.moment.presentedAt,supersededById:replacement.id};
        validateOccurrenceShapeV2(replacement);validateOccurrenceShapeV2(obsolete);
        await tx.store.add(replacement);await tx.store.put(obsolete);await tx.done;storageChanges.committed(name,['suggestions-v2']);
        return {status:'created',occurrence:replacement};
      } catch(error) {try {tx.abort();} catch {/* déjà terminée */}await tx.done.catch(()=>undefined);throw error;} finally {db.close();}
    },
    async markObsolete(id:string,expectedRevision:number,updatedAt:InstantIso):Promise<PersistableOccurrenceV2> {
      const db=await openDatabase(name),tx=db.transaction('coachSuggestionsV2','readwrite');
      try {
        const current=await tx.store.get(id);if(!current)throw new SuggestionV2LifecycleConflict('Occurrence introuvable.');
        validateOccurrenceShapeV2(current);
        if(current.revision!==expectedRevision)throw new SuggestionV2LifecycleConflict('Occurrence modifiée simultanément.');
        if(current.state==='associated')throw new SuggestionV2LifecycleConflict('Une occurrence associée reste conservée.');
        if(current.state==='obsolete') {await tx.done;return current;}
        const next:PersistableOccurrenceV2={...current,state:'obsolete',revision:current.revision+1,updatedAt};
        validateOccurrenceShapeV2(next);await tx.store.put(next);await tx.done;storageChanges.committed(name,['suggestions-v2']);return next;
      } catch(error) {try {tx.abort();} catch {/* déjà terminée */}await tx.done.catch(()=>undefined);throw error;} finally {db.close();}
    },
    async inspectAssociation(id:string):Promise<AssociationInspectionV2> {
      const db=await openDatabase(name);
      try {
        const occurrence=await checked(await db.get('coachSuggestionsV2',id));
        if(!occurrence)throw new SuggestionV2LifecycleConflict('Occurrence introuvable.');
        if(occurrence.state==='associated') {
          const activity=await db.get('sessions',occurrence.activityId!);
          return activity&&matchingDate(activity)===occurrence.opportunity.suggestedFor&&associationEvidenceMatchesV2(occurrence,activity)
            ?{status:'associated',activityId:occurrence.activityId!}:{status:'invalid-association',activityId:occurrence.activityId!};
        }
        const sessions=(await db.getAll('sessions')).filter(session=>matchingDate(session)===occurrence.opportunity.suggestedFor);
        if(!sessions.length)return {status:'no-candidate'};
        if(sessions.length===1)return {status:'confirmation-required',activityId:sessions[0].id};
        return {status:'ambiguous',activityIds:sessions.map(session=>session.id).sort()};
      } finally {db.close();}
    },
    async associateActivity(input:{occurrenceId:string;expectedRevision:number;activityId:string;updatedAt:InstantIso}):Promise<PersistableOccurrenceV2> {
      occurrenceId(input.occurrenceId);
      const db=await openDatabase(name),tx=db.transaction(['coachSuggestionsV2','sessions'],'readwrite');
      try {
        const suggestions=tx.objectStore('coachSuggestionsV2'),sessions=tx.objectStore('sessions');
        const [current,activity,all]=await Promise.all([suggestions.get(input.occurrenceId),sessions.get(input.activityId),suggestions.getAll()]);
        if(!current)throw new SuggestionV2LifecycleConflict('Occurrence introuvable.');
        validateOccurrenceShapeV2(current);
        if(current.revision!==input.expectedRevision)throw new SuggestionV2LifecycleConflict('Occurrence modifiée simultanément.');
        if(current.state==='associated') {
          if(current.activityId===input.activityId) {await tx.done;return current;}
          throw new SuggestionV2LifecycleConflict('Occurrence déjà associée à une autre activité.');
        }
        if(!activity)throw new SuggestionV2LifecycleConflict('Activité réelle introuvable.');
        if(matchingDate(activity)!==current.opportunity.suggestedFor)throw new SuggestionV2LifecycleConflict('La date civile de l’activité ne correspond pas.');
        if(all.some(item=>item.id!==current.id&&item.activityId===activity.id))throw new SuggestionV2LifecycleConflict('Activité déjà associée à une autre occurrence.');
        const next:PersistableOccurrenceV2={...current,state:'associated',activityId:activity.id,
          associationEvidence:{sportSignature:activitySportSignatureV2(activity)},revision:current.revision+1,updatedAt:input.updatedAt};
        validateOccurrenceShapeV2(next);await suggestions.put(next);await tx.done;storageChanges.committed(name,['suggestions-v2']);return next;
      } catch(error) {try {tx.abort();} catch {/* déjà terminée */}await tx.done.catch(()=>undefined);throw error;} finally {db.close();}
    },
    async invalidateMissingAssociations(updatedAt:InstantIso):Promise<{invalidated:number}> {
      const db=await openDatabase(name),tx=db.transaction(['coachSuggestionsV2','sessions'],'readwrite');let invalidated=0;
      try {
        const suggestions=tx.objectStore('coachSuggestionsV2'),sessions=tx.objectStore('sessions'),all=await suggestions.getAll();
        for(const occurrence of all)if(occurrence.state==='associated') {
          const activity=await sessions.get(occurrence.activityId!);
          if(!activity||matchingDate(activity)!==occurrence.opportunity.suggestedFor||!associationEvidenceMatchesV2(occurrence,activity)) {
            const reason=!activity?'activity-missing':matchingDate(activity)!==occurrence.opportunity.suggestedFor?'activity-replaced':'activity-modified';
            await suggestions.put(invalidateAssociationV2(occurrence,occurrence.activityId!,updatedAt,reason));
            invalidated++;
          }
        }
        await tx.done;if(invalidated)storageChanges.committed(name,['suggestions-v2']);return {invalidated};
      } catch(error) {try {tx.abort();} catch {/* déjà terminée */}await tx.done.catch(()=>undefined);throw error;} finally {db.close();}
    },
  };
}

/** Seul cet appel explicite constate une présentation de la sélection applicative.
 * La première occurrence admissible validée gagne, quelle que soit sa clé.
 * Les empreintes asynchrones sont préparées hors transaction, puis l'instantané
 * est revérifié sous transaction d'écriture avant toute décision définitive. */
export async function presentCoachV2Selection(input:{result:CoachV2ReadonlyResult;referenceDate:string;moment:PresentationMomentV2;
  provenance:OccurrenceProvenanceV2;createId?:()=>string},name=DATABASE_NAME):Promise<ApplicationPresentationResultV2> {
  const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
  for(;;){
    const snapshot=await readCoachV2Snapshot(name);
    // Réexaminer aussi les dates des occurrences arrivées depuis le calcul de cet onglet.
    // Minuit est volontaire ici : la limite de 18 h ne concerne pas leur réutilisation.
    const current=adaptCoachV2Readonly(snapshot,input.referenceDate);
    const reusable=reusableActiveOccurrenceV2(snapshot.occurrences,current,input.referenceDate);
    const prepared=reusable?undefined:await observePresentationV2({
      selection:selectedApplicationSuggestionV2(input.result,nextGenerationV2(snapshot.occurrences,input.result)),
      moment:input.moment,provenance:input.provenance,existing:[],createId:input.createId??(()=>crypto.randomUUID())});
    const db=await openDatabase(name),tx=db.transaction(['sessions','coachProfile','evolvingCoach','coachSuggestionsV2'],'readwrite');
    try {
      const [sessions,profiles,configurations,occurrences]=await Promise.all([
        tx.objectStore('sessions').getAll(),tx.objectStore('coachProfile').getAll(),
        tx.objectStore('evolvingCoach').getAll(),tx.objectStore('coachSuggestionsV2').getAll(),
      ]);
      const configuration=configurations[0];
      if(profiles.length>1||configurations.length>1||!same(sessions,snapshot.sessions)||!same(profiles[0],snapshot.profile)
        ||!same(configuration?.configuration,snapshot.configuration)
        ||(configuration?.configuration?configuration.createdAt.slice(0,10):undefined)!==snapshot.configurationCreatedOn
        ||!same(occurrences,snapshot.occurrences)){
        await tx.done;continue; // Aucun ajout à partir d'une lecture devenue périmée.
      }
      if(reusable){await tx.done;return {status:'reused-active',occurrence:reusable};}
      const candidate=prepared!.occurrence,existing=occurrences.find(value=>value.presentationKey===candidate.presentationKey);
      if(existing){await tx.done;return {status:existing.contentFingerprint===candidate.contentFingerprint?'existing':'content-conflict',occurrence:existing};}
      await tx.objectStore('coachSuggestionsV2').add(candidate);await tx.done;
      storageChanges.committed(name,['suggestions-v2']);return {status:'created',occurrence:candidate};
    }catch(error){try{tx.abort();}catch{/* Transaction déjà terminée. */}await tx.done.catch(()=>undefined);throw error;}
    finally{db.close();}
  }
}

/** Un remplacement est toujours explicite et poursuit la génération de l'occurrence remplacée. */
export async function replaceCoachV2Selection(input:{previousId:string;expectedRevision:number;result:CoachV2ReadonlyResult;
  moment:PresentationMomentV2;provenance:OccurrenceProvenanceV2;createId?:()=>string},name=DATABASE_NAME):Promise<StoredPresentationResultV2> {
  const repository=createSuggestionV2Repository(name),previous=await repository.getById(input.previousId);
  if(!previous)throw new SuggestionV2LifecycleConflict('Occurrence remplacée introuvable.');
  const selection=selectedApplicationSuggestionV2(input.result,previous.opportunity.generation+1);
  return repository.replacePresented({previousId:input.previousId,expectedRevision:input.expectedRevision,selection,
    moment:input.moment,provenance:input.provenance,createId:input.createId});
}
