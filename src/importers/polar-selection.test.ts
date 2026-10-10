import { describe, expect, it } from 'vitest';
import { selectPolarFiles, tcxReport, zipReport } from './polar-selection';
import { emptyTcxReport } from './tcx-files';
import { emptyReport } from './import-report';
const file = (name: string) => new File(['synthetic'], name);
describe('sélection unifiée Polar', () => {
  it.each(['sortie.tcx', 'sortie.TCX', 'sortie.TcX'])('aiguille %s vers TCX', name => { expect(selectPolarFiles([file(name)])).toMatchObject({ format: 'tcx' }); });
  it.each(['archive.zip', 'archive.ZIP'])('aiguille %s vers ZIP', name => { expect(selectPolarFiles([file(name)])).toMatchObject({ format: 'zip' }); });
  it('accepte plusieurs TCX et copie la sélection', () => { const files = [file('a.tcx'), file('b.TCX')]; const result = selectPolarFiles(files); files.length = 0; expect(result).toMatchObject({ format: 'tcx', files: expect.any(Array) }); if ('files' in result) expect(result.files).toHaveLength(2); });
  it.each([[], [file('x.txt')], [file('a.zip'), file('b.tcx')], [file('a.zip'), file('b.ZIP')]].map(files => ({ files })))('refuse une sélection ambiguë ou vide (%#)', ({ files }) => { expect(selectPolarFiles(files)).toHaveProperty('error'); });
  it('préserve les compteurs disponibles sans les inventer', () => {
    expect(zipReport({ ...emptyReport(), total: 523, processed: 523, imported: 500, duplicates: 23 })).toMatchObject({ total: 523, imported: 500, duplicates: 23 });
    expect(tcxReport({ ...emptyTcxReport(2), unsupported: 1, invalid: 1, processed: 2 })).toMatchObject({ total: 2, ignored: 1, invalid: 1 });
  });
});
