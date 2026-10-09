import { useEffect, useRef, useState } from 'react';
import { IMPORT_REASONS, type ImportReason } from '../importers/polar-errors';
import { emptyReport, type ImportReport } from '../importers/import-report';

export function PolarImport({ onImported }: { onImported: () => void }) {
  const [report, setReport] = useState<ImportReport>();
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  function start(file: File) {
    setReport(emptyReport()); setBusy(true);
    const fail = () => { setReport(previous => ({ ...(previous ?? emptyReport()), error: 'Import interrompu. Les séances déjà enregistrées sont conservées. Réessayez sans risque de doublon.' })); setBusy(false); worker.current?.terminate(); onImported(); };
    try {
      worker.current = new Worker(new URL('../importers/polar.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onerror = fail;
      worker.current.onmessage = event => {
        if (event.data.type === 'error') { fail(); return; }
        setReport(event.data.report);
        if (event.data.type === 'done') { setBusy(false); worker.current?.terminate(); onImported(); }
      };
      worker.current.postMessage(file);
    } catch { fail(); }
  }
  return <section className="panel settings-panel" aria-labelledby="polar-title">
    <h2 id="polar-title">Importer des données Polar</h2>
    <p>Sélectionnez votre archive ZIP Polar. Le traitement reste entièrement dans ce navigateur. Les séances déjà présentes sont conservées.</p>
    <label className="import-label">Sélectionner le ZIP<input type="file" accept=".zip,application/zip" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) start(file); event.target.value = ''; }} /></label>
    {report && <div role="status" aria-live="polite">
      <p>{busy ? 'Import en cours' : 'Compte rendu'} : {report.processed} / {report.total} fichiers d’entraînement traités.</p>
      {busy && <progress aria-label="Progression de l’import" value={report.total ? report.processed : undefined} max={report.total || 1} />}
      <p>{report.imported} ajoutées · {report.duplicates} doublons · {report.ignored} autres sports · {report.invalid} fichiers non pris en charge.</p>
      {!busy && !report.total && !report.error && <p>Aucun fichier training-session_*.json reconnu dans cette archive.</p>}
      {!!Object.keys(report.reasons).length && <ul aria-label="Motifs du compte rendu">{Object.entries(report.reasons).map(([reason, count]) => <li key={reason}>{IMPORT_REASONS[reason as ImportReason]} : {count}</li>)}</ul>}
      {report.error && <p role="alert">{report.error}</p>}
      {!!report.issues.length && <details><summary>Détails des erreurs (20 maximum)</summary><ul>{report.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}
    </div>}
  </section>;
}
