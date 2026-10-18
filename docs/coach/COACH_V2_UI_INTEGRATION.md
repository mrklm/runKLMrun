# Coach V2 — intégration expérimentale à l’interface

## Activation et parcours

L’intégration réutilise exclusivement la clé `runklmrun:coach-v2-internal`. Elle exige également `import.meta.env.DEV` : sans ces deux conditions, l’Accueil, le calendrier et la fiche d’activité restent strictement V1 et aucun accès V2 n’est effectué pour leur rendu.

Sous activation interne, l’Accueil ajoute une carte expérimentale après la dernière sortie. Elle affiche la date, le type, la durée, l’intensité et le terrain qualitatif. Les consignes et les blocs structurés restent dans « Consignes détaillées ». L’interface ne montre ni ancre, ni génération, ni identifiant, ni empreinte.

Le montage de la carte demeure une lecture. Une occurrence n’est créée que par l’action explicite « Confirmer que cette suggestion est affichée », via `presentCoachV2Selection()`. Une occurrence active compatible est réaffichée avec son contenu immuable, sans nouvelle écriture ni nouvelle génération.

## Calendrier Courses

Le calendrier continue à charger et afficher les suggestions V1. En développement activé, il charge aussi les occurrences V2 non obsolètes et les déduplique par leur identifiant immuable.

La légende et les marqueurs distinguent :

- `●` activité réellement enregistrée ;
- `○` suggestion facultative V1 ;
- `◇` suggestion expérimentale V2.

Les occurrences V2 restent une couche visuelle indépendante. Elles ne sont jamais ajoutées à la collection des activités et n’entrent donc dans aucun total statistique.

## Association explicite

La fiche d’une activité propose, sous activation interne, les occurrences V2 non obsolètes portant la même date civile. L’utilisateur choisit explicitement l’association ; aucune égalité de date ne déclenche une écriture automatique.

Lorsque plusieurs activités existent à cette date, l’interface signale l’ambiguïté avant la confirmation. Le dépôt vérifie ensuite dans une transaction la date, la révision de l’occurrence, l’existence de l’activité et l’unicité du lien. Une occurrence déjà associée à une autre activité n’est pas transférée. La preuve sportive définie en 6E est enregistrée et demeure soumise aux invalidations lors d’une modification significative.

## Synchronisation

Les trois surfaces écoutent le scope existant `suggestions-v2`. Une présentation, association, invalidation, restauration ou remplacement validé recharge les données dans l’onglet courant et les autres onglets par le bus de stockage. Une notification ne lance que des lectures : elle ne confirme aucune présentation et ne crée aucune association.

## Limites avant activation publique

- Le déclenchement produit d’une présentation effective reste à définir ; le bouton de confirmation est volontairement réservé au développement.
- L’association repose sur un choix manuel dans la fiche. Aucun classement automatique des candidats n’est introduit.
- Les textes, la gestion publique des erreurs et la transition V1/V2 devront faire l’objet d’une validation produit et d’accessibilité.
- Le Coach V1 reste affiché à côté de l’expérimentation ; aucune bascule publique ni migration n’est réalisée.
