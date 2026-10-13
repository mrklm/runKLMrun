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
