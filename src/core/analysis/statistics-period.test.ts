import { afterEach, describe, expect, it, vi } from 'vitest';
import { activatePeriod, localToday, periodStatistics } from './statistics-period';
import type { RunningSession } from '../../types/session';
const session = (date: string, extra: Partial<RunningSession> = {}): RunningSession => ({ id: date, title: 'Synthétique', date, durationSeconds: 600, distanceMeters: 1000, ascentMeters: 10, ...extra });
const calculate = (dates: string[], mode: 'week' | 'month' | 'year' | 'all', today: string) => periodStatistics(dates.map(d => session(d)), activatePeriod(mode, today), today);
afterEach(() => vi.unstubAllEnvs());
describe('périodes statistiques', () => {
  it('compte aujourd’hui et six jours précédents, à cheval sur deux années', () => {
    const result = calculate(['2025-12-27', '2025-12-28', '2026-01-03', '2026-01-04'], 'week', '2026-01-03');
    expect(result.totals.count).toBe(2); expect(result.distancePeriods).toHaveLength(7);
    expect(result.distancePeriods[0].key).toBe('2025-12-28'); expect(result.distancePeriods.at(-1)?.key).toBe('2026-01-03');
    expect(result.totals.distance.value).toBe(2000); expect(result.totals.duration.value).toBe(1200); expect(result.totals.ascent.value).toBe(20);
  });
  it('filtre février bissextile avec 29 agrégats journaliers', () => {
    const result = calculate(['2024-01-31', '2024-02-01', '2024-02-29', '2024-03-01'], 'month', '2024-02-10');
    expect(result.totals.count).toBe(2); expect(result.countPeriods).toHaveLength(29);
    expect(result.countPeriods.at(-1)?.totals.count).toBe(1);
  });
  it('respecte les changements de mois et de calendrier sans semaine civile', () => {
    const result = calculate(['2026-03-25', '2026-03-26', '2026-04-01'], 'week', '2026-04-01');
    expect(result.totals.count).toBe(2); expect(result.countPeriods.map(p => p.key)).toEqual(['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01']);
  });
  it('filtre l’année civile avant de regrouper en semaines ISO', () => {
    const result = calculate(['2020-12-31', '2021-01-01', '2021-12-31', '2022-01-01'], 'year', '2021-06-01');
    expect(result.totals.count).toBe(2); expect(result.countPeriods).toHaveLength(12);
    expect(result.distancePeriods[0].key).toBe('2020-12-28');
    expect(result.distancePeriods.reduce((sum, p) => sum + p.totals.count, 0)).toBe(2);
  });
  it('inclut toutes les séances dans Tout et signale celles non classables', () => {
    const result = calculate(['2020-01-01', '2026-12-31', 'inconnue'], 'all', '2026-01-01');
    expect(result.totals.count).toBe(3); expect(result.excludedDates).toBe(1);
    expect(result.countPeriods.reduce((sum, p) => sum + p.totals.count, 0)).toBe(2);
  });
  it('gère une période vide et garde les dates sans mesure à zéro séance', () => {
    const result = calculate(['2020-01-01'], 'week', '2026-01-01');
    expect(result.totals.count).toBe(0); expect(result.distancePeriods.every(p => p.totals.count === 0)).toBe(true);
  });
  it('conserve les mesures partielles et ne modifie aucune séance', () => {
    const sessions = [session('2026-01-01', { distanceMeters: undefined }), session('2026-01-02', { distanceMeters: 0 })];
    const before = structuredClone(sessions), result = periodStatistics(sessions, activatePeriod('month', '2026-01-01'), '2026-01-01');
    expect(result.totals.distance).toEqual({ value: 0, known: 1, total: 2 }); expect(sessions).toEqual(before);
  });
  it('réinitialise le mois et l’année lors de l’activation du mode', () => {
    expect(activatePeriod('month', '2026-10-11')).toEqual({ mode: 'month', year: '2026', month: '10' });
    expect(activatePeriod('year', '2026-10-11').year).toBe('2026');
  });
  it('utilise le calendrier local et non la date UTC près de minuit', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(localToday(new Date('2026-01-04T01:00:00Z'))).toBe('2026-01-03');
  });
});
