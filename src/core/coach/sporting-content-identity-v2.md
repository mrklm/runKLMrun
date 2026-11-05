# Identité sportive calculée D3a

Deux fonctions pures, sans raccordement au classement :

- `sportingContentIdentityV2(content)` retourne une identité connue ou un motif
  d'incomparabilité.
- `compareSportingContentsV2(left, right)` retourne la relation et les dimensions
  différentes, ou les motifs d'incomparabilité. Le résultat complet est symétrique.

## Définition exacte

L'identité contient `type`, `totalDurationSeconds`, `intensity`, `terrain` et
une représentation canonique de la structure :

- séance libre : marqueur explicite `kind: 'free'` ;
- séance structurée : marqueur `kind: 'structured'`, échauffement, liste ordonnée
  des efforts, liste ordonnée des récupérations et retour au calme ;
- chaque bloc conserve répétitions, durée en secondes et intensité.

Les répétitions omises valent une, conformément au contrat existant. Une liste
facultative de récupérations absente équivaut à `[]`. Échauffement et retour au
calme absents sont représentés par `null`. En revanche, un `null` fourni comme
bloc ou structure est invalide : il ne signifie pas « absent » dans le contrat.

Aucun arrondi, fusion, expansion ou réordonnancement des blocs. Ainsi, un bloc
`3 × 120 s` et trois blocs séparés de `120 s` ne sont pas déclarés identiques.
Le format existant sépare efforts et récupérations : la comparaison conserve
cette représentation sans inventer un entrelacement.

Les textes `shortSummary`, `optionalInstructions`, `instruction` sont ignorés.
Les métadonnées connues des prototypes (`id`, `rationale`, `changedDimensions`,
`objectiveContext`, `optional`) ne participent pas à l'identité. Si le prototype
porte aussi `durationSeconds`, sa valeur doit correspondre à la durée totale.
Aucune description libre n'est analysée.

La clé `sporting-content:v1:…` est une sérialisation déterministe en mémoire.
Elle n'est ni un nouvel identifiant de modèle, ni un champ persistant, ni une
modification de `contentFingerprint`. Ce dernier inclut toujours ses textes.
L'appelant fournit un contenu ou un prototype, pas l'occurrence enveloppante.

## Relations

| Relation | Définition |
| --- | --- |
| `identical` | Identités sportives strictement égales après normalisation |
| `same-family` | Deux contenus valides de même type, mais identités différentes |
| `different` | Deux contenus valides de types différents |
| `incomparable` | Au moins un contenu n'est pas complètement interprétable |

La famille est volontairement le type exact. Endurance facile et récupération,
ou fractionné et variations modérées, ne sont pas fusionnés. « Même famille »
ne signifie ni même difficulté, ni même charge, ni substituabilité sportive.

## Incomparabilité

Le validateur de contenu existant est réutilisé après neutralisation des seuls
textes. Les contraintes numériques et sportives restent celles du contrat V2.

- Type, durée totale, intensité ou terrain absents/invalides/non reconnus.
- Durées non entières, non positives, non finies ou hors limites du contrat.
- Durées `durationSeconds` et `totalDurationSeconds` contradictoires.
- Structure absente pour fractionné, côtes, soutenu ou variations.
- Structure présente sur une séance libre, structure nulle ou non reconnue.
- Efforts vides, listes trouées, blocs invalides, répétitions invalides.
- Somme des blocs différente de la durée prévue.
- Champs inconnus au niveau du contenu, de la structure ou des blocs : une
  future dimension sportive ne doit pas être silencieusement ignorée.
- Texte brut, enveloppe d'occurrence ou autre objet non pris en charge.

Une ancienne séance libre sans blocs reste comparable si ses quatre dimensions
sportives sont connues. L'absence de texte explicatif n'empêche pas la comparaison.
Une ancienne séance structurée sans blocs reste incomparable, même comparée à
elle-même. Les motifs sont `unrecognized-fields` ou `invalid-sporting-content` ;
le module ne remplace pas le diagnostic détaillé des validateurs de stockage.

## Limites pour D3b

La comparaison concerne exclusivement la prescription. Elle ne reçoit aucun
bilan et ne déduit ni répétitions effectuées, ni réussite, ni maîtrise d'un modèle.
Deux séances identiques ne sont pas automatiquement une répétition injustifiée.
Deux séances différentes ne sont pas automatiquement une progression.

La normalisation est conservatrice : des représentations différentes peuvent
être sportivement proches sans être identiques. Une extension de format doit
faire évoluer explicitement cette fonction ; jusque-là, elle reste incomparable.
Les consignes exprimant une information uniquement en texte ne sont pas analysées.

Aucun branchement vers les recommandations, leur réutilisation ou les perspectives.
Aucune modification des règles D2, des délais, des empreintes, du stockage ou des
sauvegardes. D3b nécessite une validation séparée.
