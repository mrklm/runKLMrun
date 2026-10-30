import { SessionReviewEditor } from '../components/SessionReviewEditor';
import { SessionRoute } from '../components/SessionRoute';
import { ascentLabel } from '../core/analysis/ascent';
import { SessionShoes } from '../components/Shoes';
import { useEffect, useMemo, useState } from 'react';
import type { RunningSession, SessionDetails } from '../types/session';
import { createSessionRepository } from '../storage/database';
import { useProfileDatabase } from '../storage/profile-context';
import { loadSessionDetails, type DetailsState } from '../storage/load-session-details';
import { duration, measure, pace, heartRate, ascent } from '../core/analysis/session-format';
import { prepareSeries } from '../core/analysis/session-detail';
import { SynchronizedSessionCharts } from '../components/SynchronizedSessionCharts';
import { EmptyState } from '../components/EmptyState';
import { formatActivityTime } from '../core/analysis/activity-time';

export function SessionInformation({ session }: { session: RunningSession }) {
  const fields = [
    ...(session.sport ? [['Sport', session.sport]] : []),
    ['Date', session.date ? session.date.split('-').reverse().join('/') : '—'],
    ['Heure', session.startTime ? formatActivityTime(session.startTime, true) : '—'], ['Durée', duration(session.durationSeconds)],
    ['Distance', measure(session.distanceMeters, 'km', 1000)], ['Allure moyenne', pace(session.averagePaceSecondsPerKm)],
    ['Fréquence cardiaque moyenne', heartRate(session.averageHeartRate)], ['Fréquence cardiaque maximale', heartRate(session.maximumHeartRate)],
    [ascentLabel(session.ascentEstimate), ascent(session.ascentMeters)], ['Dénivelé négatif', measure(session.descentMeters, 'm')],
    ['Charge cardio Polar', measure(session.cardioLoad)], ['Running Index', measure(session.runningIndex)],
  ];
  return <section className="panel session-information"><h2>Informations générales</h2><dl className="session-detail-metrics">{fields.filter(([name]) => !['Fréquence cardiaque maximale', 'Dénivelé négatif', 'Charge cardio Polar', 'Running Index'].includes(name)).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    <details className="session-secondary"><summary>Détails complémentaires</summary><dl className="session-detail-metrics">{fields.filter(([name]) => ['Fréquence cardiaque maximale', 'Dénivelé négatif', 'Charge cardio Polar', 'Running Index'].includes(name)).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    {!!session.heartRateZones?.length && <><h2>Zones cardiaques Polar</h2><div className="table-scroll"><table><thead><tr><th scope="col">Zone</th><th scope="col">Limite basse</th><th scope="col">Limite haute</th><th scope="col">Durée</th></tr></thead><tbody>{session.heartRateZones.map((zone, i) => <tr key={i}><th scope="row">{i + 1}</th><td>{measure(zone.lower, 'bpm')}</td><td>{measure(zone.upper, 'bpm')}</td><td>{zone.durationSeconds === undefined ? '—' : duration(zone.durationSeconds)}</td></tr>)}</tbody></table></div></>}
    </details>
  </section>;
}
export function SessionCurves({ details }: { details?: SessionDetails }) {
  const charts = useMemo(() => [
    { metric: 'heartRate' as const, title: 'Fréquence cardiaque', unit: 'bpm', samples: prepareSeries(details?.heartRate) },
    { metric: 'pace' as const, title: 'Allure', unit: 'min/km', samples: prepareSeries(details?.speed, true) },
    { metric: 'altitude' as const, title: 'Altitude', unit: 'm', samples: prepareSeries(details?.altitude) },
    { metric: 'cadence' as const, title: 'Cadence', unit: details?.cadenceUnit === 'source' ? 'unité source' : 'rpm', samples: prepareSeries(details?.cadence) },
  ], [details]);
  return charts.some(c => c.samples.some(p => p.value !== null)) ? <div className="session-curves"><SynchronizedSessionCharts key={details?.id} charts={charts} /><details className="curve-notes"><summary>À propos des mesures</summary><p>{details?.cadenceUnit === 'source' ? 'La cadence TCX conserve les valeurs source, sans conversion en pas/minute.' : 'La cadence conserve l’unité source Polar (tours/minute, rpm), sans doublement.'} L’allure est affichée en minutes et secondes par kilomètre.</p></details></div> : <section className="panel settings-panel"><EmptyState title={details ? 'Aucune courbe disponible' : 'Détails indisponibles'}><p>Vous pouvez consulter les informations générales de cette sortie. Aucune série exploitable n’est enregistrée pour les graphiques.</p></EmptyState></section>;
}
export function Session({ session }: { session?: RunningSession }) {
  const database = useProfileDatabase();
  const sessionRepository = useMemo(() => createSessionRepository(database), [database]);
  const [state, setState] = useState<DetailsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => session ? loadSessionDetails(sessionRepository, session.id, setState) : undefined, [session?.id, attempt, sessionRepository]);
  return <>
    <a className="session-back" href="#/courses/historique">Revenir à l’historique</a>
    <header className="session-heading"><h1>{session?.title ?? 'Séance introuvable'}</h1></header>
    {!session ? <section className="panel settings-panel"><p>Cette séance n’est pas disponible sur cet appareil.</p></section> : <>
      <SessionInformation session={session} />
      <SessionReviewEditor database={database} session={session} showActivitySummary={false} />
      <SessionRoute key={`route:${session.id}`} state={state} />
      {state.status === 'loading' && <p role="status">Chargement des détails de votre séance…</p>}
      {state.status === 'error' && <section className="panel settings-panel" role="alert"><h2>Stockage local indisponible</h2><p>Les détails n’ont pas pu être chargés. Vous pouvez réessayer.</p><button className="button" onClick={() => setAttempt(v => v + 1)}>Réessayer</button></section>}
      {state.status === 'ready' && <SessionCurves details={state.details} />}
      <SessionShoes sessionId={session.id} session={session} />
    </>}
  </>;
}
