import { adaptCoachV2Readonly,type CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { reusableActiveOccurrenceV2 } from './presentation-identity-v2';
import { productPolicy } from './product-policy';
import { proposeSuggestions } from './proposals';
import { resolveCoachV2Reference,type CoachV2Reference } from './local-reference-v2';

export interface ComparableCoachSuggestion {
  indicative?:boolean;
  engine:'V1'|'V2';date:string;type:string;durationSeconds:number;intensity:string;terrain:string;
  reasons:readonly string[];limitations:readonly string[];
}
export interface CoachVersionsComparison {
  readonly:true;referenceDate:string;sessionCount:number;goal:string|null;
  v1:{status:string;suggestions:ComparableCoachSuggestion[];reasons:readonly string[];limitations:readonly string[]};
  v2:{status:string;suggestions:ComparableCoachSuggestion[];reasons:readonly string[];limitations:readonly string[]};
}

/** Comparaison pure. Aucun dépôt d'écriture ni cycle de présentation n'est appelé. */
export function compareCoachVersionsReadonly(snapshot:CoachV2ApplicationSnapshot,referenceTime:CoachV2Reference):CoachVersionsComparison {
  const reference=resolveCoachV2Reference(referenceTime),referenceDate=reference.date;
  const goal=snapshot.configuration?.goal.kind??null,policy=productPolicy(goal??'wellbeing');
  const v1=proposeSuggestions({sessions:snapshot.sessions,referenceDate,configuration:snapshot.configuration,
    historicalProfile:snapshot.profile,policy},snapshot.planning);
  const v2=adaptCoachV2Readonly(snapshot,reference);
  const retained=reusableActiveOccurrenceV2(snapshot.occurrences,v2,referenceDate);
  return {readonly:true,referenceDate,sessionCount:snapshot.sessions.length,goal,
    v1:{status:v1.status,reasons:[...v1.reasons,...v1.constraints],limitations:v1.limitations,
      suggestions:v1.suggestions.map(value=>({engine:'V1',date:value.date,type:value.kind,durationSeconds:value.durationSeconds,
        intensity:value.intensity.description,terrain:value.recommendedTerrain.label,reasons:[...value.reasons,value.explanation],limitations:value.limitations}))},
    v2:{status:retained?'selected':v2.reason,reasons:[...v2.catalog.reasons,...v2.uncertainties],limitations:v2.catalog.reasons,
      suggestions:coachV2Perspectives(v2,retained)
        .map(({date,session,indicative})=>({engine:'V2',date,indicative,type:session.type,
          durationSeconds:session.totalDurationSeconds,intensity:session.intensity,terrain:session.terrain,
          reasons:'rationale' in session?[...session.rationale.observedFacts,...session.rationale.runnerDeclarations,...session.rationale.designChoices]:[],
          limitations:[...('rationale' in session?session.rationale.uncertainties:[]),...v2.uncertainties]}))}};
}
