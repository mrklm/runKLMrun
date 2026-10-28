import { useEffect, useMemo, useState } from 'react';
import { calendarEvents, monthDays, shiftMonth } from '../core/analysis/month-calendar';
import { measure } from '../core/analysis/session-format';
import { sessionHref } from '../core/analysis/session-detail';
import { subscribeStorage } from '../storage/changes';
import type { RunningSession } from '../types/session';
import { coachV2Labels } from './CoachV2Experimental';
import { readCoachV2Projection, type CoachV2Projection } from './coach-v2-projection';
import { useProfileDatabase } from '../storage/profile-context';
const calendarDuration = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '—';
  const seconds = Math.floor(value), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export function MonthCalendar({ sessions, today }: { sessions: RunningSession[]; today: string }) {
  const database = useProfileDatabase();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [projectionV2, setProjectionV2] = useState<CoachV2Projection>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void readCoachV2Projection(database).then(projection => {
        if (current === generation) { setProjectionV2(projection); setError(false); }
      }).catch(() => { if (current === generation) setError(true); });
    };
    const unsubscribe = subscribeStorage(['suggestions-v2', 'sessions'], refresh, database);
    window.addEventListener('focus', refresh);
    refresh();
    return () => { generation++; unsubscribe(); window.removeEventListener('focus', refresh); };
  }, [database]);
  const activities = useMemo(() => calendarEvents(sessions, [], today).activities, [sessions, today]);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <section className="month-calendar" aria-labelledby="calendar-title">
    <h2 id="calendar-title">Calendrier mensuel</h2>
    <div className="calendar-navigation">
      <button type="button" aria-label="Mois précédent" disabled={month === '0001-01'} onClick={() => setMonth(m => shiftMonth(m, -1))}>←</button>
      <h3 aria-live="polite">{label}</h3>
      <button type="button" aria-label="Mois suivant" disabled={month === '9999-12'} onClick={() => setMonth(m => shiftMonth(m, 1))}>→</button>
    </div>
    <p className="calendar-legend">● Sortie réalisée · ◇ Suggestion du Coach. Le mois affiché est indépendant de la période statistique.</p>
    {error && <p role="status">Les perspectives du Coach n’ont pas pu être chargées.</p>}
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day.slice(0, 3)}.</span>)}</div>
    <ol className="calendar-days" aria-label={label}>
      {monthDays(month).map((date, index) => date ? <li key={date} className="calendar-day" aria-label={date.split('-').reverse().join('/')}>
        <time dateTime={date} aria-current={date === today ? 'date' : undefined}><span className="calendar-weekday">{weekdays[index % 7]} </span>{Number(date.slice(8))}</time>
        {activities.get(date)?.map(session => <a className="calendar-activity" href={sessionHref(session.id)} key={session.id} aria-label={`Sortie réalisée : ${session.title}, ${date.split('-').reverse().join('/')}, ${calendarDuration(session.durationSeconds)}`}>
          <strong>● Sortie réalisée</strong><span>{measure(session.distanceMeters, 'km', 1000)} · {calendarDuration(session.durationSeconds)}</span>
        </a>)}
        {projectionV2?.perspectives.filter(item=>item.date===date).map((item,index)=><div className="calendar-suggestion calendar-suggestion-v2" key={`${item.date}-${index}`} data-testid="calendar-suggestion-v2"><strong>◇ Suggestion du Coach</strong><span>{coachV2Labels.type[item.session.type]} · {calendarDuration(item.session.totalDurationSeconds)}</span></div>)}
      </li> : <li className="calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
    </ol>
  </section>;
}
