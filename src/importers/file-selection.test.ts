import { describe, expect, it } from 'vitest';
import { takeSelectedFiles } from './file-selection';
describe('sélection des fichiers importés', () => {
  it('copie les File avant de vider la sélection native, sans changer leur contenu', async () => {
    const first = new File(['contenu synthétique'], 'sortie.TCX'), second = new File(['autre'], 'autre.tcx');
    let live = [first, second];
    const input = {
      get files() { return live as unknown as FileList; },
      get value() { return 'chemin-synthetique'; },
      set value(value: string) { expect(value).toBe(''); live = []; },
    };
    const files = takeSelectedFiles(input);
    expect(live).toHaveLength(0); expect(files).toEqual([first, second]); expect(files[0]).toBe(first);
    expect(await files[0].text()).toBe('contenu synthétique');
  });
  it('ne crée pas de fichier lorsqu’aucun fichier n’est sélectionné', () => {
    expect(takeSelectedFiles({ files: null, value: '' })).toEqual([]);
  });
});
