# Coach V2 — audit d'intégration

Phase 4A, 18 octobre 2026. Audit uniquement : aucune règle de production, donnée, version ou sauvegarde n'est modifiée.

## 1. Chaîne de production actuelle

| Responsabilité | Fichiers et fonctions | État constaté |
|---|---|---|
| Observer l'historique | `src/core/coach/proposals.ts` : `proposalEvidence()`, `selectDuration()`, `calculateProposals()` | La référence actuelle est une médiane mobile des durées récentes. Sa fenêtre dépend du rythme observé, avec fraîcheur, complétude et variabilité. Elle n'a ni épisode persistant ni hystérésis. |
| Générer les suggestions | `src/core/coach/proposals.ts` : `proposeSuggestions()` ; `src/core/coach/product-policy.ts` | Le calcul pur produit au plus trois suggestions sur sept jours. Le composant recalcule après changement des séances, du profil, de la configuration, du planning ou de la date. |
| Présenter | `src/components/CoachPlanning.tsx`, `CoachSuggestions.tsx`, `suggestion-presentation.ts` | Une carte visible déclenche l'écriture après contrôle transactionnel du contexte. Un calcul non visible n'est pas persisté. React StrictMode et les retours d'onglet sont dédupliqués. |
| Identifier et conserver | `src/core/coach/suggestions.ts`, `src/types/coach-suggestion.ts`, `src/storage/coach-suggestions.ts` | L'identité V1 contient date, `kind`, durée et terrain. Le magasin `coachSuggestions` conserve révision, état, dates techniques et association éventuelle. |
| Rapprocher | `src/core/coach/suggestion-matching.ts`, `src/storage/suggestion-reconciliation.ts` | Association prudente par date civile et unicité. Durée et contenu ne prouvent jamais l'exécution conforme. Les ambiguïtés restent sans association. |
| Sauvegarder | `src/types/backup.ts`, `src/backup/{format,validation,merge}.ts`, `src/storage/backup.ts` | Format 5 strict, JSON ou gzip, intégrité SHA-256. La fusion conserve une suggestion locale conflictuelle. |

## 2. Référence habituelle B 2G

### Données réellement disponibles

`RunningSession` fournit un identifiant stable, une date civile, une durée, parfois `startTime`, le fuseau source, le sport et la source TCX. `StoredSuggestion` fournit le jour suggéré, son contenu V1, `createdAt`, son état et éventuellement `activityId`. Aucune date d'import de séance n'est conservée. Aucun résumé n'indique de façon fiable « facile », « longue », « fractionné » ou « côtes ».

Les adaptateurs expérimentaux concernés sont :

- `simulation/session-role-v2.ts` : classe une course comme associée fiable, indépendante, ambiguë ou invalide, sans transférer le type suggéré à la course ;
- `simulation/association-policy-v2.ts` : politique B de contribution bornée ;
- `simulation/habitual-reference-v2.ts` : référence par épisode et confirmations ;
- `simulation/reference-validity-v2.ts` : les courses associées peuvent entretenir la validité sans prouver la capacité ni réviser seules la référence.

### Raccordement sans régression

Introduire d'abord un adaptateur pur de production qui transforme les résumés et suggestions V1/V2 en observations avec provenance. Il devra conserver la politique B : contributions associées bornées pour la révision, associations fiables admises seulement pour la continuité, ambiguïtés exclues. La référence V2 doit être calculée en parallèle de `proposalEvidence()`, avec diagnostic comparable, avant de piloter une durée.

Le calcul peut rester dérivé : ses entrées existent déjà dans `sessions` et `coachSuggestions`. Aucun nouveau magasin n'est nécessaire pour un premier raccordement. En revanche, `CoachPlanning` ne lit actuellement pas les suggestions avant le calcul ; son chargement devra obtenir un instantané cohérent de `sessions`, profil, configuration, planning et suggestions.

Risques : disparition d'une preuve après expiration des suggestions, association recalculée après suppression/restauration, changement brutal entre V1 et V2, et politique B dépendante de l'ordre des observations. Les identifiants sources et le statut de validité doivent être exposés dans le diagnostic, jamais présentés comme une capacité actuelle.

## 3. Suggestions, identité et stabilité

### Comportement actuel

Une même identité V1 réaffichée ne réécrit pas IndexedDB. Quand l'ensemble complet nouvellement visible diffère, les anciennes suggestions futures actives et non associées deviennent `superseded`. Une suggestion passée sans association devient temporairement `past-unmatched`, puis expire ; elle n'a pas d'état « ignorée ». Les refus du planning historique sont séparés et ne doivent pas être fusionnés avec ce mécanisme.

La persistance ne stabilise pas encore la génération après fermeture : `CoachPlanning` recalcule avec `proposeSuggestions()` sans relire les suggestions actives pour les réutiliser. Une modification de durée, de libellé ou de terrain crée une nouvelle identité. Fermer l'application ne supprime pas les enregistrements, mais ne garantit donc pas que les mêmes cartes seront reproposées.

### Incompatibilités avec 3F

- L'orchestrateur a besoin de la **date civile de présentation**. V1 ne stocke qu'un `createdAt` instantané et la date future de la séance. Déduire ultérieurement le jour local depuis `createdAt` dépend du fuseau courant.
- Le délai structuré expérimental atteint quatorze jours, alors que les suggestions sont supprimables sept jours civils après leur date suggérée. La mémoire requise peut disparaître trop tôt.
- L'identité V1 décrit le contenu. Elle ne distingue pas une occurrence stable de ses révisions de contenu.
- Une suggestion ignorée ne doit créer ni activité, ni dette, ni remplacement. L'obsolescence V1 est un état d'affichage, pas la preuve d'un refus.

Décisions nécessaires : définir une identité d'occurrence indépendante du contenu, définir `presentedOn` à l'écriture, choisir la rétention minimale de la mémoire d'orchestration et décider si une révision conserve l'occurrence ou en crée une autre. Les enregistrements V1 doivent rester lisibles et ne doivent jamais être réécrits automatiquement.

## 4. Contrat des séances enrichies

Le prototype `simulation/session-strategies-v2.ts` produit six types, une durée totale, une intensité qualitative, un terrain qualitatif, un résumé, des consignes facultatives et, pour les séances structurées, des blocs dont la somme est validée.

Le contrat V1 ne contient que `discovery | easy | endurance`, une durée et un terrain `{surface, relief}`. `SessionSuggestion`, l'affichage, `validatePresentedSuggestion()`, `suggestionId()`, la validation des sauvegardes et la fusion supposent ce contrat fermé.

La compatibilité doit prendre la forme d'une union discriminée :

- V1 reste inchangé et validé exactement comme aujourd'hui ;
- V2 porte une version de contenu explicite, le type enrichi, l'intensité, le terrain qualitatif, le résumé, les consignes et les blocs éventuels ;
- un adaptateur V1 vers présentation commune fournit seulement les informations connues, sans inventer intensité, blocs ou type enrichi ;
- l'association d'une activité à une suggestion V2 ne transfère toujours pas son type à la course importée.

Une sortie facile sur terrain en côtes et une séance structurée de côtes doivent rester distinctes. Les blocs sont absents des séances libres et leur somme doit rester égale à la durée totale.

## 5. Temps, provenance et historique

Les calculs actuels traitent `YYYY-MM-DD` à minuit UTC pour les écarts et utilisent `localToday()` pour le jour courant. `matchingDate()` conserve la date civile source et refuse un `startTime` dont le préfixe ne correspond pas. `timezoneOffsetMinutes` existe sur certaines séances, mais n'est pas utilisé pour déplacer leur date lors du rapprochement.

Il faut conserver cette règle pour les anciennes données : la date d'une course est la date civile déjà enregistrée, sans conversion rétrospective. Pour V2, enregistrer directement `presentedOn` au moment de la visibilité avec la convention civile locale documentée. Ne pas le reconstruire depuis la date suggérée.

La date d'import n'existe pas dans `RunningSession`. Le paramètre expérimental `recordedOn` reste donc inconnu en production et ne doit pas être fabriqué depuis `startTime`, `createdAt` ou l'ordre IndexedDB. Une évolution future de provenance serait additive et ne pourrait renseigner que les nouveaux imports.

## 6. IndexedDB et sauvegardes

Ajouter des champs à la valeur de `coachSuggestions` ne nécessite pas mécaniquement une migration IndexedDB : la clé `id` et l'index `expiresOn` peuvent rester identiques. Une migration de base ne serait justifiée que par un nouvel index, un nouveau magasin ou une modification de clé.

La sauvegarde exige en revanche une évolution explicite si des suggestions V2 sont persistées. Le format 5 rejette les champs inconnus et valide l'identité V1. La voie compatible est :

1. conserver la lecture intégrale des formats 1 à 5 ;
2. introduire un format suivant seulement lors de la première persistance V2 ;
3. valider séparément V1 et V2 après vérification SHA-256 ;
4. fusionner par identité d'occurrence V2 et préserver les conflits locaux, tout en gardant la logique V1 existante ;
5. exporter sans enrichir ni convertir les anciennes suggestions.

Éviter une migration ne dispense donc pas d'adapter `BackupData`, `format.ts`, `validation.ts`, `merge.ts`, l'aperçu et les tests JSON/gzip.

## 7. Décisions à prendre avant production

1. **Identité V2** : occurrence stable, version de contenu et règle de révision.
2. **Mémoire temporelle** : durée de conservation compatible avec l'orchestrateur, distincte de l'affichage des messages passés.
3. **Jour de présentation** : convention locale persistée et comportement lors d'un changement de fuseau.
4. **Politique B** : paramètres expérimentaux à figer et traitement d'une suppression ou d'une restauration des preuves sources.
5. **Catalogue** : correspondance précise entre les sept objectifs de production et les entrées du prototype.
6. **Bascule** : critères permettant de comparer V1/V2 sans afficher deux ensembles ni écrire des suggestions fantômes.
7. **Sauvegarde** : numéro de format et politique de conflit entre une occurrence V1 et V2.

## 8. Plan d'intégration par petites étapes

### Étape 1 — Adaptateur d'observations en lecture seule

Déplacer les types et fonctions B 2G hors de `simulation/` sans changer `proposeSuggestions()`. Construire les observations depuis `RunningSession` et `StoredSuggestion`, calculer V1 et V2 en parallèle uniquement dans les tests et le diagnostic de développement.

Tests : V1 inchangé ; associations fiables, ambiguës et orphelines ; contribution bornée ; expiration avec pratique associée ; suppression/restauration ; dates invalides ; absence de date d'import ; aucune écriture.

### Étape 2 — Contrat V2 en mémoire

Promouvoir le catalogue 3C en module pur de production, toujours derrière une entrée expérimentale et sans persistance. Ajouter un adaptateur d'affichage commun V1/V2.

Tests : sept objectifs ; données complètes/incomplètes ; durée et blocs ; terrain/intensité séparés ; aucune classification des imports ; rendu V1 inchangé.

### Étape 3 — Orchestration en lecture seule

Faire recevoir à l'orchestrateur les suggestions persistées et les activités dans un instantané cohérent. Conserver le résultat hors stockage et vérifier la stabilité face aux recalculs, onglets et changements de date.

Tests : consultations quotidiennes/irrégulières ; même jour ; activités réelles ; suggestions ignorées ; interruption/reprise ; zéro suggestion ; réponses asynchrones obsolètes ; aucune dette.

### Étape 4 — Identité et persistance V2

Après décision sur l'identité, étendre `StoredSuggestion` par union versionnée, enregistrer `presentedOn` et la révision de contenu seulement après visibilité. Préserver tous les enregistrements V1.

Tests : StrictMode ; fermeture/réouverture ; même occurrence et contenu révisé ; remplacement explicite ; concurrence inter-onglets ; V1 non modifié ; expiration et nettoyage.

### Étape 5 — Sauvegardes compatibles

Ajouter le nouveau format, puis adapter export, aperçu, validation, fusion et remplacement sans changer les documents signés avant vérification SHA-256.

Tests : formats 1 à 5 ; nouveau format JSON/gzip ; V1/V2 mélangés ; corruption ; conflits ; atomicité ; associations conservées.

### Étape 6 — Bascule contrôlée

Comparer les décisions V1/V2 sur données synthétiques, activer V2 derrière une option de développement, puis retirer le double calcul seulement après validation longitudinale. Les suggestions V1 déjà présentées restent affichables jusqu'à leur expiration.

Tests : non-régression du Coach, ancien planning, messages passés, actualisation inter-onglets, import/restauration, build de production sans diagnostic et parcours navigateur ciblés.

## Conclusion

La première intégration ne doit concerner ni l'interface ni le stockage. L'adaptateur d'observations B 2G en lecture seule est le point de départ le moins risqué : il utilise les données déjà présentes, rend les provenances et ambiguïtés explicites et permet de comparer les références avant toute modification des suggestions persistées. Le contrat enrichi, l'identité stable et la mémoire temporelle doivent être décidés avant le raccordement de 3C et 3F.
