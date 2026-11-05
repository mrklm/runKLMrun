import { isDocumentedActivityType } from '../../types/session';
import { effortLabels } from '../analysis/session-feeling';
import { validateRealization } from '../analysis/session-review';
import type { CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { associationEvidenceMatchesV2 } from './persistence-foundations-v2';
import { matchingDate } from './suggestion-matching';
import type { RecordedActivityEvidence } from './simulation/session-orchestrator-v2';

/** Le pipeline applicatif fournit toujours l'identifiant source, contrairement aux simulations historiques. */
export interface ApplicationActivityEvidenceV2 extends RecordedActivityEvidence { id:string }

/** Projection pure, sans estimation de charge. Champs invalides/absents : inconnus.
 * Une activité source par identifiant ; en cas de doublon, conserver la première
 * entrée datée admissible, sans fusionner des mesures potentiellement contradictoires.
 * IndexedDB garantit déjà l'unicité des identifiants dans les instantanés réels. */
export function recordedActivityEvidenceV2(snapshot:CoachV2ApplicationSnapshot,referenceDate:string):ApplicationActivityEvidenceV2[] {
  const seen=new Set<string>();
  return snapshot.sessions.flatMap(session=>{
    const date=matchingDate(session);
    if(!date||typeof session.id!=='string'||!session.id.trim()||seen.has(session.id))return [];
    seen.add(session.id);
    const known=date<=referenceDate;
    const type=known?(session.trainingType??snapshot.documentedActivityTypes?.[session.id]):undefined;
    const effort=known?session.feeling?.effort:undefined;
    const duration=session.durationSeconds,distance=session.distanceMeters;
    const linked=known?snapshot.occurrences.filter(value=>value.state==='associated'&&value.activityId===session.id):[];
    let confirmedRealization:RecordedActivityEvidence['confirmedRealization'];
    // Plusieurs revendications : ne pas choisir arbitrairement une confirmation.
    if(linked.length===1){
      const occurrence=linked[0],realization=occurrence.realization;
      if(occurrence.opportunity.suggestedFor===date&&occurrence.associationEvidence
        &&associationEvidenceMatchesV2(occurrence,session)&&realization){
        try {
          validateRealization(realization);
          if(realization.result==='completed'||realization.result==='partial')
            confirmedRealization={occurrenceId:occurrence.id,result:realization.result};
        } catch { /* Une confirmation invalide reste inconnue, sans modifier l'activité. */ }
      }
    }
    return [{id:session.id,date,
      ...(typeof duration==='number'&&Number.isFinite(duration)&&duration>0?{durationSeconds:duration}:{}),
      ...(typeof distance==='number'&&Number.isFinite(distance)&&distance>=0?{distanceMeters:distance}:{}),
      ...(isDocumentedActivityType(type)?{documentedType:type}:{}),
      ...(typeof effort==='string'&&Object.hasOwn(effortLabels,effort)?{effort}:{}),
      ...(confirmedRealization?{confirmedRealization}:{}),
    }];
  });
}
