# Coach V2 — sauvegarde et restauration V6

Phase 5D, 18 octobre 2026. Le format 6 transporte les occurrences V2 sans activer le Coach V2 dans l’interface.

## Format V6

V6 conserve toutes les propriétés du format 5 et ajoute le tableau facultatif au niveau applicatif, mais obligatoire dans un document déclaré V6 :

```text
data.coachSuggestionsV2: PersistableOccurrenceV2[]
```

Chaque occurrence contient son identifiant, sa clé de présentation, son empreinte SHA-256, son contenu immuable, l’occasion et sa génération, l’instant et la date civile de présentation, le fuseau, le décalage UTC, la provenance et l’état.

Une exportation choisit V6 dès que `coachSuggestionsV2` est présent. Une base sans occurrence V2 continue de produire le format minimal correspondant à ses données, comme auparavant. Les suggestions V1 peuvent coexister avec V2 dans un document V6 et ne sont jamais converties.

Le JSON canonique trie les propriétés et conserve l’ordre des tableaux. Les exports JSON et gzip signent exactement le même payload logique. Le SHA-256 extérieur couvre donc aussi les occurrences V2.

## Exportation

L’instantané IndexedDB lit désormais `coachSuggestionsV2` dans la même transaction de lecture que les autres magasins. Chaque occurrence subit :

1. une validation structurelle pendant l’instantané ;
2. une validation cryptographique de sa clé et de son empreinte après fermeture de la transaction ;
3. la validation normale du document ;
4. la sérialisation canonique et le SHA-256 global.

L’export ne modifie aucune occurrence, ne recalcule aucune date et ne crée aucune présentation. L’ordre naturel par clé du magasin rend le tableau déterministe pour un même contenu de base.

## Importation et validation

Les formats 1 à 5 restent acceptés avec leurs règles existantes. V6 accepte les suggestions V1 et exige `coachSuggestionsV2`, éventuellement vide.

La validation V2 contrôle notamment :

- le contrat fermé et les valeurs autorisées ;
- les dates civiles, instants et fuseaux ;
- les durées et la somme des blocs ;
- la forme des identifiants, clés et empreintes ;
- l’unicité des identifiants et clés dans le fichier ;
- la correspondance SHA-256 entre contenu, empreinte et clé canonique.

L’intégrité SHA-256 du document original est vérifiée avant que les données ne soient préparées pour la fusion ou le remplacement. Les contrôles cryptographiques internes suivent cette vérification et précèdent toute écriture.

Une version future inconnue est refusée explicitement. Une ancienne application qui ne connaît pas V6 doit également refuser le document entier ; aucun export dégradé V2 vers V1 n’est produit.

## Politique de restauration

### Remplacement

Le magasin V2 participe à la transaction globale. Il est effacé puis rempli avec les occurrences validées du fichier, en conservant exactement identifiants, clés, dates, fuseaux, générations et provenance. Une occurrence restaurée n’est jamais considérée comme nouvellement présentée.

### Fusion

- même identifiant et valeur identique : l’occurrence locale est conservée sans conflit ;
- même identifiant et valeur différente : conflit, valeur locale conservée ;
- même clé de présentation sous un autre identifiant : conflit, valeur locale conservée ;
- identifiant et clé absents localement : occurrence ajoutée sans transformation.

Les doublons d’identifiant ou de clé à l’intérieur du fichier sont rejetés avant la préparation. Les conflits de fusion sont signalés dans le rapport et ne réécrivent pas les occurrences locales.

## Atomicité

La restauration utilise une seule transaction `readwrite` couvrant les séances, détails, profils, chaussures, Coach V1, planning, suggestions V1 et suggestions V2.

Avant son ouverture :

- le fichier est décompressé et borné ;
- le document est validé ;
- son SHA-256 est vérifié ;
- les empreintes internes V2 sont vérifiées ;
- la fusion ou le remplacement est préparé ;
- l’instantané local attendu est fixé.

Dans la transaction, l’instantané local est relu et comparé. Toute modification concurrente ou toute erreur d’écriture, y compris dans `coachSuggestionsV2`, annule l’ensemble de la transaction. Le test d’échec injecté après des écritures antérieures confirme que la base revient intégralement à son état initial.

Cette garantie couvre les transactions IndexedDB testées sous `fake-indexeddb`. Les comportements multi-processus propres aux navigateurs restent à valider par un parcours réel avant activation V2.

## Compatibilité

- Formats 1 à 4 : inchangés, sans suggestion V1 ou V2 selon leur contrat historique.
- Format 5 : suggestions V1 inchangées.
- Format 6 : données V5 plus occurrences V2, avec suggestions V1 facultatives.
- JSON et gzip : pris en charge.
- V1 n’est jamais enrichi ou converti en V2.
- V2 n’est jamais dégradé en V1.

La version applicative reste inchangée. Le numéro 6 décrit uniquement le contrat du fichier de sauvegarde.

## Tests effectués

Les tests ciblés couvrent : export JSON et gzip, restauration V6, coexistence V1/V2, préservation des identifiants et dates, doublon local identique, conflits d’identité et de clé, doublons internes, empreinte incohérente, version future, échec atomique d’écriture et compatibilité des suites existantes V1 à V5.

## Conditions avant activation V2

1. Raccorder l’orchestrateur sans créer de présentation lors d’un calcul.
2. Définir la génération et le remplacement transactionnel.
3. Ajouter association, obsolescence et rétention V2.
4. Tester la concurrence et les restaurations dans plusieurs pages de navigateur.
5. Prévoir le rapport utilisateur détaillé des conflits V2 si l’interface de restauration doit les distinguer individuellement.
