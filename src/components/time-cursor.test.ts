import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SessionChart } from './SessionChart';
import { SynchronizedSessionCharts } from './SynchronizedSessionCharts';
import type { ChartMetric } from '../core/analysis/chart-display';
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  LineChart: ({ children }: { children: ReactNode }) => createElement('svg', null, children),
  CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null, Line: () => null,
  ReferenceLine: ({ x }: { x: number }) => createElement('line', { 'data-time': x }),
  usePlotArea: () => ({ x: 70, y: 12, width: 400, height: 200 }),
}));
describe('curseur dans les graphiques', () => {
  it('place les quatre repères au même temps malgré des séries différentes', () => {
    for (const metric of ['heartRate', 'pace', 'altitude', 'cadence'] as ChartMetric[]) {
      const html = renderToStaticMarkup(createElement(SessionChart, { title: metric, metric, unit: 'unité', samples: [{ timeSeconds: 1, value: 10 }], cursorTime: 755, timeDomain: [0, 1000] }));
      expect(html).toContain('data-time="755"'); expect(html).toContain('Consulter les valeurs');
    }
  });
  it('propose un contrôle temporel clavier et une désélection, avec état neutre', () => {
    const html = renderToStaticMarkup(createElement(SynchronizedSessionCharts, { charts: [{ metric: 'heartRate', title: 'FC', unit: 'bpm', samples: [{ timeSeconds: 0, value: 100 }, { timeSeconds: 1000, value: 110 }] }] }));
    expect(html).toContain('type="range"'); expect(html).toContain('max="1000"'); expect(html).toContain('Effacer la sélection');
    expect(html).toContain('Donnée indisponible'); expect(html).not.toContain('data-time='); expect(html).toContain('touch-action:pan-y');
  });
});
