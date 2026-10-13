import { ShoeHistorySelect } from './ShoeHistory';
import { useMemo } from 'react';
import type { RunningSession } from '../types/session';
import { duration, pace } from '../core/analysis/session-format';
import { sessionHref } from '../core/analysis/session-detail';
export function SessionList({ sessions, limit, shoeSelection = false }: { sessions: RunningSession[]; limit?: number; shoeSelection?: boolean }) {
  const displayedSessions = useMemo(() => [...sessions]
    .sort((a, b) => (b.startTime ?? b.date).localeCompare(a.startTime ?? a.date))
    .slice(0, limit), [sessions, limit]);
  return <ul className="session-list">
    {displayedSessions.map(session => <li key={session.id} className="session-card">
      <a className="session-link" href={sessionHref(session.id)} aria-label={session.title}>
      <div><strong>{session.title}</strong> <time dateTime={session.startTime ?? session.date}>{session.date.split('-').reverse().join('/')}{session.startTime ? ` · ${session.startTime.slice(11, 16)}` : ''}</time></div>
      <dl className="session-metrics">
        <div><dt>Distance</dt><dd>{session.distanceMeters === undefined ? '—' : `${(session.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`}</dd></div>
        <div><dt>Durée</dt><dd>{duration(session.durationSeconds)}</dd></div>
        <div><dt>Allure moyenne</dt><dd>{pace(session.averagePaceSecondsPerKm)}</dd></div>
        <div><dt>FC moyenne</dt><dd>{session.averageHeartRate === undefined ? '—' : `${session.averageHeartRate} bpm`}</dd></div>
        <div><dt>Dénivelé positif</dt><dd>{session.ascentMeters === undefined ? '—' : `${session.ascentMeters} m`}</dd></div>
      </dl>
      </a>
      {shoeSelection && <ShoeHistorySelect sessionId={session.id} />}
    </li>)}
  </ul>;
}
