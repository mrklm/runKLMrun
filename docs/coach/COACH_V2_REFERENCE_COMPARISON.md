# Coach V2 — comparaison de la référence habituelle

Phase 4B, 18 octobre 2026. Le calcul B 2G est intégré en lecture seule. Son résultat ne modifie ni les suggestions V1, ni l'interface, ni le stockage.

## Données réellement accessibles

Le comparateur utilise uniquement :

- les résumés `RunningSession` : identifiant, date civile, durée, sport et éventuel `startTime` ;
- les `StoredSuggestion` encore présentes : jour suggéré, contenu V1, état, révision et éventuel `activityId` ;
- la date de référence explicitement fournie ;
- la politique V1 pour calculer sa référence avec `proposalEvidence()`.

Il ne dispose pas de date d'import, de fatigue, d'intention du coureur ou de type fiable de séance réalisée. Une association par date ne transfère jamais le type de la suggestion à l'activité.

## Adaptateur conservateur

`adaptReferenceObservations()` classe les faits ainsi :

| Situation | Observation B 2G |
|---|---|
| Association unique et cohérente | `suggestion-linked` ; continuité possible, sans preuve suffisante pour créer seule une référence |
| Plusieurs activités ou suggestions le même jour | Écartée : `ambiguous-association` |
| Aucune suggestion le même jour, encore dans la période où elle serait conservée | `independent-unknown` ; activité réelle indépendante du contenu des suggestions connues |
| Activité plus ancienne sans suggestion conservée | Écartée : `association-unknown` |
| Date, sport, horaire ou durée incohérents | Écartée avec un motif explicite |
| Suggestion sans activité | Aucune observation d'activité ; elle reste une suggestion ignorée ou non rapprochée, jamais une réalisation |

La limite temporelle utilise la règle de conservation existante des suggestions. Après cette limite, l'absence d'enregistrement ne prouve pas qu'aucune suggestion n'avait été présentée.

La politique B est ensuite appliquée aux observations admissibles : les associations fiables contribuent de façon bornée entre preuves indépendantes. `habitualReferenceValidityV2()` distingue référence révisable, conservée, insuffisante et expirée, avec `currentCapacityProven: false` dans tous les cas.

## Comparaison V1/V2 observée dans les tests

| Scénario synthétique | V1 | B 2G | Explication |
|---|---|---|---|
| Historique vide | Indisponible | Indisponible | Aucune preuve |
| Deux courses récentes | Médiane descriptive calculable | Indisponible | Moins de quatre confirmations B 2G |
| Quatre courses indépendantes récentes de 40 min | 40 min | 40 min | Preuves cohérentes et encore qualifiables |
| Quatre courses toutes associées | 40 min | Indisponible | Une association ne suffit pas à établir seule la référence initiale |
| Suggestion présentée sans course | Indisponible | Indisponible | Aucune activité inventée |
| Association ambiguë | Les séances restent visibles pour V1 | Indisponible | B 2G écarte les associations non certaines |
| Quatre confirmations durables à 45 min après une base de 40 min | 45 min sur la fenêtre récente | Révisée à 45 min | Progression issue uniquement des activités enregistrées |
| Quatre confirmations durables à 35 min après une base de 40 min | 35 min sur la fenêtre récente | Révisée à 35 min | Réduction observée, sans décote récursive |
| Courses vieilles de plus de 42 jours sans association conservée | Indisponible | Indisponible | Leur indépendance historique n'est plus démontrable |

Le test de non-régression calcule les suggestions V1 avant et après la comparaison et vérifie leur égalité structurelle. Le comparateur ne modifie pas non plus ses entrées.

## Limites

- La conservation courte des suggestions réduit fortement la profondeur historique dont l'indépendance peut être prouvée.
- Sans référence persistée ni preuve historique d'indépendance, une interruption ancienne apparaît souvent comme `insufficient` plutôt que comme `expired-inactivity`.
- Un coureur dont toutes les activités récentes sont associées peut entretenir une référence déjà établie, mais les seules données actuelles ne permettent pas toujours de reconstruire cette référence initiale.
- La politique bornée reste expérimentale ; ses paramètres ne sont pas des constantes scientifiques.
- Les activités importées tardivement ne peuvent pas être reconnues comme telles, car leur date d'import n'est pas enregistrée.
- Aucun diagnostic n'est affiché dans l'interface et aucune lecture IndexedDB supplémentaire n'est raccordée au Coach actuel à cette étape.

## Décisions restantes

1. Définir comment conserver la provenance minimale nécessaire au-delà de l'expiration des cartes, sans conserver indéfiniment leur contenu.
2. Décider si une référence V2 dérivée doit rester entièrement recalculée ou disposer d'un instantané versionné avec ses identifiants sources.
3. Valider les quatre confirmations, les cinq minutes de différence significative et les 42 jours comme paramètres produit expérimentaux.
4. Définir le traitement d'une suppression ou restauration des séances sources.
5. Étudier séparément une date d'enregistrement pour les nouveaux imports, sans compléter rétroactivement les anciennes données.

La prochaine étape recommandée est d'exécuter ce comparateur dans un diagnostic de développement à partir d'un instantané transactionnel cohérent, toujours sans influencer les suggestions V1. Cette étape doit précéder toute bascule de durée ou persistance d'une référence V2.
