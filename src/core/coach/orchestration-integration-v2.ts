import type { CoachProfileValues } from '../../types/coach-profile';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
import type { ProposalPolicy } from '../../types/coach-proposal';
import { matchingDate } from './suggestion-matching';
import { proposeExperimentalCatalogV2,type ExperimentalCatalogV2Result } from './catalog-integration-v2';
import { orchestratePrototypeSession,type PresentedSessionEvidence,type SessionOrchestratorResult } from './simulation/session-orchestrator-v2';
import type { PrototypeSession,PrototypeSessionType } from './simulation/session-strategies-v2';

export interface ExperimentalOrchestrationV2Input {
  sessions:readonly RunningSession[];
  storedSuggestions:readonly StoredSuggestion[];
  referenceDate:string;
  proposalPolicy:ProposalPolicy;
  configuration?:EvolvingCoachValues|null;
  historicalProfile?:CoachProfileValues;
  /** Preuves de présentation fournies par l'appelant. Une consultation ne les crée jamais. */
  presented:readonly PresentedSessionEvidence[];
  /** Types établis explicitement ; aucune activité absente de cette table n'est typée. */
  documentedActivityTypes?:Readonly<Record<string,PrototypeSessionType|undefined>>;
}

export interface ExperimentalSelectionV2 {
  session:PrototypeSession;
  /** Empreinte volatile de contenu, utile aux recalculs ; ce n'est pas une identité persistante. */
  fingerprint:string;
}

export interface ExperimentalOrchestrationV2Result {
  mode:'v2-experimental';
  catalog:ExperimentalCatalogV2Result;
  selection:ExperimentalSelectionV2|null;
  reason:SessionOrchestratorResult['reason']|'catalog-unavailable';
  limitations:string[];
}

const candidateFingerprint=(value:PrototypeSession):string=>JSON.stringify({type:value.type,durationSeconds:value.durationSeconds,
  intensity:value.intensity,terrain:value.terrain,structure:value.structure??null,summary:value.shortSummary});

/** Pipeline expérimental pur : calcule, sélectionne, mais ne constate ni ne persiste une présentation. */
export function proposeExperimentalOrchestratedV2(input:ExperimentalOrchestrationV2Input):ExperimentalOrchestrationV2Result {
  const catalog=proposeExperimentalCatalogV2(input);
  const limitations=['La sélection ne constitue pas une présentation effective.',
    'L’empreinte de contenu n’est pas une identité persistante définitive.'];
  if(!input.presented.length) limitations.push('Aucune date de présentation connue n’a été fournie.');
  if(!catalog.adaptedInput||!catalog.sessions.length)
    return {mode:'v2-experimental',catalog,selection:null,reason:'catalog-unavailable',limitations};

  const activities=input.sessions.flatMap(session=>{
    const date=matchingDate(session);
    if(!date)return [];
    const documentedType=input.documentedActivityTypes?.[session.id];
    return [{date,...(documentedType===undefined?{}:{documentedType})}];
  });
  const result=orchestratePrototypeSession({referenceDate:input.referenceDate,goal:catalog.adaptedInput.goal,
    habitualReferenceSeconds:catalog.adaptedInput.habitualReferenceSeconds,
    availabilitySeconds:catalog.adaptedInput.availabilitySeconds,candidates:catalog.sessions,activities,presented:input.presented});
  return {mode:'v2-experimental',catalog,selection:result.selected
    ?{session:result.selected,fingerprint:candidateFingerprint(result.selected)}:null,reason:result.reason,limitations};
}
