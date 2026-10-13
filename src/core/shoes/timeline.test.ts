import { expect, it } from 'vitest';
import { shoeTimeline, usageDuration } from './timeline';
import { shoeMileage } from './shoes';
import type { Shoe } from '../../types/shoe';
import type { RunningSession } from '../../types/session';
const pair = (id: string, firstUseDate: string): Shoe => ({ id, firstUseDate, name: id, isDefault: false, status: 'active', revision: 1 });
const run = (id: string, date: string, distanceMeters = 5000): RunningSession => ({ id, date, distanceMeters, title: id, durationSeconds: 1800 });
const shoes = [pair('a', '2025-02-07'), pair('b', '2026-10-15')];
const sessions = [run('before', '2025-02-06'), run('first', '2025-02-07'), run('last', '2026-10-14'), run('new', '2026-10-15')];
it('calcule une seule paire sans toucher aux résumés et sans double comptage', () => {
  const before = structuredClone(sessions);
  const result = shoeTimeline([shoes[0]], [...sessions, sessions[1]], '2026-10-16');
  expect(result.assignments).toHaveLength(3); expect(result.current).toBe('a');
  expect(shoeMileage(shoes[0], sessions, result.assignments).km).toBe(15); expect(sessions).toEqual(before);
});
it('sépare les périodes à la veille du remplacement, conserve l’ancienne paire et calcule la durée civile', () => {
  const result = shoeTimeline(shoes, sessions, '2026-10-16');
  expect(result.assignments.map(a => [a.sessionId, a.shoeId])).toEqual([['first', 'a'], ['last', 'a'], ['new', 'b']]);
  expect(result.periods[0].end).toBe('2026-10-14'); expect(result.current).toBe('b');
  expect(usageDuration('2025-02-07', '2026-10-14')).toBe('20 mois et 8 jour(s)');
});
it('recalcule après modification rétroactive', () => {
  const result = shoeTimeline([shoes[0], pair('b', '2026-10-14')], sessions, '2026-10-16');
  expect(result.assignments.find(a => a.sessionId === 'last')?.shoeId).toBe('b');
  expect(result.periods[0].end).toBe('2026-10-13');
});
it('bloque les attributions pour deux dates identiques', () => {
  const result = shoeTimeline([shoes[0], pair('duplicate', '2025-02-07')], sessions, '2026-10-16');
  expect(result.issues).toHaveLength(1); expect(result.assignments).toEqual([]); expect(result.current).toBeUndefined();
});
it('signale une date absente au lieu d’inventer une période', () => {
  expect(shoeTimeline([pair('missing', '')], sessions, '2026-10-16').issues).toHaveLength(1);
});
it('n’active pas une paire future et ignore les séances futures', () => {
  const result = shoeTimeline(shoes, sessions, '2026-10-13');
  expect(result.current).toBe('a'); expect(result.periods[1].future).toBe(true);
  expect(result.assignments).toEqual([{ sessionId: 'first', shoeId: 'a' }]);
  expect(shoeTimeline([shoes[1]], sessions, '2026-10-13').current).toBeUndefined();
});
it('exclut une date invalide et signale une distance absente sans perdre la séance', () => {
  const source = [run('bad-date', 'invalid'), { ...run('missing', '2025-02-08'), distanceMeters: undefined }];
  const result = shoeTimeline([shoes[0]], source, '2026-10-16');
  expect(result.invalidDates).toBe(1);
  expect(shoeMileage(shoes[0], source, result.assignments)).toMatchObject({ km: 0, count: 1, missing: 1 });
});
it('conserve les paires archivées dans le calcul historique', () => {
  expect(shoeTimeline([{ ...shoes[0], status: 'archived' }, shoes[1]], sessions, '2026-10-16').assignments).toHaveLength(3);
});
