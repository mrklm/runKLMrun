import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ManualActivity } from '../components/ManualActivity';
import { PolarImport } from '../components/PolarImport';
import { History } from './History';
import type { RunningSession } from '../types/session';
const Statistics = lazy(() => import('./Statistics').then(module => ({ default: module.Statistics })));

function HistorySection({ sessions, open, setOpen, showHistory }: { sessions: RunningSession[]; open: boolean; setOpen: (value: boolean) => void; showHistory: boolean }) {
  const summary = useRef<HTMLElement>(null);
  // L’effet attend le contenu des statistiques : le chargement différé ne décale pas la cible après le défilement.
  useEffect(() => {
    if (!showHistory) return;
    const frame = requestAnimationFrame(() => { summary.current?.focus({ preventScroll: true }); summary.current?.scrollIntoView({ block: 'start' }); });
    return () => cancelAnimationFrame(frame);
  }, [showHistory]);
  return <details className="courses-history" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary ref={summary}>Historique des courses</summary>
    {open && <History sessions={sessions} embedded />}
  </details>;
}

/** Les outils restent montés pour ne pas interrompre un import en changeant de page. */
export function Courses({ sessions, active, ready = true, showHistory = false }: { sessions: RunningSession[]; active: boolean; ready?: boolean; showHistory?: boolean }) {
  const [open, setOpen] = useState(showHistory);
  useEffect(() => { if (active) setOpen(showHistory); }, [active, showHistory]);
  return <>
    <header className="page-heading"><h1>Courses</h1></header>
    <details className="panel settings-panel"><summary>Importer des activités</summary><PolarImport /></details>
    <ManualActivity />
    {active && ready && <Suspense fallback={<p role="status">Chargement des statistiques…</p>}>
      <Statistics sessions={sessions} embedded />
      <HistorySection sessions={sessions} open={open} setOpen={setOpen} showHistory={showHistory} />
    </Suspense>}
  </>;
}
