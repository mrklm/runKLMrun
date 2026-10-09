import type { RunningSession } from '../types/session';
const duration = (value: number) => `${Math.floor(value / 3600)} h ${Math.floor(value / 60) % 60} min ${Math.floor(value % 60)} s`;
const pace = (value?: number) => { if (value === undefined) return '—'; const s = Math.round(value); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`; };
export function SessionList({ sessions }: { sessions: RunningSession[] }) {
  return <ul className="session-list">
    {[...sessions].sort((a, b) => (b.startTime ?? b.date).localeCompare(a.startTime ?? a.date)).map(session => <li key={session.id} className="session-card">
      <div><strong>{session.title}</strong> <time dateTime={session.startTime ?? session.date}>{session.date.split('-').reverse().join('/')}{session.startTime ? ` · ${session.startTime.slice(11, 16)}` : ''}</time></div>
      <dl className="session-metrics">
        <div><dt>Distance</dt><dd>{session.distanceMeters === undefined ? '—' : `${(session.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`}</dd></div>
        <div><dt>Durée</dt><dd>{duration(session.durationSeconds)}</dd></div>
        <div><dt>Allure moyenne</dt><dd>{pace(session.averagePaceSecondsPerKm)}</dd></div>
        <div><dt>FC moyenne</dt><dd>{session.averageHeartRate === undefined ? '—' : `${session.averageHeartRate} bpm`}</dd></div>
        <div><dt>Dénivelé positif</dt><dd>{session.ascentMeters === undefined ? '—' : `${session.ascentMeters} m`}</dd></div>
      </dl>
    </li>)}
  </ul>;
}
