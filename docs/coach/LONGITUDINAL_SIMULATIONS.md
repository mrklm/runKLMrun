# Simulation longitudinale du moteur actuel — phase 2A

Exécution du 17 octobre 2026, application 0.7.0. Données intégralement synthétiques. Aucun changement des règles de production, de l'interface, du stockage, des sauvegardes ou de la version. La phase 2B n'est pas commencée.

## Méthode

Le banc [longitudinal.ts](../../src/core/coach/simulation/longitudinal.ts) appelle directement `proposeSuggestions()` et `productPolicy()`. Il ne recopie ni les coefficients, ni les fenêtres de référence, ni les règles de calendrier, de budget ou de terrain. Les diagnostics complets de chacun des 84 jours sont accessibles dans le résultat `trace` de `simulate()`.

La période couvre **du 5 janvier au 29 mars 2026**, soit douze semaines lundi–dimanche. Une consultation initiale le 4 janvier permet de présenter les premières suggestions avant le début de la période. Toutes les dates sont fixes et civiles ; les calculs de déplacement de date utilisent UTC sans dépendre du fuseau de la machine.

Chaque jour :

1. Retrouver les suggestions déjà présentées, encore courantes et prévues pour ce jour. Une idée remplacée n'est pas exécutée comme si elle était toujours courante.
2. Réaliser ou non ces suggestions selon le scénario, puis ajouter éventuellement une sortie indépendante.
3. Ajouter les activités aux résumés en mémoire et appliquer le rapprochement factuel.
4. Recalculer avec le moteur réel, simuler la consultation de l'ensemble des cartes et appliquer leurs règles d'identité et de remplacement.
5. Réappliquer le rapprochement après présentation ; relever calculs, activités et compteurs.

La consultation est quotidienne, après les sorties du jour. Le banc ne fige pas un programme hebdomadaire : cela ne correspondrait pas au recalcul de l'application. Il ne transforme pas une suggestion calculée en activité avant sa date.

### Présentation et rapprochement

L'adaptateur mémoire réutilise `suggestionId()`, `suggestionExpiry()`, `validateStoredSuggestion()`, `replacementCandidates()` et surtout **`suggestionAssociations()`**, la fonction réellement appelée par le repository. Les associations ne dépendent pas de la durée. Plusieurs activités ou identités de suggestion le même jour restent ambiguës, y compris lorsqu'une identité précédente est obsolète. Les liens devenus contradictoires sont retirés.

Le banc suppose explicitement que toutes les cartes de chaque ensemble sont consultées. Il ne simule ni IntersectionObserver, ni les transactions/revisions concurrentes inter-onglets. Les fonctions transactionnelles ne sont pas directement employées : elles ouvriraient IndexedDB, contrairement au périmètre de cette simulation. Leur partie pure est réutilisée et les transitions mémoire sont explicites. Aucun planning historique initial n'est fourni ; ce cas reste une extension à étudier.

Les identités existantes ne sont pas réactivées ou écrasées. Les révisions augmentent uniquement lors d'un changement de lien ou d'état. Les enregistrements expirés restent dans l'archive mémoire, comme dans le chemin actuel sans appel automatique de `deleteExpired()` ; ils ne sont plus candidats à une réalisation future. Le rapprochement reçoit l'ensemble des enregistrements comme le repository actuel.

## Profils et comportements

Tous les profils déclarent sept jours possibles, **pas sept séances souhaitées**, un plafond de 60 minutes et une préférence chemins. Le consentement est explicite. L'expérience déclarée est débutante pour `begin`, expérimentée pour les autres ; elle n'est pas utilisée comme preuve de capacité. Aucun ressenti, allure, FC ou distance réalisée n'est inventé.

Les historiques récents couvrent six semaines, avec une alternance de durées **35 / 40 / 45 / 38 minutes**. Deux sorties hebdomadaires sont placées mardi/samedi ; trois sorties lundi/mercredi/samedi. Les souhaits de fréquence correspondent respectivement à deux ou trois séances. Les dates anciennes sont décalées intégralement, sans modifier leurs durées.

| Identifiant | Profil | Historique initial | Objectif |
|---|---|---|---|
| begin | Débutant | Aucun ; souhait de deux sorties/semaine | Débuter |
| regular2 | Régulier deux fois/semaine | 12 sorties sur six semaines | Endurance |
| regular3 | Régulier trois fois/semaine | 18 sorties sur six semaines | Endurance |
| old | Expérimenté avec historique ancien | Historique trois fois/semaine décalé de 210 jours | Endurance |
| return | Reprise après plusieurs mois | Historique deux fois/semaine décalé de 120 jours | Reprendre |
| endurance | Objectif endurance | Même historique que regular3 | Endurance |
| speed | Objectif vitesse | Même historique que regular3 | Vitesse |
| distance | Objectif distance | Même historique que regular3 | 10 km, sans échéance |
| race | Préparation de course | Même historique que regular3 | 10 km le 13 avril 2026, sans chrono |

Les quatre derniers profils ont volontairement des données identiques : leurs différences ne peuvent ainsi pas être attribuées à des historiques différents. `regular3` constitue également un témoin identique.

- **all** : réaliser toutes les suggestions courantes arrivant à leur date, à la durée indiquée.
- **alternate** : réaliser une suggestion sur deux parmi celles arrivant à leur date, en commençant par la première ; compteur continu sur les douze semaines, pas remis à zéro chaque semaine.
- **none** : aucune suggestion réalisée et aucune activité autonome enregistrée. Cela ne prétend pas représenter tous les coureurs qui ignorent les suggestions.
- **personal** : réaliser toutes les suggestions courantes **et** ajouter chaque dimanche une sortie indépendante de 35, 45 puis 40 minutes en cycle. Si une suggestion tombe aussi le dimanche, deux activités sont conservées : aucune fusion artificielle.

## Résultats principaux réellement observés

### 1. Débuter et reprendre : réduction, refus, puis redécouverte

Pour `begin/all`, les durées réalisées sont 30/30 minutes en semaine 1, 15/15 en semaine 2, 10/5 en semaine 3, puis 5 minutes en semaine 4. Sur douze semaines : **17 sorties, 235 minutes et 50 jours sans nouvelle proposition**. La semaine 8 ne contient aucune sortie.

Pour `return/all` : 20/20, puis 10/10, puis 5/5 minutes ; **16 sorties, 165 minutes et 54 jours sans nouvelle proposition**. La semaine 10 ne contient aucune sortie.

Ces trajectoires montrent effectivement la boucle identifiée en phase 1 : les sorties réduites alimentent la médiane suivante, les objectifs débuter/reprendre conservent le coefficient prudent, puis la durée passe sous le minimum. Après vieillissement des références, la branche découverte peut réapparaître : 30 minutes pour débuter, 20 pour reprendre. Ce n'est donc pas uniquement une décroissance régulière : **des oscillations entre réduction, refus et découverte sont observées**.

Il s'agit d'un défaut de stabilité à examiner, pas d'une preuve de risque physiologique quantifié. Les retours à 30 ou 20 minutes ne démontrent aucune amélioration de capacité.

### 2. Réguliers : stabilisation, mais variation future non maintenue

`regular2/all` produit **21 sorties de 35 minutes, 735 minutes**. `regular3/all` produit **28 sorties de 35 minutes, 980 minutes**, soit 2,33 sorties par semaine en moyenne au lieu des trois du profil initial. Aucun jour de calcul sans proposition dans ces deux cas.

Avec consultation quotidienne et réalisation de toutes les suggestions courantes, les sorties effectivement arrivées à leur date restent toutes à 35 minutes dans ces profils. Les suggestions faciles plus courtes peuvent être remplacées lors du recalcul et devenir la première suggestion de durée habituelle. **La variation d'un ensemble isolé n'est pas une garantie de variation des sorties réellement proposées au fil des jours.** Les nouvelles identités présentées, détaillées dans les tableaux, permettent de voir ce renouvellement.

Ce cas montre une stabilisation basse et un effet de fréquence, pas une diminution indéfinie des durées. Une durée stable n'est pas en elle-même un échec d'entraînement ; aucune adaptation physiologique n'est simulée.

### 3. Absence d'activité : comportements très différents selon l'objectif

Sans activité, `begin/none` et `return/none` présentent une nouvelle découverte pour le lendemain à chaque consultation : **84 suggestions arrivées à leur date**, toutes ignorées, sans activité créée. Le souhait de deux séances par semaine ne constitue pas un quota de suggestions passées : sans réalisation récente, le calendrier continue de glisser.

Pour `regular3/none`, quatre suggestions arrivent encore à leur date, puis les références cessent de permettre de nouvelles propositions : **82 jours de calcul sans proposition future**. Un jour sans nouvelle proposition peut néanmoins comporter une ancienne suggestion déjà présentée et non rendue obsolète par un ensemble vide. Il ne faut donc pas confondre « absence de nouveau résultat » et « aucune suggestion mémorisée ce jour ».

Pour `old/all`, aucune sortie ni suggestion n'apparaît : **84 jours sans proposition**. L'expérience déclarée ne débloque pas artificiellement les références anciennes. Dans `old/personal`, les sorties autonomes reconstruisent progressivement des références : neuf suggestions arrivent à leur date et 840 minutes sont réalisées au total, apports personnels compris.

### 4. Objectifs : aucune différence de trajectoire dans le témoin contrôlé

Les résultats hebdomadaires d'endurance, vitesse, distance et course sont **strictement identiques pour chacun des quatre comportements**, assertion vérifiée automatiquement. L'échéance de course est après la simulation : son effet d'arrêt n'est pas testé ici. Il serait incorrect d'étendre cette égalité à toutes les configurations possibles.

Toutes les intensités proposées sont `easy`. **Zéro suggestion exigeante** est observée ; l'intensité réellement vécue n'est pas connue. Le banc ne fabrique ni charge cardio, ni fatigue, ni progression physiologique.

### 5. Rapprochement : réalisation simulée et association ne sont pas synonymes

Pour `regular3/all`, 28 sorties sont réalisées mais seulement **deux associations finales** subsistent. Le renouvellement d'identités à une même date crée des ambiguïtés conservées volontairement par le moteur de rapprochement. Le banc ne les résout pas à partir de sa connaissance du scénario.

Les sorties personnelles peuvent elles aussi créer deux activités le même jour. Ces absences d'association sont cohérentes avec la règle conservatrice actuelle ; elles ne signifient pas que les sorties n'ont pas été effectuées. Elles justifient une analyse ultérieure des interactions entre renouvellement et rapprochement, sans modifier cette règle dans cette phase.

## Risques théoriques et hypothèses non vérifiées

- Les oscillations et la stabilisation décrites ci-dessus sont **observées dans ces fixtures**, pas simplement supposées.
- Une hausse dangereuse du volume, une blessure ou un surentraînement ne sont **pas démontrés**. Aucun modèle physiologique n'est présent. Les plafonds du moteur sont testés, mais ce ne sont pas des seuils médicaux.
- La disparition de la variété est dépendante de la consultation quotidienne et du remplacement ; son ampleur avec consultations rares, cartes partiellement visibles ou sorties de durées différentes reste à mesurer.
- Les interruptions plus longues, données incomplètes, planning historique occupé, échéances au milieu du suivi, annulations et concurrence transactionnelle ne font pas partie des 36 trajectoires. Ils restent couverts seulement selon le périmètre des tests unitaires existants, ou nécessitent de futurs scénarios.
- Le scénario personnel ajoute une sortie à toutes les suggestions ; il ne représente pas le cas « uniquement des sorties autonomes ». Les stratégies de sélection préférentielle des sorties courtes/longues restent à simuler.
- Les activités réalisées suivent exactement les durées proposées dans A/B ; ce choix permet d'isoler la rétroaction mais ne représente pas toute la diversité humaine.

## Reproduction et validation

Depuis la racine du dépôt :

```sh
npm test -- src/core/coach/simulation/longitudinal.test.ts src/core/coach/suggestion-set.test.ts src/core/coach/proposals.test.ts src/core/coach/proposal-presentation.test.ts
npm run build
```

Pour régénérer uniquement les tableaux dans un fichier temporaire, sans toucher à la documentation ou aux données :

```sh
COACH_SIMULATION_REPORT=/tmp/coach-simulation-results.md npm test -- src/core/coach/simulation/longitudinal.test.ts
```

Sans cette variable, les tests n'écrivent aucun rapport. La sortie est déterministe ; aucune date système, aucun réseau et aucune ouverture IndexedDB ne sont nécessaires au banc. Le setup global de Vitest installe son environnement factice habituel, mais le banc n'en ouvre aucune base.

Validation : **81 tests ciblés réussis**, dont neuf tests du banc (matrice complète, déterminisme, absence d'écriture, invariants, apports autonomes, rapprochement prudent, égalité contrôlée des objectifs, trajectoires observées et rapport). Les tests figent les constats actuels sans les déclarer souhaitables : une future correction devra actualiser explicitement ces attentes.

`npm run build` réussit, vérification TypeScript incluse. `git diff --check` ne signale aucune erreur ; les nouveaux fichiers non suivis ont également été contrôlés pour les espaces finaux. Aucun fichier de production existant n’a été modifié.

Les tableaux suivants sont issus du banc, sans modification manuelle des valeurs. Les identités nouvellement présentées pendant la semaine peuvent concerner la semaine suivante ; inversement, celles arrivant à leur date peuvent avoir été présentées la semaine précédente ou lors de la consultation initiale. Leurs totaux ne doivent pas être additionnés comme du volume à courir.

## Phase 2C — prototype de référence habituelle V2

Le prototype est isolé dans [habitual-reference-v2.ts](../../src/core/coach/simulation/habitual-reference-v2.ts). Il ne modifie pas `proposeSuggestions()`. Les scénarios comparent la référence V1 calculée par `proposalEvidence()` et la première suggestion réelle de production à une référence V2 et une projection de suggestion limitée à cette référence. Cette projection V2 n'est pas encore une stratégie complète : elle sert uniquement à tester la stabilité du repère de durée.

### Paramètres expérimentaux

| Paramètre | Valeur testée | Rôle et limite |
|---|---:|---|
| Observations concordantes | 4 | Quatre séances marquées comme habituelles, sur quatre semaines, sont nécessaires pour réviser le repère. Choix expérimental, sans validation scientifique revendiquée. |
| Écart significatif | 5 min | Une observation doit se situer au moins cinq minutes au-dessus ou au-dessous du repère. Ce seuil correspond au pas d'affichage testé, pas à un seuil physiologique. |
| Expiration | 42 jours | Sans nouvelle preuve habituelle, la référence devient indisponible. Borne produit expérimentale à soumettre à une analyse de sensibilité. |
| Arrondi de projection | 5 min vers le bas | Permet la comparaison avec l'affichage actuel. Il crée des effets de seuil et ne constitue pas une dose recommandée. |

Les séances faciles courtes restent présentes dans l'historique et le volume, mais ne créent ni ne révisent directement la référence habituelle. Leur rôle est connu parce qu'il est fourni par la fixture synthétique. Le prototype ne tente pas de déduire ce rôle d'une association réelle : le rapprochement par date ne prouve pas l'intention de la sortie.

Chaque scénario commence avec quatre sorties habituelles de 40 minutes. Pendant douze semaines, une sortie facile de 30 minutes et une sortie habituelle sont enregistrées chaque semaine. La sortie habituelle reste à 40 minutes, passe durablement à 45 minutes, ou passe durablement à 30 minutes selon le scénario. Les deux versions reçoivent exactement les mêmes activités.

### Pratique stable

| Semaine | Référence V1 | Suggestion V1 | Référence V2 | Suggestion V2 | État V2 |
|---:|---:|---:|---:|---:|---|
| 1 | 40 | 40 | 40 | 40 | stable |
| 2 | 40 | 40 | 40 | 40 | stable |
| 3 | 40 | 40 | 40 | 40 | stable |
| 4 | 35 | 35 | 40 | 40 | stable |
| 5 | 35 | 35 | 40 | 40 | stable |
| 6 | 35 | 35 | 40 | 40 | stable |
| 7 | 35 | 35 | 40 | 40 | stable |
| 8 | 35 | 35 | 40 | 40 | stable |
| 9 | 35 | 35 | 40 | 40 | stable |
| 10 | 35 | 35 | 40 | 40 | stable |
| 11 | 35 | 35 | 40 | 40 | stable |
| 12 | 35 | 35 | 40 | 40 | stable |

**Observé :** V1 mélange les séances faciles de 30 minutes et habituelles de 40 minutes dans sa fenêtre mobile ; sa médiane puis sa suggestion passent à 35 minutes. V2 conserve 40 minutes parce que les preuves habituelles restent à 40. Cela évite la baisse liée aux seules séances faciles. Ce scénario ne démontre pas que 40 minutes serait toujours la bonne prescription.

### Progression durable

| Semaine | Référence V1 | Suggestion V1 | Référence V2 | Suggestion V2 | État V2 |
|---:|---:|---:|---:|---:|---|
| 1–3 | 40 | 40 | 40 | 40 | stable |
| 4 | 35 | 35 | 40 | 40 | stable |
| 5 | 35 | 35 | 40 | 40 | stable |
| 6–7 | 37,5 | 35 | 40 | 40 | stable |
| 8–12 | 37,5 | 35 | 45 | 45 | revised |

**Observé :** les sorties habituelles passent à 45 minutes à partir de la semaine 5. V2 attend la quatrième preuve concordante et révise le repère en semaine 8. V1 réagit plus tôt à la distribution mixte, mais sa référence de 37,5 minutes est arrondie vers le bas : sa suggestion reste à 35 minutes. Le seuil V2 produit volontairement un palier, puis un changement de 40 à 45 ; il ne modélise pas une progression intermédiaire.

### Réduction durable

| Semaine | Référence V1 | Suggestion V1 | Référence V2 | Suggestion V2 | État V2 |
|---:|---:|---:|---:|---:|---|
| 1–3 | 40 | 40 | 40 | 40 | stable |
| 4 | 35 | 35 | 40 | 40 | stable |
| 5–7 | 30 | 30 | 40 | 40 | stable |
| 8–12 | 30 | 30 | 30 | 30 | revised |

**Observé :** V2 ne fige pas l'ancien repère : quatre sorties habituelles de 30 minutes le font passer à 30 en semaine 8. V1 atteint 30 dès la semaine 5. Pendant trois semaines, V2 conserve donc une référence supérieure à la pratique habituelle synthétique ; une future stratégie ne devra pas transformer automatiquement cette référence en séance obligatoire ou en preuve de capacité.

### Effets de seuil et limites

- Quatre observations et cinq minutes sont des choix expérimentaux. À trois observations, la référence ne bouge pas ; à la quatrième, elle change en une fois. Une variation de 4 min 59 s ne démarre aucune confirmation.
- Une observation revenue près de la référence remet la série de confirmation à zéro. Une alternance durable autour du seuil pourrait retarder indéfiniment une révision pertinente.
- La médiane des quatre preuves limite l'effet d'une valeur isolée, mais quatre valeurs biaisées restent suffisantes. Aucun contrôle de dispersion supplémentaire n'est appliqué dans ce premier prototype.
- Le rôle `habitual` est fourni par le scénario. Les données de production ne permettent pas encore de savoir avec certitude si une activité associée était volontairement facile, habituelle ou différente de la suggestion.
- La suggestion V2 est seulement le repère arrondi et plafonné implicitement par la fixture ; disponibilités, volume, fréquence, terrain, interruption et stabilité d'identité ne sont pas recomposés par ce prototype.
- L'expiration est testée unitairement mais n'intervient pas dans ces trajectoires hebdomadaires. Les imports tardifs, suppressions, activités multiples un même jour et changements d'objectif restent à simuler.
- Les résultats démontrent des propriétés algorithmiques sur données synthétiques, pas une efficacité d'entraînement ou une sécurité physiologique.

### Validation 2C

Le fichier [habitual-reference-v2.test.ts](../../src/core/coach/simulation/habitual-reference-v2.test.ts) vérifie les trois trajectoires, l'absence de baisse dans le cas stable, les révisions vers le haut et vers le bas, l'ignorance d'une variation isolée, l'expiration, la validation des identifiants et le paramétrage exact. Il génère les tableaux uniquement si `COACH_V2_REFERENCE_REPORT` est fourni.

Commande ciblée exécutée :

```sh
COACH_V2_REFERENCE_REPORT=/tmp/coach-v2-reference.md rtk test npm test -- src/core/coach/simulation/habitual-reference-v2.test.ts src/core/coach/simulation/longitudinal.test.ts
```

Résultat : **2 fichiers et 15 tests réussis**. La suite complète n'a pas été lancée.

## Phase 2D — analyse de sensibilité du prototype V2

Les scénarios restent synthétiques et isolés du moteur de production. Ils évaluent les paramètres du prototype, pas une réponse physiologique. Une « expiration » signifie uniquement que les preuves sont trop anciennes pour alimenter une nouvelle suggestion ; elle ne signifie ni perte de capacité ni désentraînement.

### Confirmations et fréquence

Toutes les observations de révision passent de 40 à 45 minutes. Le nombre de séances nécessaire est exactement le seuil configuré ; le délai civil varie avec la fréquence.

| Confirmations | Courses/semaine | Séances avant révision | Semaines avant révision |
|---:|---:|---:|---:|
| 3 | 1 | 3 | 3 |
| 3 | 2 | 3 | 2 |
| 3 | 4 | 3 | 1 |
| 4 | 1 | 4 | 4 |
| 4 | 2 | 4 | 2 |
| 4 | 4 | 4 | 1 |
| 5 | 1 | 5 | 5 |
| 5 | 2 | 5 | 3 |
| 5 | 4 | 5 | 2 |

**Effet de seuil observé :** trois confirmations réagissent en une semaine chez le profil à quatre sorties et peuvent être sensibles à une courte séquence. Cinq confirmations retardent une adaptation durable jusqu'à cinq semaines chez le profil à une sortie. Quatre confirmations offrent ici un compromis expérimental : quatre preuves sont toujours nécessaires, avec un délai d'une à quatre semaines. Ce résultat ne valide pas quatre comme seuil scientifique.

### Interruption, ancienneté et reprise

Avec la borne de 42 jours et une dernière preuve la veille du début, la référence de 40 minutes reste descriptive pendant six semaines complètes puis devient indisponible en semaine 7. Après huit semaines sans course, une sortie de reprise ne réactive plus l'ancien épisode : les semaines 9 à 11 sont `insufficient`, puis quatre nouvelles sorties de 35 minutes établissent un nouveau repère de 35 en semaine 12.

| Semaine | État | Référence |
|---:|---|---:|
| 1–6 | stable | 40 min |
| 7–8 | expired | — |
| 9–11 | insufficient | — |
| 12 | stable, nouvel épisode | 35 min |

Le prototype 2C a été ajusté sur ce point : un écart entre deux preuves supérieur à la borne ouvre un nouvel épisode. Cette modification évite qu'une seule sortie de reprise rende immédiatement utilisable une ancienne référence.

| Expiration expérimentale | Première semaine expirée |
|---:|---:|
| 21 jours | 4 |
| 42 jours | 7 |
| 56 jours | 9 |
| 365 jours | Au-delà de S12 |

Une borne temporelle est nécessaire si l'on veut empêcher une ancienne référence d'être utilisable indéfiniment. Les résultats montrent seulement les conséquences calendaires : 21 jours est très réactif, 56 jours conserve le repère deux semaines de plus que 42, et 365 jours neutralise pratiquement cette protection sur l'horizon testé. Ils ne permettent pas de déduire la capacité physique réelle après une interruption.

### Alternance facile et longue

Chaque semaine comporte une séance facile de 30 minutes, explicitement marquée comme telle dans la fixture, et une séance habituelle longue de 45 minutes. La référence reste à 40 pendant trois semaines, passe une seule fois à 45 à la quatrième preuve longue, puis reste à 45 jusqu'à la semaine 12. Les séances faciles ne provoquent aucune révision descendante.

Un second scénario alterne des observations **habituelles** de 30 et 50 minutes. Chaque changement de direction remet la série de confirmation à zéro : aucune révision ni oscillation n'est produite, et la référence reste à 40. Ce comportement évite une oscillation artificielle, mais pourrait masquer une pratique réellement bimodale ; le prototype ne sait pas encore représenter deux repères habituels.

### Recommandation expérimentale

Conserver pour la prochaine comparaison **quatre confirmations**, **cinq minutes d'écart** et **42 jours d'expiration**, uniquement comme configuration témoin :

- quatre confirmations équilibrent mieux, dans ces fixtures, réactivité en nombre de preuves et délai des pratiques peu fréquentes ;
- cinq minutes restent cohérentes avec l'arrondi actuel mais créent un seuil net qu'il faudra tester autour de 4 min 59 s et 5 min ;
- 42 jours empêche la conservation indéfinie tout en laissant six semaines civiles complètes avant expiration dans le calendrier testé ;
- après expiration, reconstruire un épisode plutôt que réactiver l'ancienne référence avec une seule sortie.

Ces choix restent des hypothèses de conception. Avant raccordement, il faut comparer plusieurs distributions, un rythme irrégulier, les importations tardives et une analyse de sensibilité continue autour des seuils. Il faut également décider comment obtenir un rôle de séance fiable : la fixture connaît `easy-suggestion` et `habitual`, contrairement aux résumés réels.

### Validation 2D

[habitual-reference-v2-sensitivity.test.ts](../../src/core/coach/simulation/habitual-reference-v2-sensitivity.test.ts) couvre neuf combinaisons confirmations/fréquence, interruption, quatre semaines de reprise, quatre bornes d'ancienneté et deux alternances. La suite ciblée cumulée de la phase comporte **3 fichiers et 21 tests réussis** ; le test de sensibilité seul comporte **6 tests réussis**. Aucune suite complète n'a été lancée.

## Phase 2E — fiabilité du rôle des séances

Le rapprochement existant est volontairement factuel : une suggestion et une course ne sont associées que si chacune est unique pour la même date civile. La durée, la distance, l'intensité et le terrain ne participent pas à cette décision. Par conséquent, même une correspondance fiable ne prouve pas que le coureur a suivi le type de séance suggéré.

### Classification prudente proposée

| Situation observée | Classification du prototype | Usage pour la référence V2 |
|---|---|---|
| Une suggestion présentée et une course uniques le même jour | `reliable-suggestion-match` | Exclue : le lien est fiable, le rôle sportif ne l'est pas |
| Course un jour sans suggestion présentée | `independent-unknown` | Admise comme preuve de pratique réelle, sans la qualifier de facile ou longue |
| Plusieurs suggestions ou plusieurs courses le même jour | `ambiguous` | Exclue |
| Course importée après sa date, avec correspondance unique | Correspondance fiable, temporalité `late` | Exclue comme toute course liée à une suggestion |
| Course invalide ou non pertinente pour le rapprochement | `invalid` | Exclue |

Cette classification sépare deux questions : la **provenance** de la course et son **type sportif**. Le prototype connaît factuellement qu'une course est indépendante ou liée à une suggestion ; il ne déduit jamais son intensité à partir de sa durée. Une course indépendante reste donc de rôle sportif inconnu, même lorsqu'elle fournit une observation de durée de la pratique réelle.

### Effets observés sur la référence

| Scénario synthétique | Résultat |
|---|---|
| Quatre courses indépendantes de 40 min | Référence initiale de 40 min |
| Association unique, même jour, durée différente | Association reconnue, course exclue de la référence |
| Deux courses ou deux suggestions le même jour | Ambiguïté conservée, aucune preuve ajoutée |
| Import tardif d'une course associée | Temporalité tardive conservée, aucune requalification |
| Quatre courses indépendantes de 45 min, espacées irrégulièrement de 3 à 25 jours | Référence de 45 min tant qu'aucun intervalle ne dépasse les 42 jours expérimentaux |
| Référence de 40 min puis quatre courses ambiguës de 50 min | Référence maintenue à 40 min, aucune révision |

La référence peut donc être créée ou révisée sans rôle sportif connu uniquement à partir de courses **indépendantes**, réelles et répétées dans la même direction. Leur admission ne signifie pas « séance habituelle » au sens d'un type d'entraînement : elle constate une pratique. Les courses liées à une suggestion sont écartées afin d'éviter la rétroaction, et les cas ambigus sont écartés afin d'éviter une fausse certitude.

### Limites et recommandation

- Une course personnelle effectuée le jour d'une suggestion reste indiscernable d'une course inspirée par celle-ci ; le prototype l'exclut par prudence.
- Plusieurs courses le même jour rendent toutes les correspondances ambiguës, même si l'une paraît vraisemblable. Aucun arbitrage par durée n'est effectué.
- Une importation tardive ne pose pas de problème si les identités et la date civile restent stables, mais la date d'import n'existe pas dans le résumé de production : elle est fournie uniquement par la fixture.
- Une pratique irrégulière reste utilisable si les observations indépendantes sont cohérentes et séparées par moins que la borne expérimentale. La cohérence de durée ne révèle toujours pas le type des séances.
- L'exclusion de toutes les courses associées protège la référence, mais réduit les preuves disponibles chez un coureur qui suit souvent les suggestions.

Pour la suite, conserver cette classification comme politique témoin et ne transmettre aucun type depuis le rapprochement actuel. Avant une intégration de production, comparer deux options sur des simulations plus longues : conserver l'exclusion stricte, ou autoriser une contribution différée et bornée des courses associées sans leur attribuer de type. Cette seconde option nécessiterait une règle explicable et des preuves qu'elle ne recrée pas la rétroaction observée en V1.

### Validation 2E

`session-role-v2.test.ts` couvre l'association fiable, la course indépendante, l'ambiguïté, l'import tardif, la pratique irrégulière et la protection d'une référence existante. Les tests utilisent uniquement des données synthétiques et n'accèdent ni au stockage ni au moteur de production.

## Phase 2F — contribution des courses associées

Trois politiques reçoivent exactement les mêmes activités et suggestions synthétiques pendant douze semaines :

- **A — exclusion** : seules les courses indépendantes contribuent ;
- **B — contribution bornée** : au plus une course associée entre deux courses indépendantes peut contribuer. Les deux ancrages sont obligatoires et aucun type sportif n'est transféré ;
- **C — contribution complète** : toute association fiable contribue, comme témoin volontairement permissif.

La borne de B porte sur la provenance des preuves, pas sur leur durée. Elle n'ajoute donc aucun seuil présenté comme physiologique ou scientifiquement validé.

### Résultats comparatifs

« S » indique la première semaine de révision. Une absence en fin de simulation signifie que les dernières preuves admissibles ont dépassé l'expiration expérimentale de 42 jours ; elle ne signifie pas une perte de capacité.

| Scénario | A — exclusion | B — contribution bornée | C — contribution complète |
|---|---|---|---|
| Toutes les suggestions suivies, durée stable | — | — | 40 min, aucune révision |
| Suggestions partiellement suivies | 40 min, aucune révision | 40 min, aucune révision | 40 min, aucune révision |
| Progression réelle vers 45 min | 45 min, S4 | 45 min, S3 | 45 min, S2 |
| Réduction réelle vers 30 min | 30 min, S4 | 30 min, S3 | 30 min, S2 |
| Suggestions courtes : 30, puis 25, puis 20 min | — | — | 20 min, trois révisions dès S4 |
| Alternance indépendante 30 / 50 min | 40 min, aucune révision | 40 min, aucune révision | 40 min, aucune révision |
| Correspondances ambiguës | — | — | — |
| Imports tardifs associés, sans autre ancrage | — | — | 45 min, S4 |

### Comportements observés

- **C recrée la rétroaction recherchée** : les seules suggestions faciles successivement raccourcies font passer la référence de 40 à 30, puis 25 et 20 minutes. Une association fiable ne suffit donc pas à justifier une contribution complète.
- **A est la protection maximale**, mais un coureur dont toutes les activités sont associées perd son repère utilisable après 42 jours, même si sa pratique reste stable.
- **B ne laisse jamais les associations agir seules.** Dans les scénarios de progression et de réduction comportant aussi une course indépendante hebdomadaire, elle confirme le changement en semaine 3, contre S4 pour A et S2 pour C.
- L'alternance contradictoire ne déclenche aucune révision. Les ambiguïtés restent exclues dans les trois politiques.
- L'import tardif ne reçoit aucune date inventée. Sans date d'enregistrement disponible, seule la date civile de la course et l'association existante sont connues ; A et B l'écartent sans ancrage indépendant, tandis que C la traite entièrement.

### Recommandation expérimentale

Retenir **B comme candidate pour les simulations suivantes**, car elle préserve une adaptation réelle tout en empêchant les courses associées de déplacer seules la référence. Elle reste une hypothèse de conception : le choix « une association au maximum entre deux ancrages » n'est pas une recommandation scientifique.

Ne pas l'intégrer au moteur de production avant d'avoir résolu deux limites. Premièrement, B partage avec A la disparition du repère lorsqu'un coureur ne produit que des courses associées. Deuxièmement, une course indépendante placée après coup peut rendre admissible une association antérieure ; il faut décider si cette confirmation différée est souhaitable et stable face aux imports tardifs. En attendant cette décision, **A demeure la politique de production la plus prudente** et C doit être rejetée.

### Validation 2F

`association-policy-v2.test.ts` compare les trois politiques sur les huit scénarios, vérifie les semaines de réaction, la baisse récursive, les ambiguïtés et les imports tardifs. Les fixtures sont déterministes, locales et sans accès au stockage.

## Phase 2G — expiration de la référence habituelle

La politique B de 2F confondait deux absences : aucune course récente, et aucune **preuve révisable** récente. La variante 2G sépare désormais :

- la date des courses indépendantes, seules capables de créer ou réviser la durée de référence ;
- la date des courses associées fiables, capables uniquement d'attester une continuité de pratique ;
- la valeur historique du repère, qui reste descriptive et ne prouve jamais une capacité physique actuelle.

Une chaîne de courses associées maintient la validité si aucun intervalle civil ne dépasse les 42 jours expérimentaux. Elle ne participe ni à la médiane ni aux confirmations de révision. Après une rupture supérieure à cette borne, une activité associée isolée ne réactive pas l'ancien repère.

### Résultats avant et après

| Scénario sur douze semaines | Politique B 2F | Politique B 2G |
|---|---|---|
| Aucune course pendant 42 jours révolus | Valide à J42, expirée à J43 | Identique |
| Courses associées chaque semaine | Référence expirée | 40 min conservée, aucune révision |
| Courses associées irrégulières, intervalles de 25 à 35 jours | Référence expirée | 40 min conservée, aucune révision |
| Intervalle réel supérieur à 42 jours, puis reprise associée | Référence expirée | Données insuffisantes ; ancienne référence non réactivée |
| Quatre courses indépendantes progressant vers 45 min | 45 min révisée | 45 min révisée |
| Suggestions associées raccourcies de 30 à 25 puis 20 min | Référence expirée | 40 min conservée, aucune révision |

### Interprétation

L'inactivité réelle rend toujours le repère obsolète. Une pratique associée régulière empêche seulement cette obsolescence : sa durée ne devient pas une preuve de progression ou de réduction. La baisse récursive observée avec la politique C ne réapparaît donc pas.

L'état `valid-retained` signifie « ancien repère encore utilisable grâce à une continuité factuelle des courses ». Il ne signifie ni maintien démontré de la capacité, ni réalisation conforme aux suggestions. L'état `insufficient` après une interruption distingue une reprise observée d'une continuité suffisante pour conserver le repère.

### Recommandation expérimentale

Conserver **B avec validité entretenue sans révision** comme candidate des prochaines simulations. Cette variante corrige la disparition du repère chez un coureur suivant régulièrement les suggestions, sans autoriser leur durée à piloter la référence.

Avant toute intégration, il reste à tester les suppressions ou corrections tardives d'associations, les fuseaux autour de minuit et une séquence mêlant plusieurs interruptions proches de la borne. Les 42 jours restent un paramètre expérimental issu des phases précédentes, pas une affirmation sur la conservation d'une capacité physique.

### Validation 2G

`reference-validity-v2.test.ts` couvre l'inactivité, la frontière J42/J43, les courses associées régulières et irrégulières, la reprise après rupture, la progression indépendante et les suggestions raccourcies. Les tests sont synthétiques et sans accès au stockage.

## Résultats reproductibles de la phase 2A

Valeurs en minutes. S = suggestions arrivées à leur date, encore courantes après les consultations antérieures ; une même identité n’est pas recomptée chaque jour. N = nouvelles identités présentées dans la semaine (peut dépasser S). Médiane et référence sont relevées en fin de semaine. F/E = suggestions faciles/exigeantes, jamais une mesure de l’effort réalisé. Ø = jours dont le calcul ne produit aucune suggestion future. Liens = associations factuelles, pas adhésion.

| Profil | Scénario | S total | Couru total | S1 : durées | S12 : durées | Jours Ø | Liens finaux |
|---|---|---:|---:|---|---|---:|---:|
| begin | all | 17 | 235 | 30 / 30 | 5 / 5 | 50 | 17 |
| begin | alternate | 19 | 150 | 30 / 30 / 30 | — | 34 | 10 |
| begin | none | 84 | 0 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 0 | 0 |
| begin | personal | 13 | 660 | 30 / 30 | 10 | 0 | 4 |
| regular2 | all | 21 | 735 | 35 / 35 | 35 / 35 | 0 | 18 |
| regular2 | alternate | 27 | 490 | 35 / 35 | 35 / 35 | 0 | 14 |
| regular2 | none | 6 | 0 | 35 / 40 / 40 / 40 / 40 | — | 78 | 0 |
| regular2 | personal | 13 | 935 | 35 / 35 | 35 | 0 | 11 |
| regular3 | all | 28 | 980 | 35 / 35 | 35 / 35 / 35 | 0 | 2 |
| regular3 | alternate | 31 | 560 | 35 / 35 / 35 | 35 / 35 | 0 | 16 |
| regular3 | none | 4 | 0 | 35 / 35 / 30 | — | 82 | 0 |
| regular3 | personal | 24 | 1320 | 35 / 35 | 35 / 35 | 0 | 12 |
| old | all | 0 | 0 | — | — | 84 | 0 |
| old | alternate | 0 | 0 | — | — | 84 | 0 |
| old | none | 0 | 0 | — | — | 84 | 0 |
| old | personal | 9 | 840 | — | 40 | 20 | 0 |
| return | all | 16 | 165 | 20 / 20 | 5 | 54 | 16 |
| return | alternate | 21 | 125 | 20 / 20 / 20 | 5 | 44 | 11 |
| return | none | 84 | 0 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 0 | 0 |
| return | personal | 13 | 630 | 20 / 20 | 10 | 0 | 5 |
| endurance | all | 28 | 980 | 35 / 35 | 35 / 35 / 35 | 0 | 2 |
| endurance | alternate | 31 | 560 | 35 / 35 / 35 | 35 / 35 | 0 | 16 |
| endurance | none | 4 | 0 | 35 / 35 / 30 | — | 82 | 0 |
| endurance | personal | 24 | 1320 | 35 / 35 | 35 / 35 | 0 | 12 |
| speed | all | 28 | 980 | 35 / 35 | 35 / 35 / 35 | 0 | 2 |
| speed | alternate | 31 | 560 | 35 / 35 / 35 | 35 / 35 | 0 | 16 |
| speed | none | 4 | 0 | 35 / 35 / 30 | — | 82 | 0 |
| speed | personal | 24 | 1320 | 35 / 35 | 35 / 35 | 0 | 12 |
| distance | all | 28 | 980 | 35 / 35 | 35 / 35 / 35 | 0 | 2 |
| distance | alternate | 31 | 560 | 35 / 35 / 35 | 35 / 35 | 0 | 16 |
| distance | none | 4 | 0 | 35 / 35 / 30 | — | 82 | 0 |
| distance | personal | 24 | 1320 | 35 / 35 | 35 / 35 | 0 | 12 |
| race | all | 28 | 980 | 35 / 35 | 35 / 35 / 35 | 0 | 2 |
| race | alternate | 31 | 560 | 35 / 35 / 35 | 35 / 35 | 0 | 16 |
| race | none | 4 | 0 | 35 / 35 / 30 | — | 82 | 0 |
| race | personal | 24 | 1320 | 35 / 35 | 35 / 35 | 0 | 12 |

### begin — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 30 / 30 | 60 | 60 | 2 | 30 | 30 | 2/0 | 2 : 30 / 15 | 45 | 0 | 2 |
| 2 | 15 / 15 | 30 | 30 | 2 | 22.5 | 22.5 | 2/0 | 2 : 15 / 10 | 25 | 0 | 2 |
| 3 | 10 / 5 | 15 | 15 | 2 | 15 | 15 | 2/0 | 2 : 5 / 5 | 10 | 0 | 2 |
| 4 | 5 | 5 | 5 | 1 | 7.5 | 7.5 | 1/0 | 1 : 5 | 5 | 3 | 1 |
| 5 | 5 | 5 | 5 | 1 | 5 | 5 | 1/0 | 0 : — | 0 | 7 | 1 |
| 6 | 30 | 30 | 30 | 1 | 17.5 | 17.5 | 1/0 | 2 : 30 / 5 | 35 | 5 | 1 |
| 7 | 5 / 5 | 10 | 10 | 2 | 5 | 5 | 2/0 | 1 : 5 | 5 | 6 | 2 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 1 : 30 | 30 | 6 | 0 |
| 9 | 30 / 5 | 35 | 35 | 2 | 5 | 5 | 2/0 | 1 : 5 | 5 | 6 | 2 |
| 10 | 5 | 5 | 5 | 1 | 5 | 5 | 1/0 | 1 : 5 | 5 | 6 | 1 |
| 11 | 30 | 30 | 30 | 1 | 5 | 5 | 1/0 | 1 : 30 | 30 | 6 | 1 |
| 12 | 5 / 5 | 10 | 10 | 2 | 5 | 5 | 2/0 | 2 : 5 / 5 | 10 | 5 | 2 |

### begin — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 30 / 30 / 30 | 90 | 60 | 2 | 30 | 30 | 3/0 | 3 : 30 / 30 / 15 | 75 | 0 | 2 |
| 2 | 15 / 15 | 30 | 15 | 1 | 30 | 30 | 2/0 | 2 : 15 / 15 | 30 | 0 | 1 |
| 3 | 15 / 15 | 30 | 15 | 1 | 22.5 | 22.5 | 2/0 | 2 : 15 / 10 | 25 | 0 | 1 |
| 4 | 10 / 10 | 20 | 10 | 1 | 15 | 15 | 2/0 | 2 : 10 / 5 | 15 | 0 | 1 |
| 5 | 5 / 5 | 10 | 5 | 1 | 12.5 | 12.5 | 2/0 | 2 : 5 / 5 | 10 | 0 | 1 |
| 6 | 5 / 5 | 10 | 5 | 1 | 7.5 | 7.5 | 2/0 | 1 : 5 | 5 | 1 | 1 |
| 7 | — | 0 | 0 | 0 | 5 | 5 | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | 5 | 5 | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | 30 / 30 | 60 | 30 | 1 | 17.5 | 17.5 | 2/0 | 3 : 30 / 30 / 5 | 65 | 4 | 1 |
| 10 | 5 / 5 | 10 | 5 | 1 | 5 | 5 | 2/0 | 1 : 5 | 5 | 4 | 1 |
| 11 | 5 / 5 | 10 | 5 | 1 | 5 | 5 | 2/0 | 2 : 5 / 5 | 10 | 4 | 1 |
| 12 | — | 0 | 0 | 0 | 5 | 5 | 0/0 | 0 : — | 0 | 7 | 0 |

### begin — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 2 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 3 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 4 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 5 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 6 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 7 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 8 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 9 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 10 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 11 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |
| 12 | 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 | — | — | 7/0 | 7 : 30 / 30 / 30 / 30 / 30 / 30 / 30 | 210 | 0 | 0 |

### begin — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 30 / 30 | 60 | 95 | 3 | 30 | 30 | 2/0 | 3 : 30 / 15 / 15 | 60 | 0 | 2 |
| 2 | 15 | 15 | 60 | 2 | 30 | 30 | 1/0 | 2 : 15 / 15 | 30 | 0 | 1 |
| 3 | 15 | 15 | 55 | 2 | 35 | 35 | 1/0 | 2 : 15 / 15 | 30 | 0 | 1 |
| 4 | 10 | 10 | 45 | 2 | 35 | 35 | 1/0 | 3 : 10 / 5 / 15 | 30 | 0 | 0 |
| 5 | 10 | 10 | 55 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 6 | 10 | 10 | 50 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 7 | 10 | 10 | 45 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 8 | 10 | 10 | 55 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 9 | 10 | 10 | 50 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 10 | 10 | 10 | 45 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 11 | 10 | 10 | 55 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 12 | 10 | 10 | 50 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |

### regular2 — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 70 | 2 | 38 | 38 | 2/0 | 3 : 35 / 30 / 35 | 100 | 0 | 1 |
| 2 | 35 | 35 | 35 | 1 | 35 | 35 | 1/0 | 2 : 30 / 35 | 65 | 0 | 0 |
| 3 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 4 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |
| 5 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |
| 6 | 35 | 35 | 35 | 1 | 35 | 35 | 1/0 | 1 : 35 | 35 | 0 | 1 |
| 7 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |
| 8 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |
| 9 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |
| 10 | 35 | 35 | 35 | 1 | 35 | 35 | 1/0 | 1 : 35 | 35 | 0 | 1 |
| 11 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |
| 12 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 2 |

### regular2 — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 35 | 1 | 39 | 39 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 1 |
| 2 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 3 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 4 | 35 / 35 / 35 | 105 | 35 | 1 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 1 |
| 5 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 6 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 7 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 8 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 9 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 10 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 11 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 12 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |

### regular2 — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 40 / 40 / 40 / 40 | 195 | 0 | 0 | — | — | 5/0 | 8 : 40 / 30 / 40 / 30 / 40 / 30 / 40 / 30 | 280 | 1 | 0 |
| 2 | 30 | 30 | 0 | 0 | — | — | 1/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### regular2 — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 105 | 3 | 36.5 | 36.5 | 2/0 | 3 : 35 / 30 / 35 | 100 | 0 | 1 |
| 2 | 35 | 35 | 80 | 2 | 35 | 35 | 1/0 | 2 : 35 / 35 | 70 | 0 | 0 |
| 3 | 35 | 35 | 75 | 2 | 35 | 35 | 1/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 4 | 35 | 35 | 70 | 2 | 35 | 35 | 1/0 | 3 : 30 / 35 / 35 | 100 | 0 | 1 |
| 5 | 35 | 35 | 80 | 2 | 35 | 35 | 1/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 6 | 35 | 35 | 75 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |
| 7 | 35 | 35 | 70 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |
| 8 | 35 | 35 | 80 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |
| 9 | 35 | 35 | 75 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |
| 10 | 35 | 35 | 70 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |
| 11 | 35 | 35 | 80 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |
| 12 | 35 | 35 | 75 | 2 | 35 | 35 | 1/0 | 4 : 30 / 35 / 30 / 35 | 130 | 0 | 1 |

### regular3 — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 5 : 35 / 35 / 30 / 35 / 30 | 165 | 0 | 1 |
| 2 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 4 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 5 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 6 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 7 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 8 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 9 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 10 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 11 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 12 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |

### regular3 — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 8 : 35 / 35 / 30 / 35 / 35 / 30 / 35 / 30 | 265 | 0 | 2 |
| 2 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 8 : 35 / 30 / 35 / 30 / 35 / 30 / 35 / 30 | 260 | 0 | 2 |
| 3 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 1 |
| 4 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 5 : 35 / 30 / 35 / 35 / 35 | 170 | 0 | 2 |
| 5 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 6 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 7 | 35 / 35 / 35 | 105 | 35 | 1 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 1 |
| 8 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 9 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 10 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 11 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 12 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |

### regular3 — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 30 | 100 | 0 | 0 | — | — | 3/0 | 4 : 35 / 35 / 30 / 35 | 135 | 5 | 0 |
| 2 | 35 | 35 | 0 | 0 | — | — | 1/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### regular3 — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 7 : 35 / 35 / 30 / 35 / 30 / 35 / 30 | 230 | 0 | 1 |
| 2 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 4 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 5 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 6 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 7 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 8 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 9 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 10 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 11 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 12 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |

### old — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 2 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### old — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 2 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### old — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 2 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### old — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | — | 0 | 35 | 1 | 35 | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 2 | — | 0 | 45 | 1 | 40 | 40 | 0/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 40 | 1 | 40 | 40 | 0/0 | 1 : 40 | 40 | 6 | 0 |
| 4 | 40 | 40 | 75 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 5 | 40 | 40 | 85 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 6 | 40 | 40 | 80 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 7 | 40 | 40 | 75 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 8 | 40 | 40 | 85 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 9 | 40 | 40 | 80 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 10 | 40 | 40 | 75 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 11 | 40 | 40 | 85 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |
| 12 | 40 | 40 | 80 | 2 | 40 | 40 | 1/0 | 1 : 40 | 40 | 0 | 0 |

### return — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 20 / 20 | 40 | 40 | 2 | 20 | 20 | 2/0 | 2 : 20 / 10 | 30 | 0 | 2 |
| 2 | 10 / 10 | 20 | 20 | 2 | 15 | 15 | 2/0 | 2 : 10 / 5 | 15 | 0 | 2 |
| 3 | 5 / 5 | 10 | 10 | 2 | 10 | 10 | 2/0 | 2 : 5 / 5 | 10 | 0 | 2 |
| 4 | 5 | 5 | 5 | 1 | 5 | 5 | 1/0 | 0 : — | 0 | 7 | 1 |
| 5 | 20 | 20 | 20 | 1 | 5 | 5 | 1/0 | 1 : 20 | 20 | 6 | 1 |
| 6 | 5 | 5 | 5 | 1 | 12.5 | 12.5 | 1/0 | 2 : 5 / 5 | 10 | 5 | 1 |
| 7 | 5 | 5 | 5 | 1 | 5 | 5 | 1/0 | 0 : — | 0 | 7 | 1 |
| 8 | 20 | 20 | 20 | 1 | 12.5 | 12.5 | 1/0 | 2 : 20 / 5 | 25 | 5 | 1 |
| 9 | 5 / 5 | 10 | 10 | 2 | 5 | 5 | 2/0 | 1 : 5 | 5 | 6 | 2 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 1 : 20 | 20 | 6 | 0 |
| 11 | 20 / 5 | 25 | 25 | 2 | 5 | 5 | 2/0 | 1 : 5 | 5 | 6 | 2 |
| 12 | 5 | 5 | 5 | 1 | 5 | 5 | 1/0 | 1 : 5 | 5 | 6 | 1 |

### return — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 20 / 20 / 20 | 60 | 40 | 2 | 20 | 20 | 3/0 | 3 : 20 / 20 / 10 | 50 | 0 | 2 |
| 2 | 10 / 10 | 20 | 10 | 1 | 20 | 20 | 2/0 | 2 : 10 / 10 | 20 | 0 | 1 |
| 3 | 10 / 10 / 5 | 25 | 10 | 1 | 10 | 10 | 3/0 | 3 : 10 / 5 / 5 | 20 | 0 | 1 |
| 4 | 5 / 5 / 5 | 15 | 10 | 2 | 7.5 | 7.5 | 3/0 | 2 : 5 / 5 | 10 | 1 | 2 |
| 5 | — | 0 | 0 | 0 | 5 | 5 | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | 20 / 20 | 40 | 20 | 1 | 5 | 5 | 2/0 | 2 : 20 / 20 | 40 | 5 | 1 |
| 7 | 5 / 5 | 10 | 5 | 1 | 5 | 5 | 2/0 | 2 : 5 / 5 | 10 | 4 | 1 |
| 8 | 5 / 5 | 10 | 5 | 1 | 5 | 5 | 2/0 | 2 : 5 / 5 | 10 | 5 | 1 |
| 9 | — | 0 | 0 | 0 | 5 | 5 | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | 20 / 20 | 40 | 20 | 1 | 5 | 5 | 2/0 | 2 : 20 / 20 | 40 | 5 | 1 |
| 11 | 5 | 5 | 0 | 0 | 12.5 | 12.5 | 1/0 | 2 : 5 / 5 | 10 | 4 | 0 |
| 12 | 5 | 5 | 5 | 1 | 12.5 | 12.5 | 1/0 | 1 : 5 | 5 | 6 | 1 |

### return — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 2 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 3 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 4 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 5 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 6 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 7 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 8 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | 38 | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 9 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 10 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 11 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |
| 12 | 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 | — | — | 7/0 | 7 : 20 / 20 / 20 / 20 / 20 / 20 / 20 | 140 | 0 | 0 |

### return — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 20 / 20 | 40 | 75 | 3 | 20 | 20 | 2/0 | 3 : 20 / 10 / 10 | 40 | 0 | 2 |
| 2 | 10 | 10 | 55 | 2 | 20 | 20 | 1/0 | 2 : 10 / 10 | 20 | 0 | 1 |
| 3 | 10 | 10 | 50 | 2 | 27.5 | 27.5 | 1/0 | 2 : 10 / 10 | 20 | 0 | 1 |
| 4 | 10 | 10 | 45 | 2 | 35 | 35 | 1/0 | 4 : 15 / 10 / 5 / 15 | 45 | 0 | 1 |
| 5 | 10 | 10 | 55 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 6 | 10 | 10 | 50 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 7 | 10 | 10 | 45 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 8 | 10 | 10 | 55 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 9 | 10 | 10 | 50 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 10 | 10 | 10 | 45 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 11 | 10 | 10 | 55 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |
| 12 | 10 | 10 | 50 | 2 | 35 | 35 | 1/0 | 4 : 10 / 5 / 10 / 15 | 40 | 0 | 0 |

### endurance — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 5 : 35 / 35 / 30 / 35 / 30 | 165 | 0 | 1 |
| 2 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 4 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 5 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 6 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 7 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 8 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 9 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 10 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 11 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 12 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |

### endurance — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 8 : 35 / 35 / 30 / 35 / 35 / 30 / 35 / 30 | 265 | 0 | 2 |
| 2 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 8 : 35 / 30 / 35 / 30 / 35 / 30 / 35 / 30 | 260 | 0 | 2 |
| 3 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 1 |
| 4 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 5 : 35 / 30 / 35 / 35 / 35 | 170 | 0 | 2 |
| 5 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 6 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 7 | 35 / 35 / 35 | 105 | 35 | 1 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 1 |
| 8 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 9 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 10 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 11 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 12 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |

### endurance — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 30 | 100 | 0 | 0 | — | — | 3/0 | 4 : 35 / 35 / 30 / 35 | 135 | 5 | 0 |
| 2 | 35 | 35 | 0 | 0 | — | — | 1/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### endurance — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 7 : 35 / 35 / 30 / 35 / 30 / 35 / 30 | 230 | 0 | 1 |
| 2 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 4 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 5 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 6 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 7 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 8 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 9 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 10 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 11 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 12 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |

### speed — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 5 : 35 / 35 / 30 / 35 / 30 | 165 | 0 | 1 |
| 2 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 4 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 5 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 6 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 7 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 8 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 9 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 10 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 11 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 12 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |

### speed — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 8 : 35 / 35 / 30 / 35 / 35 / 30 / 35 / 30 | 265 | 0 | 2 |
| 2 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 8 : 35 / 30 / 35 / 30 / 35 / 30 / 35 / 30 | 260 | 0 | 2 |
| 3 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 1 |
| 4 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 5 : 35 / 30 / 35 / 35 / 35 | 170 | 0 | 2 |
| 5 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 6 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 7 | 35 / 35 / 35 | 105 | 35 | 1 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 1 |
| 8 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 9 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 10 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 11 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 12 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |

### speed — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 30 | 100 | 0 | 0 | — | — | 3/0 | 4 : 35 / 35 / 30 / 35 | 135 | 5 | 0 |
| 2 | 35 | 35 | 0 | 0 | — | — | 1/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### speed — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 7 : 35 / 35 / 30 / 35 / 30 / 35 / 30 | 230 | 0 | 1 |
| 2 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 4 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 5 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 6 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 7 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 8 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 9 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 10 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 11 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 12 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |

### distance — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 5 : 35 / 35 / 30 / 35 / 30 | 165 | 0 | 1 |
| 2 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 4 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 5 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 6 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 7 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 8 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 9 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 10 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 11 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 12 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |

### distance — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 8 : 35 / 35 / 30 / 35 / 35 / 30 / 35 / 30 | 265 | 0 | 2 |
| 2 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 8 : 35 / 30 / 35 / 30 / 35 / 30 / 35 / 30 | 260 | 0 | 2 |
| 3 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 1 |
| 4 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 5 : 35 / 30 / 35 / 35 / 35 | 170 | 0 | 2 |
| 5 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 6 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 7 | 35 / 35 / 35 | 105 | 35 | 1 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 1 |
| 8 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 9 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 10 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 11 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 12 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |

### distance — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 30 | 100 | 0 | 0 | — | — | 3/0 | 4 : 35 / 35 / 30 / 35 | 135 | 5 | 0 |
| 2 | 35 | 35 | 0 | 0 | — | — | 1/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### distance — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 7 : 35 / 35 / 30 / 35 / 30 / 35 / 30 | 230 | 0 | 1 |
| 2 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 4 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 5 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 6 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 7 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 8 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 9 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 10 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 11 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 12 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |

### race — all

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 5 : 35 / 35 / 30 / 35 / 30 | 165 | 0 | 1 |
| 2 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 4 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 5 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 6 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 7 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 8 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 9 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |
| 10 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 11 | 35 / 35 | 70 | 70 | 2 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 0 |
| 12 | 35 / 35 / 35 | 105 | 105 | 3 | 35 | 35 | 3/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 0 |

### race — alternate

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 8 : 35 / 35 / 30 / 35 / 35 / 30 / 35 / 30 | 265 | 0 | 2 |
| 2 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 8 : 35 / 30 / 35 / 30 / 35 / 30 / 35 / 30 | 260 | 0 | 2 |
| 3 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 4 : 35 / 30 / 35 / 30 | 130 | 0 | 1 |
| 4 | 35 / 35 / 35 / 35 | 140 | 70 | 2 | 35 | 35 | 4/0 | 5 : 35 / 30 / 35 / 35 / 35 | 170 | 0 | 2 |
| 5 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 6 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 7 | 35 / 35 / 35 | 105 | 35 | 1 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 1 |
| 8 | 35 / 35 / 35 | 105 | 70 | 2 | 35 | 35 | 3/0 | 3 : 35 / 35 / 35 | 105 | 0 | 2 |
| 9 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 10 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 11 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |
| 12 | 35 / 35 | 70 | 35 | 1 | 35 | 35 | 2/0 | 2 : 35 / 35 | 70 | 0 | 1 |

### race — none

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 / 30 | 100 | 0 | 0 | — | — | 3/0 | 4 : 35 / 35 / 30 / 35 | 135 | 5 | 0 |
| 2 | 35 | 35 | 0 | 0 | — | — | 1/0 | 0 : — | 0 | 7 | 0 |
| 3 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 4 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 5 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 6 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 7 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 8 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 9 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 10 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 11 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |
| 12 | — | 0 | 0 | 0 | — | — | 0/0 | 0 : — | 0 | 7 | 0 |

### race — personal

| Semaine | Durées proposées | Total proposé | Total couru | Sorties | Médiane récente | Référence Coach | F/E | N : durées nouvellement présentées | Total N | Ø | Liens |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 1 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 7 : 35 / 35 / 30 / 35 / 30 / 35 / 30 | 230 | 0 | 1 |
| 2 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 3 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 4 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 5 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 6 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 7 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 8 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 9 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 10 | 35 / 35 | 70 | 105 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 11 | 35 / 35 | 70 | 115 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
| 12 | 35 / 35 | 70 | 110 | 3 | 35 | 35 | 2/0 | 6 : 35 / 30 / 35 / 30 / 35 / 30 | 195 | 0 | 1 |
