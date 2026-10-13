import { describe, it, expect } from 'vitest';
import { compareTraining } from './comparison';
import { coachObservations } from './observations';
import { emptyProfileValues } from '../../types/coach-profile';
import type { RunningSession } from '../../types/session';
const session = (id: string, date: string, distanceMeters?: number): RunningSession => ({ id, date, title: id, distanceMeters, durationSeconds: 600 });
const reference = '2026-10-13';
describe('comparaison et observations locales', () => {
  it('compare des fenêtres consécutives inclusives, avec variations exactes', () => {
    const c = compareTraining([session('a', '2026-10-13', 6000), session('b', '2026-09-16', 4000), session('c', '2026-09-15', 2000), session('d', '2026-08-18', 99999)], 4, reference);
    expect(c.current.startDate).toBe('2026-09-16'); expect(c.previous.startDate).toBe('2026-08-19');
    expect(c.changes).toEqual({ sessions: 1, frequency: .25, distance: 8000, duration: 600, weeklyDistance: 2000 });
  });
  it('reste neutre sans séances ou sans période précédente', () => {
    expect(coachObservations(compareTraining([], 8, reference))).toEqual([]);
    expect(coachObservations(compareTraining([session('a', reference, 1000)], 4, reference))).toEqual([]);
  });
  it('n’interprète pas les volumes partiels, invalides ou les dates futures', () => {
    const c = compareTraining([session('a', reference), session('b', '2026-09-01', 1000), session('c', 'invalide', 5000), session('d', '2027-01-01', 5000)], 4, reference);
    expect(c.changes.distance).toBeNull(); expect(c.current.excluded).toEqual({ invalidDates: 1, futureDates: 1 });
    expect(coachObservations(c).map(o => o.id)).toEqual(['regularite', 'duree']);
  });
  it('rapproche objectif sans échéance et disponibilités personnalisées sans prescription', () => {
    const p = emptyProfileValues(); p.goal = { kind: 'distance', distance: { kind: 'custom', meters: 20000 } };
    p.availability = { days: ['monday'], durationMode: 'custom', maxMinutesByDay: { monday: 40 } };
    const observations = coachObservations(compareTraining([session('a', reference, 14000)], 4, reference), p);
    expect(observations.map(o => o.id)).toEqual(['disponibilites', 'objectif']);
    expect(observations.find(o => o.id === 'objectif')?.text).toContain('14 km'); expect(observations[0].text).toContain('1 jour(s)');
    expect(p.availability.maxMinutesByDay?.monday).toBe(40);
  });
  it('signale un intervalle seulement avec un historique suffisant, sans en déduire une cause', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => session(String(i), `2026-09-${String(i + 1).padStart(2, '0')}`, 1000));
    const observations = coachObservations(compareTraining(sessions, 4, reference));
    expect(observations[0].id).toBe('interruption'); expect(observations[0].text).toContain('n’est pas connue');
    expect(coachObservations(compareTraining(sessions.slice(0, 1), 4, reference))).toEqual([]);
    expect(observations.length).toBeLessThanOrEqual(4);
  });
});
it('exploite distance et durée indépendamment, sans comparer les totaux partiels', () => {
  const a = session('a', reference, 4000), b = session('b', '2026-09-01', 2000);
  a.durationSeconds = NaN;
  const obs = coachObservations(compareTraining([a, b], 4, reference));
  expect(obs.some(o => o.id === 'distance')).toBe(true); expect(obs.some(o => o.id === 'duree')).toBe(false);
  expect(obs.find(o => o.id === 'distance')?.explanation.join(' ')).toContain('+2 km');
  delete a.distanceMeters; a.durationSeconds = 1200;
  const other = coachObservations(compareTraining([a, b], 4, reference));
  expect(other.some(o => o.id === 'distance')).toBe(false); expect(other.some(o => o.id === 'duree')).toBe(true);
});
it('compte les jours civils une seule fois et cumule les sorties pour le plafond quotidien', () => {
  const p = emptyProfileValues(); p.availability = { days: ['tuesday'], durationMode: 'custom', maxMinutesByDay: { tuesday: 15, monday: 1 } };
  const c = compareTraining([session('a', reference, 1000), session('b', reference, 1000), session('old', '2026-09-01', 1000)], 4, reference);
  const obs = coachObservations(c, p);
  expect(c.current.days).toEqual([{ date: reference, sessions: 2, durationSeconds: 1200 }]);
  const duration = obs.find(o => o.id === 'durees-disponibles')!;
  expect(duration.text).toContain('1 jour(s)'); expect(duration.explanation.join(' ')).toContain('20 min enregistrées, maximum déclaré 15 min');
  expect(duration.explanation.join(' ')).not.toContain('Lundi');
});
it('exclut une durée quotidienne incomplète et respecte les plafonds égaux', () => {
  const p = emptyProfileValues(); p.availability = { days: ['tuesday'], durationMode: 'custom', maxMinutesByDay: { tuesday: 10 } };
  const a = session('a', reference), b = session('b', reference); b.durationSeconds = NaN;
  expect(coachObservations(compareTraining([a, b], 4, reference), p).some(o => o.id === 'durees-disponibles')).toBe(false);
  const obs = coachObservations(compareTraining([a], 4, reference), p);
  expect(obs.find(o => o.id === 'durees-disponibles')?.text).toContain('0 jour(s)');
});
it('explique la moyenne partielle en mode simple, sans transformer le temps disponible en objectif', () => {
  const p = emptyProfileValues(); p.availability = { minutesPerSession: 30 };
  const a = session('a', reference), b = session('b', reference); b.durationSeconds = NaN;
  const obs = coachObservations(compareTraining([a, b], 4, reference), p).find(o => o.id === 'durees-disponibles')!;
  expect(obs.text).toContain('10 min'); expect(obs.explanation.join(' ')).toContain('1/2 sorties');
});
it('privilégie les écarts personnels et les changements aux constats stables, avec ordre reproductible', () => {
  const p = emptyProfileValues(); p.availability = { sessionsPerWeek: 3, days: ['monday'], minutesPerSession: 5 };
  const c = compareTraining([session('a', reference, 4000), session('b', '2026-09-01', 2000)], 4, reference);
  const obs = coachObservations(c, p);
  expect(obs.map(o => o.id)).toEqual(['frequence-souhaitee', 'disponibilites', 'durees-disponibles', 'distance']);
  expect(coachObservations(c, p)).toEqual(obs);
  for (const o of obs) { expect(o.explanation[0]).toContain('16/09/2026'); expect(o.explanation.join(' ')).toContain('non importées'); }
  expect(obs[0].text).toContain('n’est pas un échec');
});
