import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_LIMITS, inspectJsonStats, MIN_SAMPLE_BYTES } from './limits';
import { parseBackup } from './format';
import { exportGzip, readBackupFile } from './compression';
import { fixture } from './test-fixture';
import { memoryError } from './errors';

afterEach(() => vi.restoreAllMocks());
const textFor = (points: unknown[], stream = 'gps') => JSON.stringify({ data: { details: [{ [stream]: points }] } });
describe('budgets JSON distincts', () => {
  it('distingue les clés, primitives et conteneurs sans confondre profondeur et volume', () => {
    expect(inspectJsonStats('{"x":[1,null,true,"a"],"y":{}}')).toMatchObject({
      maxDepth: 2, structuralNodes: 3, primitiveValues: 4, properties: 2, measurementPoints: 0,
    });
  });
  it('reproduit le défaut du compteur global sur une structure GPS peu profonde', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ timeSeconds: i, latitude: 0, longitude: 0, altitudeMeters: 1 }));
    const s = inspectJsonStats(textFor(points), { ...BACKUP_LIMITS, structuralNodes: 6, primitiveValues: 3 });
    expect(s).toMatchObject({ maxDepth: 6, structuralNodes: 5, measurementPoints: 20, measurementPrimitives: 80, primitiveValues: 0 });
    const oldTokens = s.structuralNodes + s.measurementPoints + s.primitiveValues + s.measurementPrimitives + s.properties;
    expect(oldTokens).toBe(188); // 9 jetons par point GPS + 8 pour l’enveloppe minimale.
    const simple = inspectJsonStats(textFor(Array.from({ length: 20 }, (_, timeSeconds) => ({ timeSeconds, value: 0 })), 'heartRate'));
    expect(simple.measurementPrimitives).toBe(40);
    expect(simple.properties + simple.structuralNodes + simple.measurementPoints + simple.primitiveValues + simple.measurementPrimitives).toBe(108);
  });
  it('justifie le budget de mesures par le plafond d’octets, sans plafond par séance', () => {
    expect(MIN_SAMPLE_BYTES).toBe(28);
    expect(BACKUP_LIMITS.measurementPoints).toBe(Math.floor(BACKUP_LIMITS.jsonBytes / MIN_SAMPLE_BYTES));
    expect(BACKUP_LIMITS.measurementPrimitives).toBe(2 * BACKUP_LIMITS.measurementPoints);
  });
  it.each(['heartRate', 'speed', 'cadence', 'altitude', 'distance', 'gps'])('applique le budget de mesures uniquement au flux connu %s', stream => {
    expect(inspectJsonStats(textFor([{ timeSeconds: 0, value: null }], stream))).toMatchObject({ measurementPoints: 1, measurementPrimitives: 2 });
  });
  it('ne donne aucune exemption à un tableau inconnu, déplacé ou imbriqué', () => {
    for (const text of [
      textFor([{ timeSeconds: 0, value: 1 }], 'unknown'),
      '{"elsewhere":{"details":[{"gps":[{"timeSeconds":0}]}]}}',
      '{"data":{"details":[{"gps":[[{"timeSeconds":0}]]}]}}',
    ]) expect(inspectJsonStats(text).measurementPoints).toBe(0);
    const nested = inspectJsonStats(textFor([{ timeSeconds: 0, value: { nested: [1, 2] } }], 'heartRate'));
    expect(nested.measurementPrimitives).toBe(1);
    expect(nested.primitiveValues).toBe(2);
    expect(nested.structuralNodes).toBe(7);
  });
  it('reconnaît les noms de clés JSON échappés sans contourner la classification', () => {
    const text = textFor([{ timeSeconds: 0, value: 1 }], 'speed').replace('"speed"', '"sp\\u0065ed"');
    expect(inspectJsonStats(text).measurementPoints).toBe(1);
  });
  it.each([
    ['[[[0]]]', { depth: 2 }, 'depth', 3, 2],
    ['[{},{}]', { structuralNodes: 2 }, 'structuralNodes', 3, 2],
    ['[0,null,true]', { primitiveValues: 2 }, 'primitiveValues', 3, 2],
    ['{"a":0,"b":0,"c":0}', { objectProperties: 2 }, 'objectProperties', 3, 2],
    [textFor([{}, {}]), { measurementPoints: 1 }, 'measurementPoints', 2, 1],
    [textFor([{ timeSeconds: 0, latitude: 0, longitude: 0 }]), { measurementPrimitives: 2 }, 'measurementPrimitives', 3, 2],
    ['[0,0]', { jsonBytes: 4 }, 'jsonBytes', 5, 4],
  ] as const)('signale le contrôle exact %s', (text, overrides, code, observed, limit) => {
    try { inspectJsonStats(text, { ...BACKUP_LIMITS, ...overrides }); expect.fail('Rejet attendu'); }
    catch (error) { expect(error).toMatchObject({ code, observed, limit }); }
  });
  it('refuse un objet géant avant JSON.parse et ne révèle aucun nom de propriété', async () => {
    const text = JSON.stringify(Object.fromEntries(Array.from({ length: 10000 }, (_, i) => [`champ-personnel-${i}`, i])));
    const parse = vi.spyOn(JSON, 'parse');
    await expect(parseBackup(text)).rejects.toMatchObject({ code: 'objectProperties', observed: 65, limit: 64 });
    await expect(parseBackup(text)).rejects.not.toThrow('champ-personnel');
    expect(parse).not.toHaveBeenCalled();
  });
  it('refuse une imbrication pathologique et les JSON corrompus', async () => {
    await expect(parseBackup('['.repeat(33) + '0' + ']'.repeat(33))).rejects.toMatchObject({ code: 'depth', observed: 33 });
    for (const text of ['{"a":}', '{"data":[]} trailing', '{"a":[}', '{"a":"non terminé}']) await expect(parseBackup(text)).rejects.toThrow();
  });
  it('garde une validation du schéma, même dans les tableaux de mesure reconnus', async () => {
    const data = fixture();
    (data.details[0].gps![0] as unknown as Record<string, unknown>).extra = { nested: true };
    await expect(exportGzip(data, '0.4.0')).rejects.toThrow('invalides');
  });
  it('vérifie le coût du champ intégrité sans reparcourir le JSON à l’export', async () => {
    const data = fixture();
    const result = await exportGzip(data, '0.4.0');
    expect((await readBackupFile(result.file)).data).toEqual(data);
    await expect(exportGzip({ sessions: [], details: [], coachProfile: null }, '0.4.0', { ...BACKUP_LIMITS, objectProperties: 5 })).rejects.toMatchObject({ code: 'objectProperties', observed: 6 });
  });
  it('distingue une allocation impossible d’une syntaxe JSON invalide', async () => {
    vi.spyOn(JSON, 'parse').mockImplementation(() => { throw new RangeError('Invalid string length'); });
    await expect(parseBackup('{}')).rejects.toThrow('Mémoire insuffisante');
    expect(memoryError(new RangeError('Maximum call stack size exceeded'))).toBeUndefined();
    expect(memoryError(new SyntaxError('Unexpected token: out of memory'))).toBeUndefined();
    expect(memoryError(new Error('Array buffer allocation failed'))?.message).toContain('Mémoire insuffisante');
  });
});
