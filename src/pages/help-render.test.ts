import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Help } from './Help';

it('explique l’enregistrement des courses, le Coach et la carte GPS', () => {
  const html = renderToStaticMarkup(createElement(Help));
  for (const text of ['Sans montre connectée', 'Avec une montre ou une application compatible', 'Importer et sauvegarder vos données', 'Importer des activités', 'Exporter une sauvegarde', 'Restaurer une sauvegarde', 'Utiliser le Coach', 'Pas à Pas', 'Évolution Active', 'Rentre dedans', 'Carte des parcours GPS', 'OpenStreetMap', 'Pour les geeks', 'React, TypeScript et Vite', 'IndexedDB', '#/aide', 'GitHub Pages']) expect(html).toContain(text);
  expect(html).not.toContain('sauvegardes sont stockés');
});
