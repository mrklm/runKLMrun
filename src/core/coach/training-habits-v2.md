# D4a — habitudes et espacements observés

`analyzeTrainingHabitsV2` est une fonction pure, déterministe et descriptive.
Elle ne participe ni à la sélection ni au classement du Coach. Aucun appelant
applicatif n'est ajouté. D4b et D4c restent hors de cette étape.

## Entrées et réutilisation

- `activities` : preuves d'activité du contrat D1 (`RecordedActivityEvidence`),
  également compatibles avec les activités uniques de D3b.
- `referenceDate` : date civile explicitement fournie, jamais l'horloge système.
- `reference` : référence existante du Coach à cette date, avec sa confiance.
- `sourceIssues` facultatif : diagnostics D3b à conserver lorsque des données
  ont déjà été exclues en amont.

D2a (`analyzeRecentLoadV2`) assure la normalisation, le regroupement des doublons,
l'exclusion des contradictions et dates futures, les rapports de durée et les
agrégats 3/7/14 jours. Les confirmations de réalisation n'entrent pas dans ces
calculs. Aucune occurrence ni prescription n'est transformée en activité.

L'horizon de 28 jours réutilise la constante de régularité du catalogue. Le
calcul d'introduction du fractionné n'est pas repris comme jugement d'habitude :
D4a décrit des données normalisées, sans seuil d'éligibilité. L'état existant de
progression n'est ni appelé ni modifié.

Attention : D1 conserve la première entrée admissible d'un identifiant dupliqué.
Si des données sont déjà réduites par D1, D4a ne peut pas retrouver une
contradiction supprimée. Pour une source non garantie unique, fournir les preuves
avant réduction ou les activités validées D3b avec leurs `issues`. Les sorties
signalent toujours que l'exhaustivité de l'historique est inconnue.

## Quatre concepts séparés

1. `immediateContext` : dernière date enregistrée et nombre de jours civils
   écoulés. `recoveryStatus` vaut toujours `not-measured`. Aucun repos réel déduit.
2. `demandingSpacing` : fréquences, espacements, durées relatives et ressentis des
   séances structurées et des sorties longues réellement déclarées.
3. `cumulativeLoad` : volumes, concentration et couvertures D2a ; comparaison
   descriptive de deux périodes adjacentes de sept jours.
4. `historicalRegularity` : activité enregistrée sur quatre périodes de sept
   jours, sans qualification du niveau ou de la récupération du coureur.

Aucun score physiologique, coefficient de ressenti, délai conseillé, tolérance
acquise, répétition restante ou décision de progression n'est produit.

## Périodes et définitions

Pour une date de référence J :

| Indicateur | Définition et période |
| --- | --- |
| Habitudes récentes | J−27 à J inclus, soit 28 jours civils |
| Semaines actives | Nombre de périodes contenant au moins une activité enregistrée parmi J−27…J−21, J−20…J−14, J−13…J−7 et J−6…J |
| Jours actifs par semaine | Nombre de dates civiles distinctes dans chaque période ; deux activités le même jour comptent pour un jour |
| Fréquence | Nombre d'activités enregistrées divisé par quatre semaines entières ; pas par les seules semaines actives |
| Espacements | Écarts civils entre activités du groupe, toutes situées dans la fenêtre de 28 jours ; aucune paire traversant la borne gauche |
| Même jour | n activités produisent n−1 écarts nuls ; leurs identifiants sont regroupés sans inventer un ordre horaire |
| Structurées | Groupe commun `intervals`, `steady-run`, `hills`, `endurance-variations`, avec détail par famille ; les alternances participent aux écarts du groupe |
| Longues | Groupe séparé `long-run` ; une durée élevée seule ne classe pas une activité en sortie longue |
| Durée relative | Durée enregistrée divisée par la référence fournie à J, pas par une référence historique reconstruite ; référence absente/périmée ou rapport non fini : null |
| Ressentis | Comptages easy/moderate/hard/very-hard/inconnu et liste sourcée des ressentis du groupe |
| Charge cumulée | Agrégats D2a sur 3, 7 et 14 jours, avec leurs dates inclusives |
| Évolution du volume | Somme J−6…J comparée à J−13…J−7 ; increased/equal/decreased/unknown, sans conclusion de surcharge ou récupération |
| Dernière activité | Dernière date valide au plus tard à J dans toute l'entrée ; peut précéder la fenêtre récente |

Les semaines sont des périodes glissantes ancrées sur J, pas des semaines ISO.
Le minimum et le maximum des écarts sont descriptifs. Avec moins de deux
activités du groupe, ils valent null et l'espacement est insuffisamment documenté.
La liste `gapDays` compte un écart par transition entre activités, tandis que
`betweenActiveDays` cite les groupes sources des dates successives. L'ordre
intrajournalier n'est jamais présenté comme connu.

La comparaison des volumes reste inconnue si une des deux périodes ne contient
aucune activité enregistrée, si une durée manque, si un total déborde, ou si les
diagnostics d'entrée empêchent une comparaison fiable. Une fenêtre vide n'est
pas assimilée à une semaine sans pratique. Les sommes D2a partielles restent
visibles avec leur couverture, sans être utilisées comme volumes complets.

## Traçabilité et qualité

Chaque indicateur expose :

- `period` : bornes inclusives et nombre de jours ;
- `sourceActivityIds` : activités du groupe utilisées ;
- `populationActivityIds` : activités connues examinées pour les dénominateurs ;
- `coverage` : activités enregistrées, classifiées, du groupe, valeurs connues,
  identifiants manquants et types inconnus ;
- `inputQuality` : identifiants absents, doublons, exclusions D2a et diagnostics
  amont D3b, explicitement relatifs à toute l'entrée ;
- `limitations` : limites propres à l'indicateur ;
- `status` : observed, no-records ou insufficient-data.

`knownValues` désigne le nombre d'activités du groupe portant les valeurs
requises, pas le nombre d'intervalles ni une confiance physiologique. Les fenêtres
D2a conservent en plus les couvertures distinctes durée/distance/type/ressenti.
Une distance manquante peut rendre cet agrégat global incomplet sans empêcher
la comparaison séparée des volumes de durée lorsque ceux-ci sont complets.

Les contradictions ne sont pas arbitrées : les doublons identiques sont comptés
une fois, les identifiants contradictoires sont exclus. Les diagnostics invalides
ou contradictoires sont conservateurs pour tous les indicateurs, car leur date
ne peut pas toujours être attribuée fiablement à une période. Les dates futures
sont signalées mais ne dégradent pas à elles seules les observations présentes.

Un type inconnu peut cacher une séance structurée ou longue : les fréquences
connues restent visibles, mais leur couverture est insuffisante. Un ressenti
manquant ne devient pas facile. Une confirmation completed ou partial n'ajoute
aucune durée, fréquence ou preuve de tolérance. Une non-réalisation ne crée
aucune activité ; elle ne supprime pas non plus une activité réelle indépendante.

Une référence provisoire peut produire un rapport descriptif selon D2a ; sa
confiance reste exposée. Ce rapport n'est pas une preuve de capacité actuelle.

## Corrections, isolation et recommandations

Aucun résultat n'est mémorisé. Corriger le type ou le ressenti, retirer un bilan,
supprimer une activité ou invalider un lien D3b produit une nouvelle analyse
fondée sur les seules sources présentes. Aucun bonus ni pénalité résiduel.

Les tests utilisent exclusivement des objets synthétiques en mémoire. La
comparaison avant/après couvre les trois tempéraments, une occurrence active,
la sélection complète et les perspectives. Les entrées sont figées pour vérifier
l'absence de mutation. Le module n'est importé par aucun chemin applicatif.

Les protections de 2/7/10/14 jours, le catalogue, les perspectives, les occurrences,
les formulaires, le schéma IndexedDB, les sauvegardes et la version sont inchangés.

## Réutilisation possible, sans activation

D4b pourra transporter ces observations et leurs diagnostics dans un contrat
commun, sans recalculer une autre définition des espacements. D4c pourra examiner
plusieurs observations concordantes : fréquence, espacement entre familles,
volumes comparables, ressentis et couverture. Aucune de ces observations ne
justifie isolément un raccourcissement. Les critères et valeurs futurs restent
à valider explicitement.

## Vérifications exécutées

- Tests ciblés D4a, D2a et D3b : 90 réussis dans trois fichiers, dont 32 cas D4a.
- Suite complète : 1 655 réussis, un test optionnel de très grosse sauvegarde
  ignoré par défaut ; 105 fichiers réussis, un ignoré.
- `npx tsc -b` : réussi.
- `npm run build` : réussi. Même liste de fichiers générés et mêmes empreintes
  de noms que le build v1.1.0 précédent, dont `index-Gl41gkIV.js`.
- Avertissement Vite conservé : paquet principal de 574,25 ko, supérieur à 500 ko.
- `git diff --check` et vérification des espaces finaux des nouveaux fichiers : réussis.
- Comparaison des empreintes SHA-256 : tous les fichiers préexistants sont
  inchangés, y compris les modifications locales, `.agents/`, la version,
  le changelog, le catalogue, les protections et les contrats persistants.

Les 32 cas D4a couvrent régularité, début, reprise apparente, alternance des quatre
familles structurées, activités du même jour, sorties longues, couverture
incomplète, confirmations partielles/complètes, type réel différent, doublons,
diagnostics D3b, volumes en hausse/égaux/en baisse, références indisponibles ou
provisoires, dépassements numériques, frontières civiles, activités futures,
corrections/suppressions et invariance du Coach pour ses trois tempéraments.

Seuls trois fichiers sont ajoutés : cette documentation, le module
`training-habits-v2.ts` et ses tests `training-habits-v2.test.ts`.
Aucune opération Git d'écriture, aucune migration et aucun début de D4b.
