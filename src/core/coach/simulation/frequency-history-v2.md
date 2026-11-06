# Étude exploratoire — fréquence réellement documentée

## Portée et résultat

Cette étude explore une personnalisation fondée sur l'expérience enregistrée, sans estimer une récupération physiologique. Aucun délai, classement, recommandation, active ou perspective n'est modifié. L'option actuelle 2/7/10/14 reste intacte. Seuls 12 jours structurés et 9 jours longues sont examinés comme hypothèse B. Aucune politique n'est choisie et D4e n'est pas commencé.

**Une fréquence peut être identifiable sans être suffisamment documentée pour justifier une adaptation.** L'étude distingue nombre d'intervalles, répétition exacte, distribution temporelle, couverture, charge récente et ressentis. Ces dimensions ne sont pas fusionnées en score, en `candidate` ou en décision sportive. D4c consolidé demeure inchangé : sa candidature reste non calibrée.

Dans les fixtures, une série structurée à 12 jours fournit 2, 4 puis 6 intervalles sur 28, 56 et 84 jours. Une série longue à 9 jours en fournit 2, 5 puis 9. Cela rend la répétition plus visible, mais ne prouve pas que ces séances ont été récupérées. Étendre à 84 jours un historique réellement limité à 28 jours laisse toujours deux intervalles à 12 jours, concentrés dans le dernier bloc.

## Méthode et données

Trois fenêtres civiles inclusives finissent à la même date explicite : J-27 à J, J-55 à J, J-83 à J. Elles sont **imbriquées**, donc les observations partagées ne sont pas des preuves indépendantes. Le nombre d'intervalles dépend de la phase des séances et des bornes ; un intervalle traversant la borne gauche n'est pas compté.

La normalisation D2a est réutilisée : dates futures exclues, doublons identiques dédupliqués, contradictions écartées sans arbitrage, champs absents conservés comme inconnus. Les types réels admissibles sont requis en entrée, jamais déduits d'une prescription. Les diagnostics D3b doivent accompagner les preuves quand ils existent. Une association ou une confirmation n'augmente pas le poids d'une activité.

Pour chaque fenêtre et population (toutes activités, structurées regroupées, longues, ensemble exigeant), le module expose :

- Nombre d'activités et de jours actifs, fréquence divisée par la fenêtre nominale.
- Première et dernière dates enregistrées, durée du segment couvert par ces dates.
- Intervalles entre jours actifs, répétitions, histogramme exact, médiane, minimum et maximum.
- Groupes du même jour et écarts nuls, sans ordre intrajournalier inventé.
- Distribution par blocs glissants de sept et 28 jours, avec sources et durées connues/manquantes.
- Ressentis individuels, types inconnus et couverture des champs.
- Comparaison descriptive sous/égal/supérieur à 14/10 et à 12/9.
- Dates d'arrivée des intervalles exactement égaux à B, réparties par semaine et bloc de 28 jours.

Deux intervalles sont seulement le minimum logique pour constater une répétition. `equal-observed-gaps` signifie exactement la même valeur dans les intervalles enregistrés ; ce n'est ni une stabilité physiologique ni une règle d'admission. `variable-observed-gaps` décrit des valeurs différentes sans juger leur amplitude. Une médiane unique ne doit pas remplacer leur distribution. La notion « proche des règles » n'a pas de marge numérique inventée : les écarts exacts restent visibles.

D4a décrit seulement 28 jours. Le nouveau module étend les comptages à 56/84 sans changer son contrat ; des tests vérifient l'identité des comptes et espacements sur les 28 jours communs. Les volumes récents et transitions réutilisent `analyzeVolumeObservationsV2`. Les décisions et signaux D2/D4b restent exposés séparément et inchangés.

## Ce que les horizons apportent, et ce qu'ils ne résolvent pas

| Horizon | Apport | Risque de faux positif | Risque de faux négatif |
| --- | --- | --- | --- |
| 28 jours | Décrit la pratique récente, détecte une série localisée | Deux ou trois séances prises pour une habitude ; épisode concentré confondu avec expérience durable | Pratique espacée et ancienne peu visible ; un intervalle coupé par la borne |
| 56 jours | Permet de comparer deux blocs de 28 jours et davantage d'intervalles | Répétitions dans un seul bloc, omissions ou changement récent masqués par le total | Historique valide mais récent classé peu profond ; phase des séances près des bords |
| 84 jours | Permet de voir trois blocs, anciens rythmes et grandes lacunes | Pratique ancienne prise pour situation actuelle ; conservation d'une fréquence qui n'est plus pratiquée | Changements récents légitimes dilués ; données anciennes peu fiables contaminant l'interprétation |

Aucun horizon n'est imposé comme seuil définitif. La fenêtre nominale et le segment réellement couvert sont distincts. Un taux sur 84 jours peut être dilué par une histoire de 28 jours ; diviser seulement par le segment actif peut au contraire exagérer un épisode concentré. Les deux informations sont donc conservées, sans supposer que les jours vides étaient du repos.

Les blocs occupés ne garantissent pas une pratique stable à l'intérieur de chacun. Les intervalles sont rattachés à leur date d'arrivée pour compter leur distribution, sans découper un intervalle ni le compter deux fois. Une répétition sur plusieurs blocs est plus informative qu'une série localisée, mais ne définit pas à elle seule un niveau de preuve suffisant.

## Fréquences identifiables et hypothèse B

- **Structurées à 12 jours, longues à 9 jours :** B correspond exactement à un espacement observé. Plusieurs intervalles, répartis dans le temps et avec leurs ressentis, constituent un dossier de cohérence historique à étudier. Le seul respect de B n'accorde aucun assouplissement.
- **Structurées à 14 ou 18 jours, longues à 10 jours :** B accélérerait la fréquence observée. L'expérience à ces rythmes ne documente pas automatiquement 12/9.
- **Structurées à 7 jours :** 12 jours serait moins fréquent que l'historique. Ce constat ne prouve pas que la pratique à 7 jours est appropriée, ni que B serait sûr. Une fréquence élevée n'est jamais un indice favorable automatique.
- **Espacements variables :** exposer l'histogramme et la chronologie. Une médiane proche de B peut cacher une alternance de longues lacunes et de séries rapprochées.
- **Série concentrée :** dans le scénario à trois jours, six intervalles identiques restent tous situés dans un seul bloc récent. L'égalité des intervalles ne suffit pas à établir une habitude durable.
- **Reprise apparente :** conserver la lacune, le petit nombre d'observations récentes et les anciennes répétitions séparément. Ne pas attribuer l'ancien rythme à la pratique actuelle sans éléments supplémentaires.

Les quatre familles structurées constituent toujours un seul groupe. Une alternance d'intervalles, de côtes, d'allure soutenue et de variations d'endurance ne produit pas quatre voies d'assouplissement.

## Croisement avec la situation récente

Le résultat expose sans les neutraliser : ressentis difficiles dans la fenêtre D4b de sept jours, protections `very-hard`, préférences concordantes D2, concentration sur trois jours, comparaison des volumes sur deux semaines, transitions/tendance sur quatre semaines, et données manquantes. Les ressentis plus anciens restent visibles dans les observations historiques et ne deviennent pas des diagnostics actuels.

Les scénarios donnent notamment :

- Fréquence à sept jours avec charge croissante : hausse récente visible, même sans préférence de récupération D2. L'absence de préférence D2 n'est pas favorable en soi.
- Fréquence élevée avec `hard` ou `very-hard` : ces signaux demeurent exposés malgré 84 jours documentés ; `very-hard` garde sa protection D4b.
- Régularité avec ressentis inconnus : la fréquence est descriptive, sa tolérance reste inconnue.
- Hausse avec concentration et durées supérieures à la référence : les motifs concordants D2 restent présents.
- Longues et structurées : leurs fréquences séparées peuvent être régulières alors que leur union crée des intervalles très courts. Examiner les intervalles de l'ensemble exigeant, les jours mixtes et les volumes par semaine, sans inventer un délai obligatoire partagé.
- Historique incomplet : un type absent ou une activité supprimée peut fusionner deux intervalles de 12 jours en un intervalle apparent de 24 jours. Le module montre la lacune connue ; une omission silencieuse reste indétectable.

Aucune fréquence historique ne peut effacer une observation défavorable récente. Le module ne calcule volontairement pas de conclusion d'adaptation qui pourrait les masquer.

## Comparaison des politiques, sans choix automatique

| Politique | Bénéfices | Risques / faux positifs | Faux négatifs | Données nécessaires | Complexité |
| --- | --- | --- | --- | --- | --- |
| A — délais fixes actuels | Cohérence des chemins, fonctionnement connu, faible dépendance à la couverture historique | Règle fixe prise à tort pour une mesure personnelle de récupération | Pratique réellement documentée plus fréquente non reflétée | Sources actuelles des protections | Faible : maintien de l'existant |
| B — fréquence habituelle documentée, étude de 12/9 | Personnalisation formulée en cohérence avec une expérience observée, sans promesse de récupération | Épisode concentré ou historique ancien pris pour habitude ; pratique élevée problématique normalisée ; omissions ; négligence des interactions | Pratique peu saisie ou irrégulière mais appropriée ; frontières temporelles ; historique trop court | Plusieurs intervalles et leur distribution, profondeur réelle, type réel, ressentis, qualité, absence de signal défavorable récent | Moyenne à forte : définition du niveau de preuve, temporalité et cohérence du contrat sur tous les chemins |
| C — hybride, fréquence + charge + protections supplémentaires | Rend les cumuls et signaux récents explicites, évite de fonder une adaptation sur la fréquence seule | Fausse précision de seuils non justifiés ; volume stable mais déjà élevé ; protection de cumul inadéquate | Restrictions empilées, défauts de saisie surbloquants, dossier jamais admissible | Données B plus volumes, durées, concentration, interactions, changements de pratique et leurs incertitudes | Forte : règles de priorité, justification des protections, tests de trajectoires et de concurrence |

B ne signifie pas « reproduire n'importe quelle fréquence historique ». Dans cette étude, les seuls délais expérimentaux restent 12/9. C ne propose aucun délai supplémentaire ni aucun coefficient de charge. Toute protection future devra avoir un contrat explicite et une justification distincte de l'observation historique.

## Conditions possibles avant une première adaptation limitée

Ces points sont des conditions à instruire, pas une autorisation ni des seuils retenus :

1. Définir la personnalisation comme cohérence avec une pratique enregistrée, pas comme récupération mesurée.
2. Établir un niveau minimal de répétition et de répartition temporelle justifié, avec une analyse de sensibilité aux fenêtres et aux observations retirées. Les séries 2/4/6 intervalles sont des exemples, pas des seuils.
3. Distinguer historique ancien et situation actuelle ; documenter les reprises et changements de rythme sans inventer des activités manquantes.
4. Exiger une qualité suffisante des types réels, durées et ressentis ; conserver un repli explicite en cas de contradiction ou d'incertitude.
5. Donner priorité aux signaux défavorables récents et aux protections existantes ; ne pas traiter leur absence comme une preuve positive.
6. Étudier un groupe à la fois et les effets combinés de fréquence et de durée. Définir le traitement des interactions avant un éventuel assouplissement simultané.
7. Recalculer après correction, suppression ou changement de contexte ; aucune fréquence personnelle acquise ne doit être persistée comme un droit.
8. Prévoir un contrat partagé par D4b, D2, classement, actives, perspectives et mémorisation, seulement après validation explicite. Aucun branchement n'est réalisé ici.

Questions à trancher avant D4e : combien d'intervalles indépendants et répartis seraient suffisamment informatifs ? Quelle fraîcheur du rythme observé ? Comment traiter une alternance de rythmes ou une omission plausible ? Comment qualifier le volume sans seuil physiologique inventé ? Quelles protections de cumul justifier ? Comment éviter une oscillation de décision après une séance à 12/9 ? Quels critères de retrait et quelle explication au coureur ?

## Reproduction et isolation

Les quatre fichiers ajoutés sont limités au dossier `simulation` : module, fixtures, tests et ce rapport. La date de référence est le 5 novembre 2026. La base synthétique contient une activité tous les trois jours, la plus récente à J-2 ; les séances du groupe étudié sont placées tous les n jours à partir de J-2. Les dates sont fusionnées avant création d'activités : une séance exigeante remplace l'activité facile du même jour. Les scénarios modifient explicitement ces données.

La référence de durée synthétique fournie à l'analyse est distincte de celle recalculée par le vrai pipeline dans les tests applicatifs. Aucun profil réel ni base historique n'est utilisé. Les activités futures sont exclues à la date examinée.

Commande de capture détaillée : `FREQUENCY_CAPTURE=1 npx vitest run src/core/coach/simulation/frequency-history-v2.test.ts`. Elle écrit `/tmp/frequency-history.json`. La capture contient les sources, intervalles, distributions, couvertures et contexte récent de chaque scénario, ainsi que les résultats du pipeline pour les trois tempéraments.

## Résultats des 24 scénarios

Dans chaque cellule, S et L désignent structurées et longues ; `a/i` signifie activités / intervalles observés. Les mêmes observations sont réutilisées dans les fenêtres imbriquées, jamais additionnées comme preuves indépendantes.

| Scénario | 28 jours : S ; L | 56 jours : S ; L | 84 jours : S ; L |
| --- | --- | --- | --- |
| `beginner-28` | 0/0 ; 0/0 | 0/0 ; 0/0 | 0/0 ; 0/0 |
| `regular-28` | 3/2 ; 0/0 | 3/2 ; 0/0 | 3/2 ; 0/0 |
| `regular-56` | 3/2 ; 0/0 | 5/4 ; 0/0 | 5/4 ; 0/0 |
| `regular-84` | 3/2 ; 0/0 | 5/4 ; 0/0 | 7/6 ; 0/0 |
| `structured-12` | 3/2 ; 0/0 | 5/4 ; 0/0 | 7/6 ; 0/0 |
| `structured-14` | 2/1 ; 0/0 | 4/3 ; 0/0 | 6/5 ; 0/0 |
| `structured-7` | 4/3 ; 0/0 | 8/7 ; 0/0 | 12/11 ; 0/0 |
| `long-9` | 0/0 ; 3/2 | 0/0 ; 6/5 | 0/0 ; 10/9 |
| `long-10` | 0/0 ; 3/2 | 0/0 ; 6/5 | 0/0 ; 9/8 |
| `high-frequency-growing` | 4/3 ; 0/0 | 8/7 ; 0/0 | 12/11 ; 0/0 |
| `high-frequency-hard` | 4/3 ; 0/0 | 8/7 ; 0/0 | 12/11 ; 0/0 |
| `unknown-efforts` | 3/2 ; 0/0 | 5/4 ; 0/0 | 7/6 ; 0/0 |
| `concentrated-demanding` | 7/6 ; 0/0 | 7/6 ; 0/0 | 7/6 ; 0/0 |
| `mixed-close` | 3/2 ; 3/2 | 5/4 ; 6/5 | 7/6 ; 9/8 |
| `return-after-gap` | 1/0 ; 0/0 | 1/0 ; 0/0 | 3/2 ; 0/0 |
| `incomplete-history` | 2/1 ; 0/0 | 4/3 ; 0/0 | 6/5 ; 0/0 |
| `corrected-activity` | 2/1 ; 0/0 | 4/3 ; 0/0 | 6/5 ; 0/0 |
| `deleted-activity` | 2/1 ; 0/0 | 4/3 ; 0/0 | 6/5 ; 0/0 |
| `future-activity` | 3/2 ; 0/0 | 5/4 ; 0/0 | 7/6 ; 0/0 |
| `alternating-structured` | 3/2 ; 0/0 | 5/4 ; 0/0 | 7/6 ; 0/0 |
| `slower-than-current` | 2/1 ; 0/0 | 3/2 ; 0/0 | 5/4 ; 0/0 |
| `variable-gaps` | 2/1 ; 0/0 | 4/3 ; 0/0 | 6/5 ; 0/0 |
| `very-hard-recent` | 3/2 ; 0/0 | 5/4 ; 0/0 | 7/6 ; 0/0 |
| `growing-and-concentrated` | 3/2 ; 1/0 | 5/4 ; 1/0 | 7/6 ; 1/0 |

### Profondeur réellement couverte des séries principales

La durée ci-dessous est le segment entre la première et la dernière activité du groupe, jours inclusifs. Ce n’est ni une durée de suivi exhaustif ni une période de récupération.

| Série | Segment couvert sur 28 / 56 / 84 jours | Intervalles sur 84 jours | Activités par bloc de 28 jours, ancien → récent |
| --- | --- | --- | --- |
| `regular-28` | 25 / 25 / 25 jours | 12 j × 2 | 0 / 0 / 3 |
| `regular-56` | 25 / 49 / 49 jours | 12 j × 4 | 0 / 2 / 3 |
| `structured-12` | 25 / 49 / 73 jours | 12 j × 6 | 2 / 2 / 3 |
| `structured-14` | 15 / 43 / 71 jours | 14 j × 5 | 2 / 2 / 2 |
| `structured-7` | 22 / 50 / 78 jours | 7 j × 11 | 4 / 4 / 4 |
| `long-9` | 19 / 46 / 82 jours | 9 j × 9 | 4 / 3 / 3 |
| `long-10` | 21 / 51 / 81 jours | 10 j × 8 | 3 / 3 / 3 |
| `concentrated-demanding` | 19 / 19 / 19 jours | 3 j × 6 | 0 / 0 / 7 |
| `return-after-gap` | 1 / 1 / 73 jours | 12 j × 1, 60 j × 1 | 2 / 0 / 1 |
| `variable-gaps` | 13 / 43 / 82 jours | 9 j × 1, 12 j × 1, 18 j × 1, 21 j × 2 | 2 / 2 / 2 |

### Contexte récent et interprétation par scénario

La comparaison de volume porte sur les deux dernières semaines disponibles, pas sur les 84 jours. Une ligne sans alerte D2 ne signifie pas un dossier favorable.

| Scénario | Volume récent | Ressenti difficile / motifs prudents D2 | Limite principale |
| --- | --- | --- | --- |
| `beginner-28` | Égal | Aucun motif de cette liste ; voir inconnues | Quatre semaines enregistrées, aucune expérience exigeante déclarée. |
| `regular-28` | Égal | Aucun motif de cette liste ; voir inconnues | Les fenêtres longues contiennent les mêmes trois structurées, pas une expérience plus longue. |
| `regular-56` | Égal | Aucun motif de cette liste ; voir inconnues | La fenêtre 84 ne crée aucune observation antérieure à cet historique. |
| `regular-84` | Égal | Aucun motif de cette liste ; voir inconnues | Plusieurs intervalles de 12 jours répartis sur trois blocs ; pas une récupération démontrée. |
| `structured-12` | Égal | Aucun motif de cette liste ; voir inconnues | L’hypothèse B reproduit ici un espacement effectivement répété. |
| `structured-14` | Égal | Aucun motif de cette liste ; voir inconnues | Douze jours seraient une fréquence supérieure à celle enregistrée. |
| `structured-7` | En baisse | Aucun motif de cette liste ; voir inconnues | Douze jours seraient plus espacés ; la fréquence élevée ne valide pas sa tolérance. |
| `long-9` | Égal | Aucun motif de cette liste ; voir inconnues | Neuf jours sont observés plusieurs fois, sans éligibilité automatique. |
| `long-10` | En baisse | Aucun motif de cette liste ; voir inconnues | Neuf jours restent une accélération par rapport aux dix jours observés. |
| `high-frequency-growing` | En hausse | Aucun motif de cette liste ; voir inconnues | Fréquence documentée avec hausse récente : cohérence historique ne neutralise pas la charge. |
| `high-frequency-hard` | En baisse | difficult-effort | Le hard récent reste un signal défavorable, quelle que soit la profondeur. |
| `unknown-efforts` | Égal | Aucun motif de cette liste ; voir inconnues | Répétition identifiable, ressenti inconnu ; ne pas assimiler silence et tolérance. |
| `concentrated-demanding` | Égal | Aucun motif de cette liste ; voir inconnues | Une série régulière à trois jours n’occupe qu’un bloc récent de 28 jours. |
| `mixed-close` | Égal | Aucun motif de cette liste ; voir inconnues | Deux fréquences régulières peuvent produire des jours mixtes et des intervalles globaux courts. |
| `return-after-gap` | En hausse | Aucun motif de cette liste ; voir inconnues | Les intervalles anciens et la lacune restent visibles ; interruption réelle ou défaut de saisie non départagés. |
| `incomplete-history` | Égal | Aucun motif de cette liste ; voir inconnues | La disparition du type transforme deux intervalles de 12 jours en un intervalle apparent de 24 jours. |
| `corrected-activity` | Égal | Aucun motif de cette liste ; voir inconnues | Le type réel corrigé retire une expérience structurée sans supprimer l’activité globale. |
| `deleted-activity` | Égal | Aucun motif de cette liste ; voir inconnues | Une suppression change fréquence globale et structurée, sans état historique conservé. |
| `future-activity` | Égal | Aucun motif de cette liste ; voir inconnues | L’activité future est exclue de chaque horizon et du contexte présent. |
| `alternating-structured` | Égal | Aucun motif de cette liste ; voir inconnues | Les quatre familles sont regroupées ; changer d’étiquette ne crée pas quatre historiques indépendants. |
| `slower-than-current` | Égal | Aucun motif de cette liste ; voir inconnues | Une pratique à 18 jours ne documente pas une fréquence de 12 jours. |
| `variable-gaps` | Égal | Aucun motif de cette liste ; voir inconnues | Intervalles variables : aucune fréquence unique ne résume le dossier. |
| `very-hard-recent` | Égal | very-hard-protection, difficult-effort | La protection de sept jours reste active, même avec six intervalles de 12 jours. |
| `growing-and-concentrated` | En hausse | concentrated-above-habitual, concentrated-volume-increase | Hausse et concentration concordantes D2 : aucune répétition historique ne peut les effacer. |

Les activités globales, fréquences par semaine, jours occupés, durées et couvertures détaillées restent dans la capture reproductible. Ainsi, `incomplete-history` peut avoir des volumes récents égaux alors qu’un type à J-14 manque dans l’historique : l’égalité récente ne répare pas la couverture historique.

### Fréquence globale : effet du dénominateur

Ces taux divisent les activités enregistrées par la fenêtre nominale. Leur baisse lorsqu’on élargit une fenêtre sans ajouter de données n’établit pas une baisse réelle de pratique.

| Historique | Activités globales 28 / 56 / 84 | Activités par semaine 28 / 56 / 84 | Semaines avec enregistrement 28 / 56 / 84 |
| --- | --- | --- | --- |
| `beginner-28` | 9 / 9 / 9 | 2.25 / 1.12 / 0.75 | 4 / 4 / 4 |
| `regular-28` | 9 / 9 / 9 | 2.25 / 1.12 / 0.75 | 4 / 4 / 4 |
| `regular-56` | 9 / 18 / 18 | 2.25 / 2.25 / 1.50 | 4 / 8 / 8 |
| `regular-84` | 9 / 18 / 28 | 2.25 / 2.25 / 2.33 | 4 / 8 / 12 |
| `concentrated-demanding` | 9 / 18 / 28 | 2.25 / 2.25 / 2.33 | 4 / 8 / 12 |
| `mixed-close` | 12 / 24 / 37 | 3.00 / 3.00 / 3.08 | 4 / 8 / 12 |
| `return-after-gap` | 3 / 3 / 13 | 0.75 / 0.38 / 1.08 | 2 / 2 / 6 |

## Validation finale

- Quatre fichiers ajoutés ; aucun fichier préexistant modifié, contrôle SHA-256 à l'appui.
- 24 scénarios reproductibles, 115 tests du nouveau laboratoire, dont 72 comparaisons du vrai pipeline sur les trois tempéraments.
- Tests ciblés avec D4a et D4b : 165 réussis.
- Suite complète : 2 061 tests réussis, un ignoré ; 111 fichiers réussis, un ignoré.
- Matrice historique avant/après : 111 snapshots et objets complets identiques.
- TypeScript, build et `git diff --check` réussis ; les espaces de fin de ligne des nouveaux fichiers ont aussi été contrôlés.
- Les bundles de production conservent leurs noms et tailles. Avertissement existant : bundle de plus de 500 kB.
- Le seul import exécutable du laboratoire est celui de ses tests. Aucun branchement aux recommandations, actives ou perspectives.
- Données synthétiques uniquement. Aucun accès à la base historique, migration, changement de version ou de changelog, opération Git d'écriture ou déploiement.
- `.agents/` et toutes les modifications préexistantes sont préservés. D4e non commencé.
