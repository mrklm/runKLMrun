import { describe, expect, it } from 'vitest';
import { createTimeIndex, nearestMeasurement, cursorReducer, pointerTime, isTap } from './time-cursor';
const index = (times: number[], values = times.map(() => 100)) => createTimeIndex(times.map((timeSeconds, i) => ({ timeSeconds, value: values[i] })));
describe('recherche temporelle synchronisée', () => {
  it('synchronise quatre fréquences par secondes et jamais par indice', () => {
    const indexes = [index([0, 1, 2, 3]), index([0, .5, 1, 1.5, 2, 2.5]), index([0, 2, 4]), index([0, 1.25, 2.5])];
    expect(indexes.map(i => nearestMeasurement(i, 2)?.timeSeconds)).toEqual([2, 2, 2, 2.5]);
  });
  it('choisit la mesure irrégulière la plus proche et conserve son vrai temps', () => {
    const i = index([0, .7, 1.8, 3]);
    expect(nearestMeasurement(i, 1.7)?.timeSeconds).toBe(1.8);
    expect(i.points[2].timeSeconds).toBe(1.8);
  });
  it('ne franchit ni une valeur nulle ni une longue interruption', () => {
    const missing = createTimeIndex([{ timeSeconds: 0, value: 10 }, { timeSeconds: 1, value: null }, { timeSeconds: 2, value: 20 }]);
    for (const t of [.1, 1, 1.9]) expect(nearestMeasurement(missing, t)).toBeUndefined();
    const gap = index([0, 1, 2, 100, 101]);
    for (const t of [2.1, 50, 99.9]) expect(nearestMeasurement(gap, t)).toBeUndefined();
    expect(nearestMeasurement(gap, 100)?.timeSeconds).toBe(100);
  });
  it('ne réutilise pas une mesure en dehors de la série', () => {
    const i = index([10, 11]);
    expect(nearestMeasurement(i, 9.9)).toBeUndefined(); expect(nearestMeasurement(i, 11.1)).toBeUndefined();
    expect(nearestMeasurement(i, 10)?.value).toBe(100); expect(nearestMeasurement(i, 11)?.value).toBe(100);
  });
  it('traite zéro, point isolé, absences et rupture dupliquée', () => {
    expect(nearestMeasurement(index([5], [0]), 5)?.value).toBe(0);
    expect(nearestMeasurement(index([5]), 5.1)).toBeUndefined(); expect(nearestMeasurement(index([]), 0)).toBeUndefined();
    const duplicate = createTimeIndex([{ timeSeconds: 1, value: null }, { timeSeconds: 1, value: 20 }]);
    expect(nearestMeasurement(duplicate, 1)).toBeUndefined();
  });
  it('plafonne la tolérance même pour un échantillonnage très lent', () => {
    const i = index([0, 60, 120]); expect(i.tolerance).toBe(5);
    expect(nearestMeasurement(i, 30)).toBeUndefined(); expect(nearestMeasurement(i, 58)?.timeSeconds).toBe(60);
  });
  it('recherche une longue séance sans parcourir toute la série à chaque instant', () => {
    const i = index(Array.from({ length: 100000 }, (_, n) => n * .5));
    let reads = 0;
    const points = new Proxy(i.points, { get(target, property, receiver) { if (/^\d+$/.test(String(property))) reads++; return Reflect.get(target, property, receiver); } });
    expect(nearestMeasurement({ ...i, points }, 34567.1)?.timeSeconds).toBe(34567);
    expect(reads).toBeLessThan(40);
  });
});
describe('interactions du curseur', () => {
  it('projette le pointeur sur le vrai temps, indépendamment des points réduits', () => {
    expect(pointerTime(150, 100, 200, [0, 1000])).toBe(250);
    expect(pointerTime(90, 100, 200, [0, 1000])).toBe(0);
    expect(pointerTime(400, 100, 200, [0, 1000])).toBe(1000);
    expect(pointerTime(150, 100, 0, [0, 1000])).toBeUndefined();
  });
  it('efface le survol à la sortie du graphique', () => {
    const state = cursorReducer(null, { type: 'hover', time: 755 });
    expect(state).toEqual({ time: 755, mode: 'hover' }); expect(cursorReducer(state, { type: 'leave' })).toBeNull();
  });
  it('conserve la sélection tactile ou clavier et permet son effacement', () => {
    const state = cursorReducer(null, { type: 'select', time: 755 });
    expect(cursorReducer(state, { type: 'leave' })).toBe(state);
    expect(cursorReducer(state, { type: 'select', time: 756 })?.time).toBe(756);
    expect(cursorReducer(state, { type: 'clear' })).toBeNull();
  });
  it('distingue un toucher d’un défilement vertical', () => {
    expect(isTap({ x: 10, y: 20 }, { x: 12, y: 23 })).toBe(true);
    expect(isTap({ x: 10, y: 20 }, { x: 12, y: 50 })).toBe(false); expect(isTap(null, { x: 12, y: 23 })).toBe(false);
  });
});
