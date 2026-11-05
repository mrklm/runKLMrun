import type { interpretRecentLoadV2 } from './load-adaptation-policy-v2';
import type { PrototypeSession } from './simulation/session-strategies-v2';

export type LoadAdaptationDecisionV2=ReturnType<typeof interpretRecentLoadV2>;
type Session=Pick<PrototypeSession,'type'|'totalDurationSeconds'>;
const easy=(value:Session)=>value.type==='easy-endurance'||value.type==='recovery';

/** Appliquer après les filtres sportifs existants, au groupe complet admissible.
 * Une réévaluation privilégie le facile s'il existe, sans inventer une date
 * ni interdire une option restante lorsque seule une préférence est exprimée. */
export function applyLoadAdaptationV2<T extends Session>(candidates:readonly T[],policy:LoadAdaptationDecisionV2|undefined,
  referenceSeconds:number|null):T[] {
  if(!policy)return [...candidates];
  const decisions=policy.decisions;
  if(decisions.allSessions.status==='defer')return [];
  const allowed=candidates.filter(value=>{
    const gate=easy(value)?decisions.allSessions:value.type==='long-run'?decisions.longRun:decisions.structured;
    if(gate.status==='defer')return false;
    // Même progression de durée facile que le catalogue ; aucune durée de remplacement.
    return !(decisions.progression==='do-not-increase'&&value.type==='easy-endurance'
      &&referenceSeconds!==null&&value.totalDurationSeconds>referenceSeconds);
  });
  const gentle=allowed.filter(easy);
  const review=decisions.allSessions.status==='review'||decisions.structured.status==='review'||decisions.longRun.status==='review';
  return gentle.length&&(review||decisions.preference==='recovery')?gentle:allowed;
}
