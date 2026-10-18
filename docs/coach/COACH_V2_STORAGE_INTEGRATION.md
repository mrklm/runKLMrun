# Coach V2 — intégration du stockage transactionnel

Phase 5C, 18 octobre 2026. Le stockage V2 est disponible par une API interne isolée. Aucun composant ne l’appelle et le Coach V2 reste désactivé.

## Vérification préalable

Le stockage ne dispose pas d’assez d’informations pour choisir seul une ancre temporelle ou attribuer une génération :

- une ancre est fiable seulement lorsqu’un appelant fournit explicitement une activité enregistrée, une présentation connue ou un amorçage daté ;
- la génération 1 représente la première occasion ; son incrément exige une décision explicite de remplacement ou de nouvelle occurrence ;
- un recalcul, une consultation, une différence de contenu ou l’écoulement du temps ne suffisent pas à incrémenter cette génération.

Le dépôt refuse donc d’inventer ces valeurs. Il reçoit une `SelectedSuggestionV2` déjà munie de son `PresentationOpportunityV2`. La décision de génération reste bloquée hors du stockage jusqu’au raccordement contrôlé de l’orchestrateur.

## Schéma et migration

La version IndexedDB passe de 8 à 9. La migration ajoute uniquement le magasin :

```text
coachSuggestionsV2
  keyPath: id
  index presentationKey: unique
  index presentedOn: presentation.presentedOn
```

Les magasins et valeurs V1 ne sont ni lus, ni transformés, ni déplacés pendant la migration. Le magasin séparé permet aux lecteurs V1 de continuer à appliquer leur contrat fermé sans rencontrer une valeur V2.

Chaque valeur contient l’identifiant immuable, la clé de présentation, l’empreinte SHA-256, le contenu validé, l’occasion avec son ancre et sa génération, le moment civil de présentation, le fuseau et la provenance minimale du calcul.

## Transactions

`createSuggestionV2Repository().recordPresented()` prépare et valide l’occurrence avant d’ouvrir une transaction `readwrite`. Dans la transaction :

1. l’index unique est interrogé avec `presentationKey` ;
2. une occurrence existante avec la même empreinte produit `existing` ;
3. une occurrence existante avec une autre empreinte produit `content-conflict` ;
4. sinon, l’occurrence est ajoutée ;
5. la transaction est validée avant le retour `created`.

L’index unique constitue le dernier garde-fou contre deux insertions. Une collision de contrainte est relue après l’abandon de la transaction : le gagnant est retourné comme occurrence existante ou comme conflit explicite.

Le contenu n’a aucune opération de mise à jour. Les objets relus par IndexedDB sont des clones ; une mutation du résultat par l’appelant ne modifie pas la valeur stockée.

La préparation SHA-256 se déroule avant la transaction. La validation cryptographique complète des valeurs relues se déroule après leur lecture, afin de ne pas laisser une transaction IndexedDB ouverte pendant une opération asynchrone non IndexedDB.

## Lectures ciblées

Le dépôt expose :

- `getById(id)` ;
- `getByPresentationKey(key)` ;
- `listPresentedBetween(from, to)`, bornes civiles incluses.

Ces opérations valident les valeurs retournées et n’ajoutent aucune occurrence. Les suggestions V1 et V2 sont distinguées structurellement par leurs magasins et leurs dépôts respectifs.

Aucune suppression, association, obsolescence ou rétention automatique n’est implémentée dans cette phase.

## Concurrence

Les tests lancent deux appels concurrents vers la même base sous `fake-indexeddb`. Ils vérifient la sérialisation transactionnelle et l’unicité de l’index : un appel crée, l’autre retrouve exactement l’occurrence gagnante.

Ce banc ne représente pas deux processus ou deux onglets réels. Il ne teste pas les délais, fermetures, événements `versionchange` ou particularités d’un moteur IndexedDB de navigateur. Un test Playwright multi-page sera nécessaire avant activation.

## Sauvegardes

Le format de sauvegarde actuel reste le format 5 et ignore le nouveau magasin. Une sauvegarde actuelle :

- n’exporte pas les occurrences V2 ;
- ne les restaure pas ;
- ne les efface pas lors d’un remplacement, car le service actuel ne connaît pas ce magasin.

Ce comportement interdit l’activation fonctionnelle du stockage V2. Il reste acceptable pour cette phase expérimentale parce qu’aucune interface ni aucun chemin du Coach ne peut écrire ces données. Avant toute activation, le format 6, l’aperçu, la fusion, le remplacement et le SHA-256 devront intégrer explicitement V2. Le service de remplacement devra alors traiter le magasin dans la même transaction atomique.

## Tests effectués

Les tests ciblés couvrent :

- création et lectures ciblées ;
- index unique et déduplication ;
- transactions concurrentes simulées ;
- conflit de contenu ;
- nouvelle génération explicite ;
- contenu stocké immuable ;
- dates et fuseaux invalides ;
- fermeture et réouverture ;
- migration d’une base en version 8 ;
- conservation exacte d’une suggestion V1 ;
- consultation sans ajout ;
- non-régression des dépôts V1 et du profil.

## Étapes restantes

1. Faire produire à l’orchestrateur une ancre stable et une première génération sans persister une simple sélection.
2. Définir transactionnellement le remplacement et le propriétaire de l’incrément de génération.
3. Ajouter un test navigateur avec deux pages réelles.
4. Définir association, obsolescence et rétention V2.
5. Intégrer le magasin au futur format de sauvegarde avant toute activation.
6. Ajouter les notifications inter-onglets seulement lorsqu’un consommateur V2 existe, après validation effective d’une écriture.
