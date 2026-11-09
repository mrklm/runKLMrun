import type { LegacySessionEffort, OptionalSessionFeeling } from '../../types/evolving-coach';
export const FEELING_COMMENT_LIMIT = 2000;
/** Anciennes catégories, conservées en lecture : jamais réécrites sans modification par le coureur. */
export const effortLabels = { easy: 'Facile', moderate: 'Modérée', hard: 'Difficile', 'very-hard': 'Très difficile' } as const;
/** Échelle CR-10 modifiée (Foster et al., 2001), saisie de 1 à 10 comme chez Polar : une sortie n'est jamais du repos.
 * Repères de Foster conservés ; 6, 8 et 9 complétés. 0 reste lisible pour d'éventuelles valeurs déjà enregistrées. */
export const RPE_MIN = 0, RPE_MAX = 10, RPE_INPUT_MIN = 1;
export const rpeLabels: Readonly<Partial<Record<number, string>>> = {
  1: 'Très, très facile', 2: 'Facile', 3: 'Modéré', 4: 'Un peu difficile', 5: 'Difficile',
  6: 'Nettement difficile', 7: 'Très difficile', 8: 'Très, très difficile', 9: 'Presque maximal', 10: 'Maximal',
};
/** Conversion des anciennes catégories vers le libellé correspondant de l'échelle 0 à 10. */
export const LEGACY_EFFORT_RPE: Readonly<Record<LegacySessionEffort, number>> = { easy: 2, moderate: 3, hard: 5, 'very-hard': 7 };
export const isRpe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= RPE_MIN && value <= RPE_MAX;
export const rpeText = (rpe: number) => `${rpe}/10${rpeLabels[rpe] ? ` — ${rpeLabels[rpe]}` : ''}`;
/** Effort perçu sur 0 à 10, saisi directement ou converti depuis une ancienne catégorie. */
export function feelingRpe(feeling?: OptionalSessionFeeling): number | undefined {
  if (isRpe(feeling?.rpe)) return feeling.rpe;
  const effort = feeling?.effort;
  return typeof effort === 'string' && Object.hasOwn(LEGACY_EFFORT_RPE, effort) ? LEGACY_EFFORT_RPE[effort] : undefined;
}
/** Catégorie utilisée par les règles existantes du Coach (politique A inchangée).
 * Réciproque exacte de LEGACY_EFFORT_RPE : 0-2 facile, 3-4 modérée, 5-6 difficile, 7-10 très difficile. */
export function feelingEffortCategory(feeling?: OptionalSessionFeeling): LegacySessionEffort | undefined {
  const rpe = feelingRpe(feeling);
  if (rpe === undefined) return undefined;
  return rpe >= 7 ? 'very-hard' : rpe >= 5 ? 'hard' : rpe >= 3 ? 'moderate' : 'easy';
}
export function validateFeeling(value: unknown): asserts value is OptionalSessionFeeling {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ressenti invalide.');
  const feeling = value as Record<string, unknown>;
  if (Object.keys(feeling).some(key => !['effort', 'rpe', 'comment'].includes(key))
    || (feeling.effort !== undefined && (typeof feeling.effort !== 'string' || !Object.hasOwn(effortLabels, feeling.effort)))
    || (feeling.rpe !== undefined && !isRpe(feeling.rpe))
    || (feeling.effort !== undefined && feeling.rpe !== undefined)
    || (feeling.comment !== undefined && (typeof feeling.comment !== 'string' || feeling.comment.length > FEELING_COMMENT_LIMIT))) {
    throw new Error(`Ressenti invalide ou commentaire dépassant ${FEELING_COMMENT_LIMIT} caractères.`);
  }
}
/** Valeur de formulaire : chaîne vide ou entier 0 à 10. Une nouvelle saisie est toujours enregistrée sur 0 à 10. */
export function feelingFromFields(rpe: string, comment: string): OptionalSessionFeeling | undefined {
  const value = { ...(rpe !== '' ? { rpe: /^\d{1,2}$/.test(rpe) ? Number(rpe) : Number.NaN } : {}), ...(comment ? { comment } : {}) };
  validateFeeling(value);
  return Object.keys(value).length ? value : undefined;
}
export const feelingRpeField = (feeling?: OptionalSessionFeeling) => {
  const rpe = feelingRpe(feeling);
  return rpe === undefined ? '' : String(rpe);
};
/** Égalité de sens : une ancienne catégorie et sa valeur convertie sont équivalentes, sans réécriture. */
export function sameFeeling(a?: OptionalSessionFeeling, b?: OptionalSessionFeeling): boolean {
  return feelingRpe(a) === feelingRpe(b) && a?.comment === b?.comment;
}
