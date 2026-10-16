import type { CoachProfileValues } from '../../types/coach-profile';
import type { RunningSession } from '../../types/session';
import type { CoachGoal, DeclaredCoachProfile, Measurement, ObservedCoachProfile, StructuredPlanningPreference, StructuredPlanningPolicy } from '../../types/evolving-coach';
import { validSessionDate } from '../analysis/session-summary';
import { validateLegacyGoal } from './profile';

/** Copie explicite, sans interprétation de regular/return ni activation d'un mode. */
export function fromLegacyProfile(profile: CoachProfileValues): DeclaredCoachProfile {
  return structuredClone({ goal: { model: 'legacy', value: profile.goal }, availability: profile.availability,
    preferences: profile.preferences, ...(profile.accompanimentMode === undefined ? {} : { legacyMode: profile.accompanimentMode }) });
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const date = (v: unknown): v is string => typeof v === 'string' && validSessionDate(v);
/** Validation structurelle uniquement : aucune faisabilité sportive déduite d'une date ou distance. */
export function validateCoachGoal(goal: unknown): string[] {
  if (!object(goal)) return ['Objectif absent ou invalide.'];
  if (goal.model === 'legacy') {
    if (Object.keys(goal).some(k => !['model', 'value'].includes(k))) return ['Champ d’objectif non reconnu.'];
    return Object.values(validateLegacyGoal(goal.value, '0001-01-01'));
  }
  if (goal.model !== 'evolving' || !['begin', 'wellbeing', 'endurance', 'speed', 'return', 'distance', 'race'].includes(String(goal.kind))) return ['Modèle ou objectif non reconnu.'];
  const allowed = ['model', 'kind', ...(goal.kind === 'distance' ? ['distanceMeters', 'targetDate'] : goal.kind === 'race' ? ['distanceMeters', 'eventDate', 'targetSeconds'] : [])];
  const errors: string[] = [];
  if (Object.keys(goal).some(k => !allowed.includes(k))) errors.push('Champ d’objectif non reconnu.');
  if ((goal.kind === 'distance' || goal.kind === 'race') && !positive(goal.distanceMeters)) errors.push('Distance cible positive et finie requise.');
  if (goal.kind === 'race' && !date(goal.eventDate)) errors.push('Date de course valide requise.');
  if (goal.kind === 'distance' && goal.targetDate !== undefined && !date(goal.targetDate)) errors.push('Date cible invalide.');
  if (goal.kind === 'race' && goal.targetSeconds !== undefined && !positive(goal.targetSeconds)) errors.push('Chrono cible positif et fini requis lorsqu’il est renseigné.');
  return errors;
}
/** Une possibilité métier n'est ni un consentement ni une prescription. */
export function structuredPlanningPolicy(goal: CoachGoal): StructuredPlanningPolicy {
  if (validateCoachGoal(goal).length) throw new Error('Objectif invalide.');
  return goal.model === 'legacy' ? 'undetermined' : goal.kind === 'wellbeing' ? 'excluded' : 'requires-explicit-preference';
}
/** Autorisation métier seulement, sans effet sur l'analyse, les conseils ou le stockage. */
export function canActivateStructuredPlanning(policy: StructuredPlanningPolicy, preference?: StructuredPlanningPreference): boolean {
  return policy === 'requires-explicit-preference' && preference === 'accepted';
}
export function measurement(value: unknown, zeroAllowed = true): Measurement {
  if (value === undefined || value === null) return { status: 'absent' };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!zeroAllowed && value === 0)) return { status: 'invalid' };
  return { status: 'available', value, origin: 'provided' };
}
/** Faits sur les résumés uniquement : ni capacités, ni diagnostic d'interruption, ni météo inférée. */
export function observeHistory(sessions: readonly RunningSession[], referenceDate: string): ObservedCoachProfile {
  if (!date(referenceDate)) throw new Error('Date de référence invalide.');
  if (new Set(sessions.map(s => s.id)).size !== sessions.length) throw new Error('Identifiants de séances dupliqués.');
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  const excluded: ObservedCoachProfile['excluded'] = [];
  const activities: ObservedCoachProfile['activities'] = [];
  for (const s of [...sessions].sort((a,b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id))) {
    if (!date(s.date) || s.date > referenceDate) {
      excluded.push({ id: s.id, reason: !date(s.date) ? 'invalid-date' : 'future-date' }); continue;
    }
    let ascent = measurement(s.ascentMeters);
    if (s.ascentEstimate && ascent.status === 'available') {
      ascent = s.ascentEstimate.meters !== ascent.value || !['complete', 'partial'].includes(s.ascentEstimate.quality)
        ? { status: 'invalid' } : { ...ascent, origin: 'estimated', status: s.ascentEstimate.quality === 'partial' ? 'partial' : 'available' };
    }
    activities.push({ id: s.id, date: s.date, ageDays: day(referenceDate) - day(s.date), calendarMonth: Number(s.date.slice(5,7)),
      distanceMeters: measurement(s.distanceMeters), durationSeconds: measurement(s.durationSeconds), ascentMeters: ascent, averageHeartRate: measurement(s.averageHeartRate, false) });
  }
  const dates = [...new Set(activities.map(s => s.date))];
  const durations = activities.flatMap(s => s.durationSeconds.status === 'available' ? [s.durationSeconds.value] : []);
  return { referenceDate, activities, excluded,
    rhythm: { activeDates: dates, gapsDays: dates.slice(1).map((d,i) => day(d) - day(dates[i])), daysSinceLatest: dates.length ? day(referenceDate)-day(dates[dates.length-1]) : null },
    durationRangeSeconds: durations.length ? { min: durations.reduce((a,b)=>Math.min(a,b)), max: durations.reduce((a,b)=>Math.max(a,b)), known: durations.length, total: activities.length } : null,
    horizons: { status: 'undetermined', reason: 'Les critères personnels de sélection des horizons restent à définir.' },
    limitations: ['L’historique importé peut être incomplet.', 'Les intervalles décrivent les jours enregistrés, pas une interruption confirmée.', 'Les durées historiques ne représentent pas les capacités actuelles.', 'Aucun niveau, état de préparation ou contexte météorologique déduit.'] };
}
