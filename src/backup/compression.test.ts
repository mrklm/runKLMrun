import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportGzip, isGzip, readBackupFile, checkBackupFile } from './compression';
import { canonicalJson, createBackup, parseBackup, sha256 } from './format';
import { BACKUP_LIMITS, inspectJson } from './limits';
import { fixture } from './test-fixture';

async function gzip(text: string): Promise<Blob> {
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
afterEach(() => vi.unstubAllGlobals());
describe('sauvegardes gzip et anciennes sauvegardes JSON', () => {
  it('exporte gzip, conserve chaque mesure et produit une empreinte v1 vérifiable séparément', async () => {
    const data = fixture(), before = structuredClone(data);
    data.sessions[0].title = 'Synthétique é😀';
    before.sessions[0].title = data.sessions[0].title;
    const exported = await exportGzip(data, '0.4.0');
    expect(await isGzip(exported.file)).toBe(true);
    const text = await new Response(exported.file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    expect(new TextEncoder().encode(text).length).toBe(exported.jsonBytes);
    const doc = JSON.parse(text), { integrity, ...payload } = doc;
    expect(doc.formatVersion).toBe(1);
    expect(await sha256(canonicalJson(payload))).toBe(integrity.digest);
    expect((await readBackupFile(exported.file)).data).toEqual(before);
    expect(data).toEqual(before);
  });
  it('lit les anciens JSON, les profils anciens et les gzip sans se fier au nom ou au MIME', async () => {
    const data = fixture(); data.coachProfile!.availability = { minutesPerSession: 40 };
    const text = JSON.stringify(await createBackup(data, '0.4.0'));
    expect((await readBackupFile(new File([text], 'ancien.json.gz', { type: 'application/gzip' }))).data).toEqual(data);
    expect((await readBackupFile(new File([await gzip(text)], 'ancien.json', { type: 'application/json' }))).data).toEqual(data);
  });
  it.each(['{', '{"format":"autre"}'])('refuse le contenu invalide compressé %s', async text => {
    await expect(readBackupFile(await gzip(text))).rejects.toThrow();
  });
  it('refuse une empreinte incorrecte après décompression', async () => {
    const doc = await createBackup(fixture(), '0.4.0'); doc.data.sessions[0].title = 'Altéré';
    await expect(readBackupFile(await gzip(JSON.stringify(doc)))).rejects.toThrow('intégrité');
  });
  it('refuse une version inconnue après décompression', async () => {
    const doc = { ...await createBackup(fixture(), '0.4.0'), formatVersion: 42 };
    await expect(readBackupFile(await gzip(JSON.stringify(doc)))).rejects.toThrow('version');
  });
  it('refuse gzip invalide, tronqué et CRC altéré', async () => {
    const compressed = await gzip(JSON.stringify(await createBackup(fixture(), '0.4.0')));
    const corrupt = new Uint8Array(await compressed.arrayBuffer()); corrupt[corrupt.length - 8] ^= 1;
    for (const file of [new Blob([new Uint8Array([0x1f, 0x8b, 0, 0])]), compressed.slice(0, compressed.size - 5), new Blob([corrupt])]) {
      await expect(readBackupFile(file)).rejects.toThrow(/gzip.*corrompu/);
    }
  });
  it('refuse un encodage UTF-8 invalide', async () => {
    await expect(readBackupFile(new Blob([new Uint8Array([0xff])]))).rejects.toThrow('UTF-8');
  });
  it('borne le fichier gzip avant toute décompression et le JSON avant lecture', async () => {
    const compressed = await gzip('{}');
    await expect(checkBackupFile(compressed, { ...BACKUP_LIMITS, compressedBytes: compressed.size - 1 })).rejects.toThrow('fichier gzip');
    await expect(checkBackupFile(new Blob(['abcd']), { ...BACKUP_LIMITS, jsonBytes: 3 })).rejects.toThrow('contenu JSON');
  });
  it('arrête la décompression au plafond absolu, même si le fichier est petit', async () => {
    await expect(readBackupFile(await gzip(' '.repeat(10000)), { ...BACKUP_LIMITS, jsonBytes: 1000 })).rejects.toThrow('contenu JSON');
  });
  it('refuse une expansion anormale sans attendre le plafond absolu', async () => {
    await expect(readBackupFile(await gzip(' '.repeat(100000)), { ...BACKUP_LIMITS, expansionRatio: 2, expansionAllowanceBytes: 512 })).rejects.toThrow('expansion gzip');
  });
  it('ne produit pas un fichier qui dépasserait les limites de lecture', async () => {
    await expect(exportGzip(fixture(), '0.4.0', { ...BACKUP_LIMITS, compressedBytes: 10 })).rejects.toThrow('fichier gzip');
    await expect(exportGzip(fixture(), '0.4.0', { ...BACKUP_LIMITS, jsonBytes: 200 })).rejects.toThrow('contenu JSON');
    await expect(exportGzip(fixture(), '0.4.0', { ...BACKUP_LIMITS, expansionRatio: 1, expansionAllowanceBytes: 1 })).rejects.toThrow('expansion gzip');
  });
  it('borne la structure avant JSON.parse : profondeur, objets, scalaires et chaînes', async () => {
    const spy = vi.spyOn(JSON, 'parse');
    for (const [text, limits] of [
      ['[[[0]]]', { ...BACKUP_LIMITS, depth: 2 }],
      ['[{},{}]', { ...BACKUP_LIMITS, structuralNodes: 2 }],
      ['[0,0,0]', { ...BACKUP_LIMITS, primitiveValues: 2 }],
      ['"abcd"', { ...BACKUP_LIMITS, stringCharacters: 3 }],
    ] as const) await expect(parseBackup(text, limits)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
  });
  it('compte exactement l’UTF-8 sans compter les accolades dans les chaînes', () => {
    for (const text of ['{"é":"😀 \\" [{}"}', '"\\ud800"', JSON.stringify('\ud800'), '{"a":true,"b":null}']) {
      expect(inspectJson(text)).toBe(new TextEncoder().encode(text).length);
    }
  });
  it('signale les API absentes sans casser les anciens JSON', async () => {
    const text = JSON.stringify(await createBackup(fixture(), '0.4.0')), compressed = await gzip(text);
    vi.stubGlobal('CompressionStream', undefined);
    await expect(exportGzip(fixture(), '0.4.0')).rejects.toThrow('navigateur');
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(readBackupFile(compressed)).rejects.toThrow('navigateur');
    expect((await readBackupFile(new Blob([text]))).data).toEqual(fixture());
  });
  it('conserve les échantillons d’un historique synthétique avec un budget réduit de test', async () => {
    const data = fixture();
    data.details[0].heartRate = Array.from({ length: 20000 }, (_, i) => ({ timeSeconds: i / 4, value: i % 29 === 0 ? null : 120 + i % 50 }));
    const exported = await exportGzip(data, '0.4.0', { ...BACKUP_LIMITS, jsonBytes: 2 * 1024 * 1024 });
    expect(exported.jsonBytes).toBeGreaterThan(128 * 1024);
    const restored = await readBackupFile(exported.file);
    expect(restored.data).toEqual(data);
  });
});
