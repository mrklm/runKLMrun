import { ShoeAlert } from '../components/Shoes';
import { useMemo } from 'react';
import { CoachPlanning } from '../components/CoachPlanning';
import { CoachV2Experimental } from '../components/CoachV2Experimental';
import { EmptyState } from '../components/EmptyState';
import { SessionList } from '../components/SessionList';
import { validSessionDate } from '../core/analysis/session-summary';
import type { RunningSession } from '../types/session';
import { coachV2PublicEnabled } from '../core/coach/activation-v2';

export function Home({ sessions }: { sessions: RunningSession[] }) {
  const recent = useMemo(() => [...sessions].filter(s => validSessionDate(s.date))
    .sort((a,b) => (b.startTime ?? b.date).localeCompare(a.startTime ?? a.date)), [sessions]);
  return <>
    <h1 className="home-title">Accueil</h1>
    <section className="panel" aria-labelledby="latest-activity-title">
      <h2 id="latest-activity-title">Dernière sortie</h2>
      {recent.length ? <SessionList sessions={recent.slice(0,1)} /> : <EmptyState title="Votre histoire commence ici">
        <p>Vous n’avez encore aucune sortie à date exploitable enregistrée.</p>
        <p>Vous pouvez importer vos sorties depuis Courses.</p>
      </EmptyState>}
      <ShoeAlert sessions={sessions} />
    </section>
    <CoachV2Experimental surface="home" />
    {!coachV2PublicEnabled()&&<CoachPlanning sessions={sessions} dashboard>
      <section className="panel" aria-labelledby="activity-title">
        <h2 id="activity-title">Activités récentes</h2>
        {recent.length ? <SessionList sessions={recent.slice(0,4)} compact /> : <p>Aucune sortie récente enregistrée.</p>}
        <p><a href="#/courses/historique">Voir tout l’historique</a></p>
      </section>
    </CoachPlanning>}
  </>;
}
