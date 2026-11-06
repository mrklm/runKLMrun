# D4e-1 — décision après comparaison de calendriers A/B

## Conclusion : maintien de A recommandé

Les calendriers de laboratoire montrent des effets réels de B sur les dates et les successions. Ils ne justifient pas encore une activation. A (14 jours structurées / 10 jours longues) reste la seule politique effective. Repos général 2 jours et protection/préférence de ressenti 7 jours inchangés. Aucune activation, aucun réglage de production ni écriture de stockage.

**Résultat important : B n'est pas impossible dans le laboratoire.** Deux scénarios avec disponibilités restreintes modifient les sélections sous les critères proposés et ne dépassent pas les limites de cumul calculées. Mais aucun cas ne dispose d'une autorisation applicative : le profil, le garde-fou de cumul et le contrat remplaçant les incertitudes D4c restent à valider. Ne pas confondre « dossier expérimental rempli », « calendrier comparativement acceptable » et « activation autorisée ».

## Proposition reprise, sans nouvel assouplissement

Référence : [proposition hybride](hybrid-policy-proposal-v2.md). L'évaluateur de laboratoire reprend ses conditions :

- 6 dates distinctes et 5 intervalles entre jours, segment historique de 56 jours, présence dans trois blocs de 28 jours sur 84.
- Deux dates récentes, trois intervalles exactement égaux à B, arrivées dans deux blocs, un intervalle B entièrement récent.
- Dernière séance du groupe à J-14 au plus ; aucune rupture documentaire par bloc vide ou intervalle supérieur à 28 jours.
- Types historiques connus ; durées et ressentis exigeants connus ; couverture de toutes les activités récentes ; sources non contradictoires.
- Quatre semaines comparables ; dernière semaine au plus égale à la précédente et à la médiane des trois antérieures ; pente non positive ; pas de deux transitions strictement négatives consécutives.
- Priorité aux ressentis défavorables et signaux concordants D2 ; référence nécessaire et diagnostics non manquants.
- Un seul groupe assoupli, contenus de séance identiques entre branches, aucune progression simultanée de durée/intensité.
- Comparaison du nombre et de la durée des séances exigeantes par période de 28 jours, et des pics glissants sur 7/14 jours, passé récent inclus.

Aucune tolérance de volume, marge autour de 12/9 ou seuil historique plus facile n'a été ajouté. L'étude ne réactive pas `candidate` : D4c consolidé reste inchangé, avec `not-calibrated`.

Les décisions encore non définies sont conservées comme blocages explicites : validation du profil expérimental, validation de la comparaison cumulative, articulation avec D4c non calibré, autorisation explicite d'une première activation. Les incertitudes sur la reprise après rupture, la sensibilité aux bornes et le niveau absolu de charge ne sont pas effacées.

## Trois calendriers distincts

1. **A** : délais actuels, sans filtre expérimental supplémentaire.
2. **B mécanique** : 12 jours pour le groupe structuré OU 9 jours pour les longues ; l'autre groupe reste à A. Le dossier hybride n'est pas imposé à cette branche contrefactuelle. Elle sert à mesurer l'effet des seuls délais ; elle n'est jamais recevable par défaut.
3. **B conditionnelle** : B seulement les jours où les conditions documentaires proposées sont toutes satisfaites, A sinon. La comparaison cumulative est ensuite effectuée sur le calendrier entier. Les validations humaines restent bloquantes, même si la comparaison passe.

La branche mécanique ne contourne donc pas les critères pour déclarer B activable : ses résultats sont séparés de ceux de la branche conditionnelle. En production, la politique effective reste toujours A.

## Méthode : 56 jours, toutes les propositions, pas seulement les exigeantes

Les scénarios commencent le 5 novembre 2026, date synthétique fixe, et couvrent huit semaines. Les dates futures du jeu d'entrée ne deviennent pas automatiquement des activités au fil de la simulation. Les événements de scénario sont fournis séparément et appliqués au jour déclaré.

L'orchestrateur existant choisit au plus une séance par jour disponible. Les protections D4b et les préférences/qualité/progression D2 sont réutilisées. Un adaptateur **local au laboratoire** remplace seulement les protections temporelles de D2 par celles du même paramétrage que l'orchestrateur. Un test vérifie l'identité complète avec D2 pour A, motifs compris. Cela évite de simuler B dans l'orchestrateur tout en laissant accidentellement une interdiction A dans D2.

Les catalogues comparatifs sont des ensembles synthétiques explicites, figés en contenu entre A et B. Les séances font 30 minutes, ou 90 minutes dans le scénario de niveau élevé, avec intensité identique pour un même type dans chaque branche. Une structurée déplacée ne devient pas plus longue ou plus intense ; le type sélectionné à une date peut évidemment changer. Les quatre types structurés partagent la même protection. Le classement de complémentarité existant permet leur alternance ; il n'est pas réécrit.

La référence de durée est recalculée chaque jour par le lecteur pur existant, à partir des activités connues. Aucun bilan inconnu ne devient `moderate` par défaut.

Deux modes sont distingués :

- **Projection** : les propositions deviennent seulement des intentions d'espacement. Elles n'alimentent ni expérience, ni charge réelle, ni confirmation. Sans nouvelle activité, les données récentes vieillissent.
- **Suivi synthétique** : les fixtures déclarent explicitement les bilans « réalisé comme proposé », partiels ou non réalisés, avec ressentis. Ce sont des hypothèses de scénario, pas une prédiction de comportement humain. Une réalisation partielle sans durée/type reste inconnue. Une non-réalisation n'ajoute aucune activité. Le type réel peut différer de la prescription.

Le calendrier complet, les jours de repos/non-disponibilité, les types admissibles, les paramètres quotidiens, les motifs de repli et les bilans figurent dans la capture. L'[annexe des calendriers](hybrid-calendar-results-v2.md) conserve toutes les propositions, faciles comprises, pour chaque branche et chaque scénario.

### Limites du périmètre

Ces calendriers isolent les effets temporels avec des contenus sportifs contrôlés. Ils ne reproduisent pas intégralement le générateur de catalogue applicatif, la recherche glissante à sept jours, les occurrences persistées et toute la continuité D3c d'une utilisation réelle. Les propositions du suivi ne sont donc pas présentées comme des prédictions exhaustives de l'application. Les chemins applicatifs réels sont testés séparément pour la non-régression et l'active périmée.

Il n'existe aucun basculement automatique après le calcul du cumul : une violation est signalée. Ni retrancher une séance pour faire passer B, ni choisir automatiquement le groupe le plus permissif n'est autorisé par l'étude. Une règle de résolution de calendrier non conforme reste à décider.

## Différences observées

### Structurées seules : même nombre, densité accrue

A propose les structurées les 17 novembre, 1er, 15 et 29 décembre. B mécanique les propose les 15 et 27 novembre, 9 et 21 décembre. Des faciles interviennent entre ces dates.

Les deux calendriers ont quatre séances exigeantes de 30 minutes, deux dans chacun des blocs de 28 jours. Pourtant le maximum glissant sur 14 jours passe de **1 séance / 30 minutes** sous A à **2 séances / 60 minutes** sous B. Le seul total à huit semaines aurait manqué ce cumul. La comparaison rejette cette variante mécanique.

B conditionnelle ne change pas les propositions de ce scénario : le dossier est rempli au départ, mais l'évolution du volume puis l'absence d'intervalle B récent le rendent insuffisant aux dates utiles. Les seuils n'ont pas été relâchés pour obtenir un résultat.

### Longues seules : 9 jours ne garantit pas une date plus tôt

Avec disponibilité quotidienne et une activité facile tous les deux jours, la date théorique J+9 peut être encore bloquée par le repos général après la facile précédente. A et B mécanique proposent alors les mêmes cinq longues, espacées de dix jours.

Avec disponibilités dimanche/mardi/jeudi, B mécanique propose six longues contre cinq sous A. Le premier bloc passe de deux à trois longues : dépassement du cumul de 28 jours. B conditionnelle conserve cinq longues, mais déplace des sélections ; elle respecte dans cette fixture les comptes/durées par bloc et les pics 7/14 jours comparés à A.

### Séquences mixtes et alternance

Dans `mixed-speed`, A produit notamment longue → longue → fractionné → longue → soutenue → longue → variations → longue → longue → côtes. B mécanique réorganise la suite en longue → fractionné → longue → soutenue → longue → variations → longue → côtes → longue. Les quatre familles ne disposent jamais de délais séparés.

Une date déplacée peut donc modifier plusieurs recommandations suivantes, y compris des longues dont le délai propre n'a pas été réduit. B mécanique propose neuf exigeantes contre dix sous A dans cette fixture ; cela ne prouve pas une meilleure récupération. B conditionnelle conserve A dans ce cas.

Dans `restricted-weekdays`, B conditionnelle déplace onze sélections quotidiennes et propose neuf exigeantes contre dix sous A. Les maxima restent à deux exigeantes sur sept jours et trois sur quatorze jours ; aucune durée supplémentaire par bloc n'est détectée. C'est un cas de laboratoire à examiner, pas une activation validée.

## Situations défavorables et stabilité

- `hard` et `very-hard` arrivant pendant le suivi font revenir la branche conditionnelle à A. Les préférences faciles et la protection `very-hard` restent effectives, sans être neutralisées par l'expérience à 12 jours.
- Une hausse avec activités supplémentaires conserve les motifs D2. La branche mécanique peut exposer une différence de calendrier, mais la branche conditionnelle reste à A.
- Le scénario de volume élevé ne reçoit aucun certificat de sûreté. Son pic de durée augmente dans la variante mécanique structurée ; aucun plafond physiologique universel n'est inventé.
- Reprise, ressentis inconnus et durée manquante empêchent la recevabilité tant que les conditions restent insuffisantes. Des réalisations synthétiques ultérieures peuvent enrichir les données ; aucune ancienne éligibilité n'est mémorisée.
- Correction ou suppression au cours du scénario modifie immédiatement les sources du dossier et les propositions suivantes. L'historique antérieur du calcul n'est pas réécrit comme si la correction avait été connue d'avance.
- Le fractionné partiel difficile compte pour sa durée et son type réels. À observations identiques, remplacer le statut `partial` par `completed` ne change pas les sélections suivantes.
- Une perspective ou une proposition non réalisée n'ajoute pas d'activité. En suivi, elle peut être reproposée ; une répétition d'offres n'est pas une répétition de pratique.
- Une active devenue incompatible après une nouvelle activité `very-hard` n'est plus réutilisée par le vrai pipeline ; l'occurrence reste intacte. Ce contrôle n'utilise pas de base de données.
- Inverser l'ordre de l'historique produit exactement les mêmes calendriers. Une réalisation à 12/9 ne crée ni motif automatique `close-family-sessions`, ni autorisation : elle reste soumise au contexte et aux validations manquantes.

Les basculements B→A se produisent parfois dès le lendemain d'un dossier recevable. Dans les scénarios restreints, plusieurs basculements proviennent des volumes glissants et de leur pente. C'est une fragilité temporelle à mesurer et à décider, pas une raison d'ajouter une tolérance ou un droit acquis en cachette.

## Calcul du cumul et protections évaluées

Les maxima glissants 7/14 jours incluent le passé exigeant réel connu à J, y compris une activité réelle le jour J, puis toutes les propositions. Les fenêtres traversant le début et la fin du calendrier sont examinées. Les bilans synthétiques des propositions ne sont pas comptés une seconde fois dans ce total de propositions. Les durées inconnues donnent une comparaison inconnue, jamais zéro.

Les périodes de 28 jours sont deux blocs consécutifs pour cette simulation de 56 jours. Les maxima 7/14 sont glissants. Une éventuelle exigence de maxima glissants sur 28 jours serait une décision supplémentaire à expliciter, pas ajoutée implicitement ici.

Pour les scénarios à correction/suppression, les maxima comparatifs de ce rapport restent ancrés sur le passé connu à J. Les sélections quotidiennes, elles, utilisent les sources corrigées. Avant activation, il faudra valider une comparaison de calendrier recalculée à chaque consultation et chaque changement de source. Les résultats de cumul des scénarios événementiels ne suffisent donc pas à autoriser B.

**Protections suffisantes pour les propriétés testées :** délais généraux, fenêtre de ressentis, regroupement des quatre structurées, séparation réelle/intention, absence de progression simultanée de contenu, réévaluation quotidienne, qualité D2, détection de densité accrue malgré un total inchangé, refus de comparer des durées inconnues, préservation d'une active périmée sans la réutiliser.

**Protections ou contrats encore manquants pour une activation :** approbation et stabilité du profil, résolution de D4c non calibré, calendrier complet issu du vrai adaptateur avec continuité et catalogue, cumul recalculé après événements, comportement précis si le calendrier B dépasse A, choix explicite d'un seul groupe, règles de retour et d'explication, validation de concurrence avant mémorisation de B. Le niveau absolu de charge et la récupération physiologique ne sont toujours pas mesurés.

## Décisions humaines exactes attendues

1. Approuver le profil expérimental tel quel ou demander une révision précise : 6/5 observations, 56/84 jours, correspondances exactes à B, fraîcheur, rupture documentaire et garde-fou directionnel de volume. Aucun de ces paramètres n'est médicalement validé.
2. Approuver ou modifier la définition du cumul : horizon, blocs de 28 jours, maxima 7/14, inclusion du passé et recalcul après modification ; décider du repli lorsque B échoue.
3. Décider comment le nouveau contrat traite `volume-interpretation-unvalidated` et `mixed-demanding-context` de D4c. Aucun renommage ne peut les résoudre à lui seul.
4. Choisir explicitement le groupe d'une éventuelle première expérimentation et autoriser son intégration limitée après validation de bout en bout. Aucune telle autorisation n'est donnée ici.

Il existe donc des **cas B conditionnels de laboratoire**, mais **zéro cas B activable avec le contrat actuel**. Conclusion : **maintien de A recommandé**. D4e-1 est une étude ; D4e n'est pas activé.

## Tableau synthétique des 19 scénarios


Le nombre de dates modifiées compte les différences de sélection quotidienne, faciles comprises. Les comptes de séances exigeantes incluent toutes les propositions ; en suivi, une proposition non réalisée peut être reproposée. Aucun de ces comptes ne doit être présenté comme une activité réellement accomplie.

| Scénario | Exigeantes A / Bm / Bc | Dates modifiées Bm / Bc | Cumul Bm | Cumul Bc |
| --- | --- | --- | --- | --- |
| `structured-only` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Dans les limites comparées |
| `long-only` | 5 / 5 / 5 | 0 / 0 | Dans les limites comparées | Dans les limites comparées |
| `long-restricted-weekdays` | 5 / 6 / 5 | 11 / 10 | Dépasse A | Dans les limites comparées |
| `mixed-speed` | 10 / 9 / 10 | 15 / 0 | Dans les limites comparées | Dans les limites comparées |
| `mixed-race` | 9 / 9 / 9 | 0 / 0 | Dans les limites comparées | Dans les limites comparées |
| `alternating-structured` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Dans les limites comparées |
| `projection-without-realization` | 1 / 1 / 1 | 0 / 0 | Dans les limites comparées | Dans les limites comparées |
| `hard-arrives` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Inconclusif |
| `very-hard-arrives` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Inconclusif |
| `volume-increase` | 0 / 1 / 0 | 1 / 0 | Dépasse A | Inconclusif |
| `high-stable-volume` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Dans les limites comparées |
| `return` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Dans les limites comparées |
| `unknown-efforts` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Dans les limites comparées |
| `partial-hard` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Dans les limites comparées |
| `not-performed` | 5 / 4 / 5 | 9 / 0 | Dans les limites comparées | Dans les limites comparées |
| `deleted-activity` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Inconclusif |
| `corrected-effort` | 4 / 4 / 4 | 8 / 0 | Dépasse A | Inconclusif |
| `restricted-weekdays` | 10 / 9 / 9 | 11 / 11 | Dans les limites comparées | Dans les limites comparées |
| `missing-duration` | 4 / 4 / 4 | 6 / 0 | Dépasse A | Inconclusif |

### Pics sur les cas représentatifs

Les durées ci-dessous sont des sommes de durées de séances exigeantes, pas des scores physiologiques.

| Cas / branche | Exigeantes bloc 1 / bloc 2 | Pic 7 jours : nombre / minutes | Pic 14 jours : nombre / minutes |
| --- | --- | --- | --- |
| `structured-only` / A | 2 / 2 | 1 / 30 | 1 / 30 |
| `structured-only` / Bm | 2 / 2 | 1 / 30 | 2 / 60 |
| `structured-only` / Bc | 2 / 2 | 1 / 30 | 1 / 30 |
| `long-only` / A | 2 / 3 | 1 / 30 | 2 / 60 |
| `long-only` / Bm | 2 / 3 | 1 / 30 | 2 / 60 |
| `long-only` / Bc | 2 / 3 | 1 / 30 | 2 / 60 |
| `long-restricted-weekdays` / A | 2 / 3 | 1 / 30 | 2 / 60 |
| `long-restricted-weekdays` / Bm | 3 / 3 | 1 / 30 | 2 / 60 |
| `long-restricted-weekdays` / Bc | 2 / 3 | 1 / 30 | 2 / 60 |
| `mixed-speed` / A | 5 / 5 | 2 / 60 | 3 / 90 |
| `mixed-speed` / Bm | 5 / 4 | 2 / 60 | 3 / 90 |
| `mixed-speed` / Bc | 5 / 5 | 2 / 60 | 3 / 90 |
| `restricted-weekdays` / A | 5 / 5 | 2 / 60 | 3 / 90 |
| `restricted-weekdays` / Bm | 5 / 4 | 2 / 60 | 3 / 90 |
| `restricted-weekdays` / Bc | 5 / 4 | 2 / 60 | 3 / 90 |
| `high-stable-volume` / A | 2 / 2 | 1 / 90 | 1 / 90 |
| `high-stable-volume` / Bm | 2 / 2 | 1 / 90 | 2 / 180 |
| `high-stable-volume` / Bc | 2 / 2 | 1 / 90 | 1 / 90 |

Les calendriers et changements de paramètres jour par jour figurent dans [l’annexe](hybrid-calendar-results-v2.md). Aucune violation quantitative détectée ne signifie ni récupération démontrée, ni activation autorisée.

## Fichiers et validation

Six fichiers ajoutés exclusivement dans `src/core/coach/simulation/` :

- `hybrid-dossier-v2.ts` : lecture des critères proposés et blocages humains.
- `hybrid-calendar-v2.ts` : simulation quotidienne, comparaison et cumul.
- `hybrid-calendar-fixtures-v2.ts` : 19 histoires synthétiques.
- `hybrid-calendar-v2.test.ts` : 41 tests de calendrier, frontières et non-régression.
- `hybrid-calendar-decision-v2.md` : présent rapport.
- `hybrid-calendar-results-v2.md` : calendriers quotidiens des trois branches.

Résultats de validation :

- Tests ciblés : **76 réussis**, dont les 41 tests ajoutés.
- Suite complète : **2 102 réussis, 1 ignoré** ; 112 fichiers réussis, 1 ignoré.
- Compatibilité de récupération : **111 tests réussis** ; captures complètes des décisions avant/après strictement identiques.
- Comparaison quotidienne de A avec l’orchestrateur existant ; comparaison du vrai adaptateur avant/après étude pour trois tempéraments, recommandations actives et perspectives incluses.
- `npx tsc -b` : réussi.
- `npm run build` : réussi ; avertissement existant sur un bundle supérieur à 500 kB.
- `git diff --check` : réussi ; espaces de fin également contrôlés dans les six fichiers non suivis.
- Empreintes SHA-256 de tous les fichiers préexistants capturés : inchangées, y compris `.agents/`, version, changelog et travaux antérieurs.

Les vérifications ont été relancées séquentiellement après un dépassement de délai lors de deux suites concurrentes. Les recalculs identiques dans les tests ont été mutualisés ; aucune assertion n’a été supprimée. Aucun test navigateur n’est ajouté à cette étude pure. Aucun accès à la base historique, aucune opération Git d’écriture et aucune activation.

Commandes de reproduction depuis la racine :

```sh
HYBRID_CALENDAR_CAPTURE=1 npx vitest run src/core/coach/simulation/hybrid-calendar-v2.test.ts src/core/coach/recovery-policy-v2.test.ts src/core/coach/presentation-identity-v2.test.ts
npx vitest run src/core/coach/recovery-compatibility-v2.test.ts
npm test
npx tsc -b
npm run build
git diff --check
```

La première commande écrit `/tmp/d4e1-calendars.json`, avec les calendriers, admissibilités quotidiennes, transitions, paramètres et motifs détaillés. Les tests restent déterministes sans cette capture. Aucun module de production n’importe les nouveaux modules de simulation.
