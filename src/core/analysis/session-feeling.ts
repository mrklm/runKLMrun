import type { OptionalSessionFeeling } from '../../types/evolving-coach';
export const FEELING_COMMENT_LIMIT = 2000;
export const effortLabels = { easy: 'Facile', moderate: 'Modérée', hard: 'Difficile', 'very-hard': 'Très difficile' } as const;
export function validateFeeling(value: unknown): asserts value is OptionalSessionFeeling {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ressenti invalide.');
  const feeling = value as Record<string, unknown>;
  if (Object.keys(feeling).some(key => !['effort', 'comment'].includes(key))
    || (feeling.effort !== undefined && (typeof feeling.effort !== 'string' || !Object.hasOwn(effortLabels, feeling.effort)))
    || (feeling.comment !== undefined && (typeof feeling.comment !== 'string' || feeling.comment.length > FEELING_COMMENT_LIMIT))) {
    throw new Error(`Ressenti invalide ou commentaire dépassant ${FEELING_COMMENT_LIMIT} caractères.`);
  }
}
export function feelingFromFields(effort: string, comment: string): OptionalSessionFeeling | undefined {
  const value = { ...(effort ? { effort } : {}), ...(comment ? { comment } : {}) };
  validateFeeling(value);
  return Object.keys(value).length ? value : undefined;
}
export function sameFeeling(a?: OptionalSessionFeeling, b?: OptionalSessionFeeling): boolean {
  return a?.effort === b?.effort && a?.comment === b?.comment;
}
