import { SessionReviewDialog } from '../components/SessionReviewDialog';
import { reviewableBatch, type CreatedActivityBatch } from '../components/created-activity-batch';
import { useProfileDatabase } from '../storage/profile-context';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
  const database = useProfileDatabase();
  const [batches, setBatches] = useState<CreatedActivityBatch[]>([]);
  const consumed = useRef(new Set<string>()), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const created = useCallback((batch: CreatedActivityBatch) => {
    if (!mounted.current || batch.database !== database || consumed.current.has(batch.id)) return;
    consumed.current.add(batch.id);
    const eligible = reviewableBatch(batch);
    if (eligible) setBatches(previous => [...previous, eligible]);
  }, [database]);
  const [open, setOpen] = useState(showHistory);
  useEffect(() => { if (active) setOpen(showHistory); }, [active, showHistory]);
  return <>
    <header className="page-heading"><h1>Courses</h1></header>
    <details className="panel settings-panel"><summary>Importer des activités</summary><PolarImport onCreated={created} /></details>
    <ManualActivity onCreated={created} />
    {batches[0] && <SessionReviewDialog key={batches[0].id} batch={batches[0]} onDismiss={() => setBatches(previous => previous.slice(1))} />}
    {active && ready && <Suspense fallback={<p role="status">Chargement des statistiques…</p>}>
      <Statistics sessions={sessions} embedded />
      <HistorySection sessions={sessions} open={open} setOpen={setOpen} showHistory={showHistory} />
    </Suspense>}
  </>;
}
