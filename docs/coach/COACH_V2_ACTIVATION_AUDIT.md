# Coach V2 — audit d’activation

Phase 6A, 18 octobre 2026. Audit statique uniquement : aucun comportement, schéma ou composant n’est modifié.

## Conclusion

Le Coach V2 ne peut pas encore être activé sans raccordements supplémentaires. Ses briques sont isolément testées, mais aucune chaîne de production ne relie aujourd’hui le calcul V2, une date candidate, une présentation réellement visible et une occurrence persistée. Le mode V1 reste le seul chemin appelé par l’interface.

Une activation progressive est possible sans convertir ni supprimer les données V1. Elle exige d’abord un service interne cohérent et testable, puis une activation sous contrôle. Une migration destructive n’est pas nécessaire : le magasin V2 et le format de sauvegarde V6 existent déjà.

## État de la chaîne fonctionnelle

| Élément | État réel | Limite d’intégration |
| --- | --- | --- |
| Référence hybride V2 | Prête comme calcul explicite | L’adaptateur lit les suggestions V1, pas les occurrences V2 et leurs associations validées |
| Catalogue enrichi | Prêt comme API expérimentale pure | Contrat distinct des objets persistants ; données de rôles fiables généralement absentes |
| Orchestrateur temporel | Prêt comme API expérimentale pure | Sélectionne zéro ou un candidat, mais ne choisit pas sa date future |
| Occurrence et empreinte | Types, validation et SHA-256 prêts | Aucun adaptateur catalogue → contenu persistant et aucune occasion complète produite par l’application |
| IndexedDB V2 | Magasin, unicité et transactions prêts | Aucun composant de production ne l’appelle ; aucune notification V2 dédiée |
| Cycle de vie | Réaffichage, remplacement, association et invalidation prêts | Confirmation d’association et déclenchement de réconciliation absents de l’interface |
| Sauvegarde V6 | Export, fusion, remplacement et intégrité prêts | À revalider avec la future chaîne de production complète |

`CoachPlanning` charge le planning, la configuration et le profil, puis appelle `proposeSuggestions()` sans mode V2. `CoachSuggestions` affiche les objets V1 et mémorise leur visibilité avec `createSuggestionRepository()`. Aucun fichier de production n’appelle `proposeExperimentalOrchestratedV2()` ou `createSuggestionV2Repository()` pour présenter une suggestion.

## Présentation, ancre et génération

La frontière consultation/présentation est fiable côté V1 : `watchSuggestionPresentation()` attend une carte réellement visible et résiste au démontage exploratoire. Elle est réutilisable, mais n’est pas raccordée à V2.

Les éléments suivants manquent réellement :

1. **Date candidate** : l’orchestrateur V2 choisit une séance, sans choisir un jour parmi les disponibilités. Le catalogue réduit même les disponibilités personnalisées à un plafond minimal global. Il ne peut donc pas construire `suggestedFor` ni garantir le plafond du jour retenu.
2. **Ancre temporelle** : aucune fonction de production ne choisit entre activité fiable, présentation V2 précédente ou amorçage. Le dépôt refuse correctement de l’inventer.
3. **Génération** : le dépôt contrôle qu’un remplacement l’augmente, mais aucun propriétaire applicatif transactionnel ne décide entre réaffichage, remplacement et nouvelle occurrence après expiration.
4. **Adaptation de contrat** : la séance du catalogue et `ImmutableSessionContentV2` sont proches mais distinctes ; aucune conversion validée ne produit contenu, occasion et provenance.
5. **Présentation effective** : aucune carte V2 ne transmet instant, date civile, fuseau et contenu au dépôt après visibilité.
6. **Actualisation** : le bus de changements ne distingue pas encore les occurrences V2. Les garanties d’unicité entre onglets existent dans IndexedDB, mais les futurs lecteurs ne seraient pas rafraîchis après une écriture V2.

La clé de présentation est stable seulement si l’occasion fournie est stable. Le SHA-256, l’index unique et les tests multi-pages empêchent les doublons pour une même clé ; ils ne compensent pas une ancre ou une génération instable en amont.

## Cohérence sportive

### Éléments démontrés dans les prototypes

- Les sept objectifs peuvent produire des catalogues différents.
- Une référence provisoire limite le catalogue à une séance facile non structurée.
- Fractionné, soutenu et côtes exigent expérience compatible, référence documentée et type antérieur fourni explicitement.
- Terrain et intensité sont séparés ; aucun D+ ou indicateur physiologique n’est inventé.
- Les disponibilités plafonnent les durées des candidats.
- L’orchestrateur espace les présentations structurées et longues, distingue activité réelle et suggestion présentée, et peut retourner zéro séance.
- Après interruption, la référence peut devenir indisponible ou provisoire au lieu de reprendre silencieusement V1.
- Les simulations de référence bornent la contribution des activités associées et évitent la baisse récursive observée avec une contribution complète.

### Ce qui n’est pas encore une règle de production

Tous ces comportements restent derrière des API expérimentales. Le moteur affiché conserve les stratégies V1. Les simulations longitudinales valident des données synthétiques et des contrats fournis explicitement ; elles ne démontrent pas encore le comportement d’une chaîne intégrée avec les instantanés IndexedDB réels.

La disponibilité V2 n’est pas rattachée à une date précise. La sortie longue peut ajouter le pas expérimental au repère habituel lorsqu’une sortie longue est documentée : elle reste facultative et n’augmente pas simultanément intensité et terrain, mais ce paramètre doit être validé au niveau produit avant exposition. Les seuils de 42, 14, 10, 3 et 2 jours sont des choix expérimentaux, pas des constantes scientifiques.

Les imports ne fournissent pas un rôle de séance fiable. En production, la table `documentedActivityTypes` serait donc vide sans nouvelle source explicite ; le Coach doit accepter cette limite et ne pas débloquer artificiellement les séances structurées.

## Activités et associations

La suppression par le dépôt invalide désormais l’association dans la transaction. Un remplacement qui change la date civile l’invalide également. Les restaurations V6 refusent les liens orphelins et une ancienne sauvegarde restaurée en remplacement ne conserve pas d’occurrence V2 isolée.

Deux limites restent bloquantes :

- aucune interface ne confirme qu’une activité correspond à une suggestion ; une égalité de date produit seulement un candidat ou une ambiguïté ;
- une modification importante sous le même identifiant et le même jour conserve aujourd’hui le lien. L’occurrence ne mémorise ni révision ni empreinte de l’activité au moment de l’association. Une activité entièrement remplacée le même jour pourrait donc rester abusivement considérée comme preuve.

Avant activation, l’association doit enregistrer une preuve minimale stable de l’activité associée, ou toute modification substantielle doit invalider le lien. Cette preuve ne doit contenir ni type inventé ni interprétation sportive. En cas de doute, l’association devient invalidée ; elle n’est jamais transférée automatiquement vers une autre activité.

## Adaptations minimales de l’interface

- **Accueil** : remplacer sous contrôle la source V1 de la carte de suggestions par un résultat V2 déjà stabilisé ; réutiliser le détecteur de visibilité. Prévoir un retour explicite « aucune suggestion V2 » sans bascule silencieuse sur V1.
- **Calendrier Courses** : lire V1 et V2 comme deux contrats distincts. Conserver toutes les suggestions V1 déjà présentées et éviter deux événements lorsque V1 et V2 coexistent.
- **Paramètres Coach** : réutiliser objectif, expérience, disponibilités et préférences. Aucun second formulaire n’est nécessaire. Une activation éventuelle doit d’abord rester interne ; aucun interrupteur utilisateur n’est justifié tant que la chaîne n’est pas validée.
- **Détail d’activité** : ajouter ultérieurement une confirmation ou une invalidation explicite du lien V2, avec gestion des ambiguïtés. Ne jamais présenter la correspondance comme la preuve que les consignes ont été suivies.

La navigation actuelle, le planning historique, les observations, les ressentis, les suggestions V1 et les anciennes sauvegardes peuvent rester inchangés.

## Risques classés

### A. Bloquants avant activation

1. Absence de service de calcul V2 lisant un instantané cohérent des séances, du profil, de la configuration et des occurrences V2.
2. Absence de sélection de date respectant la disponibilité réelle du jour.
3. Propriétaire non défini pour l’ancre et la génération ; risque de fausses nouvelles occurrences malgré une clé techniquement unique.
4. Absence d’adaptateur entre catalogue, orchestrateur et contrat persistant.
5. Absence de raccordement à la visibilité réelle et aux notifications inter-onglets V2.
6. Référence V2 encore alimentée par les suggestions V1 au lieu du cycle de vie V2 validé.
7. Association conservée après modification substantielle le même jour, faute de preuve d’intégrité de l’activité.
8. Absence de test longitudinal du pipeline intégré complet avec V1 activé par défaut.

### B. Améliorations non bloquantes pour une activation interne limitée

- Diagnostic de comparaison V1/V2 accessible uniquement au développement.
- Test navigateur multi-processus en plus du test multi-pages déjà réussi.
- Rapport de conflits V2 plus détaillé dans l’aperçu de restauration.
- Index de rétention dédié si une future purge est décidée.

### C. Fonctionnalités pouvant attendre

- Purge automatique des occurrences expirées.
- Synchronisation entre appareils ou service distant.
- Déduction ou saisie détaillée du rôle des anciennes activités.
- Remplacement du planning historique V1.
- Programme automatique sur plusieurs semaines, dette ou rattrapage.

## Ordre recommandé

1. **6B — Adaptateur applicatif en lecture seule** : construire un instantané cohérent, convertir les occurrences V2 en preuves de référence et de présentation, choisir une date selon la disponibilité du jour, puis produire une occasion complète. Comparer V1/V2 sans affichage ni écriture.
2. **6C — Identité et génération transactionnelles** : définir les règles d’ancre, de réaffichage, de remplacement et d’expiration ; tester les recalculs, changements de date et deux onglets, toujours sans interface.
3. **6D — Pipeline de présentation sous activation interne** : adapter le candidat au contrat persistant, réutiliser la visibilité V1, enregistrer seulement après rendu effectif et publier une notification V2. V1 reste le défaut et aucun repli silencieux n’est autorisé.
4. **6E — Intégrité des activités** : mémoriser une preuve minimale de l’activité au moment de l’association, invalider les modifications substantielles et ajouter la confirmation explicite. Rejouer suppression, remplacement, fusion et restauration.
5. **6F — Interface progressive** : afficher d’abord V2 sur l’Accueil sous contrôle, puis le calendrier. Conserver les occurrences V1 en lecture et éviter les doublons visuels. Ajouter le détail d’association seulement après validation d’accessibilité.
6. **6G — Validation d’activation** : simulations longitudinales du pipeline réel, tests V1/V2 comparatifs, StrictMode, fuseaux, changement de jour, multi-onglets, sauvegardes V1 à V6 et retour immédiat au mode V1.

L’activation publique ne doit intervenir qu’après 6G. Le retrait de V1 constitue une décision ultérieure distincte ; cet audit ne le recommande pas.
