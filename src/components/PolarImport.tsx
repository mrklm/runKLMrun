import type { CreatedActivityBatch } from './created-activity-batch';
import type { PolarWorkerMessage } from '../importers/polar-worker-task';
import { storageChanges } from '../storage/changes';
import { acquireOperation, useOperationBusy } from './operation-guard';
import { DelayedOperation } from './DelayedOperation';
import { maintainAfterImport } from '../storage/automatic-retention';
import { createRetentionService } from '../storage/detail-retention';
import { ImportShoeSuggestion } from './Shoes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { takeSelectedFiles } from '../importers/file-selection';
import { emptyReport } from '../importers/import-report';
import { emptyTcxReport, importTcxFiles } from '../importers/tcx-files';
import { selectPolarFiles, tcxReport, zipReport, type UnifiedReport } from '../importers/polar-selection';
import { createSessionRepository } from '../storage/database';
import { useProfileDatabase } from '../storage/profile-context';
import { ImportReportView } from './ImportReportView';
export function PolarImport({ onCreated }: { onCreated?: (batch: CreatedActivityBatch) => void }) {
  const database = useProfileDatabase();
  const sessionRepository = useMemo(() => createSessionRepository(database), [database]);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<UnifiedReport>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const operationBusy = useOperationBusy();
  const releaseOperation = useRef<(() => void) | undefined>(undefined);
  const running = useRef(false), mounted = useRef(true);
  const worker = useRef<Worker | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (worker.current) { worker.current.terminate(); releaseOperation.current?.(); releaseOperation.current = undefined; } }; }, []);
  function finish() { releaseOperation.current?.(); releaseOperation.current = undefined; running.current = false; worker.current?.terminate(); worker.current = null; if (mounted.current) { setBusy(false); } }
  async function start() {
    if (running.current) return;
    const selection = selectPolarFiles(files);
    if ('error' in selection) { setError(selection.error); setReport(undefined); return; }
    const release = acquireOperation(); if (!release) return; releaseOperation.current = release;
    const batchId = crypto.randomUUID();
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    let settled = false;
    const completed = (activityIds: string[]) => {
      if (settled) return; settled = true; finish();
      if (mounted.current) { setImportedIds(activityIds); onCreated?.({ id: batchId, database, activityIds, returnFocus }); }
    };
    setImportedIds([]); setError(undefined); running.current = true; setBusy(true);
    if (selection.format === 'tcx') {
      const added: string[] = [];
      setReport(tcxReport(emptyTcxReport(selection.files.length)));
      try { const result = await importTcxFiles(selection.files, sessionRepository, r => { if (mounted.current) setReport(tcxReport(r)); }, undefined, new Date(), id => added.push(id)); if (mounted.current) setReport(tcxReport(result)); void maintainAfterImport(result, () => createRetentionService({ name: database }).maintain()); }
      catch { if (mounted.current) setError('Import interrompu. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.'); }
      finally { completed(added); }
      return;
    }
    setReport(zipReport(emptyReport()));
    // Sans message terminal, la liste peut être incomplète : aucun bilan ni estimation du seuil.
    const fail = () => {
      if (settled || !mounted.current) return;
      settled = true;
      storageChanges.committed(database, ['sessions']);
      setReport(undefined);
      setError('Import interrompu. Le nombre final de séances enregistrées n’a pas pu être confirmé. Les séances déjà ajoutées sont conservées dans votre historique. Vous pouvez réessayer.');
      finish();
    };
    try {
      worker.current = new Worker(new URL('../importers/polar.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onerror = fail;
      worker.current.onmessage = (event: MessageEvent<PolarWorkerMessage>) => {
        const message = event.data;
        if (settled || !mounted.current || message.batchId !== batchId) return;
        setReport(zipReport(message.report));
        if (message.type === 'done' || message.type === 'error') {
          if (typeof BroadcastChannel === 'undefined' && message.importedIds.length) storageChanges.committed(database, ['sessions']);
          void maintainAfterImport(message.report, () => createRetentionService({ name: database }).maintain());
          completed(message.importedIds);
        }
      };
      worker.current.postMessage({ file: selection.files[0], database, batchId });
    } catch { fail(); }
  }
  return <section className="panel settings-panel" aria-labelledby="polar-title">
    <h2 id="polar-title">Importer des séances Polar</h2>
    <p>Importez vos séances depuis une archive Polar ou depuis des fichiers TCX exportés de Polar Flow.</p>
    <p>Formats acceptés : ZIP, TCX. Sélectionnez une archive ZIP ou plusieurs fichiers TCX, sans mélanger les formats. Le traitement reste local.</p>
    <label className="import-label">Sélectionner les fichiers<input type="file" accept=".zip,.ZIP,.tcx,.TCX" multiple disabled={operationBusy} onChange={event => { const selected = takeSelectedFiles(event.currentTarget); setFiles(selected); setReport(undefined); const result = selectPolarFiles(selected); setError('error' in result ? result.error : undefined); }} /></label>
    <p>{files.length ? `${files.length} fichier(s) sélectionné(s).` : 'Aucun fichier sélectionné.'}</p>
    <button className="button" disabled={operationBusy} onClick={() => void start()}>Importer les séances</button>
    {error && <p role="alert">{error}</p>}
    {report && (busy ? <DelayedOperation active={busy}><ImportReportView report={report} busy /></DelayedOperation> : <ImportReportView report={report} busy={false} />)}
    {!busy && importedIds.length > 0 && <ImportShoeSuggestion ids={importedIds} />}
  </section>;
}
