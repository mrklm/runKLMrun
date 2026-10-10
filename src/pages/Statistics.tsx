import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { StatisticsChart } from '../components/StatisticsChart';
import { coverage, formatMeasure, validSessionDate } from '../core/analysis/session-summary';
import { activatePeriod, localToday, periodStatistics, type PeriodMode } from '../core/analysis/statistics-period';
import type { RunningSession } from '../types/session';
export function Statistics({ sessions }: { sessions: RunningSession[] }) {
  const [today, setToday] = useState(() => localToday());
  useEffect(() => {
    const refresh = () => setToday(localToday());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const [selection, setSelection] = useState(() => activatePeriod('week', today));
  const years = useMemo(() => [...new Set([today.slice(0, 4), selection.year, ...sessions.filter(s => validSessionDate(s.date)).map(s => s.date.slice(0, 4))])].sort().reverse(), [sessions, today, selection.year]);
  const data = useMemo(() => periodStatistics(sessions, selection, today), [sessions, selection, today]);
  const key = `${selection.mode}-${selection.year}-${selection.month}-${today}`;
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return <>
    <header className="page-heading"><span className="eyebrow">VOS ENTRAÎNEMENTS EN CHIFFRES</span><h1>Statistiques</h1><p>Calculées à partir des résumés enregistrés sur cet appareil.</p></header>
    <div className="statistics-period-controls">
      <label>Période<select value={selection.mode} onChange={e => setSelection(activatePeriod(e.target.value as PeriodMode, localToday()))}><option value="week">7 derniers jours</option><option value="month">Mois</option><option value="year">Année</option><option value="all">Tout</option></select></label>
      {selection.mode === 'month' && <label>Mois<select value={selection.month} onChange={e => setSelection(s => ({ ...s, month: e.target.value }))}>{months.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select></label>}
      {(selection.mode === 'year' || selection.mode === 'month') && <label>Année<select value={selection.year} onChange={e => setSelection(s => ({ ...s, year: e.target.value }))}>{years.map(y => <option key={y}>{y}</option>)}</select></label>}
    </div>
    <p role="status">{data.label}</p>
    {!!data.excludedDates && <p>{data.excludedDates} séances sans date exploitable {selection.mode === 'all' ? 'sont incluses dans les indicateurs, mais pas dans les graphiques.' : 'ne peuvent pas être rattachées à cette période.'}</p>}
    {data.totals.count === 0 ? <section className="panel"><EmptyState title="Aucune séance pour cette période"><p>Importez des séances depuis les Paramètres pour consulter vos statistiques.</p></EmptyState></section> : <>
      <dl className="statistics-metrics">
        <div className="panel"><dt>Nombre de séances</dt><dd>{data.totals.count}</dd></div>
        {([{ name: 'Distance totale', measure: data.totals.distance, unit: 'km', divisor: 1000 }, { name: 'Durée totale', measure: data.totals.duration, unit: 'h', divisor: 3600 }, { name: 'Dénivelé positif cumulé', measure: data.totals.ascent, unit: 'm', divisor: 1 }]).map(item => <div className="panel" key={item.name}><dt>{item.name}</dt><dd>{formatMeasure(item.measure, item.divisor)} {item.unit}</dd><dd className="metric-coverage">{coverage(item.measure)}</dd></div>)}
      </dl>
      <p>Les totaux partiels additionnent uniquement les mesures renseignées. « — » indique une mesure indisponible. Zéro sans séance signifie qu’aucune sortie n’est enregistrée sur la période.</p>
      <p>{data.daily ? 'Chaque point représente une journée de la période sélectionnée.' : 'Les semaines ISO commencent le lundi. Le filtre est appliqué avant le regroupement ; utilisez les boutons pour parcourir les périodes.'}</p>
      <StatisticsChart key={`distance-${key}`} title={`Distance parcourue par ${data.daily ? 'jour' : 'semaine'}`} periods={data.distancePeriods} metric="distance" unit="km" divisor={1000} windowSize={data.daily ? 31 : 26} />
      <StatisticsChart key={`count-${key}`} title={`Nombre de sorties par ${data.daily ? 'jour' : 'mois'}`} periods={data.countPeriods} metric="count" unit="séances" windowSize={data.daily ? 31 : 12} />
      <StatisticsChart key={`ascent-${key}`} title={`Dénivelé positif par ${data.daily ? 'jour' : 'semaine'}`} periods={data.ascentPeriods} metric="ascent" unit="m" windowSize={data.daily ? 31 : 26} />
    </>}
  </>;
}
