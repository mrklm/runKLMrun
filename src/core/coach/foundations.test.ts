import { validateLegacyGoal } from './profile';
import type { CoachGoal } from '../../types/evolving-coach';
import { canActivateStructuredPlanning } from './foundations';
import { describe, expect, it } from 'vitest';
import { emptyProfileValues, type GoalKind } from '../../types/coach-profile';
import type { RunningSession } from '../../types/session';
import { fromLegacyProfile, measurement, observeHistory, structuredPlanningPolicy, validateCoachGoal } from './foundations';
const session = (id: string, date: string, durationSeconds = 1800): RunningSession => ({ id, date, title: 'Synthétique', durationSeconds });
describe('fondations indépendantes du Coach', () => {
  it.each<GoalKind>(['regular', 'return', 'endurance', 'distance', 'race'])('conserve sans correspondance l’objectif historique %s', kind => {
    const old = { ...emptyProfileValues(), goal: { kind }, accompanimentMode: 'advisor' as const };
    const copy = structuredClone(old), declared = fromLegacyProfile(old);
    expect(declared.goal).toEqual({ model: 'legacy', value: { kind } });
    expect(declared.legacyMode).toBe('advisor');
    expect(declared.experience).toBeUndefined();
    expect(structuredPlanningPolicy(declared.goal)).toBe('undetermined');
    expect(old).toEqual(copy);
    declared.availability.days = ['monday']; expect(old).toEqual(copy);
  });
  it('conserve aussi le marqueur trainer sans modifier sa validation persistante', () => {
    expect(fromLegacyProfile({ ...emptyProfileValues(), accompanimentMode: 'trainer' }).legacyMode).toBe('trainer');
  });
  it('distingue les sept nouveaux objectifs et exclut la planification plaisir', () => {
    for (const kind of ['begin', 'wellbeing', 'endurance', 'speed', 'return'] as const) {
      expect(validateCoachGoal({ model: 'evolving', kind })).toEqual([]);
      expect(structuredPlanningPolicy({ model: 'evolving', kind })).toBe(kind === 'wellbeing' ? 'excluded' : 'requires-explicit-preference');
    }
    expect(validateCoachGoal({ model: 'evolving', kind: 'regular' })).not.toEqual([]);
  });
  it('autorise distance sans date/chrono et course sans chrono, sans évaluer la faisabilité', () => {
    expect(validateCoachGoal({ model: 'evolving', kind: 'distance', distanceMeters: 7000 })).toEqual([]);
    const race = { model: 'evolving', kind: 'race', distanceMeters: 10000, eventDate: '2020-02-29' };
    expect(validateCoachGoal(race)).toEqual([]);
    expect(validateCoachGoal({ ...race, targetSeconds: 3600 })).toEqual([]);
    for (const value of [0, -1, Infinity, NaN]) expect(validateCoachGoal({ ...race, targetSeconds: value })).not.toEqual([]);
    expect(validateCoachGoal({ ...race, eventDate: '2026-02-29' })).not.toEqual([]);
    expect(validateCoachGoal({ ...race, eventDate: undefined })).not.toEqual([]);
    expect(validateCoachGoal({ ...race, distanceMeters: 0 })).not.toEqual([]);
    expect(validateCoachGoal({ model: 'evolving', kind: 'distance', distanceMeters: 7000, targetSeconds: 100 })).not.toEqual([]);
    expect(validateCoachGoal(null)).not.toEqual([]);
  });
  it('ne crée aucun repère numérique sans historique', () => {
    const result = observeHistory([], '2026-10-15');
    expect(result.activities).toEqual([]); expect(result.rhythm.daysSinceLatest).toBeNull();
    expect(result.durationRangeSeconds).toBeNull(); expect(result.horizons.status).toBe('undetermined');
  });
  it('expose ancienneté, variabilité et intervalles sans classification ni seuil de fréquence', () => {
    const rows = [session('ancien', '2023-10-15', 7200), session('a', '2026-09-01', 1200), session('b', '2026-09-16', 2400), session('c', '2026-10-01', 1800), session('d', '2026-10-01', 900)];
    const before = structuredClone(rows), r = observeHistory(rows, '2026-10-15');
    expect(r.activities[0].ageDays).toBeGreaterThan(1000);
    expect(r.rhythm.gapsDays.slice(-2)).toEqual([15,15]);
    expect(r.rhythm.daysSinceLatest).toBe(14);
    expect(r.durationRangeSeconds).toEqual({ min: 900, max: 7200, known: 5, total: 5 });
    expect(r.horizons.status).toBe('undetermined');
    expect(r).not.toHaveProperty('experience'); expect(r).not.toHaveProperty('capacity');
    expect(observeHistory([...rows].reverse(), '2026-10-15')).toEqual(r); expect(rows).toEqual(before);
  });
  it('distingue météo inconnue, mois connu, valeurs absentes, invalides, zéro et D+ partiel', () => {
    const r = observeHistory([{ ...session('a', '2026-07-01'), ascentMeters: 0, averageHeartRate: 0 },
      { ...session('b', '2026-10-01'), durationSeconds: NaN, ascentMeters: 12, ascentEstimate: { meters: 12, method: 'hysteresis-3m-v1', quality: 'partial' } }], '2026-10-15');
    expect(r.activities[0].calendarMonth).toBe(7); expect(r.activities[0]).not.toHaveProperty('weather');
    expect(r.activities[0].ascentMeters).toMatchObject({ status: 'available', value: 0 });
    expect(r.activities[0].averageHeartRate.status).toBe('invalid');
    expect(r.activities[0].distanceMeters.status).toBe('absent');
    expect(r.activities[1].ascentMeters).toMatchObject({ status: 'partial', origin: 'estimated' });
    expect(r.durationRangeSeconds?.known).toBe(1);
    expect(measurement(undefined)).toEqual({ status: 'absent' });
    expect(measurement(Infinity)).toEqual({ status: 'invalid' });
  });
  it('écarte les dates invalides et futures et refuse référence invalide ou doublons', () => {
    const r = observeHistory([session('a', ''),session('b', '2027-01-01')], '2026-10-15');
    expect(r.activities).toEqual([]); expect(r.excluded.map(e=>e.reason)).toEqual(['invalid-date','future-date']);
    expect(()=>observeHistory([], 'invalide')).toThrow();
    expect(()=>observeHistory([session('a','2026-01-01'),session('a','2026-01-02')], '2026-10-15')).toThrow();
  });
});

describe('consolidation : validation historique et consentement', () => {
  it.each<GoalKind>(['regular', 'return', 'endurance', 'distance', 'race'])('préserve tous les paramètres historiques de %s sans mutation', kind => {
    const value = { kind, distance: { kind: 'custom', meters: 7200 }, targetDate: '2020-02-29', extra: 'conservé' };
    const before = structuredClone(value);
    expect(validateCoachGoal({ model: 'legacy', value })).toEqual([]);
    expect(value).toEqual(before);
    expect(validateCoachGoal({ model: 'legacy', value: { kind } })).toEqual([]);
  });
  it('réutilise les bornes, distances prédéfinies et dates sans durcir les champs inconnus', () => {
    for (const value of [null, [], { kind: 'wellbeing' }, { distance: { kind: '5k', meters: 4999 } },
      { distance: { kind: 'custom', meters: Infinity } }, { distance: { kind: 'custom', meters: 0 } },
      { distance: { kind: 'custom', meters: Number.MAX_SAFE_INTEGER + 1 } }, { targetDate: '2026-02-29' }]) {
      expect(validateCoachGoal({ model: 'legacy', value }).length).toBeGreaterThan(0);
    }
    expect(validateCoachGoal({ model: 'legacy', value: { distance: { kind: '5k', meters: 5000, extra: true }, extra: true } })).toEqual([]);
    expect(validateCoachGoal({ model: 'legacy', value: {}, extra: true }).length).toBeGreaterThan(0);
    expect(validateLegacyGoal({ targetDate: '2020-01-01' }, '2026-10-15').targetDate).toBeDefined();
    expect(validateLegacyGoal({ targetDate: '2020-01-01' }, '2026-10-15', { targetDate: '2020-01-01' })).toEqual({});
  });
  it('teste chaque objectif et chaque préférence, sans consentement implicite', () => {
    const goals: CoachGoal[] = [
      ...(['regular','return','endurance','distance','race'] as GoalKind[]).map(kind => ({ model: 'legacy' as const, value: { kind } })),
      ...(['begin','wellbeing','endurance','speed','return'] as const).map(kind => ({ model: 'evolving' as const, kind })),
      { model: 'evolving', kind: 'distance', distanceMeters: 8000 },
      { model: 'evolving', kind: 'race', distanceMeters: 10000, eventDate: '2027-01-01' },
    ];
    for (const goal of goals) for (const preference of [undefined, 'unexpressed', 'declined', 'accepted'] as const) {
      const policy = structuredPlanningPolicy(goal);
      expect(canActivateStructuredPlanning(policy, preference)).toBe(goal.model === 'evolving' && goal.kind !== 'wellbeing' && preference === 'accepted');
    }
    const policy = structuredPlanningPolicy({ model: 'evolving', kind: 'begin' });
    expect(canActivateStructuredPlanning(policy, 'accepted')).toBe(true);
    expect(canActivateStructuredPlanning(policy, 'declined')).toBe(false);
    for (const accompanimentMode of ['advisor', 'trainer'] as const) {
      expect(fromLegacyProfile({ ...emptyProfileValues(), accompanimentMode }).structuredPlanningPreference).toBeUndefined();
    }
  });
});
