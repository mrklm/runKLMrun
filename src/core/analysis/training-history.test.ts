import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunningSession } from '../../types/session';
import { analyzeTrainingHistory, type TrainingWeeks } from './training-history';
import { localToday } from './statistics-period';
const session = (date: string, extra: Partial<RunningSession> = {}): RunningSession => ({ id: date, title: 'Synthétique', date, durationSeconds: 3600, distanceMeters: 10000, ...extra });
const analyze = (sessions: RunningSession[], weeks: TrainingWeeks = 8, reference = '2026-10-10') => analyzeTrainingHistory(sessions, weeks, reference);
afterEach(() => vi.unstubAllEnvs());
describe('bilan récent', () => {
  it('gère un historique vide sans inventer une dernière séance', () => {
    const data = analyze([]);
    expect(data.sessionCount).toBe(0); expect(data.latest).toBeUndefined(); expect(data.longest).toBeUndefined();
    expect(data.activeWeeks).toBe(0); expect(data.distance.value).toBe(0);
  });
  it('calcule une séance avec moyennes sur toutes les semaines', () => {
    const data = analyze([session('2026-10-10')]);
    expect(data.sessionCount).toBe(1); expect(data.sessionsPerWeek).toBe(1 / 8);
    expect(data.distance.weeklyAverage).toBe(1250); expect(data.duration.weeklyAverage).toBe(450);
    expect(data.latest?.daysAgo).toBe(0);
  });
  it('distingue séances et jours et compte les blocs de sept jours', () => {
    const data = analyze([session('2026-09-13'), session('2026-09-13', { id: 'bis' }), session('2026-09-19'), session('2026-09-20')], 4);
    expect(data.sessionCount).toBe(4); expect(data.activeDays).toBe(3); expect(data.activeWeeks).toBe(2); expect(data.sessionsPerWeek).toBe(1);
  });
  it.each([[4, '2026-09-13'], [8, '2026-08-16'], [12, '2026-07-19']] as const)('respecte exactement la fenêtre %i', (weeks, start) => {
    const previous = new Date(`${start}T00:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
    const data = analyze([session(previous.toISOString().slice(0, 10)), session(start), session('2026-10-10'), session('2026-10-11')], weeks);
    expect(data.startDate).toBe(start); expect(data.sessionCount).toBe(2); expect(data.activeWeeks).toBe(2); expect(data.excluded.futureDates).toBe(1);
  });
  it('écarte les dates invalides et futures de tous les indicateurs', () => {
    const data = analyze([session('incorrecte'), session('2026-02-30'), session('2026-10-11')]);
    expect(data.excluded).toEqual({ invalidDates: 2, futureDates: 1 }); expect(data.latest).toBeUndefined(); expect(data.longest).toBeUndefined();
  });
  it('traverse une année et inclut les semaines vides', () => {
    const data = analyze([session('2025-12-07'), session('2026-01-03')], 4, '2026-01-03');
    expect(data.startDate).toBe('2025-12-07'); expect(data.activeWeeks).toBe(2); expect(data.distance.weeklyAverage).toBe(5000);
  });
  it('traverse février bissextile', () => {
    const data = analyze([session('2024-02-29')], 4, '2024-03-01');
    expect(data.startDate).toBe('2024-02-03'); expect(data.latest?.daysAgo).toBe(1);
  });
  it.each(['Europe/Paris', 'America/Los_Angeles'])('ne décale pas les dates civiles avec le fuseau %s et l’heure d’été', timezone => {
    vi.stubEnv('TZ', timezone);
    const data = analyze([session('2026-03-28', { startTime: '2026-03-28T23:30:00-07:00' })], 4, '2026-03-30');
    expect(data.startDate).toBe('2026-03-03'); expect(data.latest?.daysAgo).toBe(2);
  });
  it('fournit la référence selon la date locale plutôt que UTC', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const reference = localToday(new Date('2026-10-11T01:00:00Z'));
    expect(reference).toBe('2026-10-10'); expect(analyze([], 4, reference).startDate).toBe('2026-09-13');
  });
  it('distingue distance absente, null, zéro, négative et non finie', () => {
    const values = [undefined, null, 0, -1, NaN, Infinity, 10000];
    const data = analyze(values.map((v, i) => session('2026-10-10', { id: String(i), distanceMeters: v as number })));
    expect(data.distance).toEqual({ value: 10000, known: 2, total: 7, missing: 2, invalid: 3, weeklyAverage: 1250 });
  });
  it('distingue durée absente, nulle et invalide sans changer le nombre de séances', () => {
    const data = analyze([undefined, null, 0, -1, Infinity, NaN, 3600].map((v, i) => session('2026-10-10', { id: String(i), durationSeconds: v as number })));
    expect(data.duration).toEqual({ value: 3600, known: 2, total: 7, missing: 2, invalid: 3, weeklyAverage: 450 }); expect(data.sessionCount).toBe(7);
  });
  it('ne présente pas une absence totale de mesures comme zéro', () => {
    const data = analyze([session('2026-10-10', { distanceMeters: undefined, durationSeconds: NaN })]);
    expect(data.distance.value).toBeNull(); expect(data.duration.weeklyAverage).toBeNull(); expect(data.longest).toBeUndefined();
  });
  it('conserve une distance réellement nulle', () => {
    const data = analyze([session('2026-10-10', { distanceMeters: 0, durationSeconds: 0 })]);
    expect(data.longest?.distanceMeters).toBe(0); expect(data.distance.known).toBe(1); expect(data.duration.value).toBe(0);
  });
  it('choisit la plus grande distance de la période, non la plus longue durée', () => {
    const data = analyze([session('2020-01-01', { distanceMeters: 50000 }), session('2026-10-09', { distanceMeters: 20000, durationSeconds: undefined as unknown as number }), session('2026-10-10', { durationSeconds: 10000 })]);
    expect(data.longest).toEqual({ id: '2026-10-09', date: '2026-10-09', distanceMeters: 20000, durationSeconds: null });
  });
  it('départage les égalités sans dépendre de l’ordre et sans mutation', () => {
    const sessions = [session('2026-10-09'), session('2026-10-10', { id: 'b' }), session('2026-10-10', { id: 'a' })];
    const copy = structuredClone(sessions), data = analyze(sessions);
    expect(data.longest?.id).toBe('a'); expect(analyze([...sessions].reverse())).toEqual(data); expect(sessions).toEqual(copy);
  });
  it('recherche la dernière activité même hors période', () => {
    const data = analyze([session('2025-10-10')]);
    expect(data.sessionCount).toBe(0); expect(data.latest?.daysAgo).toBe(365); expect(data.latest?.date).toBe('2025-10-10');
  });
  it('rejette une référence ou une période invalide', () => {
    expect(() => analyze([], 4, '2026-02-30')).toThrow(); expect(() => analyze([], 5 as TrainingWeeks)).toThrow();
  });
});
