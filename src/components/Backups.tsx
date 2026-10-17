import { acquireOperation, useOperationBusy } from './operation-guard';
import { DelayedOperation } from './DelayedOperation';
import { memoryError } from '../backup/errors';
import { sizeLabel } from '../backup/limits';
import { useEffect, useRef, useState } from 'react';
import { createBackupService } from '../storage/backup';
import { runBackupWorker } from '../backup/worker-client';
import { BackupError } from '../backup/validation';
import { StorageBlockedError } from '../storage/database-connection';
import type { BackupDocument, BackupExport, RestoreOptions, RestorePreview, RestoreReport } from '../types/backup';

const service = createBackupService({
  export: data => runBackupWorker<BackupExport>({ kind: 'export', data, version: __APP_VERSION__ }),
  parse: (file, signal) => runBackupWorker<BackupDocument>({ kind: 'parse', file }, signal),
  prepare: (preview, options, signal) => runBackupWorker({ kind: 'prepare', preview, options }, signal),
});
function errorMessage(error: unknown) {
  const allocation = memoryError(error);
  if (allocation) return allocation.message;
  if (error instanceof BackupError || error instanceof StorageBlockedError) return error.message;
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'L’espace disponible est insuffisant. La restauration a été annulée ; vos données précédentes sont conservées.';
  return 'L’opération a échoué. Aucune restauration partielle n’a été conservée. Vérifiez le stockage de votre navigateur puis réessayez.';
}
export function Backups() {
  const [phase, setPhase] = useState<'idle' | 'exporting' | 'reading' | 'restoring'>('idle');
  const [preview, setPreview] = useState<RestorePreview>();
  const [options, setOptions] = useState<RestoreOptions>({ mode: 'merge', profile: 'keep' });
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<RestoreReport>();
  const input = useRef<HTMLInputElement>(null), previewHeading = useRef<HTMLHeadingElement>(null), notice = useRef<HTMLParagraphElement>(null);
  const controller = useRef<AbortController | null>(null), generation = useRef(0), locked = useRef(false);
  const busy = phase !== 'idle';
  const operationBusy = useOperationBusy();
  const releaseOperation = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => { generation.current++; controller.current?.abort(); if (controller.current) { releaseOperation.current?.(); releaseOperation.current = undefined; } }, []);
  useEffect(() => { if (preview) previewHeading.current?.focus(); }, [preview]);
  useEffect(() => { if (error || message) notice.current?.focus(); }, [error, message]);
  function cancel() {
    generation.current++; controller.current?.abort(); locked.current = false; releaseOperation.current?.(); releaseOperation.current = undefined;
    setPreview(undefined); setConfirmed(false); setPhase('idle'); setError(''); setMessage('Restauration annulée. Vos données restent inchangées.');
  }
  async function exportData() {
    if (locked.current) return;
    const release = acquireOperation(); if (!release) return; releaseOperation.current = release;
    locked.current = true; setPhase('exporting'); setError(''); setMessage(''); setReport(undefined);
    try {
      const { file: blob, jsonBytes } = await service.exportData();
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `runKLMrun-sauvegarde-${new Date().toISOString().slice(0, 10)}.json.gz`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Votre sauvegarde est prête. Fichier : ${sizeLabel(blob.size)} ; avant compression : ${sizeLabel(jsonBytes)} ; réduction : ${((1 - blob.size / jsonBytes) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %. Conservez ce fichier dans un endroit sûr.`);
    } catch (e) { setError(errorMessage(e)); }
    finally { releaseOperation.current?.(); releaseOperation.current = undefined; locked.current = false; setPhase('idle'); }
  }
  async function selectFile(file: File | undefined) {
    if (!file || locked.current) return;
    const release = acquireOperation(); if (!release) return; releaseOperation.current = release;
    locked.current = true;
    const token = ++generation.current;
    controller.current = new AbortController();
    setPhase('reading'); setPreview(undefined); setError(''); setMessage(''); setReport(undefined); setConfirmed(false);
    setOptions({ mode: 'merge', profile: 'keep' });
    try {
      const value = await service.preview(file, controller.current.signal);
      if (token === generation.current) setPreview(value);
    } catch (e) { if (token === generation.current) setError(errorMessage(e)); }
    finally { if (token === generation.current) { controller.current = null; releaseOperation.current?.(); releaseOperation.current = undefined; locked.current = false; setPhase('idle'); } }
  }
  async function restore() {
    if (!preview || !confirmed || locked.current) return;
    const release = acquireOperation(); if (!release) return; releaseOperation.current = release;
    locked.current = true; setPhase('restoring'); setError(''); setMessage('');
    try {
      const result = await service.restore(preview, options);
      setReport(result); setPreview(undefined); setConfirmed(false);
      setMessage('La restauration est terminée. Les données de l’application ont été actualisées.');
    } catch (e) { setError(errorMessage(e)); setConfirmed(false); }
    finally { releaseOperation.current?.(); releaseOperation.current = undefined; locked.current = false; setPhase('idle'); }
  }
  return <section className="panel settings-panel backups" aria-labelledby="backup-title">
    <h2 id="backup-title">Données et sauvegardes</h2>
    <p>Exportez vos séances, leurs détails, votre profil, vos chaussures et leurs associations dans une sauvegarde compressée locale, non chiffrée. Le thème de cet appareil reste inchangé.</p>
    <p className="notice">Votre sauvegarde contient des données personnelles, éventuellement des informations de localisation. Conservez ce fichier dans un endroit sûr.</p>
    <p>Sauvegarde compressée (.json.gz). Restauration : .json ou .json.gz.</p>
    <div className="profile-actions">
      <button className="button" disabled={operationBusy || !!preview} onClick={exportData}>Exporter mes données</button>
      <button className="button" disabled={operationBusy || !!preview} onClick={() => input.current?.click()}>Restaurer une sauvegarde</button>
      <input ref={input} type="file" accept=".json,.JSON,.json.gz,.JSON.GZ,.gz,.GZ,application/json,application/gzip" hidden aria-label="Fichier de sauvegarde" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void selectFile(file); }} />
    </div>
    <p className="training-coverage">Traitement sur votre appareil, sans envoi. Limites : gzip 128 Mio ; contenu JSON 384 Mio. Des limites de complexité et d’expansion protègent la lecture. L’empreinte détecte des altérations, mais ne garantit pas l’authenticité du fichier.</p>
    <DelayedOperation active={busy}><p>{phase === 'reading' ? 'Lecture, décompression éventuelle et vérification de la sauvegarde…' : phase === 'exporting' ? 'Lecture des données, préparation et compression de votre sauvegarde…' : 'Restauration en cours…'}</p></DelayedOperation>
    {phase === 'reading' && <button className="button" onClick={cancel}>Annuler la lecture</button>}
    {error && <p role="alert" tabIndex={-1} ref={notice}>{error}</p>}
    {message && <p role="status" tabIndex={-1} ref={notice}>{message}</p>}
    {preview && <div className="backup-preview">
      <h3 ref={previewHeading} tabIndex={-1}>Prévisualisation de la sauvegarde</h3>
      <dl className="training-metrics">
        <div><dt>Date de la sauvegarde</dt><dd>{new Date(preview.backup.exportedAt).toLocaleString('fr-FR')}</dd></div>
        <div><dt>Version du format</dt><dd>{preview.backup.formatVersion}</dd></div>
        <div><dt>Séances</dt><dd>{preview.backup.data.sessions.length}</dd></div>
        <div><dt>Ensembles de détails dans le fichier</dt><dd>{preview.backup.data.details.length}</dd></div>
        {preview.mergeReport && <>
          <div><dt>Séances avec détails récents conservables</dt><dd>{preview.mergeReport.retention.recentDetails}</dd></div>
          <div><dt>Détails anciens du fichier ignorés</dt><dd>{preview.mergeReport.retention.ignoredDetails}</dd></div>
          <div><dt>Séances à date incertaine</dt><dd>{preview.mergeReport.retention.uncertainSessions}</dd></div>
          <div><dt>Détails conservables malgré une date incertaine</dt><dd>{preview.mergeReport.retention.uncertainDetails}</dd></div>
        </>}
        <div><dt>Mode de suivi des chaussures du fichier</dt><dd>{preview.backup.data.shoeSettings?.mode === 'automatic' ? 'Une seule paire — Automatique' : 'Plusieurs paires — Par séance'}</dd></div>
        <div><dt>Chaussures</dt><dd>{preview.backup.data.shoes?.length ?? 0}</dd></div>
        <div><dt>Associations de chaussures</dt><dd>{preview.backup.data.shoeAssignments?.length ?? 0}</dd></div>
        <div><dt>Séances du planning</dt><dd>{preview.backup.data.coachPlanning?.sessions.length ?? 0}</dd></div>
        <div><dt>Propositions écartées</dt><dd>{preview.backup.data.coachPlanning?.dismissed.length ?? 0}</dd></div>
        <div><dt>Profil sauvegardé</dt><dd>{preview.backup.data.coachProfile ? 'Présent' : 'Absent'}</dd></div>
      </dl>
      <p>En fusion, les ressentis et commentaires locaux sont conservés en cas de conflit ; les variantes du fichier restent dans votre sauvegarde. Les séances planifiées locales restent prioritaires en cas de conflit, y compris les annulations. En remplacement, le planning est remplacé par celui du fichier ; une ancienne sauvegarde sans planning le vide. Les refus enregistrés sont également restaurés.</p>
      <p>Après vérification intégrale de l’empreinte SHA-256, les détails du fichier dépassant 30 jours seront ignorés dans les deux modes. Les résumés seront conservés selon le mode choisi. Les dates incertaines et les dates futures restent protégées ; une date absente sera représentée comme non renseignée.</p>
      {preview.mergeReport && <p>En fusion : {preview.mergeReport.added} séance(s) à ajouter, {preview.mergeReport.retained} déjà présente(s).</p>}
      {preview.mergeReport?.warnings.map(warning => <p className="notice" key={warning}>{warning}</p>)}
      <fieldset disabled={operationBusy} className="profile-fields">
        <legend>Mode de restauration</legend>
        <label className="profile-duration-toggle"><input type="radio" name="restore-mode" checked={options.mode === 'merge'} onChange={() => { setOptions({ mode: 'merge', profile: 'keep' }); setConfirmed(false); }} />Fusionner les séances</label>
        <p>Vos séances, détails, chaussures et associations existants sont conservés. Les conflits de chaussures ou d’associations conservent les valeurs locales. Le mode local est conservé si vous avez déjà des chaussures ou un réglage de mode. Seuls les identifiants absents sont ajoutés. Des détails absents sont complétés uniquement si les résumés sont identiques et si la règle des 30 jours autorise leur conservation. Aucun détail local ancien n’est supprimé par la fusion. Des identifiants différents restent séparés, même pour des dates proches.</p>
        <label className="profile-duration-toggle"><input type="radio" name="restore-mode" checked={options.mode === 'replace'} onChange={() => { setOptions({ mode: 'replace', profile: 'restore' }); setConfirmed(false); }} />Remplacer les données locales</label>
        {options.mode === 'replace' && <p className="notice">Toutes vos séances, leurs ressentis et commentaires, leurs détails, votre profil, vos chaussures et leurs associations seront remplacés. Une ancienne sauvegarde sans ressentis ni commentaires effacera vos annotations locales. Exportez-les avant de remplacer vos données. Une ancienne sauvegarde sans chaussures effacera donc vos chaussures et associations locales. Sans réglage de mode dans le fichier, le suivi sera manuel. {preview.backup.data.coachProfile ? 'Le profil sauvegardé sera restauré.' : 'Cette sauvegarde ne contient pas de profil : votre profil local sera supprimé.'}</p>}
        {options.mode === 'merge' && <fieldset className="profile-days">
          <legend>Profil du coureur</legend>
          <p>{preview.local.coachProfile ? 'Un profil existe sur cet appareil.' : 'Aucun profil local n’est enregistré.'}</p>
          <label className="profile-duration-toggle"><input type="radio" name="restore-profile" checked={options.profile === 'keep'} onChange={() => { setOptions(o => ({ ...o, profile: 'keep' })); setConfirmed(false); }} />Conserver le profil local (ou son absence)</label>
          {preview.backup.data.coachProfile ? <label className="profile-duration-toggle"><input type="radio" name="restore-profile" checked={options.profile === 'restore'} onChange={() => { setOptions(o => ({ ...o, profile: 'restore' })); setConfirmed(false); }} />{preview.local.coachProfile ? 'Remplacer mon profil par celui du fichier' : 'Restaurer le profil du fichier'}</label> : <p>La sauvegarde ne contient pas de profil. Votre profil local sera conservé.</p>}
        </fieldset>}
        <label className="profile-duration-toggle"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{options.mode === 'replace' ? 'Je confirme le remplacement de toutes mes données locales par cette sauvegarde, sans ses détails anciens.' : 'Je confirme la fusion, sans réintroduire les détails anciens du fichier, et le choix indiqué pour mon profil.'}</label>
        <div className="profile-actions">
          <button className="button" disabled={!confirmed} onClick={restore}>Confirmer la restauration</button>
          <button className="button" onClick={cancel}>Annuler</button>
        </div>
      </fieldset>
    </div>}
    {report && <div className="backup-report">
      <p>Bilan : {report.added} séance(s) ajoutée(s) · {report.retained} conservée(s) · {report.conflicts} conflit(s) · {report.detailsAdded} ensemble(s) de détails ajouté(s).</p>
      <p>Détails anciens du fichier ignorés : {report.retention.ignoredDetails}. Détails à date incertaine conservables : {report.retention.uncertainDetails}.</p>
      <p>{report.shoesAdded} paire(s) et {report.assignmentsAdded} association(s) ajoutée(s).</p>
      <p>Profil : {report.profile === 'kept' ? 'conservé' : report.profile === 'restored' ? 'restauré' : 'absent après remplacement'}.</p>
      {report.warnings.map(warning => <p className="notice" key={warning}>{warning}</p>)}
    </div>}
  </section>;
}
