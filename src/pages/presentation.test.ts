import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Home } from './Home';
import { Statistics } from './Statistics';
import { SessionInformation } from './Session';
describe('présentation compacte', () => {
  it('retire le bandeau de l’accueil sans retirer les dernières sorties', () => {
    const html = renderToStaticMarkup(createElement(Home, { sessions: [] }));
    expect(html).not.toContain('À votre rythme.'); expect(html).not.toContain('class="hero"');
    expect(html).not.toContain('Consulter votre historique'); expect(html).toContain('Dernière sortie');
  });
  it('sélectionne sept jours par défaut et annonce la période vide', () => {
    const html = renderToStaticMarkup(createElement(Statistics, { sessions: [] }));
    expect(html).toContain('<option value="week" selected="">7 derniers jours</option>'); expect(html).toContain('Aucune séance pour cette période');
  });
  it('garde les métriques principales visibles et replie les secondaires sans les supprimer', () => {
    const html = renderToStaticMarkup(createElement(SessionInformation, { session: { id: 'test', title: 'Test', date: '2026-01-01', durationSeconds: 600, distanceMeters: 1000, cardioLoad: 12, runningIndex: 30, maximumHeartRate: 175, descentMeters: 20 } }));
    expect(html).toContain('<details class="session-secondary"><summary>Détails complémentaires</summary>');
    for (const label of ['Date', 'Durée', 'Distance', 'Allure moyenne']) expect(html.indexOf(label)).toBeLessThan(html.indexOf('<details'));
    for (const label of ['Charge cardio Polar', 'Running Index', '175 bpm', '20 m']) expect(html).toContain(label);
  });
});
