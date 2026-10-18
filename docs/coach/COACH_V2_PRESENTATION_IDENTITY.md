# Coach V2 — identité et génération des présentations

## Périmètre

Cette phase relie une sélection complète de l’adaptateur en lecture seule au dépôt V2. L’appel `presentCoachV2Selection()` reste volontairement explicite : ni une consultation, ni un recalcul, ni une sélection ne constate une présentation. Le Coach V2 demeure absent de l’interface.

## Priorité de réutilisation

Avant toute création, l’API recherche une occurrence `active` compatible. Elle doit :

- concerner le même objectif ;
- viser une date courante ou future située dans la fenêtre de sept jours ;
- viser un jour toujours déclaré disponible ;
- respecter le plafond actuellement déclaré pour ce jour ;
- conserver un jour de semaine cohérent avec sa date civile.

Son contenu n’a pas besoin d’être identique au dernier calcul. L’occurrence compatible est renvoyée avec le statut `reused-active`, sans écriture et sans modification de sa première présentation. Un changement mineur de profil ne la remplace donc pas tant qu’elle reste compatible.

## Ancre et absence de boucle

L’adaptateur continue de calculer son ancre depuis le dernier événement persistant : activité réelle ou présentation V2. Cette présentation pourrait modifier l’ancre du calcul suivant. La priorité de réutilisation intervient avant la préparation d’une nouvelle occurrence et coupe cette boucle : une occurrence active compatible se retrouve elle-même, même si le catalogue recalculé diffère.

Une nouvelle occasion peut être ouverte lorsqu’aucune occurrence active n’est encore compatible, notamment après le passage de sa date, après son obsolescence ou son association, après une activité réelle plus récente, ou lors d’un remplacement explicitement demandé. L’heure de consultation n’intervient jamais.

## Identité et génération

Les éléments restent distincts :

- la date et le plafond viennent de la sélection applicative ;
- l’ancre vient d’un événement persistant ;
- l’objectif vient du catalogue adapté ;
- la génération appartient à l’occasion logique ;
- la clé de présentation est le SHA-256 de l’occasion canonique ;
- l’identifiant immuable est créé uniquement au moment de l’insertion ;
- l’empreinte SHA-256 décrit uniquement le contenu.

Pour une première occasion, la génération vaut 1. Pour une même occasion — même objectif, date, ancre et disponibilité — elle est calculée depuis les générations déjà stockées. Deux appels concurrents choisissent la même génération ; l’index unique `presentationKey` fait autorité et leur fait partager la même occurrence. Un remplacement explicite utilise la génération précédente plus un et conserve les liens `supersedesId` et `supersededById`.

Une nouvelle date ou une nouvelle ancre constitue une nouvelle occasion et recommence à la génération 1. Aucun compteur local en mémoire n’est une source d’autorité.

## Transactions et concurrence

`recordPresented()` insère l’occurrence dans une transaction IndexedDB `readwrite`. L’index unique de clé de présentation garantit qu’une course entre onglets produit une création et, pour l’autre appel, l’occurrence gagnante (`existing` ou `reused-active` selon l’ordre observé). Un contenu différent sous la même clé reste un conflit explicite.

Le remplacement écrit la nouvelle occurrence et rend l’ancienne obsolète dans une seule transaction avec contrôle de révision. Une collision ou une révision périmée annule l’ensemble.

Les sauvegardes V6 conservent déjà l’identifiant, la clé, la génération, l’empreinte, l’ancre, les dates et les liens de remplacement sans les recalculer.

## Limites avant activation

- L’interface ne constate encore aucune présentation réelle.
- L’identité applicative est testée avec `fake-indexeddb` et dans deux onglets Playwright, mais pas entre deux appareils.
- La sélection d’une occurrence parmi plusieurs occurrences actives compatibles est déterministe (date puis identifiant), sans politique produit supplémentaire.
- Il n’existe aucune purge automatique et aucune activation V2.
