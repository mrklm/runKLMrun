import { useEffect, useRef, useState } from 'react';
import { retentionService, type RetentionReport, type RetentionService } from '../storage/detail-retention';

export function DetailRetention({ service = retentionService, onCleaned }: { service?: RetentionService; onCleaned: () => void }) {
  const [report, setReport] = useState<RetentionReport>();
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(false), [accepted, setAccepted] = useState(false);
  const [enabled, setEnabled] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null), mounted = useRef(true), locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    try { setEnabled(service.isEnabled()); } catch { setError('Les préférences locales sont indisponibles. Aucun nettoyage ne peut démarrer.'); }
    return () => { mounted.current = false; controller.current?.abort(); };
  }, [service]);
  useEffect(() => { if (confirmation) heading.current?.focus(); }, [confirmation]);
  async function analyze() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('Analyse des clés et des résumés…');
    controller.current = new AbortController();
    try {
      const result = await service.analyze(controller.current.signal);
      if (mounted.current) { setReport(result); setEnabled(service.isEnabled()); setMessage('Bilan actualisé. Aucune donnée n’a été supprimée.'); }
    } catch { if (mounted.current) setError('Impossible de lire le bilan du stockage. Vous pouvez réessayer.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function clean() {
    if (!accepted || locked.current) return;
    locked.current = true; setBusy(true); setConfirmation(false); setError('');
    controller.current = new AbortController();
    try {
      const result = await service.activateAndClean(accepted, {
        signal: controller.current.signal,
        progress: value => { if (mounted.current) setMessage(`${value.scanned} enregistrements vérifiés ; ${value.deleted} détails supprimés.`); },
      });
      if (!mounted.current) return;
      setEnabled(service.isEnabled());
      setMessage(result ? `${result.deleted} détails supprimés. ${result.interrupted ? 'Nettoyage interrompu entre les lots. Vous pouvez reprendre ; l’entretien reste activé.' : 'Entretien glissant activé.'}` : 'Un nettoyage est déjà en cours dans un autre onglet. Réessayez ensuite.');
      onCleaned();
      const updated = await service.analyze();
      if (mounted.current) setReport(updated);
    } catch (e) {
      if (mounted.current) {
        setError(`${e instanceof Error && e.message.includes('verrouiller') ? e.message : 'Le nettoyage a été interrompu. Les lots terminés restent validés ; les résumés et le coach sont préservés.'} Vous pouvez actualiser le bilan et reprendre.`);
        setReport(undefined);
      }
    } finally {
      locked.current = false;
      if (mounted.current) { setBusy(false); setAccepted(false); try { setEnabled(service.isEnabled()); } catch { /* Erreur déjà présentée. */ } }
    }
  }
  return <section className="panel settings-panel" aria-labelledby="retention-title">
    <h2 id="retention-title">Conservation des données détaillées</h2>
    <p>Les mesures détaillées sont conservées 30 jours. Les séances plus anciennes restent dans votre historique avec leur résumé, mais leurs graphiques détaillés, leur GPS et leurs tours individuels ne seront plus disponibles. Vos informations personnelles du coach sont conservées.</p>
    <p>{enabled ? 'L’entretien glissant est activé : une vérification légère a lieu au démarrage ou lorsque vous revenez dans l’application, au maximum une fois par jour après une vérification réussie.' : 'L’entretien est désactivé. Aucun détail existant ne sera supprimé sans votre confirmation.'}</p>
    <button className="button" disabled={busy} onClick={() => void analyze()}>Actualiser le bilan</button>
    {report && <>
      <dl className="session-detail-metrics">
        <div><dt>Enregistrements de détails présents</dt><dd>{report.total}</dd></div>
        <div><dt>Détails de plus de 30 jours supprimables</dt><dd>{report.expired}</dd></div>
        <div><dt>Détails conservés, toutes raisons comprises</dt><dd>{report.total - report.expired}</dd></div>
        <div><dt>Dates incertaines, détails conservés</dt><dd>{report.uncertain}</dd></div>
        <div><dt>Résumé absent ou invalide, détails conservés</dt><dd>{report.invalidSummary}</dd></div>
      </dl>
      <p>L’espace récupérable ne peut pas être estimé fiablement sans lire les mesures.</p>
      <button className="button" disabled={busy} onClick={() => { setAccepted(false); setConfirmation(true); }}>Alléger mon historique</button>
    </>}
    {confirmation && <div className="notice" role="group" aria-labelledby="retention-confirm-title">
      <h3 id="retention-confirm-title" ref={heading} tabIndex={-1}>Confirmer le nettoyage et l’entretien glissant</h3>
      <p>Le dernier bilan indique {report?.expired} détails supprimables. L’éligibilité sera revérifiée avant chaque suppression.</p>
      <p>Les détails supprimés ne pourront être récupérés que depuis les fichiers sources Polar ou une sauvegarde antérieure complète. Conservez ces fichiers avant de poursuivre. La réimportation actuelle des séances anciennes ne rétablit pas leurs graphiques dans runKLMrun.</p>
      <p>Votre confirmation active aussi les prochains nettoyages des détails dépassant 30 jours, sans nouvelle confirmation.</p>
      <label><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /> Je confirme la suppression des détails anciens et l’activation de l’entretien glissant.</label>
      <div className="profile-actions"><button className="button" disabled={!accepted || busy} onClick={() => void clean()}>Confirmer et activer</button><button className="button" disabled={busy} onClick={() => setConfirmation(false)}>Annuler</button></div>
    </div>}
    {busy && <button className="button" onClick={() => controller.current?.abort()}>Interrompre après le lot en cours</button>}
    <p role="status" aria-live="polite">{message}</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
