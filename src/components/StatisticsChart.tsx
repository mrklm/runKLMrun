import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { coverage, formatAscentMeasure, formatMeasure, type Measure, type Period } from '../core/analysis/session-summary';
interface Props { title: string; periods: Period[]; metric: 'distance' | 'ascent' | 'count'; unit: string; divisor?: number; windowSize: number }
export function StatisticsChart({ title, periods, metric, unit, divisor = 1, windowSize }: Props) {
  const [offset, setOffset] = useState(Math.max(0, periods.length - windowSize));
  const start = Math.min(offset, Math.max(0, periods.length - windowSize));
  const points = useMemo(() => periods.slice(start, start + windowSize).map(period => {
    const measure: Measure = metric === 'count' ? { value: period.totals.count, known: period.totals.count, total: period.totals.count } : period.totals[metric];
    return { key: period.key, label: period.label, measure, value: measure.value === null ? null : measure.value / divisor };
  }), [periods, start, windowSize, metric, divisor]);
  return <section className="panel chart-panel" aria-label={title}>
    <h2>{title} ({unit})</h2>
    {periods.length > windowSize && <div className="chart-pagination">
      <button type="button" className="button" disabled={start === 0} onClick={() => setOffset(Math.max(0, start - windowSize))}>Périodes précédentes</button>
      <span role="status">{start + 1}–{Math.min(start + windowSize, periods.length)} sur {periods.length}</span>
      <button type="button" className="button" disabled={start + windowSize >= periods.length} onClick={() => setOffset(Math.min(periods.length - windowSize, start + windowSize))}>Périodes suivantes</button>
    </div>}
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={points} accessibilityLayer margin={{ top: 12, right: 16, bottom: 12, left: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="key" stroke="var(--panel-fg)" tick={{ fill: 'var(--panel-fg)', fontSize: 11 }} minTickGap={28} tickFormatter={key => String(key).slice(0, 10)} />
          <YAxis stroke="var(--panel-fg)" tick={{ fill: 'var(--panel-fg)', fontSize: 11 }} width={metric === 'count' ? 82 : 62} allowDecimals={metric !== 'count' && metric !== 'ascent'} unit={` ${unit}`} />
          <Tooltip filterNull={false} cursor={{ stroke: 'var(--panel-fg)', fill: 'var(--field)', fillOpacity: .25 }} content={({ active, payload }) => {
            const point = payload?.[0]?.payload as typeof points[number] | undefined;
            return active && point ? <div className="chart-tooltip"><strong>{point.label}</strong><p>{metric === 'ascent' ? formatAscentMeasure(point.measure) : formatMeasure(point.measure, divisor)} {unit}</p><p>{point.measure.total === 0 ? 'Aucune séance enregistrée' : coverage(point.measure)}</p></div> : null;
          }} />
          {metric === 'count' ? <Bar dataKey="value" name={title} fill="var(--chart-line)" isAnimationActive={false} /> : <Line dataKey="value" name={title} stroke="var(--chart-line)" strokeWidth={2} type="linear" connectNulls={false} dot={{ r: 2, fill: 'var(--chart-line)' }} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <p className="chart-legend"><span aria-hidden="true" />{title} · {unit}</p>
    <details className="chart-data"><summary>Consulter les valeurs affichées</summary><div className="table-scroll"><table><caption>{title} — fenêtre affichée</caption><thead><tr><th scope="col">Période</th><th scope="col">Valeur ({unit})</th><th scope="col">Mesures renseignées</th></tr></thead><tbody>{points.map(p => <tr key={p.key}><th scope="row">{p.label}</th><td>{metric === 'ascent' ? formatAscentMeasure(p.measure) : formatMeasure(p.measure, divisor)}</td><td>{p.measure.known}/{p.measure.total}</td></tr>)}</tbody></table></div></details>
  </section>;
}
