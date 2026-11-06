# Proposition de politique adaptative hybride — soumise à validation

## Statut et principe

Document de conception uniquement. A reste la référence appliquée : 14 jours entre les quatre familles structurées regroupées, 10 jours entre longues ; repos général de 2 jours et fenêtre de ressenti de 7 jours inchangés. B (12/9) n'est ni activé ni autorisé par ce document. Aucun module, paramètre applicatif, classement, occurrence, perspective ou stockage n'est modifié. D4e n'est pas commencé.

La proposition est de **reconnaître une expérience enregistrée concordante, puis de limiter l'exposition supplémentaire**, sans estimer une récupération physiologique. Une fréquence élevée, une séance `completed`, un ressenti facile ou l'absence de blocage D2 ne suffisent pas. Les conditions se cumulent ; aucun critère favorable ne compense un signal défavorable ou une donnée requise manquante.

Cette version fixe une architecture et propose un profil chiffré pour une prochaine calibration. Ce profil n'est pas validé : ses valeurs sont des choix éditoriaux de réplication et de périmètre, pas des seuils physiologiques. Il faut pouvoir les modifier ou les abandonner si les comparaisons montrent des effets indésirables. Aucun résultat `candidate` actuel n'est réactivé.

## Réutilisation des modules

| Besoin | Source existante | Usage proposé |
| --- | --- | --- |
| Normalisation et charge récente | `recent-load-v2.ts` | Identifiants, dates, durées, types, ressentis, exclusions ; fenêtres 3/7/14 jours |
| Habitudes récentes et couverture | `training-habits-v2.ts` | Quatre semaines, jours actifs, espacements, ressentis et limites de couverture |
| Profondeur 28/56/84 jours | `simulation/frequency-history-v2.ts` | Dates pertinentes, intervalles distincts, histogrammes, semaines/blocs occupés, durée réellement couverte |
| Volume descriptif | `volume-observations-v2.ts` | Sommes hebdomadaires, médiane des semaines antérieures, transitions, pente, couverture ; ne pas recalculer ces valeurs |
| Signaux concordants de charge | `load-adaptation-policy-v2.ts` | Ressenti difficile, concentration avec hausse ou avec durée supérieure à la référence, inconnues |
| Protections et levées | `recovery-policy-v2.ts` | Source unique des délais et préférences ; conserver les protections existantes |
| Limites de l'éligibilité | `spacing-eligibility-v2.ts` | Motifs défavorables, inconnues, séparation observations/admissibilité ; ne pas contourner `not-calibrated` |
| Comparaison mécanique A/B | `simulation/spacing-calibration-v2.ts` | Portes temporelles uniquement, pas simulation complète du classement ou des effets cumulés |

Les observations, l'éligibilité à une étude et l'admissibilité sportive restent trois niveaux distincts. Les calculs existants suffisent à renseigner la plupart des critères historiques. Ils ne fournissent pas encore une comparaison complète de deux calendriers A/B : ce manque doit rester explicite.

## 1. Profondeur : profil de calibration proposé

Évaluer séparément le groupe structuré et les longues. La fenêtre de collecte serait de 84 jours, avec les vues 28 et 56 conservées pour détecter la sensibilité aux bornes.

Pour un premier profil de laboratoire, proposer **toutes** les conditions suivantes :

- Au moins **6 dates distinctes** du groupe et **5 intervalles entre jours distincts** dans les 84 jours. Les écarts nuls du même jour n'augmentent pas la profondeur requise.
- Un segment entre première et dernière date couvrant au moins **56 jours civils inclusifs**.
- Des séances du groupe dans chacun des **3 blocs de 28 jours**, avec au moins **2 dates dans le bloc récent**.
- Au moins **3 intervalles exactement égaux à B** (12 jours structurés ou 9 jours longues), dont les dates d'arrivée occupent au moins **2 blocs de 28 jours** ; au moins un de ces intervalles doit être entièrement contenu dans les 28 jours récents.

Le but est d'éviter de qualifier un seul intervalle ou un épisode concentré. Six dates/cinq intervalles dépassent la répétition minimale ; trois correspondances réparties empêchent qu'un unique couple fortuit justifie B. Le choix exact de ces nombres n'est pas établi par les études et reste à tester. Les fenêtres imbriquées ne sont jamais additionnées comme observations indépendantes ; des intervalles adjacents partagent une activité.

L'égalité exacte à B est volontairement restrictive pour la première comparaison : elle établit une concordance avec la pratique enregistrée, sans marge inventée. Elle exclurait des rythmes 11/13 jours potentiellement voisins ; ce faux négatif est connu. Des intervalles à 7 jours ne comptent pas automatiquement comme preuves en faveur de 12 jours. Les rythmes à 14 ou 18 jours ne documentent pas automatiquement 12 jours. Il ne faut pas transformer ce profil de laboratoire en exigence demandant au coureur de réaliser des séances rapprochées pour devenir éligible.

Analyse de sensibilité à prévoir : comparer 4/6/8 dates, 2/3/4 correspondances à B, et les trois horizons existants. Ces nombres sont des variantes de dossier, pas des recommandations d'entraînement. Si le résultat dépend d'une seule observation ou d'un léger déplacement de la date de consultation, le dossier reste incertain.

## 2. Fraîcheur : ne pas importer une ancienne habitude dans une reprise

Profil initial à discuter : dernière séance du groupe à **J-14 au plus**, deux dates dans les 28 jours récents et présence récente d'un intervalle à B, comme ci-dessus. Les 14 jours sont ici une fenêtre documentaire empruntée à l'analyse récente, pas un nouveau délai de récupération ni une garantie de fraîcheur suffisante.

Exposer systématiquement l'ancienneté de la dernière activité globale et de la dernière séance du groupe, l'intervalle maximal, les blocs vides et l'évolution des comptes hebdomadaires. Un bloc de 28 jours sans séance pertinente, ou un intervalle du groupe supérieur à 28 jours, serait un **signal de rupture documentaire à examiner**, non la preuve d'une interruption réelle ou d'une mauvaise récupération.

Pour le premier profil, une telle rupture non expliquée empêcherait B : repli A avec motif `recent-practice-uncertain`. Ne pas réutiliser les séances antérieures à une reprise apparente pour fabriquer une profondeur récente. La définition d'un segment après rupture et les éléments permettant de lever cette incertitude restent à valider ; en leur absence, aucun rétablissement automatique. Ce choix peut exclure longtemps un historique pourtant approprié : il doit être mesuré lors de la calibration.

## 3. Couverture : compter des preuves identifiables, pas leur absence

Exigences documentaires proposées :

- Sources admissibles D1/D3b, dates non futures, identifiants valides. Doublons identiques dédupliqués ; contradictions non résolues : dossier insuffisant, sans choisir la version favorable.
- Type réel connu pour les activités de la fenêtre historique retenue, afin de ne pas manquer des séances exigeantes ou fausser leurs intervalles.
- Durées et ressentis connus pour les séances exigeantes servant de preuves historiques, et pour toutes les activités des 28 jours récents utilisées dans l'analyse de charge.
- Chaque fenêtre de volume requise contient des observations, sans durée inconnue ni dépassement numérique. Un total de zéro faute d'enregistrements ne représente pas du repos prouvé.
- Aucun diagnostic amont susceptible d'altérer les preuves retenues ne reste non résolu. Un diagnostic non datable ne doit pas être silencieusement écarté.

La couverture des champs n'est jamais une preuve d'exhaustivité. Aucune référence à une prescription, confirmation `completed`/`partial` ou perspective ne remplace un type, une durée ou un ressenti réel absent. Une correction valide n'est pas pénalisée en tant que correction : elle remplace l'observation courante. Après correction ou suppression, recalculer tous les critères ; aucun statut acquis ni journal inventé.

La disponibilité actuelle d'un journal d'import exhaustif ou d'une connaissance de la pratique non enregistrée ne doit pas être supposée. Cette limite reste dans le résultat, même si tous les champs connus sont renseignés.

## 4. Charge : veto sur les signaux, prudence sur les inconnues

### Conditions existantes à conserver

- `very-hard` dans les sept jours : protections exigeantes D4b inchangées, aucune réduction expérimentale.
- `hard` récent : retirer l'étude de réduction et conserver le comportement D4b de préférence facile. Cela ne transforme pas `hard` en interdiction générale de courir.
- Ressenti défavorable du groupe sur les 28 jours : garder le motif prudent D4c pour cette étude, sans prolonger la protection sportive de sept jours.
- Concentration et hausse comparable, ou concentration et durée supérieure à la référence confirmée : conserver les motifs D2, sans compensation par une longue expérience.
- Référence nécessaire manquante, durée/ressenti inconnu ou volume non comparable : dossier insuffisant ; l'absence de signal détecté n'est pas un feu vert.

### Condition expérimentale de non-augmentation, distincte de la stabilité

Ne pas restaurer l'égalité stricte et ne pas introduire une tolérance de type « +x % acceptable ». Pour la prochaine calibration, examiner ce garde-fou directionnel :

1. Les quatre semaines sont comparables pour les activités enregistrées.
2. Le volume de la dernière semaine ne dépasse ni celui de la semaine précédente ni la médiane des trois semaines précédentes.
3. La pente des quatre semaines n'est pas positive.
4. Si les deux dernières transitions sont strictement négatives, classer le changement de régime comme incertain plutôt que d'y voir une preuve favorable.

Ces comparaisons utilisent les valeurs déjà calculées. Les bornes à zéro expriment une absence d'augmentation, pas un seuil de surcharge. Ce garde-fou reste sensible aux fluctuations minimes et au découpage : une minute supplémentaire pourrait écarter B, **avec un motif de prudence pour l'expérimentation, pas `maintain` physiologique**. Une baisse ponctuelle peut satisfaire la non-augmentation mais n'est pas une preuve de récupération. Une pente nulle peut cacher des oscillations ; conserver l'étendue et les transitions dans le dossier.

Si cette règle n'est pas retenue après calibration, le volume reste `not-calibrated`, comme dans D4c consolidé, et B reste indisponible. Aucun profil n'est réputé validé par ce document.

Un niveau élevé mais stable peut satisfaire une règle de non-augmentation. Ce garde-fou ne résout donc pas la question du niveau absolu approprié. Il ne faut ni inventer un plafond universel ni présenter le dossier comme médicalement sûr. La limitation de l'exposition projetée ci-dessous est complémentaire ; elle ne résout pas cette incertitude physiologique.

## 5. Cumul : évaluer le calendrier entier, pas deux permissions indépendantes

Observer l'union des séances exigeantes : effectifs, durées connues, intervalles, jours mixtes et distribution par semaine. Ne pas fusionner les délais des longues et structurées. Aucune séparation croisée de 9, 10, 12 ou 14 jours n'est créée.

Pour une première expérimentation limitée, proposer :

- **Un seul groupe étudié à la fois.** Si les deux dossiers sont recevables, ne pas sélectionner automatiquement le plus permissif. Le groupe expérimental devra être défini explicitement ; à défaut, A pour les deux.
- **Pas d'augmentation simultanée de durée ou d'intensité.** Une réduction de délai ne doit pas déclencher une progression de durée en parallèle. Ce serait une restriction de l'expérimentation, pas un changement autorisé aujourd'hui.
- **Aucun accord automatique pour les historiques mêlant les deux groupes** tant qu'une comparaison de leur cumul projeté n'est pas disponible. La présence des deux groupes n'est pas en soi défavorable ; c'est un manque de protection calibrée.
- Avant toute future sélection B, comparer un calendrier A de référence et la variante B avec les mêmes sources, disponibilités et contenus sportifs. Sur les 28 jours projetés, B ne doit pas ajouter de séance exigeante ni augmenter leur durée totale par rapport à A.
- Comparer aussi les maxima de nombre de séances exigeantes et de durée cumulée sur les fenêtres glissantes de 7 et 14 jours de ces calendriers. Inclure les activités réelles récentes qui croisent le début de la projection ; ne pas masquer un rapprochement à la frontière de J.
- B ne doit pas dépasser ces maxima A. La première expérience pourrait donc avancer une date tout en conservant le nombre et la durée des séances, plutôt qu'autoriser une cadence supplémentaire saturant le délai réduit.

Ces plafonds sont une proposition de **non-augmentation relative à A**, pas une estimation de charge tolérable. Les fenêtres 7/14/28 proviennent des analyses existantes ; elles restent des choix éditoriaux pour cette comparaison. Leur suffisance et leur sensibilité aux bords doivent être étudiées. La référence A n'est pas elle-même une garantie physiologique.

Cette comparaison de calendriers n'existe pas encore dans `spacing-calibration-v2.ts`, qui compare des portes temporelles. Elle n'est pas implémentée ici. Tant qu'elle manque, la protection de cumul reste non calibrée : B ne peut pas être activé, même pour un groupe isolé. Les intentions futures ne serviraient qu'à contrôler la projection, jamais à renforcer l'expérience historique.

## 6. Résultat explicable et ordre de décision proposés

Un futur évaluateur pur rendrait, pour chaque groupe : date examinée, périodes, sources, critères documentés, signaux défavorables, inconnues, paramètres expérimentaux, motifs et limites. Il distinguerait :

1. **Signal défavorable documenté** : ne pas étudier B dans cet état ; conserver A et les protections sportives existantes.
2. **Données ou règles insuffisantes** : conserver A ; distinguer un champ manquant d'une protection de volume/cumul non calibrée.
3. **Dossier recevable pour comparaison A/B** : profondeur, fraîcheur, couverture et contexte concordent. Ce statut n'est ni une autorisation de séance, ni un rétablissement du `candidate` actuel.
4. **Comparaison A/B compatible avec les garde-fous expérimentaux** : résultat de laboratoire seulement, soumis à validation du contrat avant tout branchement.

L'admissibilité effective resterait ensuite calculée par une politique de récupération unique, avec repos général, ressentis, disponibilité et autres règles du Coach. D4c consolidé ne peut pas être simplement ignoré ou rebaptisé : le nouveau contrat devrait expliquer explicitement comment il traite ses incertitudes de volume et de cumul.

Aucun compteur persistant, aucune récompense pour une réalisation complète, aucun droit à un délai réduit. Recalcul à chaque consultation, et à nouveau avant mémorisation en cas de concurrence. Une séance réalisée à 12/9 ne doit ni disqualifier automatiquement le dossier par comparaison à 14/10, ni le valider à elle seule.

## 7. Cas de contrôle attendus — non exécutés pour cette proposition

| Cas | Lecture attendue de la proposition |
| --- | --- |
| Structurées à 12 jours sur 84 jours, réparties, documentées | Peut remplir le profil historique proposé ; vérifier fraîcheur, charge et comparaison projetée avant toute recevabilité complète |
| Longues à 9 jours sur 84 jours | Même raisonnement dans le groupe long uniquement |
| Historique à 12 jours limité à 28 ou 56 jours | Profondeur proposée non atteinte ; aucune création artificielle d'historique en élargissant la fenêtre |
| Structurées à 14 jours, longues à 10 jours | Ne documente pas les répétitions exactes de B requises par ce premier profil |
| Structurées à 7 jours | Fréquence supérieure non automatiquement favorable ; correspondances à B absentes |
| Série concentrée à intervalles égaux | Répartition ou profondeur insuffisante ; pas une habitude durable démontrée |
| Habitude ancienne suivie d'une lacune/reprise apparente | Fraîcheur incertaine ; ne pas agréger avant et après comme une pratique continue |
| `hard`/`very-hard` récent malgré expérience longue | Signal défavorable prioritaire ; aucune compensation par la profondeur |
| Hausse isolée sans alerte D2 | Garde-fou de non-augmentation proposé non satisfait, sans diagnostic de surcharge inventé |
| Volumes égaux élevés | Non-augmentation possible, mais ni niveau absolu qualifié ni récupération démontrée ; cumul projeté indispensable |
| Champs absents ou contradictions | Données insuffisantes ; le passé fréquent ne remplace pas les preuves manquantes |
| Deux groupes recevables ou projection plus dense sous B | Pas de réduction simultanée ; choix de périmètre ou comparaison de cumul manquante : A |
| Correction/suppression qui retire un intervalle clé | Recalcul ; dossier peut perdre sa recevabilité documentaire, sans pénalité liée à l'acte de correction |
| Perspectives annonçant des séances réussies | Aucun apport aux preuves historiques ; intentions utilisées uniquement pour la cohérence de projection |

Ces attentes sont des éléments de spécification. Elles ne constituent pas des résultats de simulation du nouveau profil : aucun nouvel évaluateur ni calendrier A/B complet n'a été exécuté.

## 8. Validation requise avant toute suite applicative

La recommandation de conception est de retenir l'architecture hybride **sans autoriser ses seuils ni son activation** : expérience répartie et récente, qualité explicite, priorité aux signaux, non-augmentation expérimentale et comparaison du cumul avec A.

À valider avant D4e : nombres et distribution d'observations, fraîcheur/ruptures, acceptabilité de l'égalité exacte à B, garde-fou directionnel de volume, niveau de couverture, définition et horizon du cumul projeté, périmètre d'un seul groupe, gestion du retour à A et explications au coureur.

La prochaine étape autorisable serait une calibration autonome de cette proposition, comparant les cas limites, les données retirées/corrigées et les trajectoires sur plusieurs consultations. Elle ne doit pas être confondue avec une activation. Tout éventuel branchement futur devra partager le même contrat entre D2, orchestrateur, actives, perspectives, présentation et remplacement, avec contrôle concurrent des sources.

## Vérification de cette livraison documentaire

Un seul document ajouté ; aucun code ni fichier préexistant modifié. Contrôle des empreintes initiales, des espaces de fin de ligne et `git diff --check`. Pas de nouveaux tests sportifs, de TypeScript ou de build nécessaires pour cet ajout Markdown ; les résultats des étapes précédentes ne sont pas présentés comme des tests de cette proposition.

Aucun accès à la base historique, aucune migration, modification de version ou de changelog, opération Git d'écriture ou déploiement. `.agents/` et toutes les modifications préexistantes restent préservés.
