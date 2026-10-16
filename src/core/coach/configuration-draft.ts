import type { EvolvingCoachValues, DeclaredExperience, StructuredPlanningPreference } from '../../types/evolving-coach';
import { validateCoachGoal } from './foundations';
import { validateEvolvingCoachValues } from './configuration';
export const COACH_GOALS = { begin: 'Débuter la course à pied', wellbeing: 'Courir pour le plaisir et la forme', return: 'Reprendre la course à pied', endurance: 'Améliorer son endurance', speed: 'Améliorer sa vitesse', distance: 'Atteindre une distance', race: 'Préparer une course' } as const;
export const EXPERIENCES: Record<DeclaredExperience, string> = { beginner: 'Débutant', intermediate: 'Intermédiaire', experienced: 'Expérimenté', observe: 'Je ne sais pas, évalue mon niveau' };
export interface ConfigurationDraft { goal: string; distanceKm: string; date: string; chrono: string; experience: string; planning: StructuredPlanningPreference }
const formatChrono = (seconds: number) => {
  const [whole, fraction] = String(seconds % 60).split('.');
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2,'0')}:${whole.padStart(2,'0')}${fraction ? `.${fraction}` : ''}`;
};
export function configurationDraft(value?: EvolvingCoachValues | null): ConfigurationDraft {
  const goal = value?.goal;
  return { goal: goal?.kind ?? '', distanceKm: goal && 'distanceMeters' in goal ? String(goal.distanceMeters / 1000) : '',
    date: goal?.kind === 'race' ? goal.eventDate : goal?.kind === 'distance' ? goal.targetDate ?? '' : '',
    chrono: goal?.kind === 'race' && goal.targetSeconds !== undefined ? formatChrono(goal.targetSeconds) : '',
    experience: value?.experience ?? '', planning: value?.structuredPlanningPreference ?? 'unexpressed' };
}
export function configurationValues(draft: ConfigurationDraft): EvolvingCoachValues {
  if (!Object.hasOwn(COACH_GOALS, draft.goal)) throw new Error('Choisissez votre objectif.');
  const kind = draft.goal as keyof typeof COACH_GOALS;
  const km = /^\d+(?:[.,]\d+)?$/.test(draft.distanceKm.trim()) ? Number(draft.distanceKm.trim().replace(',', '.')) : NaN;
  const distanceMeters = km * 1000;
  let targetSeconds: number | undefined;
  if (kind === 'race' && draft.chrono.trim()) {
    const match = /^(\d+):([0-5]\d):([0-5]\d(?:[.,]\d+)?)$/.exec(draft.chrono.trim());
    if (!match) throw new Error('Saisissez le chrono sous la forme hh:mm:ss, par exemple 01:05:00, ou laissez-le vide.');
    targetSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3].replace(',', '.'));
  }
  const goal: EvolvingCoachValues['goal'] = kind === 'race' ? { model: 'evolving', kind, distanceMeters, eventDate: draft.date, ...(targetSeconds !== undefined ? { targetSeconds } : {}) }
    : kind === 'distance' ? { model: 'evolving', kind, distanceMeters, ...(draft.date ? { targetDate: draft.date } : {}) } : { model: 'evolving', kind };
  const errors = validateCoachGoal(goal);
  if (errors.length) throw new Error(errors.join(' '));
  const value = { goal, ...(draft.experience ? { experience: draft.experience } : {}), structuredPlanningPreference: kind === 'wellbeing' ? 'declined' : draft.planning };
  validateEvolvingCoachValues(value); return value;
}
