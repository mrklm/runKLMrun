import { storageChanges } from '../storage/changes';
import { acquireOperation, useOperationBusy } from './operation-guard';
import { DelayedOperation } from './DelayedOperation';
import { maintainAfterImport } from '../storage/automatic-retention';
import { createRetentionService } from '../storage/detail-retention';
import { ImportShoeSuggestion } from './Shoes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { takeSelectedFiles } from '../importers/file-selection';
import { emptyReport, type ImportReport } from '../importers/import-report';
import { emptyTcxReport, importTcxFiles } from '../importers/tcx-files';
import { selectPolarFiles, tcxReport, zipReport, type UnifiedReport } from '../importers/polar-selection';
import { createSessionRepository } from '../storage/database';
import { useProfileDatabase } from '../storage/profile-context';
import { ImportReportView } from './ImportReportView';
export function PolarImport() {
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
    setImportedIds([]); setError(undefined); running.current = true; setBusy(true);
    if (selection.format === 'tcx') {
      const added: string[] = [];
      setReport(tcxReport(emptyTcxReport(selection.files.length)));
      try { const result = await importTcxFiles(selection.files, sessionRepository, r => { if (mounted.current) setReport(tcxReport(r)); }, undefined, new Date(), id => added.push(id)); if (mounted.current) setReport(tcxReport(result)); void maintainAfterImport(result, () => createRetentionService({ name: database }).maintain()); }
      catch { if (mounted.current) setError('Import interrompu. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.'); }
      finally { if (mounted.current) setImportedIds(added); finish(); }
      return;
    }
    setReport(zipReport(emptyReport()));
    let committedInWorker = 0;
    const fail = () => { if (committedInWorker) storageChanges.committed(database, ['sessions']); if (mounted.current) setReport(previous => ({ ...(previous ?? zipReport(emptyReport())), error: 'Import interrompu. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.' })); finish(); };
    try {
      worker.current = new Worker(new URL('../importers/polar.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onerror = fail;
      worker.current.onmessage = event => {
        committedInWorker = event.data.report?.imported ?? committedInWorker;
        if (event.data.type === 'error') { fail(); return; }
        if (mounted.current) setReport(zipReport(event.data.report as ImportReport));
        if (event.data.type === 'done') { if (typeof BroadcastChannel === 'undefined' && committedInWorker) storageChanges.committed(database, ['sessions']); void maintainAfterImport(event.data.report as ImportReport, () => createRetentionService({ name: database }).maintain()); if (mounted.current) setImportedIds(event.data.importedIds ?? []); finish(); }
      };
      worker.current.postMessage({ file: selection.files[0], database });
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
