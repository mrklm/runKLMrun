# Coach V2 — intégration contrôlée de la référence

Phase 4D, 18 octobre 2026. La politique hybride C est raccordée au moteur commun, mais reste inaccessible à l'interface et désactivée par défaut.

## Point de raccordement

Le raccordement se situe dans `calculateProposals()`, immédiatement après `proposalEvidence()` et avant `selectDuration()`. C'est le point unique où la médiane observée devient une base de durée.

Le placement des jours, les disponibilités, l'arrondi, le budget, les libellés, la présentation et la persistance restent communs. Le moteur n'est pas dupliqué.

## Modes internes

### V1

L'absence de `referenceMode`, ou la valeur explicite `v1`, exécute le chemin historique. Aucune suggestion persistée n'est lue, aucun diagnostic V2 n'est ajouté et la structure du résultat reste identique. Ce mode était utilisé par l’interface V1 retirée au lot 2.

### V2 expérimental

Le mode `v2-experimental` doit être injecté explicitement avec un tableau `storedSuggestions`. Une omission provoque une erreur au lieu de supposer un historique vide.

Le moteur appelle `bootstrapHabitualReference()` avec la politique hybride C :

- une référence B 2G disponible est `confirmed` ;
- une estimation issue d'activités réelles admissibles mais historiquement incertaines est `provisional` ;
- une référence trop ancienne est `unavailable` avec une fraîcheur `expired` ;
- des preuves trop rares ou incohérentes donnent `unavailable` avec une fraîcheur `insufficient`.

Le diagnostic éphémère contient le mode, la confiance, la fraîcheur, les identifiants sources et les raisons. Rien n'est persisté.

Une référence provisoire est traitée prudemment par la politique de durée actuelle et produit un statut prudent ou aucune suggestion si les garde-fous éditoriaux ne permettent pas une durée cohérente. Elle ne se confirme jamais elle-même.

## Indisponibilité

V2 ne réutilise jamais silencieusement la médiane V1. Lorsque sa référence vaut `null`, cette valeur est transmise à `selectDuration()` :

- pour les objectifs sans durée de découverte, aucune suggestion n'est créée ;
- si une politique possède déjà une durée de découverte explicite, cette durée reste un choix éditorial distinct et n'est pas présentée comme une référence V2.

Les suggestions ignorées ne fournissent aucune activité. Les activités associées peuvent maintenir une référence conformément à B 2G, mais ne servent pas à amorcer la politique hybride. Les suggestions persistées fournies en entrée ne sont jamais modifiées.

## Non-régression vérifiée

- V1 implicite et V1 explicite produisent des résultats strictement égaux.
- Fournir `storedSuggestions` sans activer V2 ne change rien.
- Une progression réelle de 40 à 45 minutes et une réduction réelle de 40 à 35 minutes deviennent des références confirmées.
- Un historique ancien encore admissible produit une référence provisoire explicite.
- Plus de 42 jours d'ancienneté ou une seule sortie de reprise ne provoquent aucun secours V1.
- Quatre sorties associées et raccourcies n'abaissent pas la référence provisoire issue des activités historiques à association inconnue.
- Aucune suggestion persistée n'est réécrite.

## Limites et conditions avant activation

- L’interface V1 retirée ne chargeait pas les suggestions persistées pour le calcul ; elle ne participe plus à l’activation publique.
- Les paramètres d'amorçage restent expérimentaux.
- La référence provisoire peut empêcher toute proposition lorsque la politique prudente descend sous le minimum éditorial ; ce comportement doit être validé produit.
- Le rythme et le placement restent issus de l'observation V1, même lorsque la durée utilise V2.
- La date d'import et le type réel d'une séance restent inconnus.
- La conservation actuelle des suggestions limite la reconstruction historique.

Avant activation réelle, il faut valider les paramètres, le comportement des références provisoires, charger un instantané cohérent des suggestions avec les séances, puis effectuer des simulations longitudinales du moteur complet en mode V2. L'interface et la persistance doivent rester inchangées jusqu'à cette validation.
