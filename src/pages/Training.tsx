import { CoachConfiguration } from '../components/CoachConfiguration';
import { useEffect, useMemo, useState } from 'react';
import { compareTraining } from '../core/coach/comparison';
import { CoachProfile } from '../components/CoachProfile';
import { EmptyState } from '../components/EmptyState';
import type { RunningSession } from '../types/session';
import { type CoveredMeasure, type TrainingWeeks } from '../core/analysis/training-history';
import { localToday } from '../core/analysis/statistics-period';
import { formatNumber } from '../core/analysis/session-summary';
import { duration } from '../core/analysis/session-format';
import { sessionHref } from '../core/analysis/session-detail';
import { CoachV2Experimental } from '../components/CoachV2Experimental';

const dateLabel = (date: string) => date.split('-').reverse().join('/');
const distanceLabel = (value: number | null) => value === null ? '—' : `${formatNumber(value / 1000)} km`;
const durationLabel = (value: number | null) => value === null ? '—' : duration(value);
function Coverage({ measure, name }: { measure: CoveredMeasure; name: string }) {
  return <span className="training-coverage">{name} connue pour {measure.known} séances sur {measure.total}.
    {measure.known < measure.total && <> Mesure partielle : {measure.missing} non renseignées, {measure.invalid} invalides.</>}
  </span>;
}
export function Training({ sessions, embedded = false }: { sessions: RunningSession[]; embedded?: boolean }) {
  const [weeks, setWeeks] = useState<TrainingWeeks>(8);
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const refresh = () => setToday(localToday());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const comparison = useMemo(() => compareTraining(sessions, weeks, today), [sessions, weeks, today]);
  const data = comparison.current;
  return <>
    {!embedded && <header className="page-heading"><h1>Coach</h1></header>}
    {!embedded && <CoachV2Experimental />}
    <CoachProfile comparison={comparison}>
<section className="panel settings-panel training-history" aria-labelledby="training-history-title">
      <h2 id="training-history-title">Votre activité récente</h2>
      <label className="theme-picker" htmlFor="training-weeks">Période du bilan</label>
      <select id="training-weeks" value={weeks} onChange={event => setWeeks(Number(event.target.value) as TrainingWeeks)}>
        {[4, 8, 12].map(value => <option key={value} value={value}>{value} semaines</option>)}
      </select>
      <p role="status">Du {dateLabel(data.startDate)} au {dateLabel(today)} inclus · {weeks * 7} jours.</p>
      {!!(data.excluded.invalidDates + data.excluded.futureDates) && <p>{data.excluded.invalidDates} séances à date invalide et {data.excluded.futureDates} séances à date future sont exclues du bilan et de la dernière activité.</p>}
      {data.sessionCount === 0 ? <EmptyState title="Aucune séance enregistrée sur cette période."><p>Aucune séance récente enregistrée. L’absence de données ne prouve pas l’absence d’entraînement.</p></EmptyState> : <>
        <dl className="training-metrics">
          <div><dt>Séances réalisées</dt><dd>{data.sessionCount}</dd><dd className="training-coverage">Sur {data.activeDays} jours d’activité.</dd></div>
          <div><dt>Fréquence hebdomadaire</dt><dd>{formatNumber(data.sessionsPerWeek)} séances/semaine</dd></div>
          <div><dt>Semaines actives</dt><dd>{data.activeWeeks} sur {weeks}</dd></div>
          <div><dt>Distance parcourue</dt><dd>{distanceLabel(data.distance.value)}</dd><dd><Coverage name="Distance" measure={data.distance} /></dd></div>
          <div><dt>Distance hebdomadaire</dt><dd>{distanceLabel(data.distance.weeklyAverage)}</dd><dd className="training-coverage">{data.distance.known < data.distance.total ? 'Moyenne partielle sur' : 'Moyenne sur'} {weeks} semaines.</dd></div>
          <div><dt>Durée d’entraînement</dt><dd>{durationLabel(data.duration.value)}</dd><dd><Coverage name="Durée" measure={data.duration} /></dd></div>
          <div><dt>Durée hebdomadaire</dt><dd>{durationLabel(data.duration.weeklyAverage)}</dd><dd className="training-coverage">{data.duration.known < data.duration.total ? 'Moyenne partielle sur' : 'Moyenne sur'} {weeks} semaines.</dd></div>
        </dl>
        <p className="training-coverage">Les moyennes incluent les semaines sans séance. Une semaine active est un bloc de sept jours depuis le début de la fenêtre contenant au moins une séance enregistrée.</p>
      </>}
      <div className="training-highlights">
        <section><h3>Sortie la plus longue en distance</h3>{data.longest ? <>
          <p>{distanceLabel(data.longest.distanceMeters)} · {durationLabel(data.longest.durationSeconds)} · {dateLabel(data.longest.date)}</p>
          <a href={sessionHref(data.longest.id)}>Consulter cette séance</a>
          {data.distance.known < data.distance.total && <p className="training-coverage">Parmi les séances dont la distance est exploitable.</p>}
        </> : <p>Aucune distance exploitable sur cette période.</p>}</section>
        <section><h3>Dernière activité enregistrée</h3>{data.latest ? <p>{dateLabel(data.latest.date)} · {data.latest.daysAgo} jours écoulés.</p> : <p>Aucune séance à date exploitable enregistrée jusqu’à aujourd’hui.</p>}</section>
      </div>
      <p className="training-coverage">Ce bilan décrit les séances enregistrées. Il ne constitue pas une évaluation de votre condition physique.</p>
    </section>
      <CoachConfiguration />
    </CoachProfile>
  </>;
}
