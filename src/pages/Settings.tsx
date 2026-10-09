import { PolarImport } from '../components/PolarImport';

export function Settings({ onImported }: { onImported: () => void }) {
  return (
    <>
      <header className="page-heading"><span className="eyebrow">VOTRE ESPACE PERSONNEL</span><h1>Paramètres</h1><p>Comprenez où sont conservées vos données.</p></header>
      <PolarImport onImported={onImported} />
      <section className="panel settings-panel" aria-labelledby="storage-title">
        <span className="tag">Stockage local</span><h2 id="storage-title">Vos données restent avec vous</h2>
        <p>runKLMrun conserve vos données dans la base IndexedDB de ce navigateur. Aucun compte n’est nécessaire et vos activités ne sont envoyées à aucun serveur.</p>
        <p>Chaque navigateur et chaque appareil dispose de son propre stockage. Vos données ne sont pas synchronisées entre vos appareils.</p>
        <div className="notice"><strong>À savoir</strong><p>Effacer les données de ce site peut supprimer votre historique. En navigation privée, le stockage peut être indisponible ou supprimé à la fermeture du navigateur.</p></div>
      </section>
      <section className="panel settings-panel" aria-labelledby="backup-title"><span className="tag">À venir</span><h2 id="backup-title">Sauvegarde et restauration</h2><p>L’architecture prévoit la sauvegarde et la restauration de vos données. Ces fonctions ne sont pas encore disponibles.</p></section>
    </>
  );
}
