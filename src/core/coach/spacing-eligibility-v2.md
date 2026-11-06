> Archive de l’étape initiale, avant consolidation D4c. Les critères, classifications et résultats ci-dessous décrivent la version historique. Le contrat courant et les différences sont documentés dans [la consolidation D4c](spacing-eligibility-consolidation-v2.md). Les commandes rejouées utilisent désormais ce contrat courant.

# D4c — éligibilité descriptive à l'étude d'un assouplissement

## Portée

`evaluateSpacingEligibilityV2` est indépendant du moteur. Il ne change ni recommandation, ni active, ni perspective, ni délai. Aucun module de production ne l'importe à cette étape. Aucun accès au stockage, à l'horloge ou au réseau. Les entrées et sorties sont des instantanés : après correction ou suppression, rappeler la fonction.

Deux évaluations seulement : `structured` (les quatre familles ensemble) et `longRun`. Aucun contournement par alternance de `intervals`, `steady-run`, `hills`, `endurance-variations`.

La fonction reçoit le contrat D4a : activités admissibles, date civile, référence existante et diagnostics amont éventuels. D4a réutilise D2a pour normaliser, dédupliquer, exclure les dates futures et calculer volumes, couvertures et espacements. D4c ne recalcule pas ces agrégats. Seuls les intervalles entre groupes différents sont ajoutés : D4a ne les expose pas.

Pour des sources brutes susceptibles de contradictions, utiliser `buildRecommendationContinuityV2` puis transmettre `activities` **et** `issues`. `recordedActivityEvidenceV2` suppose notamment l'unicité des identifiants de stockage ; son choix de la première entrée ne suffit pas à diagnostiquer un import contradictoire. Les prescriptions et confirmations ne sont jamais projetées en type réalisé par D4c.

## Critères exacts et provenance

Ces critères sont des conditions éditoriales conservatrices pour examiner un dossier, pas des seuils physiologiques validés. Aucun coefficient, score ou délai réduit.

| Dimension | Condition descriptive | Provenance et limite |
| --- | --- | --- |
| Régularité | Une activité enregistrée au moins dans chacune des quatre semaines | Fenêtre D4a de 28 jours, quatre blocs glissants de sept jours. Exiger tous les blocs est un choix prudent D4c ; une semaine vide n'établit pas une interruption réelle. |
| Expérience du groupe | Au moins deux dates distinctes | Minimum logique pour constater une répétition et un intervalle ; ce nombre ne valide pas une tolérance. |
| Espacements du groupe | Tous les intervalles observés au moins égaux à la protection actuelle | Constantes D4b : 14 jours structurés, 10 jours longues. Le respect du délai actuel ne prouve pas qu'il peut être réduit. |
| Ressentis du groupe | Au moins deux dates avec `easy` ou `moderate`, sans `hard`/`very-hard` dans le groupe sur 28 jours | Concordance déclarative seulement. Aucun ressenti isolé ne suffit. L'observation historique défavorable ne prolonge aucune protection D4b. |
| Ressentis récents généraux | Aucun `hard`/`very-hard` enregistré dans les sept jours | Fenêtre D4b existante. Tous les sports doivent déjà avoir été filtrés en amont. |
| Volume | Égalité exacte des durées de deux semaines adjacentes comparables | D4a/D2a, fenêtre de 14 jours. Choix strict pour ne pas inventer une marge de variation. Une baisse reste insuffisante, pas défavorable par principe. |
| Concentration | Pas de pluralité d'activités dans les trois derniers jours | Observation D2a et critère de concentration déjà utilisé par D2. D4c en fait un motif pour maintenir dans cette étude, pas un diagnostic de surcharge ni un nouveau filtre du Coach. |
| Interactions | Pas de paire adjacente longue/structurée à moins de deux jours | Repos général D4b. Aucun espacement commun de 10 ou 14 jours n'est créé. |
| Qualité | Types, durées et ressentis connus sur les activités des 28 jours ; aucun diagnostic amont non résolu | Exigence D4c de couverture complète des enregistrements disponibles, sans garantir leur exhaustivité. |

Les fenêtres sont inclusives de J-27 à J pour les habitudes, J-13 à J pour le volume, J-6 à J pour les ressentis récents et J-2 à J pour la concentration. Les intervalles exactement égaux à 2, 10 ou 14 jours ne sont pas classés rapprochés. Un ressenti général à J-7 sort de la fenêtre récente ; un ressenti du groupe peut rester une observation historique dans les 28 jours. Cela ne modifie jamais la levée D4b à J+7.

Les volumes égaux mais élevés ne reçoivent pas de pénalité absolue : les données ne définissent pas de seuil individuel de volume excessif. Les durées relatives D4a sont exposées avec leur confiance de référence, sans coefficient ni condition cachée. Une référence absente empêche un rapport relatif, pas la comparaison de durées réelles complètes.

## Conclusions et priorité

1. `maintain` : au moins un signal défavorable documenté (ressenti, rapprochement, hausse comparable, concentration). Les lacunes éventuelles restent exposées séparément.
2. `insufficient-data` : aucun signal défavorable retenu, mais au moins une dimension requise non établie ou une contradiction non résolue.
3. `candidate` : toutes les dimensions sont établies, aucun signal défavorable retenu. Seule une étude ultérieure est envisageable ; cela ne démontre pas qu'un délai plus court serait approprié.

Deux sorties longues peuvent donc fournir un dossier candidat pour les longues tout en laissant le structuré insuffisant, et réciproquement. Un croisement rapproché des deux groupes affecte les deux conclusions. Les ressentis généraux récents et la charge concernent les deux groupes.

Une réalisation `completed`, `partial`, une association non confirmée ou une absence de blocage D2 n'ajoutent aucun point favorable. Une réalisation partielle n'est pas un échec automatique. Une proposition seule, une perspective future ou un type inconnu ne documentent aucune expérience du groupe. Un type réel différent d'une prescription prévaut.

## Contrat explicable et diagnostics

Chaque évaluation expose famille, date, période, conclusion, observations favorables/défavorables, données manquantes, raisons, identifiants sources, diagnostics, couverture, durées relatives, interactions et limites. Chaque observation porte sa période et ses sources. Les identifiants absents restent signalés dans les diagnostics sans être inventés.

D2a écarte les doublons contradictoires sans choisir une version. Une contradiction devient un manque de preuve, pas un ressenti défavorable imputé arbitrairement. Les doublons identiques ne multiplient ni les expériences ni la charge. Les exclusions futures sont signalées mais ne bloquent pas seules un dossier ; les autres diagnostics amont restent conservateurs, même lorsqu'ils ne peuvent être datés dans la fenêtre.

L'ordre des entrées n'influe pas sur la décision. Aucune mémoire d'éligibilité n'est conservée. Le système ne reconstitue pas l'historique des corrections et ne sait pas si des activités ont été omises.

## Limites et préparation de D4d

- Les seuils descriptifs D4c, notamment quatre semaines couvertes, deux dates et égalité stricte des volumes, nécessitent validation éditoriale avant tout branchement.
- L'égalité exacte est volontairement restrictive et ne décrit pas la variabilité habituelle ; aucune tolérance numérique n'a été inventée.
- `candidate` n'est pas une décision sportive. D4d devra définir explicitement si et comment exploiter ce dossier, sans déduire une récupération physiologique.
- Aucun délai réduit n'est proposé ici. Tout changement futur devra distinguer groupes, interactions, données insuffisantes et priorités des protections.
- La fenêtre de 28 jours ne mesure pas une expérience à long terme ; l'absence de données ne prouve pas l'absence de pratique.
- Avant intégration, maintenir les diagnostics D3b et les contrôles de concurrence D4b. Une candidature ne doit pas être mémorisée comme un droit durable.

D4d n'est pas commencé.

## Vérifications réalisées

- Nouveau module : 37 tests synthétiques, dont les trois tempéraments et les liens de réalisation réels/non confirmés.
- Tests ciblés D4a/D4b/D4c : 87 réussis.
- Comparaison avant/après : 111 scénarios synthétiques inchangés, égalité des objets complets (recommandations, actives et perspectives) et des snapshots D4b.
- Suite complète : 1 827 tests réussis, un ignoré ; 109 fichiers réussis, un ignoré.
- `npx tsc -b`, `npm run build`, `git diff --check` : réussis ; les trois nouveaux fichiers ont aussi été contrôlés pour les espaces de fin de ligne.
- Build : avertissement existant pour un bundle de plus de 500 kB. Les noms et tailles des bundles restent identiques au build D4b.
- Contrôle par SHA-256 : aucun fichier préexistant modifié pendant D4c, y compris D4a/D4b, `.agents/`, version, changelog, schéma et sauvegardes.
- Aucun test navigateur supplémentaire demandé ou exécuté pour ce module autonome non branché. Aucun accès à une base de données dans les nouveaux tests ; la suite existante utilise ses données synthétiques isolées.
- Aucune opération Git d'écriture, migration ou publication.
