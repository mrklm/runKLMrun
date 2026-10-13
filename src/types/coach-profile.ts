export const LOCAL_PROFILE_ID = 'local' as const;
export type GoalKind = 'regular' | 'return' | 'endurance' | 'distance' | 'race';
export type DistanceKind = '5k' | '10k' | 'half' | 'marathon' | 'custom';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type Terrain = 'none' | 'road' | 'trail' | 'treadmill';
/** Uniquement des choix déclarés. undefined = non renseigné ; aucune suggestion implicite. */
export interface CoachProfileValues {
  goal: { kind?: GoalKind; distance?: { kind: DistanceKind; meters: number }; targetDate?: string };
  availability: { sessionsPerWeek?: number; days?: Weekday[]; minutesPerSession?: number; durationMode?: 'simple' | 'custom'; maxMinutesByDay?: Partial<Record<Weekday, number>> };
  preferences: { terrain?: Terrain };
}
export interface CoachProfile extends CoachProfileValues {
  id: typeof LOCAL_PROFILE_ID;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export const emptyProfileValues = (): CoachProfileValues => ({ goal: {}, availability: {}, preferences: {} });
