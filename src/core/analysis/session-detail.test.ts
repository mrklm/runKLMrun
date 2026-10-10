import { describe, expect, it } from 'vitest';
import { prepareSeries, reduceSeries, sessionHref, sessionIdFromPath, speedToPace } from './session-detail';
describe('fiche et séries temporelles', () => {
  it('encode et décode les identifiants sans confondre les routes', () => {
    const id = 'polar:a/b % été';
    expect(sessionIdFromPath(sessionHref(id).slice(1))).toBe(id);
    for (const path of ['/historique', '/seance/', '/seance/%ZZ', '/seance/a/b']) expect(sessionIdFromPath(path)).toBeUndefined();
  });
  it('convertit la vitesse en secondes par kilomètre', () => { expect(speedToPace(2)).toBeCloseTo(500); });
  it.each([null, 0, -1, Infinity, NaN, Number.MIN_VALUE])('évite les allures invalides pour %s', value => { expect(speedToPace(value)).toBeNull(); });
  it('préserve les temps propres aux fréquences différentes et les trous', () => {
    const first = [{ timeSeconds: 0, value: 2 }, { timeSeconds: .5, value: null }, { timeSeconds: 1, value: 4 }];
    const second = [{ timeSeconds: 0, value: 100 }, { timeSeconds: 2, value: 105 }];
    const copy = structuredClone(first);
    expect(prepareSeries(first, true).map(p => p.timeSeconds)).toEqual([0, .5, 1]);
    expect(prepareSeries(first, true)[1].value).toBeNull();
    expect(prepareSeries(second)).toEqual(second); expect(first).toEqual(copy);
  });
  it('trie les temps irréguliers sans mutation et transforme les valeurs non finies en trous', () => {
    expect(prepareSeries([{ timeSeconds: 7, value: Infinity }, { timeSeconds: .25, value: 1 }])).toEqual([{ timeSeconds: .25, value: 1 }, { timeSeconds: 7, value: null }]);
    expect(prepareSeries([{ timeSeconds: NaN, value: 1 }, { timeSeconds: 2, value: 3 }])[0]).toEqual({ timeSeconds: 2, value: null });
  });
  it('gère les séries absentes, vides et entièrement nulles', () => {
    expect(prepareSeries()).toEqual([]); expect(reduceSeries([])).toEqual([]);
    expect(prepareSeries([{ timeSeconds: 0, value: null }])).toEqual([{ timeSeconds: 0, value: null }]);
  });
  it('réduit une longue série en conservant extrema, extrémités et interruptions', () => {
    const input = Array.from({ length: 10000 }, (_, i) => ({ timeSeconds: i * 2.5, value: i === 2345 ? -1000 : i === 6789 ? 1000 : i === 4000 ? null : Math.sin(i) }));
    const copy = structuredClone(input); const reduced = reduceSeries(input, 100);
    expect(reduced.length).toBeLessThan(120);
    for (const index of [0, 2345, 3999, 4000, 4001, 6789, 9999]) expect(reduced).toContainEqual(input[index]);
    expect(input).toEqual(copy);
    expect(reduced.map(p => p.timeSeconds)).toEqual(reduced.map(p => p.timeSeconds).sort((a, b) => a - b));
  });
});
