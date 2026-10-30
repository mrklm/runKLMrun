# Persistance du bilan de séance

`createSessionReviewRepository(database)` exige une base explicite et refuse
le nom historique exact `runklmrun`. Le dépôt ne consulte pas le profil actif.
Il réutilise `sessions` et `coachSuggestionsV2`, sans migration IndexedDB.

## API

`get(sessionId, occurrenceId?)` retourne un instantané des deux magasins dans
une transaction de lecture. Sans recommandation, les annotations restent
enregistrables. `save(snapshot, patch)` compare cet instantané dans une
transaction d'écriture commune avant de modifier les champs demandés.
Une propriété omise conserve la donnée ; `null` l'efface.

Les propriétés modifiables sont `feeling`, `trainingType`,
`trainingDescription`, `realization` et `realizationProposal`.
Le ressenti garde son contrat existant. La description accepte 2 000 caractères,
refuse une chaîne vide et les caractères de contrôle hors tabulations et sauts
de ligne. Type connu et description peuvent coexister. Aucune classification
ni aucun type ne sont déduits d'une association ou d'un texte.

## Réalisation et provenance

`realization` contient `result` (`completed`, `partial`, `not-completed`),
`proposalOrigin` (`manual` ou `automatic`) et `confirmedBy: 'user'`.
L'appelant ne doit fournir ce dernier champ qu'après une décision explicite.
L'absence de résultat reste une absence de réponse, y compris sur les anciennes
associations. La révision et `updatedAt` de l'occurrence suivent les modifications.

`realizationProposal` contient `origin: 'automatic'` et un résultat proposé
(`completed`, `partial`, `unrecognized`). Son enregistrement seul ne crée
aucune confirmation ni association. Aucun moteur de reconnaissance n'est livré.
La proposition et la confirmation peuvent différer après correction utilisateur.
Ces métadonnées sont distinctes de la provenance technique du Coach.

Une confirmation complète ou partielle exige une activité de même date civile,
une signature sportive et l'exclusivité du lien. Une réponse négative ne garde
aucune référence à l'activité : elle ne réserve donc pas cette activité et reste
valable si celle-ci disparaît. Elle peut être enregistrée sans type ni description.

Effacer une confirmation positive retire son association. Effacer un résultat
absent ne retire pas une association historique indépendante. Modifier une
réponse négative en confirmation passe par ce service ; l'ancien raccourci
`associateActivity` refuse d'écraser cette réponse implicitement.

Une occurrence obsolète refuse toute nouvelle réponse ou proposition ; leur
effacement reste possible. Une réponse négative antérieure est conservée lors
de l'obsolescence et empêche son éligibilité à la suppression automatique.
L'invalidation sportive ou la suppression d'une activité liée efface sa
confirmation et sa proposition. Les corrections descriptives les conservent.

## Sauvegardes

V7 est sélectionné uniquement pour une description, le type `recovery`, une
réalisation ou une proposition. Les anciens validateurs stricts rejettent ces
données : les étiqueter V6 serait trompeur. Les formats 1 à 6 restent lisibles,
sans conversion des associations en confirmations. JSON et gzip partagent la
même sélection de version.

La fusion conserve les enregistrements locaux et signale les conflits. Le
remplacement adopte les données du fichier ; une ancienne sauvegarde peut donc
effacer les nouveaux champs. Les révisions des occurrences déjà présentes
augmentent au remplacement pour rejeter les instantanés périmés.

## Limites de cette étape

Aucune interface, règle de sélection, formule de récupération ou analyse Polar
n'est ajoutée. Les consommateurs du Coach continuent d'ignorer le résultat de
réalisation ; le lien d'association conserve sa signification historique.
Les propositions automatiques ne portent pas encore de preuve détaillée ni de
version d'analyse : ce contrat devra être précisé lors de leur implémentation.
