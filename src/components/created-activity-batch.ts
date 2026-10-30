export interface CreatedActivityBatch {
  id: string;
  database: string;
  activityIds: string[];
  /** Élément déclencheur capturé avant sa désactivation pendant l’écriture. */
  returnFocus?: HTMLElement;
}
/** Liste exhaustive, composée uniquement de transactions validées. Aucun bilan sur un résultat incertain. */
export function reviewableBatch(batch: CreatedActivityBatch, complete = true): CreatedActivityBatch | undefined {
  const activityIds = [...new Set(batch.activityIds)];
  return complete && activityIds.length >= 1 && activityIds.length <= 5 ? { ...batch, activityIds } : undefined;
}
