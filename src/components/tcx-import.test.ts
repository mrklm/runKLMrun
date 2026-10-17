import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ImportReportView } from './ImportReportView';
import { tcxReport, zipReport } from '../importers/polar-selection';
import { emptyReport } from '../importers/import-report';
import { emptyTcxReport } from '../importers/tcx-files';
import { History } from '../pages/History';
import { SessionCurves } from '../pages/Session';
// Le sélecteur de thème dépend du navigateur et n'est pas l'objet de ce rendu serveur.
vi.mock('./Appearance', () => ({ Appearance: () => null }));
describe('interface TCX', () => {
  it('conserve le ZIP et propose la sélection multiple TCX dans l’historique', () => {
    const html = renderToStaticMarkup(createElement(History, { sessions: [] }));
    expect(html).toContain('Importer des séances Polar'); expect(html).toContain('accept=".zip,.ZIP,.tcx,.TCX" multiple=""');
    expect(html.match(/accept="\.zip,\.ZIP,\.tcx,\.TCX"/g)).toHaveLength(1); expect(html).toContain('Importer les séances');
  });
  it('ne présente pas la cadence TCX comme une cadence Polar ou des pas/minute', () => {
    const html = renderToStaticMarkup(createElement(SessionCurves, { details: { id: 'synthetic', cadenceUnit: 'source', cadence: [{ timeSeconds: 0, value: 80 }] } }));
    expect(html).toContain('Cadence (unité source)'); expect(html).toContain('sans conversion en pas/minute');
    expect(html).not.toContain('Cadence (rpm)');
  });
});


describe('comptes rendus TCX explicites', () => {
  it('distingue une sélection vide d’un import rejeté, sans bilan 0/0', () => {
    const html = renderToStaticMarkup(createElement(ImportReportView, { report: zipReport(emptyReport()), busy: false }));
    expect(html).toContain('aucun fichier JSON'); expect(html).not.toContain('0 / 0');
  });
  it('comptabilise et affiche le motif d’un fichier rejeté', () => {
    const html = renderToStaticMarkup(createElement(ImportReportView, { report: tcxReport({ ...emptyTcxReport(1), processed: 1, invalid: 1, issues: ['Fichier n°1 : XML invalide.'] }), busy: false }));
    expect(html).toContain('Compte rendu'); expect(html).toContain('1 / 1 fichiers TCX');
    expect(html).toContain('role="alert"'); expect(html).toContain('XML invalide'); expect(html).not.toContain('0 / 0');
  });
  it('affiche une erreur de stockage même si aucun fichier n’a été ajouté', () => {
    const html = renderToStaticMarkup(createElement(ImportReportView, { report: tcxReport({ ...emptyTcxReport(1), error: 'Stockage indisponible.' }), busy: false }));
    expect(html).toContain('0 / 1'); expect(html).toContain('Stockage indisponible'); expect(html).toContain('role="alert"');
  });
});
