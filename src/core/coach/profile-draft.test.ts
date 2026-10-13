import { describe, expect, it } from 'vitest';
import { emptyProfileValues, type CoachProfileValues } from '../../types/coach-profile';
import { draftFrom, valuesFrom } from './profile-draft';
import { formatAvailableMinutes, maximumMinutesForDay, validateProfile } from './profile';
const today = '2026-10-10';
describe('durées disponibles par jour', () => {
  it('ouvre un ancien profil en mode simple sans inventer de durées', () => {
    const old = { ...emptyProfileValues(), availability: { minutesPerSession: 45 } };
    const draft = draftFrom(old);
    expect(draft.durationMode).toBe('simple'); expect(draft.dailyMinutes).toEqual({});
    expect(validateProfile(old, today)).toEqual({});
    expect(maximumMinutesForDay(old, 'monday')).toBeUndefined();
    expect(valuesFrom(draft).availability.minutesPerSession).toBe(45);
  });
  it('conserve des durées différentes et facultatives sans imposer autant de séances que de jours', () => {
    const d = draftFrom(emptyProfileValues());
    d.durationMode = 'custom'; d.sessions = '3';
    d.days = ['monday', 'wednesday', 'friday', 'saturday', 'sunday'];
    d.dailyMinutes = { monday: '45', wednesday: '', saturday: '90', sunday: '120' };
    const p = valuesFrom(d);
    expect(validateProfile(p, today)).toEqual({});
    expect(p.availability.maxMinutesByDay).toEqual({ monday: 45, saturday: 90, sunday: 120 });
    expect(maximumMinutesForDay(p, 'wednesday')).toBeUndefined();
    expect(maximumMinutesForDay(p, 'saturday')).toBe(90);
    expect(draftFrom(p).dailyMinutes).toEqual({ monday: '45', saturday: '90', sunday: '120' });
  });
  it('conserve les valeurs lors des changements de mode et de jours sans interpréter les valeurs inactives', () => {
    const d = draftFrom(emptyProfileValues());
    d.durationMode = 'custom'; d.days = ['monday']; d.dailyMinutes = { monday: '90' };
    d.durationMode = 'simple';
    expect(maximumMinutesForDay(valuesFrom(d), 'monday')).toBeUndefined();
    expect(draftFrom(valuesFrom(d)).dailyMinutes.monday).toBe('90');
    d.durationMode = 'custom'; d.days = [];
    expect(maximumMinutesForDay(valuesFrom(d), 'monday')).toBeUndefined();
    d.days = ['monday'];
    expect(maximumMinutesForDay(valuesFrom(d), 'monday')).toBe(90);
  });
  it.each(['0', '-1', 'abc', '1.5', '1441', 'Infinity'])('refuse la durée saisie %s même si elle est temporairement masquée', text => {
    const d = draftFrom(emptyProfileValues()); d.dailyMinutes = { monday: text };
    expect(validateProfile(valuesFrom(d), today).maxMinutesByDay).toBeDefined();
    expect(d.dailyMinutes.monday).toBe(text);
  });
  it.each([1, 1440])('accepte la borne %s minutes', minutes => {
    const p = { ...emptyProfileValues(), availability: { maxMinutesByDay: { monday: minutes } } };
    expect(validateProfile(p, today)).toEqual({});
  });
  it.each([null, [], { unknown: 45 }, { monday: null }, { monday: '45' }, { monday: NaN }])('refuse une structure de durées corrompue %j', maxMinutesByDay => {
    const p = { ...emptyProfileValues(), availability: { maxMinutesByDay } } as unknown as CoachProfileValues;
    expect(validateProfile(p, today).maxMinutesByDay).toBeDefined();
  });
  it('refuse un mode inconnu', () => {
    expect(validateProfile({ ...emptyProfileValues(), availability: { durationMode: 'unknown' } } as unknown as CoachProfileValues, today).durationMode).toBeDefined();
  });
  it.each([[45, '45 min'], [90, '1 h 30'], [120, '2 h'], [undefined, 'Durée non précisée']] as const)('présente %s minutes comme %s', (minutes, label) => {
    expect(formatAvailableMinutes(minutes)).toBe(label);
  });
});
