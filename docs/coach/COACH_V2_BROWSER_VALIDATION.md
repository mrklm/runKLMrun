# Coach V2 — validation navigateur et intégrité

Phase 5F, 18 octobre 2026. Les scénarios ont été exécutés avec Playwright dans Chromium contre le serveur Vite réel. Le Coach V2 reste désactivé dans l’interface.

## Intégrité des associations

Une association V2 ne sert de preuve que si l’activité identifiée existe encore et si sa date civile correspond toujours à la date suggérée.

- La suppression par le dépôt de séances retire l’activité, ses détails et son association de chaussure, puis invalide les occurrences V2 concernées dans la même transaction.
- Le remplacement sous le même identifiant conserve le lien si la date civile reste compatible.
- Un remplacement qui change la date civile invalide le lien dans la transaction d’enregistrement.
- Une suppression effectuée directement hors du dépôt est détectée par `inspectAssociation()` comme `invalid-association`. `invalidateMissingAssociations()` permet ensuite une réconciliation explicite et transactionnelle.

L’occurrence n’est jamais supprimée. Elle devient `obsolete`, perd son `activityId` actif et conserve `associationInvalidation` avec l’ancien identifiant, l’instant et le motif `activity-missing` ou `activity-replaced`. Aucune autre activité du même jour ou d’un jour proche n’est associée automatiquement. Aucun type sportif et aucun état « manquée » ne sont créés.

## Scénarios réellement exécutés dans Chromium

Deux pages du même contexte navigateur ont partagé la même origine et la même base IndexedDB synthétique.

| Scénario | Résultat observé |
| --- | --- |
| Deux insertions simultanées avec la même clé | Une création, une lecture de l’occurrence gagnante, un seul enregistrement |
| Lecture dans les deux pages | Même identifiant et même contenu |
| Deux remplacements simultanés | Un remplacement atomique, un conflit de révision explicite |
| Deux associations simultanées vers la même activité | Une association, un conflit explicite, jamais deux propriétaires |
| Fermeture puis réouverture | Trois occurrences retrouvées, avec une seule associée et l’ancienne occurrence obsolète |

Ces vérifications utilisent de véritables transactions IndexedDB de Chromium. Elles vont au-delà de `fake-indexeddb`, tout en restant deux pages d’un même processus de test ; les différences propres à plusieurs processus ou appareils ne sont pas couvertes.

## Sauvegarde et restauration

Le second parcours navigateur a exécuté : création d’une activité, présentation V2, association explicite, export gzip V6, restauration dans une autre base et relecture.

L’identifiant, la clé, les dates, le fuseau, l’état, la révision et l’association ont été conservés exactement. Une ancienne sauvegarde sans V2 restaurée en remplacement a effacé ensemble l’activité et l’occurrence V2 précédemment présentes : aucune association orpheline n’est restée valide.

La validation V6 refuse aussi avant écriture :

- une association vers une activité absente ;
- deux occurrences revendiquant la même activité ;
- une chaîne de remplacement absente ou non réciproque.

En fusion, les conflits de séance et d’association conservent les données locales et sont signalés. Une restauration ne crée jamais une nouvelle présentation.

## Non-régression et limites

- Les magasins, types et suggestions V1 restent inchangés.
- Une lecture ou une inspection ne crée aucune présentation.
- Le catalogue, les durées, les blocs et l’interface ne sont pas modifiés.
- Aucune purge automatique n’est ajoutée.
- La réconciliation après des écritures IndexedDB qui contournent le dépôt reste à déclencher explicitement.
- Un test multi-processus navigateur et une stratégie pour une suppression distante entre appareils resteraient nécessaires avant une synchronisation externe éventuelle.

Avant activation du Coach V2, il reste à raccorder la constatation réelle de présentation, les notifications inter-onglets V2 et une confirmation utilisateur explicite pour l’association.
