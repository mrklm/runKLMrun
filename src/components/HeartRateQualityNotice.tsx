import { useMemo } from 'react';
import { analyzeHeartRateQuality } from '../core/analysis/heart-rate-quality';
import { heartRateQualityDetails, heartRateQualitySummary } from '../core/analysis/heart-rate-quality-messages';
import type { RunningSession, SessionDetails } from '../types/session';

/** Affiché seulement si les détails sont conservés : sans détails, la qualité de la courbe reste inconnue. */
export function HeartRateQualityNotice({ session, details }: { session: RunningSession; details: SessionDetails }) {
  const quality = useMemo(() => analyzeHeartRateQuality(details.heartRate, session.averageHeartRate), [details.heartRate, session.averageHeartRate]);
  const summary = heartRateQualitySummary(quality, session.averageHeartRate !== undefined);
  if (!summary) return null;
  const { certain, suspected } = heartRateQualityDetails(quality);
  return <section className="panel settings-panel heart-rate-quality" data-heart-rate-quality={quality.status} aria-labelledby="heart-rate-quality-title">
    <h2 id="heart-rate-quality-title">Qualité de la fréquence cardiaque</h2>
    <p>{summary}</p>
    {!!certain.length && <><p>Valeurs erronées ou mesures manquantes :</p><ul>{certain.map(text => <li key={text}>{text}</li>)}</ul></>}
    {!!suspected.length && <><p>Anomalies possibles, à interpréter avec prudence :</p><ul>{suspected.map(text => <li key={text}>{text}</li>)}</ul></>}
    {quality.status !== 'absent' && <p>Les mesures d’origine sont conservées sans modification.</p>}
  </section>;
}
