import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect } from 'vitest';
import { CoachObservations } from './CoachObservations';
import { CoachProfile } from './CoachProfile';
import { compareTraining } from '../core/coach/comparison';
it('présente un état vide explicite et les cinq mesures comparées', () => {
  const html = renderToStaticMarkup(createElement(CoachObservations, { comparison: compareTraining([], 4, '2026-10-13') }));
  expect(html).toContain('observation personnalisée fiable');
  expect(html).toContain('Distance par semaine'); expect(html).toContain('Comparaison insuffisante');
  expect(html).not.toContain('<li>');
});
it('ne présente plus deux modes et conserve le chargement du profil', () => {
  const html = renderToStaticMarkup(createElement(CoachProfile));
  expect(html).not.toContain('Entraîneur');
  expect(html).not.toContain('Conseiller');
  expect(html).toContain('Chargement de votre profil');
});
it('rend les explications consultables dans des détails natifs fermés', () => {
  const comparison = compareTraining([
    { id: 'a', title: 'a', date: '2026-10-13', durationSeconds: 1200, distanceMeters: 2000 },
    { id: 'b', title: 'b', date: '2026-09-01', durationSeconds: 600, distanceMeters: 1000 },
  ], 4, '2026-10-13');
  const html = renderToStaticMarkup(createElement(CoachObservations, { comparison }));
  expect(html).toContain('<details><summary>Pourquoi cette observation ?</summary>');
  expect(html).toContain('Écart : +1 km'); expect(html).not.toContain('<details open');
});
