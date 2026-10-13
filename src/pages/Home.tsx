import { ShoeAlert } from '../components/Shoes';
import { EmptyState } from '../components/EmptyState';
import { SessionList } from '../components/SessionList';
import type { RunningSession } from '../types/session';

export function Home({ sessions }: { sessions: RunningSession[] }) {
  return (
    <>
      <h1 className="home-title">Accueil</h1>
      <ShoeAlert sessions={sessions} />
      <section className="panel" aria-labelledby="activity-title">
        <div className="panel-heading"><h2 id="activity-title">Dernières sorties</h2><span className="tag">Historique</span></div>
        {sessions.length === 0 ? (
          <EmptyState title="Votre histoire commence ici">
            <p>Vous n’avez encore aucune sortie enregistrée.</p>
            <p>Importez votre archive Polar depuis les Paramètres.</p>
          </EmptyState>
        ) : <SessionList sessions={sessions} limit={5} />}
        <div className="panel-heading"><a href="#/historique">Voir tout l’historique</a></div>
      </section>
      <div className="info-grid">
        <section className="info-card"><span className="eyebrow">ENTRAÎNEMENT</span><h2>Préparer la suite</h2><p>La planification sera disponible dans une prochaine étape.</p><a href="#/entrainement">Voir l’espace entraînement <span aria-hidden="true">→</span></a></section>
        <section className="info-card"><span className="eyebrow">VOS DONNÉES</span><h2>Sur votre appareil</h2><p>Vos sorties restent dans ce navigateur, sans compte ni serveur de données.</p><a href="#/parametres">Comprendre le stockage <span aria-hidden="true">→</span></a></section>
      </div>
    </>
  );
}
