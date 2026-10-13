import { ImportShoeSuggestion } from './Shoes';
import { useEffect, useRef, useState } from 'react';
import { takeSelectedFiles } from '../importers/file-selection';
import { emptyReport, type ImportReport } from '../importers/import-report';
import { emptyTcxReport, importTcxFiles } from '../importers/tcx-files';
import { selectPolarFiles, tcxReport, zipReport, type UnifiedReport } from '../importers/polar-selection';
import { sessionRepository } from '../storage/database';
import { ImportReportView } from './ImportReportView';
export function PolarImport({ onImported }: { onImported: () => void }) {
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<UnifiedReport>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const running = useRef(false), mounted = useRef(true);
  const worker = useRef<Worker | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; worker.current?.terminate(); }; }, []);
  function finish() { running.current = false; worker.current?.terminate(); worker.current = null; if (mounted.current) { setBusy(false); onImported(); } }
  async function start() {
    if (running.current) return;
    const selection = selectPolarFiles(files);
    if ('error' in selection) { setError(selection.error); setReport(undefined); return; }
    setImportedIds([]); setError(undefined); running.current = true; setBusy(true);
    if (selection.format === 'tcx') {
      const added: string[] = [];
      setReport(tcxReport(emptyTcxReport(selection.files.length)));
      try { const result = await importTcxFiles(selection.files, sessionRepository, r => { if (mounted.current) setReport(tcxReport(r)); }, undefined, new Date(), id => added.push(id)); if (mounted.current) setReport(tcxReport(result)); }
      catch { if (mounted.current) setError('Import interrompu. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.'); }
      finally { if (mounted.current) setImportedIds(added); finish(); }
      return;
    }
    setReport(zipReport(emptyReport()));
    const fail = () => { if (mounted.current) setReport(previous => ({ ...(previous ?? zipReport(emptyReport())), error: 'Import interrompu. Les séances déjà ajoutées sont conservées. Vous pouvez réessayer.' })); finish(); };
    try {
      worker.current = new Worker(new URL('../importers/polar.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onerror = fail;
      worker.current.onmessage = event => {
        if (event.data.type === 'error') { fail(); return; }
        if (mounted.current) setReport(zipReport(event.data.report as ImportReport));
        if (event.data.type === 'done') { if (mounted.current) setImportedIds(event.data.importedIds ?? []); finish(); }
      };
      worker.current.postMessage(selection.files[0]);
    } catch { fail(); }
  }
  return <section className="panel settings-panel" aria-labelledby="polar-title">
    <h2 id="polar-title">Importer des séances Polar</h2>
    <p>Importez vos séances depuis une archive Polar ou depuis des fichiers TCX exportés de Polar Flow.</p>
    <p>Formats acceptés : ZIP, TCX. Sélectionnez une archive ZIP ou plusieurs fichiers TCX, sans mélanger les formats. Le traitement reste local.</p>
    <label className="import-label">Sélectionner les fichiers<input type="file" accept=".zip,.ZIP,.tcx,.TCX" multiple disabled={busy} onChange={event => { const selected = takeSelectedFiles(event.currentTarget); setFiles(selected); setReport(undefined); const result = selectPolarFiles(selected); setError('error' in result ? result.error : undefined); }} /></label>
    <p>{files.length ? `${files.length} fichier(s) sélectionné(s).` : 'Aucun fichier sélectionné.'}</p>
    <button className="button" disabled={busy} onClick={() => void start()}>Importer les séances</button>
    {error && <p role="alert">{error}</p>}
    {report && <ImportReportView report={report} busy={busy} />}
    {!busy && importedIds.length > 0 && <ImportShoeSuggestion ids={importedIds} />}
  </section>;
}
