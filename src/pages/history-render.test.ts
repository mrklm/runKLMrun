import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { History } from './History';
import type { RunningSession } from '../types/session';
const sessions: RunningSession[] = [
  { id: 'old', title: 'Séance ancienne synthétique', date: '2024-01-01', durationSeconds: 600 },
  { id: 'recent', title: 'Séance récente synthétique', date: '2025-02-01', durationSeconds: 600 },
  { id: 'previous', title: 'Autre mois synthétique', date: '2025-01-01', durationSeconds: 600 },
];
describe('rendu initial de l’historique', () => {
  it('ouvre uniquement la dernière année et son dernier mois avec des éléments natifs', () => {
    const html = renderToStaticMarkup(createElement(History, { sessions }));
    expect((html.match(/open=""/g) ?? []).length).toBe(2);
    expect(html).toContain('<summary>');
    expect(html).toContain('Séance récente synthétique');
    expect(html).not.toContain('Séance ancienne synthétique');
    expect(html).not.toContain('Autre mois synthétique');
    expect(html.indexOf('2025')).toBeLessThan(html.indexOf('2024'));
  });
  it('affiche un état vide sans séance de démonstration', () => {
    const html = renderToStaticMarkup(createElement(History, { sessions: [] }));
    expect(html).toContain('Aucune sortie enregistrée'); expect(html).not.toContain('<details');
  });
});
