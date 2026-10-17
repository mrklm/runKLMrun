# Phase 3A — prototype de séances différenciées

Ce prototype est isolé du Coach de production. Il reçoit une référence habituelle déjà calculée et ne recopie ni ne modifie la politique B 2G. Ses résultats décrivent des propriétés logicielles, pas une prescription sportive validée.

## Architecture

`selectPrototypeSessions()` sépare :

1. le contexte déclaré : objectif, expérience, disponibilité et préférence de terrain ;
2. les faits fournis : qualité des références et types de séances déjà documentés ;
3. la composition : type, durée totale, intensité qualitative et terrain qualitatif ;
4. les garde-fous : disponibilité, absence de séance structurée sans preuve et une seule dimension de difficulté augmentée.

Chaque résultat est facultatif. Le terrain appartient exclusivement à `flat`, `rolling` ou `hills`. Aucun itinéraire, dénivelé ou pente numérique n'est produit.

## Choix scientifiques et choix de conception

Les principes généraux de spécificité, individualisation et progressivité, ainsi que l'effet contextuel du relief sur le coût de l'effort, sont documentés dans les fondements scientifiques. Ils ne déterminent pas une dose universelle.

Les paramètres suivants sont des **choix expérimentaux de conception** : pas de cinq minutes, durée d'amorçage de vingt minutes, réduction prudente à 80 %, ajout éventuel de cinq minutes pour une sortie longue et exigence d'un type déjà observé avant une séance structurée. Aucun n'est présenté comme une constante physiologique ou une garantie de sécurité.

## Stratégies obtenues

| Objectif | Profil synthétique | Séances proposées |
|---|---|---|
| Débuter | Sans référence documentée | Endurance facile, 15 min, facile, plat |
| Reprendre | Sans référence actuelle documentée | Récupération, 15 min, très facile, plat |
| Plaisir et forme | Référence 40 min | Endurance facile, 40 min, facile, terrain préféré ; aucune progression |
| Améliorer l'endurance | Référence 40 min et sorties longues observées | Endurance facile 40 min ; sortie longue 45 min, facile, plat |
| Améliorer la vitesse | Référence 40 min et fractionné déjà observé | Endurance facile 40 min ; fractionné 30 min, effort contrôlé, plat |
| Atteindre une distance | Référence 40 min et sorties longues observées | Endurance facile 40 min ; sortie longue 45 min, facile, plat |
| Préparer une course | Référence 40 min et côtes déjà observées | Endurance facile 40 min ; côtes 30 min, intensité facile, terrain côtes |

Une sortie soutenue remplace le fractionné pour l'objectif vitesse lorsque seule cette pratique structurée est documentée. Une préparation de course peut également retenir une sortie soutenue ou longue si les faits correspondants existent. L'objectif seul n'autorise aucune de ces séances.

## Garde-fous observés

- Une sortie longue augmente seulement la durée ; son intensité reste facile et son terrain plat.
- Une séance soutenue ou fractionnée modifie seulement l'intensité ; sa durée est réduite et son terrain reste plat.
- Une séance de côtes modifie seulement le terrain ; sa durée n'augmente pas et l'intensité reste facile.
- Un débutant ou un historique insuffisant ne reçoit aucune séance exigeante ou structurée.
- Le terrain vallonné reste un terrain qualitatif et ne devient pas une intensité.
- Plaisir et forme conserve le repère fourni sans ajout de progression.
- La disponibilité plafonne toutes les durées et peut supprimer une variante longue devenue incohérente.

## Limites

- Le prototype sait qu'un type a été observé parce que la fixture le lui fournit ; la production ne dispose pas encore d'une classification sportive suffisamment fiable.
- L'intensité reste qualitative. Aucune structure détaillée d'efforts et de récupérations n'est définie pour le fractionné.
- La récupération est un type éditorial et ne démontre aucun état physiologique.
- Les durées d'amorçage et les écarts de cinq minutes doivent faire l'objet de simulations de sensibilité.
- Le prototype sélectionne des candidats, sans calendrier, volume cumulé, espacement, identité persistante ni suivi longitudinal.

## Validation

Les tests ciblés vérifient la différenciation entre objectifs, la prudence pour les débutants et données insuffisantes, le terrain qualitatif, l'intensité facile d'une sortie longue, l'absence de progression pour plaisir et forme, la modification d'une seule dimension et le plafond de disponibilité.

La prochaine étape recommandée est une simulation longitudinale des stratégies sur douze semaines, avec les mêmes profils et comportements pour chaque objectif. Elle devra mesurer la fréquence des types, l'accumulation des séances structurées et les transitions après interruption, sans encore raccorder ce prototype au moteur de production.
