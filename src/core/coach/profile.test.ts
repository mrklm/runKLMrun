import { describe, expect, it } from 'vitest';
import { emptyProfileValues, type CoachProfileValues, type GoalKind, type Weekday } from '../../types/coach-profile';
import { GOALS, DISTANCES, validateProfile } from './profile';
const today = '2026-10-10';
describe('validation du profil déclaré', () => {
  it('autorise les champs non renseignés sans valeurs déduites', () => {
    const values = emptyProfileValues(); expect(validateProfile(values, today)).toEqual({}); expect(values.availability.days).toBeUndefined(); expect(values.preferences.terrain).toBeUndefined();
  });
  it.each(Object.keys(GOALS) as GoalKind[])('reconnaît l’objectif %s', kind => {
    expect(validateProfile({ ...emptyProfileValues(), goal: { kind } }, today)).toEqual({});
  });
  it.each(Object.entries(DISTANCES).filter(([key]) => key !== 'custom'))('valide la distance prédéfinie %s', (kind, d) => {
    expect(validateProfile({ ...emptyProfileValues(), goal: { kind: 'race', distance: { kind: kind as '5k', meters: d.meters! } } }, today)).toEqual({});
  });
  it('accepte une distance personnalisée sans échéance', () => {
    expect(validateProfile({ ...emptyProfileValues(), goal: { kind: 'distance', distance: { kind: 'custom', meters: 12500 } } }, today)).toEqual({});
  });
  it.each([0, -1, NaN, Infinity])('refuse une distance personnalisée invalide %s', meters => {
    expect(validateProfile({ ...emptyProfileValues(), goal: { distance: { kind: 'custom', meters } } }, today).distance).toBeDefined();
  });
  it('refuse un objectif inconnu et une valeur prédéfinie altérée', () => {
    const values = { ...emptyProfileValues(), goal: { kind: 'unknown', distance: { kind: '5k', meters: 10000 } } } as unknown as CoachProfileValues;
    expect(validateProfile(values, today)).toMatchObject({ goal: expect.any(String), distance: expect.any(String) });
  });
  it.each(['2026-02-30', '2026-10-09', '2026-2-1'])('refuse une échéance nouvellement saisie invalide ou passée %s', targetDate => {
    expect(validateProfile({ ...emptyProfileValues(), goal: { targetDate } }, today).targetDate).toBeDefined();
  });
  it('accepte aujourd’hui, les dates futures et une ancienne échéance inchangée', () => {
    for (const targetDate of [today, '2028-02-29']) expect(validateProfile({ ...emptyProfileValues(), goal: { targetDate } }, today)).toEqual({});
    const previous = { ...emptyProfileValues(), goal: { targetDate: '2026-01-01' } };
    expect(validateProfile(previous, today, previous)).toEqual({});
  });
  it('distingue sans préférence de non renseigné et jours vides de jours inconnus', () => {
    const values: CoachProfileValues = { goal: {}, availability: { days: [], sessionsPerWeek: 0 }, preferences: { terrain: 'none' } };
    expect(validateProfile(values, today)).toEqual({}); expect(values).not.toEqual(emptyProfileValues());
  });
  it('signale les incohérences sans changer les choix', () => {
    const values: CoachProfileValues = { ...emptyProfileValues(), availability: { sessionsPerWeek: 3, days: ['monday', 'friday'] } };
    const before = structuredClone(values); expect(validateProfile(values, today).days).toContain('3 séances'); expect(values).toEqual(before);
  });
  it.each([-1, 1.5, 8, NaN])('refuse un nombre de séances invalide %s', sessionsPerWeek => {
    expect(validateProfile({ ...emptyProfileValues(), availability: { sessionsPerWeek } }, today).sessionsPerWeek).toBeDefined();
  });
  it('refuse les doublons et jours inconnus', () => {
    for (const days of [['monday', 'monday'], ['unknown']]) expect(validateProfile({ ...emptyProfileValues(), availability: { days: days as Weekday[] } }, today).days).toBeDefined();
  });
  it.each([0, -1, 1.5, 1441, Infinity])('refuse une durée invalide %s', minutesPerSession => {
    expect(validateProfile({ ...emptyProfileValues(), availability: { minutesPerSession } }, today).minutesPerSession).toBeDefined();
  });
  it('valide les limites de durée et rejette les structures corrompues', () => {
    for (const minutesPerSession of [1, 1440]) expect(validateProfile({ ...emptyProfileValues(), availability: { minutesPerSession } }, today)).toEqual({});
    expect(validateProfile(null as unknown as CoachProfileValues, today).form).toBeDefined();
    expect(validateProfile({ ...emptyProfileValues(), preferences: { terrain: 'unknown' } } as unknown as CoachProfileValues, today).terrain).toBeDefined();
  });
});
