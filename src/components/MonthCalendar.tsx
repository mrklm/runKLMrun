import { useEffect, useMemo, useState } from 'react';
import { calendarEvents, monthDays, shiftMonth } from '../core/analysis/month-calendar';
import { measure } from '../core/analysis/session-format';
import { sessionHref } from '../core/analysis/session-detail';
import { createSuggestionRepository } from '../storage/coach-suggestions';
import { subscribeStorage } from '../storage/changes';
import type { RunningSession } from '../types/session';
import type { StoredSuggestion } from '../types/coach-suggestion';
import { formatCoachDuration } from './coach-planning-display';
const repository = createSuggestionRepository();
const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export function MonthCalendar({ sessions, today }: { sessions: RunningSession[]; today: string }) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [suggestions, setSuggestions] = useState<StoredSuggestion[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      setSuggestions([]);
      void repository.list().then(records => {
        if (current === generation) { setSuggestions(records); setError(false); }
      }).catch(() => { if (current === generation) setError(true); });
    };
    const unsubscribe = subscribeStorage(['suggestions', 'sessions'], refresh);
    window.addEventListener('focus', refresh);
    refresh();
    return () => { generation++; unsubscribe(); window.removeEventListener('focus', refresh); };
  }, []);
  const events = useMemo(() => calendarEvents(sessions, suggestions, today), [sessions, suggestions, today]);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <section className="month-calendar" aria-labelledby="calendar-title">
    <h2 id="calendar-title">Calendrier mensuel</h2>
    <div className="calendar-navigation">
      <button type="button" aria-label="Mois précédent" disabled={month === '0001-01'} onClick={() => setMonth(m => shiftMonth(m, -1))}>←</button>
      <h3 aria-live="polite">{label}</h3>
      <button type="button" aria-label="Mois suivant" disabled={month === '9999-12'} onClick={() => setMonth(m => shiftMonth(m, 1))}>→</button>
    </div>
    <p className="calendar-legend">● Sortie réalisée · ○ Suggestion facultative du Coach. Le mois affiché est indépendant de la période statistique.</p>
    {error && <p role="status">Les suggestions mémorisées n’ont pas pu être chargées.</p>}
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day.slice(0, 3)}.</span>)}</div>
    <ol className="calendar-days" aria-label={label}>
      {monthDays(month).map((date, index) => date ? <li key={date} className="calendar-day" aria-label={date.split('-').reverse().join('/')}>
        <time dateTime={date} aria-current={date === today ? 'date' : undefined}><span className="calendar-weekday">{weekdays[index % 7]} </span>{Number(date.slice(8))}</time>
        {events.activities.get(date)?.map(session => <a className="calendar-activity" href={sessionHref(session.id)} key={session.id} aria-label={`Sortie réalisée : ${session.title}, ${date.split('-').reverse().join('/')}, ${formatCoachDuration(session.durationSeconds)}`}>
          <strong>● Sortie réalisée</strong><span>{measure(session.distanceMeters, 'km', 1000)} · {formatCoachDuration(session.durationSeconds)}</span>
        </a>)}
        {events.future.get(date)?.map(suggestion => <div className="calendar-suggestion" key={suggestion.id}><strong>○ Suggestion facultative</strong><span>{suggestion.kind === 'endurance' ? 'Endurance' : suggestion.kind === 'discovery' ? 'Découverte' : 'Sortie facile'} · {formatCoachDuration(suggestion.durationSeconds)}</span></div>)}
      </li> : <li className="calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
    </ol>
  </section>;
}
