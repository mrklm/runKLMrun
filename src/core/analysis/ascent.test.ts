import { it, expect } from 'vitest';
import { estimateAscent } from './ascent';
const estimate = (values: (number | null)[]) => estimateAscent(values.map((value, timeSeconds) => ({ value, timeSeconds })));
it('additionne les montées sur une boucle sans retrancher les descentes', () => {
  expect(estimate([0, 5, 10, 5, 0])?.meters).toBe(10);
  expect(estimate([10, 5, 0])?.meters).toBe(0);
  expect(estimate([0, 5, 0, 8, 0])?.meters).toBe(13);
});
it('distingue zéro estimé, bruit sous le seuil et manque de données', () => {
  expect(estimate([10, 10, 10])).toMatchObject({ meters: 0, quality: 'complete' });
  expect(estimate([10, 11, 9, 10, 11])?.meters).toBe(0);
  expect(estimate([1])).toBeUndefined(); expect(estimate([null, null])).toBeUndefined();
  expect(estimate([0, 1, 2, 3, 4])?.meters).toBe(4);
});
it('ne raccorde pas les interruptions ni les pistes', () => {
  expect(estimate([0, 5, null, 100, 105])).toMatchObject({ meters: 10, quality: 'partial' });
  expect(estimate([0, null, 100])).toBeUndefined();
  expect(estimate([0, 5, NaN, 100, 105])?.meters).toBe(10);
});
