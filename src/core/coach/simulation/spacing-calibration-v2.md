> Archive de l’étape initiale, avant consolidation D4c. Les critères, classifications et résultats ci-dessous décrivent la version historique. Le contrat courant et les différences sont documentés dans [la consolidation D4c](../spacing-eligibility-consolidation-v2.md). Les commandes rejouées utilisent désormais ce contrat courant.

# D4d — comparaison d'hypothèses, sans activation

## Résultat et recommandation de travail

**Conserver les délais de production 14 jours structurés et 10 jours longues pendant la calibration.** L'option B mérite une étude supplémentaire avant toute décision. L'option C expose davantage de cumuls et ne dispose pas de protections suffisamment définies. Cette recommandation technique ne sélectionne aucune option dans le code et ne valide aucun délai physiologique. D4e n'est pas commencé.

Les hypothèses comparées sont A = 14/10, B = 12/9, C = 10/7 (structuré/longue). Ce sont des points de sensibilité à discuter, pas des prescriptions. Les écarts ne proviennent d'aucune mesure de récupération. Le laboratoire compare également les neuf combinaisons de ces trois valeurs par groupe, ainsi qu'une variante B avec +300 secondes de durée. Les protections générales de 2 jours et liées au ressenti de 7 jours restent inchangées.

## Audit critique des critères D4c

| Critère actuel | Ce qu'il mesure réellement | Ce qu'il ne permet pas de conclure |
| --- | --- | --- |
| Quatre semaines couvertes | Présence d'au moins un enregistrement dans chacun des quatre blocs glissants | Fréquence stable, continuité réelle ou exhaustivité. Des activités aux bords des blocs peuvent être concentrées ; le décalage du jour d'étude peut changer le résultat. |
| Deux dates du groupe | Répétition déclarée minimale, pas une expérience durable | Avec 28 jours et 14 jours entre structurées, il ne peut y avoir que deux dates au maximum, donc un seul intervalle. Le dossier est peu informatif. |
| Espacements au moins égaux aux délais actuels | Conformité de l'historique observé à une règle éditoriale | Tolérance à un délai inférieur. Les personnes ayant déjà des intervalles courts sont écartées : biais de sélection conservateur, pas preuve de risque physiologique. |
| Deux ressentis faciles/modérés | Concordance de deux déclarations de séance | État entre les séances, récupération ou coût de répétition. Une absence de hard n'est pas une mesure positive de récupération. |
| Couverture complète des champs | Types, durées, ressentis présents dans les enregistrements disponibles | Absence d'activités omises, qualité intrinsèque des mesures, pertinence d'une déclaration. Une omission silencieuse peut laisser `candidate`. |
| Volumes strictement égaux | Même somme de durées sur les deux dernières fenêtres de sept jours | Même répartition, même contenu exigeant, même intensité, charge appropriée ou stabilité prolongée. Un volume dix fois supérieur peut rester candidat. |

Autres limites : le ressenti du groupe est examiné sur 28 jours, alors que le ressenti général récent est examiné sur 7 jours. Un `hard` à J-10 peut donc maintenir D4c sans bloquer D4b. Ce n'est pas une prolongation physiologique de récupération. D4c considère la concentration seule comme défavorable, alors que D2 exige une concordance supplémentaire pour certaines préférences. Les diagnostics amont non datables peuvent bloquer un dossier même si la difficulté se situe hors période.

**Incompatibilité d'intégration à résoudre :** si une séance structurée était autorisée après 12 jours, cet intervalle réel serait ensuite inférieur à 14 jours et D4c repasserait à `maintain`. Un test reproduit ce cas. Brancher D4c tel quel pourrait provoquer des alternances de candidature et de retrait. Il faut définir un contrat cohérent d'évaluation des observations avant de parler d'activation.

Il faut distinguer quatre notions : habitudes relativement stables, expérience documentée du groupe, absence de signal défavorable observé, récupération physiologique. D4c apporte des éléments sur les trois premières, avec des limites ; il ne mesure pas la quatrième.

## Cinq approches de stabilité du volume

Les volumes étudiés sont des durées enregistrées, pas une charge physiologique calculée. Les semaines sont quatre fenêtres adjacentes glissantes, pas des semaines ISO. Les semaines sans activité et les durées manquantes restent non comparables.

| Approche | Avantage | Limites | Faux positif possible | Faux négatif possible |
| --- | --- | --- | --- | --- |
| Égalité stricte des deux dernières semaines | Transparente, sans seuil additionnel | Très sensible à une minute, ignore les deux premières semaines et la composition | Deux totaux élevés identiques, répartition exigeante nouvelle, omissions équilibrées | Pratique régulière avec petite variation bénigne ou décalage d'une activité à la frontière |
| Variation relative à une référence | Rend l'amplitude comparable entre niveaux de volume | Référence et marge doivent être justifiées ; petit dénominateur instable | Référence déjà élevée, marge trop large, hausse récente masquée par la référence | Marge trop étroite, référence inadéquate à une reprise ou à une saison différente |
| Évolution entre semaines successives | Expose les hausses, baisses et oscillations séparément | Sensible aux bords ; un seul rapport ne décrit pas une tendance | Petites hausses répétées considérées séparément comme acceptables | Alternance régulière de semaines différentes classée instable sans contexte |
| Tendance sur plusieurs semaines | Replace une hausse isolée dans une trajectoire | Quatre points seulement, dépend du découpage ; une pente nulle masque des oscillations | Plateau élevé ou série 3600/7200/7200/3600 : pente nulle malgré forte variation | Cycle planifié ou reprise graduelle jugés défavorables sans connaître leur contexte |
| Volumes disponibles, couverture partielle | Rend les observations visibles sans les jeter | Aucune extrapolation fiable sans mécanisme de données manquantes connu | Sommes connues égales malgré beaucoup d'activités omises ou durées absentes | Dossier refusé malgré de bonnes observations réelles non saisies |

Le simulateur expose l'égalité D4a, la variation relative à la **médiane des trois semaines antérieures**, les trois transitions, la pente des moindres carrés et l'étendue des quatre volumes. Cette médiane réduit l'influence d'un seul point extrême, mais reste une référence descriptive courte, pas une norme. La pente est exprimée en secondes par semaine ; son coefficient statistique n'est pas un poids de risque. Les couvertures et sommes connues restent visibles séparément.

Aucune marge relative n'est choisie par défaut. Un appel peut fournir `relativeVolumeTolerance` pour un essai de sensibilité ; cela ne modifie ni D4c ni les variantes de délai. Le test à 2 % est un exemple explicite, pas un seuil retenu. Une hausse de 60 secondes sur 3600 (1,67 %) passe cet essai alors que D4c reste `maintain`. Symétriquement, une baisse de 60 secondes devient `insufficient-data` dans D4c. Il serait préférable de conserver amplitude, signe, trajectoire et couverture comme observations distinctes avant de définir une catégorie « stable ».

Les semaines partielles exposent la somme des durées connues sans compléter les inconnues. Les ratios et tendances nécessitant ces semaines deviennent `null`. Une absence totale d'activité enregistrée ne devient pas une semaine de repos prouvée. Même une couverture des champs à 100 % ne résout pas les omissions silencieuses.

## Hypothèses et effets mécaniques

| Option | Structurées | Longues | Dernier structuré à J-10 : levée | Dernière longue à J-6 : levée |
| --- | --- | --- | --- | --- |
| A | 14 jours | 10 jours | J+4 | J+4 |
| B | 12 jours | 9 jours | J+2 | J+3 |
| C | 10 jours | 7 jours | J | J+1 |

Il s'agit des premières dates non bloquées par les protections connues, **pas de dates de séances recommandées**. Le repos général et `very-hard` peuvent repousser ces dates. `hard` conserve sa préférence facile sans interdiction générale. Les quatre familles structurées partagent le même délai dans toutes les variantes. Une longue ne devient pas une structurée, ni l'inverse.

À intervalle constant, la fréquence théorique augmente d'environ 16,7 % pour 14→12 et 40 % pour 14→10 ; de 11,1 % pour 10→9 et 42,9 % pour 10→7. Ce calcul réciproque n'est ni une prévision d'activité ni un risque clinique. Sur 28 jours inclusifs, en commençant à J0 et en ignorant tous les autres filtres, les plafonds indépendants sont 2/3 séances (structurées/longues) pour A, 3/4 pour B, 3/4 pour C. Des plafonds identiques sur une courte fenêtre peuvent masquer des fréquences différentes à long terme. Les sommes 5 ou 7 sont des bornes indépendantes, pas des calendriers validés.

### Effets cumulés à ne pas ignorer

- Réduire 14→12 tout en passant une séance de 1800 à 2100 secondes augmente mécaniquement le volume théorique du groupe d'environ 36,1 % si la cadence est saturée : `(14/12) × (2100/1800)`. Cette multiplication illustre deux changements simultanés, pas une charge tolérable. Le simulateur signale les dimensions simultanées sans produire de score.
- Assouplir les deux groupes peut densifier la même période. Le scénario `joint-candidate` donne `candidate` aux deux groupes, sans prouver que leur futur cumul est approprié.
- Un espacement croisé de deux jours respecte la seule règle générale. Il ne démontre pas qu'une longue et une structurée sont suffisamment espacées pour une personne. Une éventuelle protection de densité commune devra être définie explicitement, pas introduite comme un délai partagé implicite de 10 ou 14 jours.
- Un volume stable déjà élevé n'est pas détecté comme excessif par D4c. Aucune limite absolue ne peut être inventée depuis ces données.
- Une hausse sans concentration peut laisser D2 sans préférence prudente tout en produisant `maintain` dans D4c. L'absence de blocage D2 n'est pas favorable en soi.
- Les ressentis difficiles, les historiques incomplets et les reprises gardent leurs motifs propres. Les statuts `partial` et `completed` ne les neutralisent pas.

## Options à discuter, aucune sélection automatique

| Option | Conditions envisagées | Avantages | Risques et données manquantes | Changements techniques nécessaires avant activation |
| --- | --- | --- | --- | --- |
| A — conservatrice, 14/10 | Règles actuelles ; expliquer séparément charge, expérience, incertitude et protections | Comportement stable, aucune nouvelle hypothèse de récupération | Rigidité possible ; critères D4c restrictifs et faible profondeur historique demeurent | Pour améliorer l'affichage : contrat de présentation et textes à valider ultérieurement. Aucun changement sportif requis. |
| B — limitée, 12/9 | Dossier bien documenté, contrat D4c cohérent après raccourcissement, absence de signaux défavorables ; éviter de modifier durée et fréquence ensemble ; étudier un groupe à la fois | Sensibilité modérée, comparaison plus facile à attribuer à une dimension | Le seuil reste hypothétique ; expérience trop courte, omissions et cumuls non mesurés | Définir une décision commune à D4b/D2/orchestrateur, ses motifs et replis ; recalculer actives, perspectives et mémorisation concurrente avec ce même contrat ; tests de trajectoire sur plusieurs consultations. |
| C — plus souple, 10/7 | Conditions B renforcées ; histoire plus étendue, définition explicite de la densité croisée, règles de réévaluation après ressenti et correction | Davantage de dates théoriquement ouvertes | Augmentation plus forte des fréquences ; interaction de deux groupes ; risque de surinterpréter les ressentis et la stabilité | Même intégration cohérente que B, plus simulation de séquences complètes et protections de cumul justifiées. Aucune nouvelle protection chiffrée n'est décidée ici. |

Pour B/C, les durées de suivi nécessaires, la marge de stabilité, la gestion du niveau de charge et les critères de repli restent à définir et valider. Ne pas choisir automatiquement ces valeurs depuis `candidate`. Une éventuelle expérimentation doit distinguer la validité du dossier, les protections applicables et la sélection finale. Le laboratoire actuel n'est pas un remplacement du moteur.

## Reproductibilité et périmètre du laboratoire

- `spacing-calibration-v2.ts` : fonction pure avec hypothèses explicites, normalisation D2a, observations D4a, conclusions D4c et protections D4b réutilisées. Aucun état persistant ni appel applicatif.
- `spacing-calibration-fixtures-v2.ts` : 23 scénarios synthétiques au 5 novembre 2026, dix variantes chacun. Base : huit activités de 1800 secondes à J-27, -24, -20, -17, -13, -10, -6 et -3 ; structurées à J-24/-10. Les longues répétées sont à J-17/-6. Les mutations exactes sont lisibles dans ce fichier.
- `spacing-calibration-v2.test.ts` : tests du laboratoire et comparaison du vrai pipeline avant/après un appel d'étude, pour chaque scénario et chacun des trois tempéraments. Les preuves brutes simulées sont indépendantes du calcul de la référence par le vrai pipeline.
- Capture détaillée reproductible : `D4D_CAPTURE=1 npx vitest run src/core/coach/simulation/spacing-calibration-v2.test.ts` écrit `/tmp/d4d-calibration.json`, sans toucher aux sources ni au stockage applicatif.

Chaque variante expose les portes actuelles, les portes théoriques et un contrefactuel qui applique la réduction seulement lorsque D4c est `candidate` au jour étudié. Ce dernier n'est pas une autorisation : D2 reste exposé séparément, et les futurs changements d'observations ne sont pas prédits. Aucune variante ne rejoue le classement avec des délais modifiés, car cela exigerait de changer le contrat de production D2/D4b ; l'étude porte sur les ouvertures temporelles et leurs limites.

Les perspectives fournies comme contexte de fixture n'entrent jamais dans les preuves du simulateur. Une activité future est exclue à la date de l'étude. Les corrections et suppressions produisent un nouveau calcul ; aucune candidature ancienne n'est retenue.

## Résultats des 23 scénarios

Les valeurs S/L sont les décalages civils en jours depuis le 5 novembre 2026, pour structuré/longue. `0` signifie non bloqué par ces seules protections au jour étudié. M = `maintain`, I = `insufficient-data`, C = `candidate`. B et C affichent la levée théorique puis, entre parenthèses, celle conservée avec le filtre D4c. Aucun de ces nombres ne garantit une séance.

Le vrai pipeline a été calculé séparément pour les trois tempéraments. Dans ces fixtures, leurs types et dates sélectionnés coïncident ; les objets complets, les actives et les perspectives ont néanmoins été comparés séparément. « Aucune » indique un résultat sans candidat sélectionné, pas une interdiction générale de courir.

| Scénario | D4c S/L | Sélection actuelle, trois tempéraments | A S/L | B brut (filtré) | C brut (filtré) |
| --- | --- | --- | --- | --- | --- |
| `slight-variation` | M/M | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `equal-volume` | C/I | Facile J+0 | 4/0 | 2/0 (2/0) | 0/0 (0/0) |
| `high-volume` | C/I | Facile J+0 | 4/0 | 2/0 (2/0) | 0/0 (0/0) |
| `beginner` | I/I | Aucune | 0/0 | 0/0 (0/0) | 0/0 (0/0) |
| `return` | I/I | Aucune | 0/0 | 0/0 (0/0) | 0/0 (0/0) |
| `regular-intervals` | C/I | Facile J+0 | 4/0 | 2/0 (2/0) | 0/0 (0/0) |
| `partial-hard` | M/M | Facile J+0 | 8/0 | 6/0 (8/0) | 4/0 (8/0) |
| `completed-very-hard` | M/M | Facile J+0 | 8/1 | 6/1 (8/1) | 4/1 (8/1) |
| `repeated-long` | I/C | Facile J+0 | 0/4 | 0/3 (0/3) | 0/1 (0/1) |
| `alternating-families` | M/I | Facile J+0 | 0/0 | 0/0 (0/0) | 0/0 (0/0) |
| `close-long-structured` | M/M | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `volume-increase` | M/M | Aucune | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `no-effort` | I/I | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `partial-coverage` | I/I | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `corrected-effort` | C/I | Facile J+0 | 4/0 | 2/0 (2/0) | 0/0 (0/0) |
| `deleted-review` | I/I | Facile J+0 | 0/0 | 0/0 (0/0) | 0/0 (0/0) |
| `future-perspectives` | C/I | Facile J+0 | 4/0 | 2/0 (2/0) | 0/0 (0/0) |
| `no-family-practice` | I/I | Facile J+0 | 0/0 | 0/0 (0/0) | 0/0 (0/0) |
| `joint-candidate` | C/C | Facile J+0 | 4/4 | 2/3 (2/3) | 0/1 (0/1) |
| `omitted-record` | C/I | Facile J+0 | 4/0 | 2/0 (2/0) | 0/0 (0/0) |
| `decreased-volume` | I/I | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `deleted-activity` | I/I | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |
| `old-hard` | M/I | Facile J+0 | 4/0 | 2/0 (4/0) | 0/0 (4/0) |

### Risques et conditions par scénario

| Scénario | Risque observé ou limite | Condition avant un éventuel assouplissement |
| --- | --- | --- |
| `slight-variation` | Une minute de plus suffit au maintien D4c, sans preuve de surcharge. | Revoir la définition descriptive du volume avant tout assouplissement. |
| `equal-volume` | Deux dates structurées ne documentent qu’un seul intervalle. | Candidate ne remplace pas une validation sportive. |
| `high-volume` | Égalité à un niveau dix fois plus élevé : D4c ne détecte pas un excès absolu. | Comprendre le niveau individuel et la charge exigeante avant adaptation. |
| `beginner` | Une activité ne documente ni régularité ni expérience du groupe. | Conserver les délais faute de données. |
| `return` | Une longue lacune peut être une interruption ou un défaut de saisie. | Documenter la reprise sans inférer un repos acquis. |
| `regular-intervals` | Respect du délai actuel, pas démonstration de capacité à le raccourcir. | Expérience historique plus étendue nécessaire à une décision future. |
| `partial-hard` | Le ressenti et la durée réelle comptent, pas un échec présumé du partiel. | Ne pas assouplir en présence du ressenti défavorable. |
| `completed-very-hard` | Completed ne neutralise pas very-hard. | Conserver la protection de sept jours et le maintien D4c. |
| `repeated-long` | Deux sorties longues ne mesurent pas leur coût individuel. | Évaluation séparée des longues ; aucun transfert depuis les intervalles. |
| `alternating-families` | L’alternance masque une densité élevée si les familles sont dissociées. | Garder les quatre familles dans le même groupe. |
| `close-long-structured` | Une longue un jour avant le structuré : interaction documentée. | Ne pas relâcher les protections avec un croisement rapproché. |
| `volume-increase` | Hausse de 50 % entre semaines, sans concentration D2 concomitante. | Absence de préférence D2 ne suffit pas : maintien D4c. |
| `no-effort` | Pas de ressenti ne signifie pas bonne récupération. | Compléter les observations, sans imputation favorable. |
| `partial-coverage` | Somme connue sous-estimée, ratio potentiellement trompeur. | Ne pas qualifier le volume de stable. |
| `corrected-effort` | La correction retire le motif lié à un ancien hard ; elle ne prouve pas la récupération. | Recalculer depuis l’instantané courant, jamais conserver une ancienne éligibilité. |
| `deleted-review` | Suppression du bilan laisse des inconnues, pas une séance facile. | Maintenir les inconnues et la candidature insuffisante. |
| `future-perspectives` | Une perspective ne peut servir de preuve d’expérience. | Les intentions restent hors des entrées du simulateur. |
| `no-family-practice` | Aucun blocage temporel malgré aucune expérience exigeante. | Insufficient-data interdit de déduire une candidature de portes ouvertes. |
| `joint-candidate` | Les deux groupes peuvent être candidate simultanément ; les cumuls futurs ne sont pas contrôlés par D4c. | Étudier un garde-fou commun de densité sans créer implicitement un délai partagé. |
| `omitted-record` | Une activité omise sans diagnostic peut rester indétectable et laisser candidate. | La couverture des champs ne garantit jamais l’exhaustivité de la pratique. |
| `decreased-volume` | Une minute de moins devient insuffisante, sans signal défavorable. | Distinguer baisse, stabilité non démontrée et récupération. |
| `deleted-activity` | La suppression retire la seule répétition structurée. | Recalculer l’expérience sans mémoire persistante. |
| `old-hard` | Hard à J-10 a quitté D4b mais maintient D4c sur 28 jours. | Ne pas confondre fenêtre historique descriptive et délai de récupération. |

### Lecture des résultats

- Les faibles variations ne sont pas assimilées à une stabilité par D4c : +60 secondes donne M, −60 secondes donne I. Les approches relatives et temporelles rendent cette asymétrie visible sans la corriger automatiquement.
- `high-volume` et `omitted-record` restent candidats : contre-exemples à une lecture de C comme récupération acquise ou qualité exhaustive.
- `joint-candidate` ouvre théoriquement les deux groupes plus tôt. Aucun budget de séances exigeantes commun n’existe dans D4c.
- `alternating-families`, `deleted-review` et `no-family-practice` montrent qu’une porte D4b ouverte ne constitue pas une preuve favorable D4c.
- `old-hard`, `corrected-effort`, `deleted-review` et `deleted-activity` montrent les changements dus au seul instantané courant, sans mémoire de candidature.
- Pour chaque scénario, les neuf combinaisons et la variante +300 secondes sont testées et présentes dans la capture détaillée. La variante de durée n’altère pas une porte temporelle : son cumul reste à traiter par un futur contrat explicite.

## Vérifications finales

- Laboratoire D4d : 106 tests, dont 69 comparaisons du pipeline (23 scénarios × trois tempéraments).
- Tests ciblés D4b/D4c/D4d : 161 réussis.
- Matrice de non-régression existante : 111 comparaisons avant/après identiques, snapshots et objets complets.
- Suite complète : 1 933 tests réussis, un ignoré ; 110 fichiers réussis, un ignoré.
- TypeScript, build et `git diff --check` réussis. Les espaces de fin de ligne des nouveaux fichiers sont contrôlés séparément.
- Bundles de production identiques au build D4c ; avertissement existant de bundle supérieur à 500 kB.
- Empreintes des fichiers initiaux préservées : aucun fichier préexistant modifié. Aucun import du laboratoire par un chemin applicatif.
- Aucun accès à la base historique, aucune migration, aucun changement de version ou de changelog, aucune opération Git d’écriture ni déploiement.
- Aucune hypothèse activée. D4e nécessite une validation explicite.
