import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { StatisticsChart } from '../components/StatisticsChart';
import { coverage, formatMeasure, groupHistory, statistics } from '../core/analysis/session-summary';
import type { RunningSession } from '../types/session';
export function Statistics({ sessions }: { sessions: RunningSession[] }) {
  const years = useMemo(() => groupHistory(sessions).years.map(g => g.year), [sessions]);
  const [selection, setSelection] = useState('all');
  const year = years.includes(selection) ? selection : 'all';
  const data = useMemo(() => statistics(sessions, year), [sessions, year]);
  return <>
    <header className="page-heading"><span className="eyebrow">VOS ENTRAÎNEMENTS EN CHIFFRES</span><h1>Statistiques</h1><p>Calculées à partir des résumés enregistrés sur cet appareil.</p></header>
    <label className="statistics-filter" htmlFor="statistics-year">Période<select id="statistics-year" value={year} onChange={e => setSelection(e.target.value)}><option value="all">Toutes les années</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
    {!!data.excludedDates && <p role="status">{data.excludedDates} séances sans date exploitable sont exclues de ces statistiques.</p>}
    {data.totals.count === 0 ? <section className="panel"><EmptyState title="Aucune séance pour cette période"><p>Importez des séances depuis les Paramètres pour consulter vos statistiques.</p></EmptyState></section> : <>
      <dl className="statistics-metrics">
        <div className="panel"><dt>Nombre de séances</dt><dd>{data.totals.count}</dd></div>
        {([{ name: 'Distance totale', measure: data.totals.distance, unit: 'km', divisor: 1000 }, { name: 'Durée totale', measure: data.totals.duration, unit: 'h', divisor: 3600 }, { name: 'Dénivelé positif cumulé', measure: data.totals.ascent, unit: 'm', divisor: 1 }]).map(item => <div className="panel" key={item.name}><dt>{item.name}</dt><dd>{formatMeasure(item.measure, item.divisor)} {item.unit}</dd><dd className="metric-coverage">{coverage(item.measure)}</dd></div>)}
      </dl>
      <p>Les totaux partiels additionnent uniquement les mesures renseignées. « — » indique une mesure indisponible. Zéro sans séance signifie qu’aucune sortie n’est enregistrée sur la période.</p>
      <p>Les semaines ISO commencent le lundi. {year === 'all' ? 'Toutes les séances sont regroupées selon leur semaine ISO.' : `Seules les séances datées de ${year} sont comptées, même si une semaine chevauche deux années.`} Les graphiques présentent d’abord les périodes les plus récentes ; utilisez les boutons pour parcourir l’historique.</p>
      <StatisticsChart key={`distance-${year}`} title="Distance parcourue par semaine" periods={data.weeks} metric="distance" unit="km" divisor={1000} windowSize={26} />
      <StatisticsChart key={`count-${year}`} title="Nombre de sorties par mois" periods={data.months} metric="count" unit="séances" windowSize={12} />
      <StatisticsChart key={`ascent-${year}`} title="Dénivelé positif par semaine" periods={data.weeks} metric="ascent" unit="m" windowSize={26} />
    </>}
  </>;
}
