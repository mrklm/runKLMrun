import { EmptyState } from '../components/EmptyState';

export function Training() {
  return (
    <>
      <header className="page-heading"><span className="eyebrow">LA SUITE DE VOTRE PARCOURS</span><h1>Entraînement</h1><p>Votre futur espace de préparation des entraînements.</p></header>
      <section className="panel"><EmptyState title="Aucun programme d’entraînement" symbol="＋"><p>Le planificateur n’est pas encore disponible.</p><p>Aucune séance ni recommandation sportive n’est générée à cette étape.</p></EmptyState></section>
    </>
  );
}
