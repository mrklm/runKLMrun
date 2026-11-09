import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fixture } from './test-fixture';
import { canonicalJson, createBackup, sha256, verifyBackup } from './format';
import { validateShoe } from '../core/shoes/shoes';
import { DEFAULT_SHOE_COLORS, isShoeColors, storedShoeColors } from '../core/shoes/shoe-colors';
import type { BackupData, BackupDocument } from '../types/backup';
import type { Shoe } from '../types/shoe';

const colors = { upper: '#2b6cd6', laces: '#ffd400', midsole: '#ffffff', stripes: '#ff5a1f', outsole: '#333333' };
const shoe = (extra: Partial<Shoe> = {}): Shoe => ({ id: 'shoe-a', name: 'Paire synthétique', status: 'active', isDefault: false, revision: 1, ...extra });
const data = (value: Shoe): BackupData => ({ ...fixture(), shoes: [value], shoeAssignments: [] });
const resign = async (value: BackupDocument) => { const { integrity: _integrity, ...payload } = value; return { ...payload, integrity: { algorithm: 'SHA-256' as const, digest: await sha256(canonicalJson(payload)) } }; };

describe('couleurs de l’icône des chaussures', () => {
  it('valide cinq couleurs hexadécimales et rien d’autre', () => {
    expect(isShoeColors(colors)).toBe(true);
    for (const value of [{ ...colors, upper: 'red' }, { ...colors, upper: '#FFF' }, { ...colors, autre: '#000000' }, (({ laces: _l, ...rest }) => rest)(colors), [], null])
      expect(isShoeColors(value)).toBe(false);
    expect(() => validateShoe(shoe({ colors }))).not.toThrow();
    expect(() => validateShoe(shoe({ colors: { ...colors, upper: '#GGGGGG' } }))).toThrow('Couleurs');
  });
  it('n’enregistre rien quand les couleurs reprennent l’image d’origine', () => {
    expect(storedShoeColors(undefined)).toBeUndefined();
    expect(storedShoeColors({ ...DEFAULT_SHOE_COLORS, stripes: '#1B1E25' })).toBeUndefined();
    expect(storedShoeColors({ ...colors, upper: '#2B6CD6' })).toEqual(colors);
  });
  it('sauvegarde au format 11 seulement si une paire est personnalisée', async () => {
    expect((await createBackup(data(shoe()), '1.6.0')).formatVersion).toBe(2);
    const document = await createBackup(data(shoe({ colors })), '1.6.0');
    expect(document.formatVersion).toBe(11);
    await expect(verifyBackup(document)).resolves.toEqual(document);
    await expect(verifyBackup(await resign({ ...document, formatVersion: 10 }))).rejects.toThrow(/format 11/);
  });
});
