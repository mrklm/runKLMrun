# Consolidation D4c après D4d — aucune activation

## Décision de périmètre

L'option A reste appliquée : 2/7/10/14 jours inchangés. B demeure une hypothèse d'étude. D4e n'est pas commencé. Cette consolidation modifie uniquement l'analyse autonome D4c et adapte son laboratoire D4d ; aucun import dans le classement, les recommandations, les actives, la présentation ou les perspectives réelles.

La version interne du contrat descriptif devient `d4c-consolidated-2`. Ce n'est pas une modification de version de l'application.

**Aucun scénario ne produit actuellement `candidate`.** Le contrat conserve les trois conclusions, mais les critères permettant de qualifier la stabilité du volume pour un assouplissement ne sont pas suffisamment justifiés. L'incertitude `volume-interpretation-unvalidated` est donc explicite dans chaque évaluation. `candidateReadiness.status` vaut `not-calibrated`. C'est le repli prudent demandé, pas une décision physiologique ni une activation différée implicite.

## Trois niveaux distincts

1. **Observations** : `observations` expose fréquence enregistrée, quatre semaines glissantes, espacements réels, durées relatives, ressentis, volumes hebdomadaires, transitions, tendance, concentration et contribution cumulée des groupes exigeants. Les sources et les couvertures sont conservées. Il s'agit de pratique enregistrée, dont l'exhaustivité reste inconnue.
2. **Éligibilité** : `favorable`, `unfavorable`, `missing`, `uncertainties`, `reasons` et `conclusion` interprètent les preuves et leurs limites. Un ressenti facile ou une séance complète ne suffit jamais. Une absence de signal défavorable ne remplace pas les preuves manquantes.
3. **Admissibilité temporelle** : `admissibility` expose séparément la porte D4b actuelle pour le groupe concerné. Elle ne garantit pas une recommandation : le catalogue et les autres contrôles applicatifs demeurent nécessaires. Un intervalle de 12 jours peut être neutre pour l'éligibilité tout en restant bloqué par D4b.

Aucune recommandation, occurrence ou perspective n'entre dans les preuves de tolérance. Les confirmations `completed` et `partial` restent sans pondération. Les corrections et suppressions déclenchent un calcul sur l'instantané actuel, jamais la conservation d'un droit acquis.

## Critères modifiés et motifs

| Élément | Avant | Après | Motif |
| --- | --- | --- | --- |
| Égalité des volumes | Égalité favorable ; toute hausse défavorable ; baisse insuffisante | Égalité, variation, transitions, pente et étendue sont des observations. Qualification pour assouplissement non calibrée, donc insuffisante | Une minute ne démontre pas une surcharge ; l'égalité peut masquer un niveau élevé ou des répartitions différentes |
| Quatre semaines | Une activité par bloc comptait comme régularité favorable | Maintien du constat de couverture, avec le détail des fréquences et espacements ; jamais suffisant à la candidature | Couverture documentaire ne signifie pas stabilité des habitudes |
| Répétition du groupe | Deux dates suffisaient à l'observation favorable | Trois dates distinctes au minimum pour disposer de plusieurs intervalles, sans conclure à une expérience suffisante pour réduire un délai | Deux dates ne donnent qu'un seul intervalle. Trois est un minimum de réplication descriptive, pas un seuil physiologique |
| Espacements structurés/longs | Moins de 14/10 jours automatiquement défavorable | Intervalles bruts exposés, sans comparaison à ces délais dans la décision d'éligibilité | Supprimer la contradiction qui disqualifiait automatiquement une séance future réalisée à un délai réduit |
| Espacement croisé | Moins de deux jours automatiquement défavorable | Proximité observée et incertitude de cumul ; D4b traite séparément le repos minimal après l'activité | Aucun délai croisé historique ne prouve la récupération ou sa défaillance |
| Concentration | Plusieurs activités dans trois jours suffisaient au maintien | Réutilisation des motifs concordants existants D2 : concentration avec hausse comparable, ou durée supérieure à la référence confirmée | Ne pas qualifier une concentration isolée comme une surcharge mesurée |
| Présence des deux groupes | Pouvait laisser deux candidatures simultanées | `mixed-demanding-context` expose l'absence de protection de cumul calibrée ; pas de candidature simultanée implicite | Un délai indépendant par groupe ne maîtrise pas leur densité cumulée |

Les ressentis `hard`/`very-hard` récents (sept jours, toutes activités) et ceux du groupe sur 28 jours restent défavorables documentés pour D4c. Cette fenêtre historique n'allonge pas les protections D4b. Les données contradictoires ou manquantes restent des lacunes, pas des ressentis négatifs imputés.

## Volume : calculs réutilisés, sans nouvelle tolérance

`volume-observations-v2.ts` extrait les calculs descriptifs auparavant présents dans le laboratoire D4d. D4c et D4d utilisent désormais la même fonction pure. Les 23 sorties de volume sont strictement identiques avant/après l'extraction.

Elle conserve les quatre périodes D4a et les mesures D2a, puis expose :

- Les sommes connues, nombres de valeurs manquantes et identifiants par semaine.
- La variation relative de la dernière semaine par rapport à la médiane des trois précédentes.
- Les variations absolues et relatives entre chaque paire de semaines adjacentes.
- La pente des moindres carrés et l'étendue des quatre volumes.
- L'égalité descriptive D4a, conservée pour comparaison, **sans rôle favorable dans l'éligibilité**.

Les semaines sans activité enregistrée ne sont pas un repos prouvé. Les valeurs incomplètes empêchent les comparaisons correspondantes ; aucune durée n'est imputée. Une pente nulle ne prouve pas la stabilité. Aucune marge relative n'est ajoutée à D4c. Le paramètre facultatif d'essai D4d reste purement expérimental et ne modifie pas l'éligibilité.

Un volume élevé mais stable est insuffisant : aucun seuil de niveau absolu n'a été inventé. Une hausse progressive ou isolée est exposée sans devenir automatiquement défavorable ; une hausse et une concentration concordantes conservent le motif prudent de D2. Ce motif ne constitue pas un diagnostic physiologique.

## Interactions et charge cumulée

Les quatre types structurés restent un groupe commun. Les longues restent séparées. Les proximités croisées, le nombre d'activités exigeantes et leurs durées connues/absentes par semaine sont exposés dans `observations.demanding`. Aucune intensité n'est pondérée et les durées ne sont pas assimilées à une charge physiologique.

La présence des deux groupes ajoute une incertitude de cumul, pas un délai partagé. Plusieurs séances proches avec ressenti facile restent insuffisantes ; avec ressenti difficile, le ressenti justifie le maintien. Une concentration récente avec hausse de volume documentée peut aussi justifier le maintien via D2. Ni l'alternance des quatre familles ni un ressenti facile ne contourne ces distinctions.

## Possibilité future de candidate

Il n'existe actuellement **aucun scénario activant `candidate`** dans ce contrat consolidé, y compris les anciens cas favorables du laboratoire. C'est volontaire et explicitement testé. Trois dates documentées, plusieurs ressentis concordants et quatre semaines couvertes apportent des observations favorables, mais ne lèvent pas l'incertitude sur le volume et les cumuls.

Avant D4e, il reste nécessaire de :

1. Justifier un critère descriptif de volume exploitable pour l'étude, en distinguant stabilité, niveau absolu et variations de composition ; ne pas choisir une marge pour obtenir davantage de candidats.
2. Définir la profondeur et la qualité d'expérience nécessaires au-delà d'un minimum de réplication, avec des données permettant d'évaluer leurs limites.
3. Définir le traitement commun de la densité des séances exigeantes et des variations simultanées de durée et de fréquence, sans introduire implicitement un délai obligatoire partagé.
4. Vérifier la cohérence sur plusieurs consultations : une séance à 12/9 jours ne doit pas créer un maintien automatique ni une candidature automatique.
5. Valider explicitement le périmètre de D4e. Aucune réduction ni intégration au moteur ne découle de cette consolidation.

Les omissions silencieuses, ressentis subjectifs, diagnostics amont non datables et absence de mesure physiologique restent des limites. La restriction actuelle est assumée plutôt que masquée derrière un score.

## Comparaison des 23 scénarios D4d

Les colonnes comparent les deux groupes séparément ; le moteur sportif conserve exactement ses résultats. M = `maintain`, I = `insufficient-data`, C = `candidate`. Les risques et descriptions des fixtures D4d restent historiques ; seules leurs attentes de classification ont été adaptées.

| Scénario | Structurées avant → après | Longues avant → après |
| --- | --- | --- |
| `slight-variation` | M → I | M → I |
| `equal-volume` | C → I | I → I |
| `high-volume` | C → I | I → I |
| `beginner` | I → I | I → I |
| `return` | I → I | I → I |
| `regular-intervals` | C → I | I → I |
| `partial-hard` | M → M | M → M |
| `completed-very-hard` | M → M | M → M |
| `repeated-long` | I → I | C → I |
| `alternating-families` | M → I | I → I |
| `close-long-structured` | M → I | M → I |
| `volume-increase` | M → I | M → I |
| `no-effort` | I → I | I → I |
| `partial-coverage` | I → I | I → I |
| `corrected-effort` | C → I | I → I |
| `deleted-review` | I → I | I → I |
| `future-perspectives` | C → I | I → I |
| `no-family-practice` | I → I | I → I |
| `joint-candidate` | C → I | C → I |
| `omitted-record` | C → I | I → I |
| `decreased-volume` | I → I | I → I |
| `deleted-activity` | I → I | I → I |
| `old-hard` | M → M | I → I |

Sur 46 évaluations de groupe : avant, 9 C, 12 M et 25 I ; après, 0 C, 5 M et 41 I.

Les anciens C deviennent I faute de critère de volume suffisamment justifié. Les M liés uniquement à une hausse isolée ou un espacement historique deviennent I. Les M liés aux ressentis documentés restent M. Des tests complémentaires, hors des 23 scénarios, vérifient que concentration et hausse concordantes restent M via D2.

Les 69 résultats applicatifs capturés (23 scénarios × trois tempéraments), les 23 sorties descriptives de volume, les décisions D2/D4b et les portes théoriques des hypothèses sont identiques avant/après. Les sorties `withD4cFilter` du laboratoire changent conformément à la nouvelle éligibilité : elles conservent désormais A. Elles ne sont jamais utilisées par l’application.

## Fichiers et vérifications

Ajouts : `volume-observations-v2.ts` et ce document. Modifications ciblées : `spacing-eligibility-v2.ts`, son test et sa documentation ; `simulation/spacing-calibration-v2.ts`, son test et sa documentation. Les deux anciennes documentations sont conservées comme archives, avec un renvoi explicite au contrat consolidé. Aucun autre fichier initial n'a changé selon le contrôle SHA-256.

- Tests ciblés : 174 réussis (D4c consolidé, laboratoire D4d et protections D4b).
- Suite complète : 1 946 réussis, un ignoré ; 110 fichiers réussis, un ignoré.
- Non-régression historique : 111 snapshots et objets applicatifs complets identiques.
- Laboratoire : 69 comparaisons avant/après d'appels d'étude sur les trois tempéraments ; recommandations, actives et perspectives identiques.
- Extraction du volume : égalité des 23 sorties avant/après ; mêmes décisions D2/D4b et mêmes portes théoriques.
- TypeScript, build et `git diff --check` réussis ; contrôle supplémentaire des espaces de fin de ligne pour les fichiers non suivis.
- Bundles de production inchangés ; avertissement existant pour un bundle de plus de 500 kB.
- `.agents/`, autres modifications préexistantes, délais, version, changelog, formulaires, IndexedDB et sauvegardes préservés.
- Données synthétiques uniquement, aucun accès à la base historique, aucune migration, aucune opération Git d'écriture ni déploiement.

A reste actif. B n'est pas activé. D4e n'est pas commencé.
