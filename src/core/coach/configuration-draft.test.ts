import { expect, it } from 'vitest';
import { configurationDraft, configurationValues, COACH_GOALS } from './configuration-draft';
it('présente sept objectifs sans défaut ni accord implicite', () => {
  expect(Object.keys(COACH_GOALS)).toHaveLength(7);
  expect(configurationDraft()).toMatchObject({ goal: '', planning: 'unexpressed', experience: '' });
  expect(()=>configurationValues(configurationDraft())).toThrow();
  for (const goal of Object.keys(COACH_GOALS)) {
    const values = configurationValues({ ...configurationDraft(), goal, distanceKm: '12,5', date: '2027-02-01' });
    expect(values.goal.kind).toBe(goal);
    expect(values.structuredPlanningPreference).toBe(goal === 'wellbeing' ? 'declined' : 'unexpressed');
  }
});
it('préserve une configuration au passage par le formulaire, avec chrono facultatif', () => {
  const draft = { ...configurationDraft(), goal: 'race', distanceKm: '12,5', date: '2027-02-01', chrono: '01:05:30', experience: 'observe', planning: 'accepted' as const };
  const values = configurationValues(draft);
  expect(values.goal).toMatchObject({ distanceMeters: 12500, targetSeconds: 3930 });
  expect(configurationValues(configurationDraft(values))).toEqual(values);
  expect(configurationValues({ ...draft, chrono: '' }).goal).not.toHaveProperty('targetSeconds');
});
it('valide champs conditionnels, dates, distance et chrono sans inventer de faisabilité', () => {
  const draft = { ...configurationDraft(), goal: 'distance', distanceKm: '8' };
  expect(configurationValues(draft).goal).toEqual({ model: 'evolving', kind: 'distance', distanceMeters: 8000 });
  for (const distanceKm of ['', '0', '-2', 'Infinity', '1e3', 'abc']) expect(()=>configurationValues({ ...draft, distanceKm })).toThrow();
  expect(()=>configurationValues({ ...draft, date: '2027-02-29' })).toThrow();
  expect(()=>configurationValues({ ...draft, goal: 'race' })).toThrow();
  for (const chrono of ['00:00:00', '01:60:00', '1h', '-01:00:00']) expect(()=>configurationValues({ ...draft, goal: 'race', date: '2027-01-01', chrono })).toThrow();
  expect(configurationValues({ ...draft, goal: 'endurance', distanceKm: 'invalide', date: 'invalide', chrono: 'invalide' }).goal).toEqual({ model: 'evolving', kind: 'endurance' });
});
it('conserve les expériences et préférences explicites ; plaisir exclut le programme', () => {
  for (const experience of ['beginner','intermediate','experienced','observe']) for (const planning of ['accepted','declined','unexpressed'] as const) {
    expect(configurationValues({ ...configurationDraft(), goal: 'begin', experience, planning })).toMatchObject({ experience, structuredPlanningPreference: planning });
  }
  expect(configurationValues({ ...configurationDraft(), goal: 'wellbeing', planning: 'accepted' }).structuredPlanningPreference).toBe('declined');
});
