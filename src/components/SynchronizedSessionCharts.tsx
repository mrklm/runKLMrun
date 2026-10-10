import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Sample } from '../types/session';
import type { ChartMetric } from '../core/analysis/chart-display';
import { compactTime, paceLabel } from '../core/analysis/chart-display';
import { measure } from '../core/analysis/session-format';
import { createTimeIndex, cursorReducer, nearestMeasurement } from '../core/analysis/time-cursor';
import { SessionChart } from './SessionChart';
export interface SessionCurve { metric: ChartMetric; title: string; unit: string; samples: Sample[] }
export function SynchronizedSessionCharts({ charts }: { charts: SessionCurve[] }) {
  const [cursor, dispatch] = useReducer(cursorReducer, null);
  const visibleCharts = useMemo(() => charts.filter(c => c.samples.some(p => p.value !== null)), [charts]);
  const indexes = useMemo(() => charts.map(c => createTimeIndex(c.samples)), [charts]);
  const domain = useMemo<[number, number]>(() => [0, Math.max(1, ...charts.map(c => c.samples.at(-1)?.timeSeconds ?? 0))], [charts]);
  const frame = useRef<number | null>(null);
  const pending = useRef(0);
  const cancel = useCallback(() => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; }, []);
  useEffect(() => () => cancel(), [cancel]);
  const hover = useCallback((time: number) => {
    pending.current = time;
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; dispatch({ type: 'hover', time: pending.current }); });
  }, []);
  const select = useCallback((time: number) => { cancel(); dispatch({ type: 'select', time }); }, [cancel]);
  const leave = useCallback(() => { cancel(); dispatch({ type: 'leave' }); }, [cancel]);
  return <>
    <section className="panel cursor-controls" aria-label="Curseur temporel synchronisé">
      <label>Choisissez un instant dans la séance<input type="range" min={0} max={domain[1]} step="0.1" value={cursor?.time ?? 0} aria-valuetext={cursor ? compactTime(cursor.time) : 'Aucun instant sélectionné'} onFocus={() => { if (!cursor) select(0); }} onChange={event => select(Number(event.currentTarget.value))} /></label>
      <button className="button" disabled={!cursor} onClick={() => { cancel(); dispatch({ type: 'clear' }); }}>Effacer la sélection</button>
      <details className="cursor-help"><summary>Utiliser le curseur</summary><p>Survolez une courbe, touchez un instant ou utilisez les flèches du curseur au clavier. Les valeurs proches indiquent leur temps de mesure.</p></details>
      <p aria-live={cursor?.mode === 'pinned' ? 'polite' : 'off'}>Instant : {cursor ? compactTime(cursor.time) : '—'}</p>
      <dl className="cursor-values" aria-live={cursor?.mode === 'pinned' ? 'polite' : 'off'} aria-atomic="true">{charts.map((chart, i) => {
        const point = cursor ? nearestMeasurement(indexes[i], cursor.time) : undefined;
        return <div key={chart.metric}><dt>{chart.title}</dt><dd>{point ? `${chart.metric === 'pace' ? paceLabel(point.value!) : measure(point.value!)} ${chart.unit}` : 'Donnée indisponible'}{point && cursor && point.timeSeconds !== cursor.time && <small> Mesurée à {compactTime(point.timeSeconds)} ({measure(point.timeSeconds)} s)</small>}</dd></div>;
      })}</dl>
    </section>
    {visibleCharts.map(chart => <SessionChart key={chart.metric} {...chart} cursorTime={cursor?.time ?? null} timeDomain={domain} onHoverTime={hover} onSelectTime={select} onLeaveTime={leave} />)}
  </>;
}
