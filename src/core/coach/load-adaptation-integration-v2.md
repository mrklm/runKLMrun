# Intégration D2b-2

## Chemin de calcul

`adaptCoachV2Readonly` construit les preuves D1 une fois. Pour chaque date
examinée, il calcule D2a puis D2b-1 une seule fois, avec la référence habituelle
valable à cette date. La référence de consultation est réutilisée pour ce jour.
Les décisions restent en mémoire dans `loadPoliciesByDate`, sans persistance.
Le catalogue et ses règles de construction ne changent pas.

`applyLoadAdaptationV2` applique la politique aux candidats qui ont déjà passé
les filtres sportifs. Ce petit filtre est commun à l'orchestrateur et au groupe
de candidats admissibles utilisé pour la réutilisation.

- `defer` retire les candidats de la portée concernée.
- `review` privilégie une option facile admissible lorsqu'elle existe.
- `recovery` applique la même préférence facile.
- `baseline-only` conserve les filtres et le classement existants.
- `do-not-increase` retire les variantes d'endurance facile plus longues que la
  référence utilisée pour le catalogue, sans inventer une durée de remplacement.

Sans option facile, une préférence seule n'ajoute pas d'interdiction : les
protections existantes restent décisives. `very-hard` interdit bien l'exigeant
même dans ce cas. Les délais 2/7/10/14 ne sont pas modifiés ni paramétrables par
les indicateurs de charge. L'orchestrateur refuse une politique d'une autre date.

## Occurrences et présentation

L'admissibilité d'une date est filtrée sur **le groupe complet**. Appliquer la
préférence à chaque exigeant isolé permettrait à tort de conclure qu'aucune
alternative facile n'existe. `admissibleCoachV2Content` fournit ensuite le même
contrôle à la réutilisation, aux perspectives et à la mémorisation.

Une occurrence exigeante incompatible n'est plus retenue comme conseil actuel.
Son contenu, son état, sa révision et ses associations restent conservés.
La présentation d'une nouvelle sélection utilise les générations existantes ;
aucun remplacement destructif ni suppression automatique n'est ajouté.

La mémorisation relit l'instantané courant avant d'accepter le contenu proposé.
Un calcul périmé incompatible est rejeté par `CoachV2SelectionChanged` puis
recalculé à l'écran. La transaction existante vérifie toujours que cet instantané
n'a pas changé pendant la préparation. Schéma et formats IndexedDB inchangés.

La projection utilise un instantané commun pour le calcul et la réutilisation.
Le bloc Coach et le calendrier se rafraîchissent après changement des activités,
ressentis, configuration ou occurrences. Après mémorisation, le bloc relit la
projection au lieu d'associer une occurrence récente à d'anciennes perspectives.

## Perspectives

Chaque perspective utilise la politique de sa propre date, avec uniquement les
activités réelles comme preuves. Les intentions conservent leur rôle antérieur
d'espacement et de variété. Une ancienne occurrence fournie directement aux
perspectives est écartée si elle n'est plus active ou admissible.

## Comparaisons attendues avant/après

| Scénario | Avant | D2b-2 |
| --- | --- | --- |
| Accumulation sur trois jours avec indices concordants | Le tempérament pouvait choisir le fractionné | Facile privilégié |
| Hausse isolée, bilan complet, sans second indice | Classement habituel | Même choix, même catalogue |
| Fractionné partiel déclaré | Activité et délai structuré déjà considérés | Mesures réelles transmises ; 14 jours conservés |
| Ancienne exigeante active après `hard` | Pouvait primer sur le nouveau classement facile | Écartée de la présentation actuelle, historique intact |
| Ancienne facile encore compatible | Réutilisée | Réutilisée |
| Activité sans bilan | Option exigeante parfois retenue | Réévaluation, facile si disponible |
| Historique sans référence exploitable | Pas de candidat hors amorçage existant | Inchangé |
| Fin de fenêtre de concentration | Pas de politique de charge | Réévaluation à la date suivante, sans récupération fictive |
| Fin des sept jours d'un ressenti | Protection expirée | Protection expirée ; les autres incertitudes peuvent encore favoriser le facile |

Les tests D1 restent isolés de la nouvelle politique pour vérifier leur contrat
historique de transport. Les anciens tests de classement nécessitant une preuve
complète utilisent désormais types et ressentis explicites. Le test qui exigeait
la conservation d'une ancienne recommandation exigeante après `hard` vérifie
maintenant son exclusion sans réécriture.

## Validation et limites

Les comparaisons D2b-2 neutralisent uniquement le filtre nouvellement raccordé,
conservant les règles et classements sportifs historiques. Elles couvrent les
trois tempéraments, l'accumulation, les hausses isolées, les réalisations
partielles, les bilans absents, les frontières civiles, les perspectives et les
occurrences actives. Les tests de persistance utilisent `fake-indexeddb` avec
noms uniques ; le test navigateur utilise un contexte neuf et bloque tout accès
à `runklmrun` via le garde existant.

Les limites D1/D2a/D2b-1 subsistent : dates civiles plutôt qu'heures, couverture
des imports inconnue, absence de reconnaissance du type à partir des mesures,
doublons sous identifiants distincts non fusionnés. Une réévaluation ne fournit
pas de date certaine de récupération. L'absence d'activité ou de bilan récent
peut donc maintenir une préférence facile après expiration d'un délai sportif,
sans prolonger ce délai.

## Fichiers concernés par D2b-2

Production :

- `src/core/coach/load-adaptation-selection-v2.ts` (ajout du filtre commun).
- `src/core/coach/application-adapter-v2.ts` (calcul par date et cache en mémoire).
- `src/core/coach/simulation/session-orchestrator-v2.ts` (application avant classement).
- `src/core/coach/presentation-identity-v2.ts` (compatibilité commune).
- `src/core/coach/perspectives-v2.ts` (politique par date et contrôle de l'ancre).
- `src/storage/coach-suggestions-v2.ts` (rejet d'une sélection périmée ; aucun schéma modifié).
- `src/components/coach-v2-projection.ts` (instantané cohérent).
- `src/components/CoachV2Experimental.tsx` (invalidation après bilan et relecture après présentation).
- `src/components/MonthCalendar.tsx` (invalidation des perspectives affichées).
- `src/core/coach/recent-load-v2.ts` et `load-adaptation-policy-v2.ts` : commentaires de raccordement uniquement, calculs inchangés.

Tests :

- Ajouts : `src/core/coach/load-adaptation-integration-v2.test.ts` (29 cas),
  `e2e/coach-v2-load.spec.ts` (un scénario navigateur).
- Adaptations : `src/core/coach/activity-evidence-v2.test.ts`,
  `application-adapter-v2.test.ts`, `presentation-identity-v2.test.ts`,
  `perspectives-v2.test.ts`, `src/components/coach-v2-display.test.ts`,
  `e2e/coach-v2-internal.spec.ts`.
- `src/core/coach/load-adaptation-policy-v2.test.ts` : intitulé de groupe clarifié,
  le test vérifie toujours l'absence d'effet de bord d'un appel isolé.

Documentation : ce fichier ajouté ; renvoi depuis `recent-load-v2.md` et
`load-adaptation-policy-v2.md`, dont les contrats historiques sont conservés.

## Résultats de vérification

- Exécution ciblée : 311 tests réussis ; les derniers ajustements et le cas
  supplémentaire `not-completed` sont également couverts par la suite finale.
- `npm test` final : 1 514 tests réussis, un test volumineux ignoré par configuration.
- `npx tsc -b` : réussi.
- `npx playwright test e2e/coach-v2-load.spec.ts e2e/coach-v2-internal.spec.ts` :
  dix tests réussis, avec garde interdisant l'ouverture et la suppression de la
  base historique. Serveur local et contextes Chromium isolés seulement.
- `npm run build` : réussi ; avertissement Vite sur un bundle dépassant 500 ko.
- `git diff --check` : réussi.

Aucun changement de version, changelog, formulaire, schéma IndexedDB ou format
de sauvegarde. Aucune opération Git d'écriture. Les modifications préexistantes
hors de cette étape sont conservées.
