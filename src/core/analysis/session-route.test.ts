import { describe, expect, it } from 'vitest';
import { prepareSessionRoute, validGpsCoordinates } from './session-route';
import type { SessionDetails } from '../../types/session';

type Point = NonNullable<SessionDetails['gps']>[number];
const point = (timeSeconds: number, latitude: number | null, longitude: number | null): Point => ({ timeSeconds, latitude, longitude });

describe('parcours GPS pour affichage local', () => {
  it('prépare le parcours, les extrémités et les limites', () => {
    expect(prepareSessionRoute([point(0, 48, 2), point(1, 49, 3), point(2, 47, 4)])).toEqual({
      segments: [[[48, 2], [49, 3], [47, 4]]], start: [48, 2], end: [47, 4], bounds: [[47, 2], [49, 4]], pointCount: 3,
    });
  });
  it('accepte une absence de points', () => {
    expect(prepareSessionRoute()).toEqual({ segments: [], start: null, end: null, bounds: null, pointCount: 0 });
    expect(prepareSessionRoute([])).toEqual(prepareSessionRoute());
  });
  it.each([null, NaN, Infinity, -Infinity, 91, -91])('écarte une latitude invalide : %s', latitude => {
    const invalid = point(1, latitude, 0);
    expect(validGpsCoordinates(invalid)).toBe(false);
    expect(prepareSessionRoute([point(0, 0, 0), invalid, point(2, 1, 1)]).segments).toEqual([[[0, 0]], [[1, 1]]]);
  });
  it.each([null, NaN, Infinity, -Infinity, 181, -181])('écarte une longitude invalide : %s', longitude => {
    expect(prepareSessionRoute([point(0, 0, longitude)]).pointCount).toBe(0);
  });
  it('accepte zéro et les limites géographiques inclusives', () => {
    for (const p of [point(0, 0, 0), point(0, -90, -180), point(0, 90, 180)]) expect(validGpsCoordinates(p)).toBe(true);
    expect(prepareSessionRoute([point(0, 0, 0)])).toEqual({
      segments: [[[0, 0]]], start: [0, 0], end: [0, 0], bounds: [[0, 0], [0, 0]], pointCount: 1,
    });
  });
  it('conserve le départ et l’arrivée d’une boucle', () => {
    const route = prepareSessionRoute([point(0, 1, 1), point(1, 2, 2), point(2, 1, 1)]);
    expect(route.start).toEqual(route.end); expect(route.segments[0]).toHaveLength(3);
  });
  it('respecte les trous consécutifs et les séparateurs TCX au même instant', () => {
    const route = prepareSessionRoute([point(0, null, null), point(1, 1, 1), point(2, 2, 2),
      point(3, null, null), point(3, 3, 3), point(4, 4, 4), point(5, null, null), point(6, null, null)]);
    expect(route.segments).toEqual([[[1, 1], [2, 2]], [[3, 3], [4, 4]]]);
    expect(route.start).toEqual([1, 1]); expect(route.end).toEqual([4, 4]);
  });
  it('ordonne une copie chronologique en conservant les trous horodatés', () => {
    const points = [point(3, 3, 3), point(1, 1, 1), point(2, null, null), point(0, 0, 0)];
    expect(prepareSessionRoute(points).segments).toEqual([[[0, 0], [1, 1]], [[3, 3]]]);
    expect(points.map(p => p.timeSeconds)).toEqual([3, 1, 2, 0]);
  });
  it('interrompt le parcours à un horodatage inexploitable', () => {
    expect(prepareSessionRoute([point(0, 0, 0), point(NaN, 1, 1), point(2, 2, 2)]).segments).toEqual([[[0, 0]], [[2, 2]]]);
  });
  it.each([1, -1])('cadre l’antiméridien et coupe le franchissement, sens %s', sign => {
    const route = prepareSessionRoute([point(0, 0, sign * 179), point(1, 1, sign * 179.5),
      point(2, 2, sign * -179.5), point(3, 3, sign * -179)]);
    expect(route.segments.map(segment => segment.length)).toEqual([2, 2]);
    expect(route.bounds![1][1] - route.bounds![0][1]).toBe(2);
    for (const segment of route.segments) expect(Math.abs(segment[1][1] - segment[0][1])).toBe(.5);
  });
  it('ne coupe pas artificiellement un parcours passant par Greenwich', () => {
    expect(prepareSessionRoute([point(0, 0, -1), point(1, 0, 1)]).segments).toEqual([[[0, -1], [0, 1]]]);
  });
  it('prépare 20 000 points sans mutation ni réduction des sources', () => {
    const points = Object.freeze(Array.from({ length: 20_000 }, (_, i) => Object.freeze(point(i, i / 1000, i / 1000))));
    const before = JSON.stringify(points), route = prepareSessionRoute(points);
    expect(route.pointCount).toBe(20_000); expect(route.segments[0]).toHaveLength(20_000);
    route.segments[0][0][0] = 50;
    expect(JSON.stringify(points)).toBe(before);
  });
});
