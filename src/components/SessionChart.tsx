import { memo, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { TimeCursorOverlay } from './TimeCursorOverlay';
import type { Sample } from '../types/session';
import { reduceSeries } from '../core/analysis/session-detail';
import { measure } from '../core/analysis/session-format';
import { chartScale, compactTime, displaySeries, paceLabel, type ChartMetric } from '../core/analysis/chart-display';
export function SessionChart({ title, unit, samples, metric, cursorTime, timeDomain, onHoverTime, onSelectTime, onLeaveTime }: { title: string; unit: string; samples: Sample[]; metric: ChartMetric; cursorTime?: number | null; timeDomain?: [number, number]; onHoverTime?: (time: number) => void; onSelectTime?: (time: number) => void; onLeaveTime?: () => void }) {
  const [full, setFull] = useState(false);
  const scale = useMemo(() => chartScale(samples, metric, full), [samples, metric, full]);
  const points = useMemo(() => reduceSeries(displaySeries(samples, scale.domain)), [samples, scale]);
  const singlePoint = useMemo(() => points.filter(p => p.value !== null).length === 1, [points]);
  const formatValue = (v: number) => metric === 'pace' ? paceLabel(v) : measure(v);
  const color = `var(--chart-${metric})`;
  return <section className="panel chart-panel" aria-label={title}>
    <h2>{title} ({unit})</h2>
    <p>Temps écoulé depuis le début de la séance. Les interruptions de mesure restent visibles.</p>
    <div className="chart-frame"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} accessibilityLayer margin={{ top: 12, right: 24, bottom: 12, left: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="timeSeconds" domain={timeDomain ?? ['dataMin', 'dataMax']} allowDataOverflow tickFormatter={compactTime} stroke="var(--panel-fg)" minTickGap={28} tickCount={4} />
        <YAxis domain={scale.domain} allowDataOverflow reversed={scale.reversed} stroke="var(--panel-fg)" width={62} tickFormatter={v => formatValue(Number(v))} />
        {!timeDomain && <Tooltip allowEscapeViewBox={{ x: false, y: false }} filterNull={false} content={({ active, payload }) => {
          const point = payload?.[0]?.payload as Sample | undefined;
          return active && point ? <div className="chart-tooltip"><strong>Temps : {compactTime(point.timeSeconds)}</strong><p>{title} : {point.value === null ? 'Mesure indisponible' : `${formatValue(point.value)} ${unit}`}</p></div> : null;
        }} />}
        <Line dataKey="value" name={title} type="linear" stroke={color} strokeWidth={2} dot={singlePoint ? { r: 3, fill: color } : false} connectNulls={false} isAnimationActive={false} />
        {cursorTime !== null && cursorTime !== undefined && <ReferenceLine x={cursorTime} stroke="var(--panel-fg)" strokeDasharray="4 3" strokeWidth={1.5} />}
        {timeDomain && onHoverTime && onSelectTime && onLeaveTime && <TimeCursorOverlay domain={timeDomain} onHover={onHoverTime} onSelect={onSelectTime} onLeave={onLeaveTime} />}
      </LineChart>
    </ResponsiveContainer></div>
    {scale.excluded > 0 && <p role="status">Échelle adaptée : {scale.excluded} valeurs extrêmes hors champ créent des interruptions. Vous pouvez consulter toutes les valeurs dans le tableau ou afficher l’échelle complète.</p>}
    {metric === 'pace' && <button className="button" onClick={() => setFull(v => !v)}>{full ? 'Utiliser l’échelle adaptée' : 'Afficher l’échelle complète'}</button>}
    <details className="chart-data"><summary>Détails techniques</summary><p>{samples.length} points disponibles ; {points.length} affichés. Les extrema dans l’échelle choisie et les interruptions sont conservés lors de la réduction. Aucune donnée enregistrée n’est modifiée.</p></details>
    <SessionChartTable title={title} unit={unit} samples={samples} metric={metric} />
  </section>;
}

/** La navigation du curseur ne reconstruit pas les lignes du tableau. */
const SessionChartTable = memo(function SessionChartTable({ title, unit, samples, metric }: { title: string; unit: string; samples: Sample[]; metric: ChartMetric }) {
  const formatValue = (v: number) => metric === 'pace' ? paceLabel(v) : measure(v);
  const [page, setPage] = useState(0);
  const start = Math.min(page * 100, Math.max(0, Math.floor((samples.length - 1) / 100) * 100));
  return <details className="chart-data"><summary>Consulter les valeurs de {title.toLocaleLowerCase('fr-FR')}</summary>
      <p>Vous pouvez parcourir toutes les mesures dans ce tableau, y compris sur écran tactile.</p>
      <div className="chart-pagination"><button className="button" disabled={start === 0} onClick={() => setPage(Math.max(0, page - 1))}>Valeurs précédentes</button><span role="status">{start + 1}–{Math.min(start + 100, samples.length)} sur {samples.length}</span><button className="button" disabled={start + 100 >= samples.length} onClick={() => setPage(page + 1)}>Valeurs suivantes</button></div>
      <div className="table-scroll"><table><caption>{title} — valeurs sans réduction</caption><thead><tr><th scope="col">Temps écoulé (secondes)</th><th scope="col">Valeur ({unit})</th></tr></thead><tbody>{samples.slice(start, start + 100).map((p, i) => <tr key={start + i}><th scope="row">{measure(p.timeSeconds)}</th><td>{p.value === null ? '—' : formatValue(p.value)}</td></tr>)}</tbody></table></div>
    </details>;
});
