import type { RunningSession } from '../../types/session';
import type { LoadCoefficients, RunnerProfile } from '../../types/runner-profile';

/** Garde-fous de saisie contre les fautes de frappe, pas des seuils sportifs. */
export const RESTING_HEART_RATE_RANGE = { min: 25, max: 120 } as const;
export const MAX_HEART_RATE_RANGE = { min: 100, max: 230 } as const;
export const loadCoefficientLabels: Readonly<Record<LoadCoefficients, string>> = {
  female: 'Femme', male: 'Homme', unspecified: 'Non précisé (approximation)',
};
export const isLoadCoefficients = (value: unknown): value is LoadCoefficients =>
  typeof value === 'string' && Object.hasOwn(loadCoefficientLabels, value);

type HeartRateSettings = Pick<RunnerProfile, 'restingHeartRate' | 'maxHeartRate' | 'loadCoefficients'>;
const integerIn = (value: unknown, range: { min: number; max: number }) =>
  typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max;

/** Messages destinés à l'interface ; tableau vide si les réglages sont valides ou absents. */
export function heartRateSettingsErrors(value: HeartRateSettings): string[] {
  const errors: string[] = [];
  if (value.restingHeartRate !== undefined && !integerIn(value.restingHeartRate, RESTING_HEART_RATE_RANGE))
    errors.push(`La fréquence cardiaque au repos doit être un nombre entier entre ${RESTING_HEART_RATE_RANGE.min} et ${RESTING_HEART_RATE_RANGE.max}.`);
  if (value.maxHeartRate !== undefined && !integerIn(value.maxHeartRate, MAX_HEART_RATE_RANGE))
    errors.push(`La fréquence cardiaque maximale doit être un nombre entier entre ${MAX_HEART_RATE_RANGE.min} et ${MAX_HEART_RATE_RANGE.max}.`);
  if (value.restingHeartRate !== undefined && value.maxHeartRate !== undefined && value.restingHeartRate >= value.maxHeartRate)
    errors.push('La fréquence cardiaque au repos doit être inférieure à la fréquence cardiaque maximale.');
  if (value.loadCoefficients !== undefined && !isLoadCoefficients(value.loadCoefficients))
    errors.push('Les coefficients de calcul de la charge sont invalides.');
  return errors;
}

/** Pondération de Banister (TRIMP) selon la fraction de réserve cardiaque x.
 * « Non précisé » : moyenne des deux courbes publiées, approximation documentée. */
function banisterWeight(x: number, coefficients: LoadCoefficients): number {
  const male = 0.64 * Math.exp(1.92 * x), female = 0.86 * Math.exp(1.67 * x);
  return coefficients === 'male' ? male : coefficients === 'female' ? female : (male + female) / 2;
}

/** Charge cardiaque estimée (TRIMP de Banister) à partir de la FC moyenne et de la durée.
 * Aucune valeur sans réglages complets, sans FC moyenne, avec FC exclue ou hors de la réserve cardiaque.
 * Non branchée dans le Coach : fonction d'étude. */
export function estimatedCardioLoad(
  session: Pick<RunningSession, 'durationSeconds' | 'averageHeartRate' | 'heartRateIgnored'>,
  settings: HeartRateSettings,
): number | undefined {
  const { restingHeartRate: rest, maxHeartRate: max, loadCoefficients } = settings;
  if (session.heartRateIgnored || rest === undefined || max === undefined || loadCoefficients === undefined) return undefined;
  if (heartRateSettingsErrors(settings).length) return undefined;
  const hr = session.averageHeartRate, duration = session.durationSeconds;
  if (typeof hr !== 'number' || !Number.isFinite(hr) || !(duration > 0)) return undefined;
  const x = (hr - rest) / (max - rest);
  if (x < 0 || x > 1) return undefined;
  return duration / 60 * x * banisterWeight(x, loadCoefficients);
}
