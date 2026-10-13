import type { CoachProfileValues, DistanceKind, GoalKind, Terrain, Weekday } from '../../types/coach-profile';
import { validSessionDate } from '../analysis/session-summary';
export const GOALS: Record<GoalKind, string> = { regular: 'Courir régulièrement', return: 'Reprendre la course', endurance: 'Améliorer son endurance', distance: 'Préparer une distance', race: 'Préparer une compétition' };
export const DISTANCES: Record<DistanceKind, { label: string; meters?: number }> = { '5k': { label: '5 km', meters: 5000 }, '10k': { label: '10 km', meters: 10000 }, half: { label: 'Semi-marathon', meters: 21097.5 }, marathon: { label: 'Marathon', meters: 42195 }, custom: { label: 'Distance personnalisée' } };
export const DAYS: Record<Weekday, string> = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
export const TERRAINS: Record<Terrain, string> = { none: 'Sans préférence', road: 'Route', trail: 'Chemins / sentiers', treadmill: 'Tapis de course' };
export type ProfileErrors = Partial<Record<'form' | 'goal' | 'distance' | 'targetDate' | 'sessionsPerWeek' | 'days' | 'minutesPerSession' | 'terrain' | 'durationMode' | 'maxMinutesByDay', string>>;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (options: object, key: unknown) => typeof key === 'string' && Object.hasOwn(options, key);
/** Une échéance passée déjà enregistrée reste lisible/modifiable sans effacement forcé. */
export function validateProfile(values: CoachProfileValues, today: string, previous?: CoachProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!validSessionDate(today) || !object(values) || !object(values.goal) || !object(values.availability) || !object(values.preferences)) return { form: 'Le profil est invalide. Vérifiez les données renseignées.' };
  const { goal, availability: a, preferences } = values;
  if (goal.kind !== undefined && !has(GOALS, goal.kind)) errors.goal = 'Choisissez un objectif reconnu.';
  if (goal.distance !== undefined) {
    const d = goal.distance;
    if (!object(d) || !has(DISTANCES, d.kind) || typeof d.meters !== 'number' || !Number.isFinite(d.meters) || d.meters <= 0 || d.meters > Number.MAX_SAFE_INTEGER
      || (d.kind !== 'custom' && d.meters !== DISTANCES[d.kind]?.meters)) errors.distance = 'Renseignez une distance strictement positive et valide.';
  }
  if (goal.targetDate !== undefined && (typeof goal.targetDate !== 'string' || !validSessionDate(goal.targetDate))) errors.targetDate = 'Renseignez une date calendaire valide.';
  else if (goal.targetDate !== undefined && goal.targetDate < today && goal.targetDate !== previous?.goal?.targetDate) errors.targetDate = 'Choisissez une échéance aujourd’hui ou à venir.';
  if (a.sessionsPerWeek !== undefined && (!Number.isInteger(a.sessionsPerWeek) || a.sessionsPerWeek < 0 || a.sessionsPerWeek > 7)) errors.sessionsPerWeek = 'Indiquez un nombre entier de séances entre 0 et 7.';
  if (a.days !== undefined && (!Array.isArray(a.days) || a.days.some(day => !has(DAYS, day)) || new Set(a.days).size !== a.days.length)) errors.days = 'Choisissez des jours reconnus, sans doublon.';
  if (!errors.days && !errors.sessionsPerWeek && a.days !== undefined && a.sessionsPerWeek !== undefined && a.sessionsPerWeek > a.days.length) errors.days = `Vous souhaitez ${a.sessionsPerWeek} séances mais avez choisi ${a.days.length} jours. Ajustez vos choix ; cette étape prévoit au plus une séance par jour disponible.`;
  if (a.minutesPerSession !== undefined && (!Number.isInteger(a.minutesPerSession) || a.minutesPerSession < 1 || a.minutesPerSession > 1440)) errors.minutesPerSession = 'Indiquez une durée entière entre 1 et 1 440 minutes (une journée).';
  if (a.durationMode !== undefined && a.durationMode !== 'simple' && a.durationMode !== 'custom') errors.durationMode = 'Choisissez un mode de durée reconnu.';
  if (a.maxMinutesByDay !== undefined && (!object(a.maxMinutesByDay) || Object.entries(a.maxMinutesByDay).some(([day, minutes]) => !has(DAYS, day) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440))) errors.maxMinutesByDay = 'Indiquez des durées entières entre 1 et 1 440 minutes. Pour corriger une durée masquée, réactivez la personnalisation et sélectionnez le jour concerné.';
  if (preferences.terrain !== undefined && !has(TERRAINS, preferences.terrain)) errors.terrain = 'Choisissez un terrain reconnu.';
  return errors;
}

/** Les valeurs mémorisées mais inactives ne constituent pas des disponibilités. */
export function maximumMinutesForDay(profile: CoachProfileValues, day: Weekday): number | undefined {
  const a = profile.availability;
  return a.durationMode === 'custom' && a.days?.includes(day) ? a.maxMinutesByDay?.[day] : undefined;
}
export function formatAvailableMinutes(minutes: number | undefined): string {
  if (minutes === undefined) return 'Durée non précisée';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest}` : ''}` : `${rest} min`;
}
