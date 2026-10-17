import { DetailRetention } from '../components/DetailRetention';
import { Backups } from '../components/Backups';
import { Appearance } from '../components/Appearance';
import { CoachConfiguration } from '../components/CoachConfiguration';
import { CoachProfile } from '../components/CoachProfile';

export function Settings({ active = true }: { active?: boolean }) {
  return (
    <>
      <header className="page-heading"><span className="eyebrow">VOTRE ESPACE PERSONNEL</span><h1>Paramètres</h1><p>Comprenez où sont conservées vos données.</p></header>
      <section aria-labelledby="settings-coach-title">
        <h2 id="settings-coach-title">Coach</h2>
        <details className="panel settings-panel"><summary>Configurer le Coach</summary>
          {active && <><CoachConfiguration /><CoachProfile /></>}
        </details>
        <p><a href="#/entrainement">Ancien planning et page Coach</a></p>
      </section>
      <section aria-labelledby="settings-shoes-title">
        <h2 id="settings-shoes-title">Chaussures</h2>
        <p><a href="#/chaussures">Mes chaussures</a></p>
      </section>
      <section aria-labelledby="settings-data-title"><h2 id="settings-data-title">Données</h2>
      <section className="panel settings-panel" aria-labelledby="storage-title">
        <span className="tag">Stockage local</span><h2 id="storage-title">Vos données restent avec vous</h2>
        <p>runKLMrun conserve vos données dans la base IndexedDB de ce navigateur. Aucun compte n’est nécessaire et vos activités ne sont envoyées à aucun serveur.</p>
        <p>Chaque navigateur et chaque appareil dispose de son propre stockage. Vos données ne sont pas synchronisées entre vos appareils.</p>
        <div className="notice"><strong>À savoir</strong><p>Effacer les données de ce site peut supprimer votre historique. En navigation privée, le stockage peut être indisponible ou supprimé à la fermeture du navigateur.</p></div>
      </section>
      <Backups />
      <DetailRetention />
      </section>
      <section aria-labelledby="settings-app-title"><h2 id="settings-app-title">Application</h2><Appearance /></section>
    </>
  );
}
