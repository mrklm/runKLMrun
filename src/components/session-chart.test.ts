import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SessionChart } from './SessionChart';
// Vérifie le contrat passé à Recharts et le tableau, sans simuler une mise en page navigateur.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  LineChart: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: ({ tickFormatter }: { tickFormatter: (v: number) => string }) => createElement('span', null, tickFormatter(500)),
  YAxis: ({ reversed, tickFormatter }: { reversed: boolean; tickFormatter: (v: number) => string }) => createElement('span', { 'data-reversed': String(reversed) }, tickFormatter(330)),
  Line: ({ stroke, connectNulls }: { stroke: string; connectNulls: boolean }) => createElement('span', { 'data-stroke': stroke, 'data-connect-nulls': String(connectNulls) }),
}));
describe('contrat visuel de SessionChart', () => {
  it('inverse l’axe d’allure, formate les axes et conserve les extrêmes dans le tableau', () => {
    const samples = [300, 305, 310, 315, 9600, 320, 325, 330, 335, 340].map((value, i) => ({ timeSeconds: i * 1.25, value }));
    const html = renderToStaticMarkup(createElement(SessionChart, { metric: 'pace', title: 'Allure', unit: 'min/km', samples }));
    expect(html).toContain('data-reversed="true"'); expect(html).toContain('5:30'); expect(html).toContain('08:20');
    expect(html).toContain('1 valeurs extrêmes hors champ'); expect(html).toContain('160:00');
    expect(html).toContain('Afficher l’échelle complète'); expect(html).toContain('<summary>Détails techniques</summary>');
    expect(html).toContain('data-stroke="var(--chart-pace)"'); expect(html).toContain('data-connect-nulls="false"');
    expect(html).toContain('1,25');
  });
  it('conserve la cadence en rpm, zéro et absence distincts', () => {
    const html = renderToStaticMarkup(createElement(SessionChart, { metric: 'cadence', title: 'Cadence', unit: 'rpm', samples: [{ timeSeconds: 0, value: 0 }, { timeSeconds: 1, value: null }, { timeSeconds: 2, value: 80 }] }));
    expect(html).toContain('Cadence (rpm)'); expect(html).toContain('<td>0</td>'); expect(html).toContain('<td>—</td>');
    expect(html).toContain('data-reversed="false"');
  });
});
