import { describe, expect, it } from 'vitest';
import { classifyDetails, DETAIL_RETENTION_MS, shouldKeepDetails } from './detail-retention';
const reference = new Date('2026-10-13T12:00:00Z');
const session = { date: '2026-09-13', startTime: '2026-09-13T12:00:00Z' };
describe('conservation des détails', () => {
  it('conserve la frontière exacte et les séances récentes', () => {
    expect(shouldKeepDetails(session, reference)).toBe(true);
    expect(shouldKeepDetails(session, new Date(reference.getTime() - 1))).toBe(true);
    expect(DETAIL_RETENTION_MS).toBe(2592000000);
  });
  it('écarte une séance ancienne, dès un milliseconde après la frontière', () => {
    expect(shouldKeepDetails(session, new Date(reference.getTime() + 1))).toBe(false);
  });
  it.each([undefined, '', 'invalide', '2026-02-30'])('conserve une date incertaine %s', date => {
    expect(shouldKeepDetails({ date }, reference)).toBe(true);
  });
  it('conserve les heures invalides, incohérentes, futures et une référence invalide', () => {
    for (const startTime of ['invalide', '2026-09-12T12:00:00Z']) expect(shouldKeepDetails({ ...session, startTime }, reference)).toBe(true);
    expect(shouldKeepDetails(session, new Date('invalid'))).toBe(true);
    expect(shouldKeepDetails(session, new Date('2026-01-01'))).toBe(true);
  });
  it('traite le fuseau explicitement et conserve prudemment les dates sans fuseau', () => {
    expect(shouldKeepDetails({ ...session, startTime: '2026-09-13T14:00:00+02:00' }, reference)).toBe(true);
    expect(shouldKeepDetails({ ...session, startTime: '2026-09-13T14:00:00', timezoneOffsetMinutes: 120 }, reference)).toBe(true);
    expect(shouldKeepDetails({ date: session.date }, reference)).toBe(true);
    expect(shouldKeepDetails({ date: '2026-09-01' }, reference)).toBe(false);
  });
});

it.each(['2026-09-13T24:00:00Z', '2026-09-13T12:60:00Z', '2026-09-13T12:00:60Z'])('classe une heure invalide comme incertaine : %s', startTime => {
  expect(classifyDetails({ date: '2026-09-13', startTime }, reference)).toBe('uncertain');
});
