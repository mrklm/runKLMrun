import type { EvolvingCoachRecord, EvolvingCoachValues } from '../../types/evolving-coach';
import { validateCoachGoal } from './foundations';
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function fields(v: unknown, allowed: string[]): asserts v is Record<string, unknown> {
  if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) throw new Error('Configuration du Coach évolutif invalide.');
}
/** Aucun défaut implicite ni conversion d'un objectif historique. */
export function validateEvolvingCoachValues(value: unknown): asserts value is EvolvingCoachValues {
  fields(value, ['goal', 'experience', 'structuredPlanningPreference']);
  if (!object(value.goal) || value.goal.model !== 'evolving' || typeof value.goal.kind !== 'string' || validateCoachGoal(value.goal).length) throw new Error('Objectif du Coach évolutif invalide.');
  if (value.experience !== undefined && (typeof value.experience !== 'string' || !['beginner', 'intermediate', 'experienced', 'observe'].includes(value.experience))) throw new Error('Expérience déclarée invalide.');
  if (value.structuredPlanningPreference !== undefined && (typeof value.structuredPlanningPreference !== 'string' || !['accepted', 'declined', 'unexpressed'].includes(value.structuredPlanningPreference))) throw new Error('Préférence de planification invalide.');
}
export function validateEvolvingCoachRecord(value: unknown): asserts value is EvolvingCoachRecord {
  fields(value, ['id', 'configuration', 'revision', 'createdAt', 'updatedAt']);
  const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
  if (value.id !== 'local' || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 || !timestamp(value.createdAt) || !timestamp(value.updatedAt) || value.updatedAt < value.createdAt) throw new Error('Métadonnées du Coach évolutif invalides.');
  if (value.configuration !== null) validateEvolvingCoachValues(value.configuration);
}
export function nextCoachRevision(previous = 0): number {
  if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) throw new Error('Révision du Coach évolutif hors limites.');
  return previous + 1;
}
