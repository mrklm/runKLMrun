import { EmptyState } from '../components/EmptyState';
import { SessionList } from '../components/SessionList';
import type { RunningSession } from '../types/session';

export function History({ sessions }: { sessions: RunningSession[] }) {
  return (
    <>
      <header className="page-heading"><span className="eyebrow">VOS SORTIES</span><h1>Historique</h1><p>Retrouvez vos entraînements enregistrés sur cet appareil.</p></header>
      <section className="panel">
        {sessions.length === 0 ? <EmptyState title="Aucune sortie enregistrée" symbol="≡"><p>Votre historique est vide pour le moment.</p><p>L’import de vos activités n’est pas encore disponible.</p></EmptyState> : <SessionList sessions={sessions} />}
      </section>
    </>
  );
}
