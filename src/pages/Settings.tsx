import { Backups } from '../components/Backups';
import { Appearance } from '../components/Appearance';
import { CoachConfiguration } from '../components/CoachConfiguration';
import { CoachTemperamentSettings } from '../components/CoachTemperamentSettings';
import { CoachProfile } from '../components/CoachProfile';
import { Shoes } from '../components/Shoes';
import { Training } from './Training';
import { RunnerProfiles } from '../components/RunnerProfiles';
import { useState } from 'react';
import type { RunningSession } from '../types/session';

export function Settings({ active = true, sessions = [] }: { active?: boolean; sessions?: RunningSession[] }) {
  const [storageOpen, setStorageOpen] = useState(false);
  return (
    <>
      <header className="page-heading"><h1>Paramètres</h1></header>
      {active && <RunnerProfiles />}
      <section aria-labelledby="settings-coach-title">
        <h2 id="settings-coach-title">Coach</h2>
        <details className="panel settings-panel"><summary>Configurer le Coach</summary>
          {active && <><CoachConfiguration /><CoachProfile /></>}
        </details>
        {active && <CoachTemperamentSettings />}
        <details className="panel settings-panel"><summary>Configuration et bilan</summary>{active && <Training sessions={sessions} embedded />}</details>
      </section>
      <section aria-labelledby="settings-shoes-title">
        <h2 id="settings-shoes-title">Chaussures</h2>
        <details className="panel settings-panel"><summary>Mes chaussures</summary>{active && <Shoes sessions={sessions} embedded />}</details>
      </section>
      <section aria-labelledby="settings-data-title"><h2 id="settings-data-title">Données</h2>
      <details className="panel settings-panel"><summary>Données et sauvegardes</summary>{active && <Backups />}</details>
      </section>
      <section aria-labelledby="settings-app-title"><h2 id="settings-app-title">Application</h2><Appearance /></section>
      <section className="panel settings-panel" aria-labelledby="storage-title">
        <span className="tag">Stockage local</span><h2 id="storage-title">Vos données restent avec vous</h2>
        <button type="button" className="button" aria-expanded={storageOpen} aria-controls="storage-details" onClick={() => setStorageOpen(value => !value)}>{storageOpen ? 'Masquer les détails' : 'Afficher les détails'}</button>
        {storageOpen && <div id="storage-details"><p>runKLMrun conserve vos données dans la base IndexedDB de ce navigateur. Aucun compte n’est nécessaire et vos activités ne sont envoyées à aucun serveur.</p>
          <p>Chaque navigateur et chaque appareil dispose de son propre stockage. Vos données ne sont pas synchronisées entre vos appareils.</p>
          <div className="notice"><strong>À savoir</strong><p>Effacer les données de ce site peut supprimer votre historique. En navigation privée, le stockage peut être indisponible ou supprimé à la fermeture du navigateur.</p></div>
        </div>}
      </section>
    </>
  );
}
