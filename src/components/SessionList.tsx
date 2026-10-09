import type { RunningSession } from '../types/session';

export function SessionList({ sessions }: { sessions: RunningSession[] }) {
  return (
    <ul className="session-list">
      {sessions.map((session) => (
        <li key={session.id}>
          <strong>{session.title}</strong>
          <time dateTime={session.date}>{session.date.split('-').reverse().join('/')}</time>
        </li>
      ))}
    </ul>
  );
}
