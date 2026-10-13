import { ShoeHistoryProvider } from '../components/ShoeHistory';
import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { SessionList } from '../components/SessionList';
import { coverage, formatMeasure, groupHistory, type MonthGroup, type YearGroup } from '../core/analysis/session-summary';
import type { RunningSession } from '../types/session';
function Month({ month, initialOpen }: { month: MonthGroup; initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <details className="history-month" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><strong>{month.label}</strong><span>{month.totals.count} séances · {formatMeasure(month.totals.distance, 1000)} km{month.totals.distance.known < month.totals.count && ' (partiel)'}</span></summary>
    {open && <><p className="group-coverage">{coverage(month.totals.distance)}</p><SessionList shoeSelection sessions={month.sessions} /></>}
  </details>;
}
function Year({ group, initialOpen }: { group: YearGroup; initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <details className="panel history-year" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><strong>{group.year}</strong><span>{group.totals.count} séances · {formatMeasure(group.totals.distance, 1000)} km{group.totals.distance.known < group.totals.count && ' (partiel)'}</span></summary>
    <div hidden={!open}>{group.months.map((month, i) => <Month key={month.key} month={month} initialOpen={initialOpen && i === 0} />)}</div>
  </details>;
}
export function History({ sessions }: { sessions: RunningSession[] }) {
  const { years, undated } = useMemo(() => groupHistory(sessions), [sessions]);
  return <ShoeHistoryProvider>
    <header className="page-heading"><span className="eyebrow">VOS SORTIES</span><h1>Historique</h1><p>Retrouvez vos entraînements par année et par mois. Les distances partielles ne comprennent que les mesures renseignées.</p></header>
    {sessions.length === 0 ? <section className="panel"><EmptyState title="Aucune sortie enregistrée" symbol="≡"><p>Importez votre archive Polar depuis les Paramètres.</p></EmptyState></section> : years.map((group, i) => <Year key={group.year} group={group} initialOpen={i === 0} />)}
    {!!undated.length && <section className="panel settings-panel"><h2>Séances sans date exploitable</h2><p>{undated.length} séances ne peuvent pas être classées. Elles restent conservées.</p><SessionList shoeSelection sessions={undated} /></section>}
  </ShoeHistoryProvider>;
}
