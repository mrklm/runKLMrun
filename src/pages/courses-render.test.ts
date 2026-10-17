import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Courses } from './Courses';
const sessions = [{id:'a',title:'Sortie témoin',date:'2026-10-17',durationSeconds:600}];
it('garde les actions mais ne monte aucune ligne d’historique fermé', () => {
  const html=renderToStaticMarkup(createElement(Courses,{sessions,active:false}));
  expect(html).toContain('Importer des activités');expect(html).toContain('Ajouter une sortie manuellement');
  expect(html).not.toContain('Historique des courses');expect(html).not.toContain('Sortie témoin');expect(html).not.toContain('history-year');
});
it('ne rend pas un historique ouvert lorsque Courses est masqué', () => {
  expect(renderToStaticMarkup(createElement(Courses,{sessions,active:false,showHistory:true}))).not.toContain('Sortie témoin');
});
