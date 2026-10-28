import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MonthCalendar } from './MonthCalendar';
import { SessionList } from './SessionList';
import { Settings } from '../pages/Settings';
import { Home } from '../pages/Home';
import { CoachSuggestionCard } from './CoachV2Experimental';
import { CoachTemperamentSettings } from './CoachTemperamentSettings';

vi.mock('./Appearance', () => ({ Appearance: () => createElement('div') }));
vi.mock('./Backups', () => ({ Backups: () => createElement('div') }));

it('affiche le D+ fiable dans le résumé compact et des durées fixes dans le calendrier', () => {
  const session = { id: 'run', title: 'Course', date: '2026-10-18', durationSeconds: 2547.9, distanceMeters: 5000, ascentMeters: 156.7 };
  expect(renderToStaticMarkup(createElement(SessionList, { sessions: [session], compact: true }))).toContain('157 m');
  const calendar = renderToStaticMarkup(createElement(MonthCalendar, { sessions: [session], today: '2026-10-18' }));
  expect(calendar).toContain('00:42:27'); expect(calendar).not.toContain('42 min');
  expect(calendar).toContain('Suggestion du Coach'); expect(calendar).not.toContain('Suggestion facultative V1'); expect(calendar).not.toContain('○ Suggestion facultative');
});

it('présente trois suggestions homogènes avec leurs détails repliables', () => {
  const session = { type: 'easy-endurance' as const, totalDurationSeconds: 2100, intensity: 'easy' as const, terrain: 'flat' as const };
  const html = renderToStaticMarkup(createElement('div', {}, [
    createElement(CoachSuggestionCard, { key: 'next', session, date: '2026-10-21', label: 'Prochaine séance conseillée', primary: true, reasons: ['Motif'], limitations: ['Limite'] }),
    createElement(CoachSuggestionCard, { key: 'a', session, date: '2026-10-23', label: 'Perspective susceptible d’évoluer', reasons: ['Motif'], limitations: ['Limite'] }),
    createElement(CoachSuggestionCard, { key: 'b', session, date: '2026-10-25', label: 'Perspective susceptible d’évoluer', reasons: ['Motif'], limitations: ['Limite'] }),
  ]));
  expect((html.match(/coach-v2-card/g) ?? []).length).toBe(4);
  expect(html).toContain('Prochaine séance conseillée'); expect((html.match(/Perspective susceptible d’évoluer/g) ?? []).length).toBe(2);
  expect((html.match(/Pourquoi \?/g) ?? []).length).toBe(3); expect((html.match(/Limites/g) ?? []).length).toBe(3);
  expect(html).not.toContain('Facultatives et susceptibles'); expect(html).not.toContain('Suggestion enregistrée et facultative');
});

it('garde le stockage local fermé et accessible, sans la notice informative supprimée', () => {
  const html = renderToStaticMarkup(createElement(Settings, { active: false }));
  expect(html).toContain('Afficher les détails'); expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('Conservation des données détaillées');
  expect(html).toContain('Configuration et bilan'); expect(html).toContain('Mes chaussures'); expect(html).toContain('Données et sauvegardes');
});

it('replie par défaut les activités récentes et le type de Coach', () => {
  const home = renderToStaticMarkup(createElement(Home, { sessions: [] }));
  expect(home).toContain('<details class="panel settings-panel" aria-labelledby="activity-title"><summary id="activity-title">Activités récentes</summary>');
  const temperament = renderToStaticMarkup(createElement(CoachTemperamentSettings));
  expect(temperament).toContain('<details class="panel settings-panel coach-temperament" aria-labelledby="coach-temperament-title"><summary id="coach-temperament-title">Type de Coach</summary>');
  expect(temperament).not.toContain(' open=""');
});

it('ne conserve que la description active du tempérament', () => {
  const html = renderToStaticMarkup(createElement(CoachTemperamentSettings));
  expect(html).toContain('coach-temperament-description');
  expect(html).not.toContain('Tempérament choisi');
  expect(html).not.toContain('Préférence enregistrée');
  expect(html).not.toContain('pas ton niveau sportif');
  expect(html).not.toContain('Ce choix s’applique aux nouveaux calculs');
});
