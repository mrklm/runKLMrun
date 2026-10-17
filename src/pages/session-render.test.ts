import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Session, SessionCurves, SessionInformation } from './Session';
import { History } from './History';
import { Home } from './Home';
import type { RunningSession } from '../types/session';
const session: RunningSession = { id: 'polar:a/b', title: 'Sortie', date: '2026-01-01', durationSeconds: 600 };
describe('fiche de séance', () => {
  it.each([Home, History])('propose un lien encodé depuis la liste', Component => {
    expect(renderToStaticMarkup(createElement(Component, { sessions: [session] }))).toContain('href="#/seance/polar%3Aa%2Fb"');
  });
  it('affiche les informations générales et distingue les zones sans durée des zéros', () => {
    const html = renderToStaticMarkup(createElement(SessionInformation, { session: { ...session, maximumHeartRate: 175, heartRateZones: [{ lower: 120 }, { durationSeconds: 0 }] } }));
    for (const text of ['01/01/2026', '175 bpm', 'Charge cardio Polar', 'Running Index', '—', '0 h 0 min 0 s']) expect(html).toContain(text);
  });
  it('gère une séance introuvable avec retour vers l’historique', () => {
    const html = renderToStaticMarkup(createElement(Session, {}));
    expect(html).toContain('Séance introuvable'); expect(html).toContain('href="#/courses/historique"');
  });
  it('affiche le chargement sans masquer le résumé', () => {
    const html = renderToStaticMarkup(createElement(Session, { session }));
    expect(html).toContain('Chargement des détails'); expect(html).toContain('Informations générales');
  });
  it.each([undefined, { id: 'a' }, { id: 'a', heartRate: [] }, { id: 'a', heartRate: [{ timeSeconds: 0, value: null }] }])('garde un état utile sans courbe exploitable', details => {
    expect(renderToStaticMarkup(createElement(SessionCurves, { details }))).toContain('Aucune série exploitable');
  });
});
