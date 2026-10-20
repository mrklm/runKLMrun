import { describe, expect, it } from 'vitest';
import { civilDateFromActivityStart, formatActivityTime } from './activity-time';

describe('horodatages d’activité', () => {
  it('affiche un instant UTC dans le fuseau local, avec heure d’été et d’hiver', () => {
    expect(formatActivityTime('2026-10-18T10:35:42Z', false, 'Europe/Paris')).toBe('12:35');
    expect(formatActivityTime('2026-10-18T10:35:42Z', true, 'Europe/Paris')).toBe('12:35:42');
    expect(formatActivityTime('2026-01-18T10:35:42Z', true, 'Europe/Paris')).toBe('11:35:42');
  });
  it('respecte un instant avec décalage explicite et préserve une heure sans fuseau', () => {
    expect(formatActivityTime('2026-10-18T12:35:00+02:00', false, 'Europe/Paris')).toBe('12:35');
    expect(formatActivityTime('2026-01-18T11:35:00+01:00', false, 'Europe/Paris')).toBe('11:35');
    expect(formatActivityTime('2026-10-18T12:35:42', true, 'Europe/Paris')).toBe('12:35:42');
  });
  it('dérive la date civile de la source sans décaler les heures non zonées', () => {
    expect(civilDateFromActivityStart('2026-10-18T22:30:00Z', 120)).toBe('2026-10-19');
    expect(civilDateFromActivityStart('2026-10-18T22:30:00Z', undefined, 'Europe/Paris')).toBe('2026-10-19');
    expect(civilDateFromActivityStart('2026-10-18T23:30:00+02:00', undefined, 'America/Los_Angeles')).toBe('2026-10-18');
    expect(civilDateFromActivityStart('2026-10-18T23:30:00')).toBe('2026-10-18');
  });
});
