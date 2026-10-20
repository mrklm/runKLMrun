import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MonthCalendar } from './MonthCalendar';
import { SessionList } from './SessionList';
import { Settings } from '../pages/Settings';
import { CoachV2Comparison } from './CoachV2Comparison';
import { CoachSuggestionCard } from './CoachV2Experimental';

vi.mock('./Appearance', () => ({ Appearance: () => createElement('div') }));
vi.mock('./Backups', () => ({ Backups: () => createElement('div') }));

it('affiche le D+ fiable dans le résumé compact et des durées fixes dans le calendrier', () => {
  const session = { id: 'run', title: 'Course', date: '2026-10-18', durationSeconds: 2547.9, distanceMeters: 5000, ascentMeters: 156.7 };
  expect(renderToStaticMarkup(createElement(SessionList, { sessions: [session], compact: true }))).toContain('157 m');
  const calendar = renderToStaticMarkup(createElement(MonthCalendar, { sessions: [session], today: '2026-10-18' }));
  expect(calendar).toContain('00:42:27'); expect(calendar).not.toContain('42 min');
  expect(calendar).toContain('Suggestion du Coach'); expect(calendar).not.toContain('Suggestion facultative V1');
});

it('ne rend pas le comparateur V1/V2 en mode public', () => {
  expect(renderToStaticMarkup(createElement(CoachV2Comparison))).toBe('');
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
});
