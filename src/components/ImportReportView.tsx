import type { UnifiedReport } from '../importers/polar-selection';
export function ImportReportView({ report, busy }: { report: UnifiedReport; busy: boolean }) {
  return <div role="status" aria-live="polite">
    <p>{busy ? 'Import en cours' : 'Compte rendu'} — {report.format.toUpperCase()}</p>
    {report.total > 0 ? <p>{report.processed} / {report.total} {report.format === 'zip' ? 'fichiers JSON d’entraînement' : 'fichiers TCX'} traités.</p> : <p>{busy ? 'Analyse de l’archive sélectionnée…' : report.error ? 'L’archive sélectionnée n’a pas pu être traitée.' : 'Archive analysée : aucun fichier JSON d’entraînement reconnu.'}</p>}
    {busy && <progress aria-label="Progression de l’import" value={report.total ? report.processed : undefined} max={report.total || 1} />}
    <p>{report.imported} séances ajoutées · {report.duplicates} doublons · {report.ignored} autres sports · {report.invalid} fichiers non pris en charge.</p>
    {!!report.issues.length && <div role="alert"><p>Motifs des rejets (20 maximum) :</p><ul>{report.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}
    {report.error && <p role="alert">{report.error}</p>}
  </div>;
}
