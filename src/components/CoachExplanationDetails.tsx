import { coachExplanationLines } from './coach-v2-display';

export function CoachExplanationDetails({reasons,limitations}:{reasons:readonly string[];limitations:readonly string[]}) {
  const why=coachExplanationLines(reasons),limits=coachExplanationLines(limitations);
  return <>{!!why.length&&<details><summary>Pourquoi ?</summary>{why.map(reason=><p key={reason}>{reason}</p>)}</details>}
    {!!limits.length&&<details><summary>Limites</summary>{limits.map(reason=><p key={reason}>{reason}</p>)}</details>}</>;
}
