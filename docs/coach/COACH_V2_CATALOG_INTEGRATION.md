# Coach V2 — raccordement expérimental du catalogue

Phase 4E, 18 octobre 2026. Le catalogue enrichi est raccordé à la référence hybride C par une API en mémoire distincte. L'interface, les suggestions V1 et leur stockage restent inchangés.

## Raccordement

`proposeExperimentalCatalogFromReferenceV2()` reçoit explicitement les séances, la référence V2, la configuration, le profil et la date de référence. Elle :

1. adapte seulement les déclarations et mesures disponibles au contrat `SessionStrategyInput` ;
2. appelle `selectPrototypeSessions()` ;
3. valide chaque résultat avec `validatePrototypeSession()` ;
4. retourne un `ExperimentalCatalogV2Result`, jamais un `SessionSuggestion` ou `StoredSuggestion` V1.

Cette fonction n'est appelée par aucun composant. Le mode V1 implicite ou explicite continue d'utiliser `proposeSuggestions()` et produit un résultat strictement identique.

## Données adaptées

| Entrée du catalogue | Source actuelle | Traitement |
|---|---|---|
| Objectif | Configuration évolutive | Repris sans conversion |
| Référence habituelle | Politique hybride C | Confirmée ou provisoire explicitement |
| Expérience | Déclaration du coureur | `intermediate` devient le niveau technique `regular` ; absence et `observe` restent absents |
| Disponibilité | Profil | Durée simple, ou minimum prudent des durées réellement déclarées pour les jours disponibles |
| Distance cible | Objectif distance/course | Reprise seulement si déclarée |
| Distance documentée | Résumés | Maximum des distances positives réellement enregistrées |
| Échéance | Objectif course | Reprise seulement si déclarée |
| Relief préféré | Indisponible | La surface route/chemin/tapis n'est jamais convertie en relief |
| Types déjà pratiqués | Indisponibles par défaut | Tableau vide, sauf table de preuves explicite fournie par un appelant ; aucun type déduit des imports, durées ou associations |

Quand le relief manque, le catalogue choisit `flat` comme terrain prudent de conception et l'indique dans sa justification. Il ne prétend pas que le coureur préfère le plat.

## Sortie expérimentale

Chaque séance V2 possède :

- un type ;
- une durée totale ;
- une intensité qualitative ;
- un terrain qualitatif ;
- un résumé court ;
- des consignes facultatives ;
- des blocs uniquement pour les séances structurées ;
- les raisons, incertitudes et dimensions modifiées ;
- `optional: true`.

La sortie n'a aucun identifiant persistant. Elle n'est ni enregistrée, ni rapprochée d'une activité, ni convertie vers le format V1.

## Confiance et données insuffisantes

- Une référence confirmée donne `evidence: documented` au catalogue.
- Une référence provisoire donne `evidence: insufficient` : seule l'alternative facile non structurée reste admissible.
- Une référence indisponible produit une liste vide et un motif explicite. Aucune référence V1 n'est reprise.
- Une configuration ou une disponibilité absente produit également une liste vide.

Même avec une référence confirmée, aucun fractionné, sortie soutenue, séance de côtes ou sortie longue n'est autorisé sans preuve de type fournie explicitement, car runKLMrun ne possède pas de qualification fiable par défaut. L'objectif ou l'expérience déclarée ne suffisent pas.

## Validation et non-régression

Les tests vérifient :

- les références confirmées, provisoires et indisponibles ;
- la différence entre débuter et reprendre ;
- l'absence de type inventé pour vitesse et course ;
- la conservation des données cibles réellement déclarées et de la distance documentée ;
- l'absence de conversion surface/relief ;
- la somme exacte des blocs lorsque le catalogue reçoit une preuve structurée explicite ;
- l'absence de modification des suggestions persistées.

## Limites avant activation réelle

- Le catalogue n’est pas une API de compatibilité V1 : sa référence est fournie explicitement par le pipeline V2.
- Le choix d'une durée disponible unique à partir de plusieurs jours devra être remplacé lors du futur placement temporel.
- La distance documentée maximale n'établit ni une capacité actuelle ni une sortie longue habituelle.
- Les preuves fiables de séances structurées n'existent pas encore dans les données de production.
- Le vocabulaire et les paramètres du catalogue restent expérimentaux.
- L'identité, la visibilité, la persistance et les sauvegardes V2 restent à concevoir avant toute activation.

Les calculs V2 restent séparés des suggestions V1 historiques et de leur stockage.
