import { describe, expect, it } from 'vitest';
import { chartScale, compactTime, displaySeries, paceLabel } from './chart-display';
import { THEMES, contrast, themeVariables } from '../../themes/themes';
const samples = (values: (number | null)[]) => values.map((value, i) => ({ timeSeconds: i * 1.25, value }));
describe('affichage des graphiques', () => {
  it.each([[0, '00:00'], [500, '08:20'], [4100, '1:08:20'], [360000, '100:00:00']])('formate le temps %s', (value, label) => { expect(compactTime(Number(value))).toBe(label); });
  it('formate l’allure en minutes et secondes, sans décimales', () => { expect(paceLabel(330)).toBe('5:30'); expect(paceLabel(375)).toBe('6:15'); expect(paceLabel(359.9)).toBe('6:00'); });
  it('adapte FC et cadence sans imposer zéro', () => {
    expect(chartScale(samples([140, 150]), 'heartRate').domain).toEqual([139.2, 150.8]);
    expect(chartScale(samples([75, 90]), 'cadence').domain[0]).toBeGreaterThan(70);
  });
  it('préserve les altitudes négatives et les zéros réels de cadence', () => {
    expect(chartScale(samples([-20, -10]), 'altitude').domain).toEqual([-20.8, -9.2]);
    expect(chartScale(samples([0, null, 80]), 'cadence').domain[0]).toBe(0);
    expect(displaySeries(samples([0, null, 80]), [0, 90])).toEqual(samples([0, null, 80]));
  });
  it('adapte une allure extrême sans supprimer les originaux ni relier la rupture', () => {
    const input = samples([300, 305, 310, 315, 9600, 320, 325, 330, 335, 340]);
    const original = structuredClone(input), scale = chartScale(input, 'pace');
    expect(scale.reversed).toBe(true); expect(scale.excluded).toBe(1); expect(scale.domain[1]).toBeLessThan(400);
    expect(displaySeries(input, scale.domain)[4]).toEqual({ timeSeconds: 5, value: null });
    expect(input).toEqual(original); expect(chartScale(input, 'pace', true).excluded).toBe(0);
  });
  it('traite une distribution constante et conserve les petits jeux sans exclusion', () => {
    expect(chartScale(samples([300, 300, 300, 300, 300, 300, 300, 9000]), 'pace').excluded).toBe(1);
    expect(chartScale(samples([300, 9000]), 'pace').excluded).toBe(0);
    expect(chartScale(samples([300, 300]), 'pace').domain).toEqual([299, 301]);
  });
  it('gère absences et longues séries sans modifier les temps irréguliers', () => {
    expect(chartScale(samples([null, NaN]), 'altitude').domain).toEqual([0, 1]);
    expect(chartScale([], 'pace').excluded).toBe(0);
    const input = samples(Array.from({ length: 100000 }, (_, i) => i % 100 + 200));
    expect(chartScale(input, 'pace').excluded).toBe(0); expect(input[99999].timeSeconds).toBe(124998.75);
  });
  it.each(THEMES.map(t => [t.name, t] as const))('contraste des quatre couleurs pour %s', (_, theme) => {
    const vars = themeVariables(theme), colors = ['heartRate', 'pace', 'altitude', 'cadence'].map(k => vars[`--chart-${k}`]);
    expect(new Set(colors).size).toBe(4);
    for (const color of colors) expect(contrast(theme.colors.PANEL, color)).toBeGreaterThanOrEqual(3);
  });
});
