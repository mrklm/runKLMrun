/** Une proposition n'est jamais une confirmation. Aucun algorithme automatique ici. */
export type RealizationResult = 'completed' | 'partial' | 'not-completed';
export interface Realization {
  result: RealizationResult;
  proposalOrigin: 'manual' | 'automatic';
  confirmedBy: 'user';
}
export interface RealizationProposal {
  result: 'completed' | 'partial' | 'unrecognized';
  origin: 'automatic';
}
export const TRAINING_DESCRIPTION_LIMIT = 2000;
export function validateTrainingDescription(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > TRAINING_DESCRIPTION_LIMIT
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('Description d’entraînement invalide.');
}
function fields(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Déclaration de réalisation invalide.');
}
export function validateRealization(value: unknown): asserts value is Realization {
  fields(value, ['result', 'proposalOrigin', 'confirmedBy']);
  if (typeof value.result !== 'string' || !['completed', 'partial', 'not-completed'].includes(value.result)
    || typeof value.proposalOrigin !== 'string' || !['manual', 'automatic'].includes(value.proposalOrigin) || value.confirmedBy !== 'user')
    throw new Error('Confirmation de réalisation invalide.');
}
export function validateRealizationProposal(value: unknown): asserts value is RealizationProposal {
  fields(value, ['result', 'origin']);
  if (typeof value.result !== 'string' || !['completed', 'partial', 'unrecognized'].includes(value.result) || value.origin !== 'automatic')
    throw new Error('Proposition de réalisation invalide.');
}
