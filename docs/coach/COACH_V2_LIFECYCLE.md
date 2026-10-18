# Coach V2 — cycle de vie des suggestions persistées

Phase 5E, 18 octobre 2026. Le cycle de vie est disponible dans l’API interne V2. Il ne raccorde ni le moteur V2 ni l’interface.

## États et transitions

Une occurrence persistée possède exactement un état :

- `active` : elle a été effectivement présentée et reste exploitable par l’orchestrateur ;
- `obsolete` : elle ne doit plus être proposée, mais demeure dans l’historique technique ;
- `associated` : elle référence explicitement une activité réellement enregistrée.

Il n’existe aucun état « manquée ». Une suggestion ignorée reste un fait de présentation ; elle ne devient ni activité, ni dette d’entraînement.

Les transitions autorisées sont :

```text
présentation effective -> active
active -> obsolete
active ou obsolete -> associated, après association explicite
active -> nouvelle occurrence active + ancienne occurrence obsolete, lors d’un remplacement
```

Chaque mutation de métadonnées incrémente `revision` et fixe `updatedAt`. Le contrôle de la révision attendue empêche une écriture ancienne d’écraser une modification concurrente. Le contenu, son empreinte, l’occasion et la première présentation restent immuables.

## Réaffichage et remplacement

`recordPresented()` recherche la clé de présentation unique. Si la même empreinte existe, il retourne l’occurrence stockée sans écriture : l’identifiant, `presentedAt`, `presentedOn`, la révision et le contenu restent identiques. Un recalcul ou une consultation ne crée donc ni doublon ni génération.

Un contenu différent sous la même clé reste un conflit explicite. Un remplacement doit appeler `replacePresented()` avec :

- l’identifiant et la révision de l’occurrence active ;
- une occasion portant une génération strictement supérieure ;
- une nouvelle présentation effectivement constatée.

La transaction ajoute la nouvelle occurrence avec `supersedesId`, puis rend l’ancienne `obsolete` avec `supersededById`. Une collision de clé ou une révision périmée annule l’ensemble. Aucun remplacement silencieux, report ou rattrapage n’est déduit.

## Association aux activités

`inspectAssociation()` ne modifie rien. Il compare uniquement la date civile suggérée aux dates civiles valides d’activités de course réellement stockées :

- aucune activité : `no-candidate` ;
- une activité : `confirmation-required` ;
- plusieurs activités : `ambiguous`, avec leurs identifiants ;
- occurrence déjà liée : `associated`.

Même une correspondance unique n’est pas une preuve suffisante : aucune association automatique n’est réalisée. `associateActivity()` exige l’identifiant choisi explicitement, vérifie que l’activité existe, que sa date civile correspond et qu’elle n’est pas déjà revendiquée par une autre occurrence. Il ne compare ni durée, ni intensité, ni terrain et n’infère jamais de type sportif.

Une ambiguïté reste donc visible jusqu’à une décision explicite. Une proximité de date, une suggestion ignorée ou une activité absente ne provoque aucune écriture. Une occurrence obsolète peut être associée lors d’un import tardif ; elle passe alors à `associated` sans réactiver la suggestion.

Si l’activité associée disparaît ou si son remplacement change sa date civile, le lien est invalidé explicitement : l’occurrence passe à `obsolete`, l’ancien identifiant et le motif sont conservés dans `associationInvalidation`. Aucune activité voisine n’est recherchée automatiquement.

## Fenêtre opérationnelle et conservation

`retainUntil` est le premier jour civil situé après 42 jours révolus, calculé depuis la plus tardive entre la date suggérée et la première date de présentation. Cette durée est un choix expérimental du produit, pas une constante scientifique.

`operationalStatusV2()` distingue :

- `withinWindow`, qui indique si l’occurrence est encore dans la fenêtre d’exploitation ;
- `deletionEligible`, qui indique seulement qu’une occurrence non associée pourrait être examinée par une future politique de nettoyage.

Une occurrence associée n’est jamais déclarée supprimable par cette règle. Une occurrence non associée dépassant 42 jours reste néanmoins stockée : cette phase n’ajoute aucune purge, aucun minuteur et aucune suppression automatique. La politique définitive des occurrences non associées devra préciser les lots, les protections inter-onglets et le consentement produit avant toute implémentation.

## Sauvegardes et compatibilité

Les nouveaux champs de cycle de vie font partie de `PersistableOccurrenceV2`. Le format de sauvegarde V6 conserve les états, révisions, dates, associations et liens de remplacement tels quels dans les exports JSON et gzip. Une restauration ne transforme jamais une occurrence en nouvelle présentation.

Les suggestions V1 restent dans leur magasin et leur contrat historiques. Elles ne sont ni converties ni réécrites. Le Coach V1 continue à fonctionner indépendamment.

## Limites avant activation

- La concurrence est testée transactionnellement avec `fake-indexeddb`, pas encore entre deux processus navigateur réels.
- Le choix explicite qui confirme une association n’a pas encore d’interface.
- L’invalidation est automatique dans les opérations du dépôt de séances ; une écriture IndexedDB extérieure au dépôt doit appeler la réconciliation explicite avant d’exploiter l’association.
- Il n’existe aucune purge automatique après 42 jours.
- Le raccordement à la visibilité réelle, à l’orchestrateur et aux notifications inter-onglets reste à réaliser avant activation.
