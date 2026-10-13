# Profil déclaré du coureur

`profile.ts` définit les libellés et la validation pure du modèle
`src/types/coach-profile.ts`. Il ne dépend ni de React, ni du navigateur, ni du
stockage. La date civile de référence est passée explicitement.

Les champs facultatifs absents ne sont pas des choix implicites. `none` pour le
terrain, zéro séance et un tableau de jours vide sont des choix explicites.
Aucune observation du bilan n’est copiée dans le profil. Les suggestions futures
devront rester séparées et n’être intégrées qu’après acceptation explicite.

La validation ne corrige ni ne modifie l’entrée. Les bornes de saisie sont
documentées dans le README principal ; elles n’expriment pas un niveau sportif.
L’échéance existante peut devenir passée sans empêcher une autre modification.
Le module ne génère pas de programme et n’est pas un moteur de sécurité médicale.


Les champs facultatifs `availability.durationMode` (`simple` ou `custom`) et
`availability.maxMinutesByDay` (`Partial<Record<Weekday, number>>`, minutes)
complètent le modèle. L’absence de mode équivaut au mode simple ; `days` reste
l’unique sélection des jours disponibles. Les valeurs des jours désélectionnés
restent mémorisées. `maximumMinutesForDay` ne retourne une valeur qu’en mode
personnalisé pour un jour sélectionné, sans repli sur la durée habituelle.

`profile-draft.ts` convertit le profil en saisies textuelles et inversement,
sans éliminer les valeurs temporairement masquées. Les champs vides sont omis ;
les saisies invalides sont rejetées par la validation avant stockage. Toutes les
valeurs mémorisées doivent rester valides, même lorsqu’elles sont inactives.


Le profil complet fait partie des sauvegardes locales, y compris les durées
inactives. La fusion le conserve par défaut. Le remplacement d’un profil existant
conserve sa date de création sauvegardée, actualise la date de modification et
avance la révision pour refuser les anciens brouillons. Sans profil local, les
métadonnées du fichier sont conservées. Voir [la restauration](../../backup/README.md).

## Conseiller : première étape

Le champ facultatif `accompanimentMode` du profil réserve les valeurs `advisor`
et `trainer`. Seul `advisor` est accepté à cette étape ; l’absence de champ signifie
Conseiller. Le bouton dédié enregistre ce choix sans modifier les autres valeurs
persistées du profil. Les écritures conservent le contrôle de révision existant.
Les sauvegardes JSON/gzip incluent ce champ sans nouveau format ni migration ;
les anciennes sauvegardes restent lisibles. Entraîneur est désactivé dans l’interface.

`comparison.ts` réutilise le bilan pour deux fenêtres consécutives égales.
Les différences sont absolues ; les variations de distance/durée ne sont calculées
que si les deux périodes ont des séances et une couverture complète de la mesure.
Les totaux partiels restent affichés avec leur couverture. Aucun pourcentage
potentiellement trompeur sur une base nulle n’est calculé.

`observations.ts` reçoit le bilan comparatif et le profil facultatif complet.
Il exploite la distance cible, la fréquence souhaitée, les jours réellement courus
et disponibles, et les durées disponibles. Les dates civiles source déterminent
les jours de semaine ; plusieurs sorties du même jour comptent comme un seul jour.
En mode personnalisé, les durées sont cumulées par jour et comparées au plafond
actif correspondant ; un jour avec une durée manquante ou invalide est exclu.
En mode simple, la moyenne par sortie utilise uniquement les durées connues,
avec indication explicite de la couverture. Les disponibilités actuelles ne sont
pas supposées représenter les disponibilités passées.

Distance et durée produisent des observations indépendantes si la mesure concernée
est complète dans les deux périodes. Chaque observation possède des explications
consultables : période, valeurs, couverture et règle appliquée. L’historique peut
être incomplet même lorsque toutes les séances enregistrées ont leurs mesures.

Quatre observations au maximum sont retenues par priorité décroissante :
interruption (100), écart de fréquence souhaitée (80), jours hors disponibilités
(70), durée supérieure au temps déclaré (65), changement de fréquence (60),
changement de distance/durée (55), objectif (50), puis constats sans écart
(fréquence souhaitée 20, jours 15, durée 10, fréquence/volume 5).
À priorité égale, l’ordre de déclaration des règles est conservé. Ces priorités
éditoriales ne représentent pas une gravité ou un risque sportif.
L’échéance et le terrain ne produisent pas encore d’observations spécifiques.
L’interruption exige quatre sorties précédentes au minimum et un intervalle depuis
la dernière activité au moins égal au maximum de sept jours et de deux intervalles
moyens précédents (arrondi supérieur). Ce repère décrit les enregistrements et ne
permet aucune conclusion médicale. Les observations ne sont jamais persistées.
