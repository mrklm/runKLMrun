import { useEffect, useMemo, useState } from 'react';
import { calendarEvents, monthDays, shiftMonth } from '../core/analysis/month-calendar';
import { measure } from '../core/analysis/session-format';
import { sessionHref } from '../core/analysis/session-detail';
import { createSuggestionRepository } from '../storage/coach-suggestions';
import { subscribeStorage } from '../storage/changes';
import type { RunningSession } from '../types/session';
import type { StoredSuggestion } from '../types/coach-suggestion';
import { coachV2Labels } from './CoachV2Experimental';
import { coachV2Enabled, coachV2PublicEnabled } from '../core/coach/activation-v2';
import { createSuggestionV2Repository } from '../storage/coach-suggestions-v2';
import type { PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
const calendarDuration = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '—';
  const seconds = Math.floor(value), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const repository = createSuggestionRepository();
const repositoryV2 = createSuggestionV2Repository();
const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export function MonthCalendar({ sessions, today }: { sessions: RunningSession[]; today: string }) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [suggestions, setSuggestions] = useState<StoredSuggestion[]>([]);
  const [suggestionsV2, setSuggestionsV2] = useState<PersistableOccurrenceV2[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      setSuggestions([]);
      const v2 = coachV2Enabled() ? repositoryV2.listAll() : Promise.resolve([]);
      const v1 = coachV2PublicEnabled() ? Promise.resolve([]) : repository.list();
      void Promise.all([v1, v2]).then(([records, recordsV2]) => {
        if (current === generation) { setSuggestions(records); setSuggestionsV2(recordsV2.filter(item=>item.state!=='obsolete')); setError(false); }
      }).catch(() => { if (current === generation) setError(true); });
    };
    const unsubscribe = subscribeStorage(['suggestions', 'suggestions-v2', 'sessions'], refresh);
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
    <p className="calendar-legend">● Sortie réalisée · {coachV2PublicEnabled() ? '◇ Suggestion du Coach' : `○ Suggestion facultative V1${coachV2Enabled() ? ' · ◇ Suggestion V2' : ''}`}. Le mois affiché est indépendant de la période statistique.</p>
    {error && <p role="status">Les suggestions mémorisées n’ont pas pu être chargées.</p>}
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day.slice(0, 3)}.</span>)}</div>
    <ol className="calendar-days" aria-label={label}>
      {monthDays(month).map((date, index) => date ? <li key={date} className="calendar-day" aria-label={date.split('-').reverse().join('/')}>
        <time dateTime={date} aria-current={date === today ? 'date' : undefined}><span className="calendar-weekday">{weekdays[index % 7]} </span>{Number(date.slice(8))}</time>
        {events.activities.get(date)?.map(session => <a className="calendar-activity" href={sessionHref(session.id)} key={session.id} aria-label={`Sortie réalisée : ${session.title}, ${date.split('-').reverse().join('/')}, ${calendarDuration(session.durationSeconds)}`}>
          <strong>● Sortie réalisée</strong><span>{measure(session.distanceMeters, 'km', 1000)} · {calendarDuration(session.durationSeconds)}</span>
        </a>)}
        {events.future.get(date)?.map(suggestion => <div className="calendar-suggestion" key={suggestion.id}><strong>○ Suggestion facultative</strong><span>{suggestion.kind === 'endurance' ? 'Endurance' : suggestion.kind === 'discovery' ? 'Découverte' : 'Sortie facile'} · {calendarDuration(suggestion.durationSeconds)}</span></div>)}
        {suggestionsV2.filter(item=>item.opportunity.suggestedFor===date).map(item=><div className="calendar-suggestion calendar-suggestion-v2" key={item.id} data-testid="calendar-suggestion-v2"><strong>◇ Suggestion du Coach</strong><span>{coachV2Labels.type[item.content.type]} · {calendarDuration(item.content.totalDurationSeconds)}</span></div>)}
      </li> : <li className="calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
    </ol>
  </section>;
}
