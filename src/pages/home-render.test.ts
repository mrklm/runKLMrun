import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Home } from './Home';
import { SessionList } from '../components/SessionList';
import type { RunningSession } from '../types/session';
const session = (day: number, extra: Partial<RunningSession> = {}): RunningSession => ({
  id: `synthetic-${day}`, title: `Sortie synthétique ${day}`, date: `2025-01-${String(day).padStart(2, '0')}`,
  durationSeconds: 600, distanceMeters: 2000, averagePaceSecondsPerKm: 300, averageHeartRate: 140, ascentMeters: 20, ...extra,
});
const render = (sessions: RunningSession[]) => renderToStaticMarkup(createElement(Home, { sessions }));
const titles = (html: string) => [...html.matchAll(/<strong>(Sortie synthétique [^<]+)<\/strong>/g)].map(m => m[1]);
describe('dernières sorties de l’accueil', () => {
  it('limite à cinq séances après le tri, même si les plus récentes arrivent en fin de tableau', () => {
    const html = render(Array.from({ length: 8 }, (_, i) => session(i + 1)));
    expect(titles(html)).toEqual([8, 7, 6, 5, 4].map(i => `Sortie synthétique ${i}`));
    expect(html).toContain('Dernières sorties');
  });
  it('classe les séances par date puis heure décroissante sans modifier les données reçues', () => {
    const input = [session(2, { id: 'early', title: 'Sortie synthétique matin', startTime: '2025-01-02T08:00:00' }), session(1), session(2, { id: 'late', title: 'Sortie synthétique soir', startTime: '2025-01-02T18:00:00' })];
    const original = structuredClone(input);
    expect(titles(render(input))).toEqual(['Sortie synthétique soir', 'Sortie synthétique matin', 'Sortie synthétique 1']);
    expect(input).toEqual(original);
  });
  it('affiche toutes les séances disponibles si elles sont moins de cinq', () => {
    expect(titles(render([session(1), session(3), session(2)]))).toEqual([3, 2, 1].map(i => `Sortie synthétique ${i}`));
  });
  it('conserve le message d’accueil sans séance', () => {
    const html = render([]);
    expect(titles(html)).toEqual([]); expect(html).toContain('Votre histoire commence ici');
    expect(html).toContain('Vous n’avez encore aucune sortie enregistrée.'); expect(html).not.toContain('session-card');
  });
  it.each([{ sessions: [] }, { sessions: [session(1)] }])('propose le lien vers tout l’historique', ({ sessions }) => {
    expect(render(sessions)).toContain('<a href="#/historique">Voir tout l’historique</a>');
  });
  it('conserve les informations de chaque séance', () => {
    const html = render([session(1)]);
    for (const value of ['01/01/2025', '2 km', '0 h 10 min 0 s', '5:00 /km', '140 bpm', '20 m']) expect(html).toContain(value);
  });
  it('ne limite pas les autres usages de SessionList sans limite explicite', () => {
    const html = renderToStaticMarkup(createElement(SessionList, { sessions: Array.from({ length: 8 }, (_, i) => session(i + 1)) }));
    expect(titles(html)).toHaveLength(8);
  });
});
