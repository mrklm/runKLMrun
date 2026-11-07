import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { HeartRateQuality } from '../core/analysis/heart-rate-quality';
import { heartRateQualityDetails, heartRateQualitySummary } from '../core/analysis/heart-rate-quality-messages';
import { createHeartRateExclusionRepository } from '../storage/heart-rate-exclusion';
import { useProfileDatabase } from '../storage/profile-context';
import { heartRateUsable, type RunningSession } from '../types/session';

/** Qualité calculée seulement si les détails sont conservés : sans eux, elle reste inconnue.
 * Une exclusion manuelle prime sur le constat de qualité. */
export function HeartRateQualityNotice({ session, quality, control }: { session: RunningSession; quality?: HeartRateQuality; control?: ReactNode }) {
  if (!heartRateUsable(session)) return <section className="panel settings-panel heart-rate-quality" data-heart-rate-quality="ignored" aria-labelledby="heart-rate-quality-title">
    <h2 id="heart-rate-quality-title">Qualité de la fréquence cardiaque</h2>
    <p>Les données cardiaques de cette activité sont ignorées : elles ne sont plus affichées ni utilisées. Les mesures d’origine restent conservées.</p>
    {control}
  </section>;
  const summary = quality && heartRateQualitySummary(quality, session.averageHeartRate !== undefined);
  if (!quality || !summary) return null;
  const { certain, suspected } = heartRateQualityDetails(quality);
  return <section className="panel settings-panel heart-rate-quality" data-heart-rate-quality={quality.status} aria-labelledby="heart-rate-quality-title">
    <h2 id="heart-rate-quality-title">Qualité de la fréquence cardiaque</h2>
    <p>{summary}</p>
    {!!certain.length && <><p>Valeurs erronées ou mesures manquantes :</p><ul>{certain.map(text => <li key={text}>{text}</li>)}</ul></>}
    {!!suspected.length && <><p>Anomalies possibles, à interpréter avec prudence :</p><ul>{suspected.map(text => <li key={text}>{text}</li>)}</ul></>}
    {quality.status !== 'absent' && <p>Les mesures d’origine sont conservées sans modification.</p>}
    {control}
  </section>;
}

/** Bascule réversible ; la séance affichée est relue via la notification de stockage. */
export function HeartRateExclusionButton({ session }: { session: RunningSession }) {
  const database = useProfileDatabase();
  const repository = useMemo(() => createHeartRateExclusionRepository(database), [database]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const running = useRef(false);
  const ignored = !heartRateUsable(session);
  async function toggle() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await repository.save(session.id, !ignored, ignored);
      setMessage(ignored ? 'Les données cardiaques de cette activité sont de nouveau utilisées.' : 'Les données cardiaques de cette activité sont maintenant ignorées.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'L’enregistrement a échoué. Vous pouvez réessayer.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <div className="heart-rate-exclusion">
    {!ignored && <p>Si ces mesures vous paraissent incorrectes, vous pouvez les ignorer pour cette activité. Ce choix est réversible et ne supprime aucune mesure.</p>}
    <button type="button" className="button" disabled={busy} onClick={() => void toggle()}>
      {ignored ? 'Utiliser de nouveau les données cardiaques' : 'Ignorer les données cardiaques de cette activité'}
    </button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
