import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SessionRoute } from './SessionRoute';
import type { DetailsState } from '../storage/load-session-details';

vi.mock('./SessionMap', () => ({ default: () => null }));

const render = (state: DetailsState) => renderToStaticMarkup(createElement(SessionRoute, { state }));
it('distingue chargement, erreur de lecture et coordonnées indisponibles', () => {
  expect(render({ status: 'loading' })).toContain('Chargement des coordonnées GPS');
  expect(render({ status: 'error' })).toContain('Les coordonnées GPS n’ont pas pu être lues');
  for (const details of [undefined, { id: 'empty' }, { id: 'invalid', gps: [{ timeSeconds: 0, latitude: null, longitude: null }] }]) {
    const html = render({ status: 'ready', details });
    expect(html).toContain('Coordonnées GPS indisponibles');
    expect(html).not.toContain('Afficher la carte');
  }
});
it('déclenche le chargement différé automatiquement, même avec un point à zéro', () => {
  const html = render({ status: 'ready', details: { id: 'one', gps: [{ timeSeconds: 0, latitude: 0, longitude: 0 }] } });
  expect(html).not.toContain('Afficher la carte');
  expect(html).toContain('Chargement de la carte'); expect(html).toContain('Un seul point GPS disponible');
  expect(html).not.toContain('Votre tracé reste sur cet appareil');
  expect(html).not.toContain('leaflet-container'); expect(html).not.toContain('tile.openstreetmap.org');
});
