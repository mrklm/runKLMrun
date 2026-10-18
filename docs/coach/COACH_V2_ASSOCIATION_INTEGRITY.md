# Coach V2 — intégrité des associations après modification

## Classification des modifications

Une association V2 confirmée conserve désormais une signature déterministe du résumé sportif au moment de l’association.

Les modifications **descriptives** n’affectent pas cette signature :

- correction du titre ;
- ressenti et commentaire subjectif ;
- association ou changement de chaussures.

Elles ne remettent pas en cause l’identité sportive de l’activité et ne provoquent aucune invalidation V2.

Les modifications **sportives significatives** concernent :

- date civile et heure de départ ;
- durée et distance ;
- dénivelé, allure, fréquence cardiaque, zones, Running Index et charge cardio ;
- sport et identifiants ou métadonnées de provenance Polar/TCX ;
- correction ou remplacement d’un résumé importé.

La signature utilise uniquement ces champs, dans un ordre canonique. Elle n’infère ni type de séance, ni intensité, ni fatigue.

## Invalidation et traçabilité

`associateActivity()` enregistre `associationEvidence.sportSignature` avec l’association. Lors d’un `sessionRepository.save()`, l’ancien résumé, le nouveau résumé et les occurrences associées sont lus dans la même transaction IndexedDB.

Si la signature change, l’occurrence :

- passe de `associated` à `obsolete` ;
- perd son `activityId` actif ;
- conserve sa preuve sportive initiale ;
- conserve l’ancien identifiant et l’instant d’invalidation ;
- reçoit le motif `activity-modified`.

Un changement de date utilise le motif historique `activity-replaced`, et une suppression `activity-missing`. Aucune activité voisine ou de même date n’est recherchée automatiquement. La révision de l’occurrence est incrémentée dans la transaction qui modifie ou supprime l’activité.

Les anciennes occurrences V6 sans `associationEvidence` restent lisibles. Lors de leur prochaine modification via le dépôt, l’ancien et le nouveau résumé sont comparés directement afin de conserver la même protection sans migration destructive.

## Écritures extérieures et restauration

`inspectAssociation()` vérifie aussi la signature. Une modification qui contourne le dépôt est donc signalée comme `invalid-association`. `invalidateMissingAssociations()` réconcilie ensuite le lien transactionnellement avec le motif approprié, sans réassociation.

La validation des sauvegardes V6 vérifie qu’une preuve présente correspond à l’activité sauvegardée. Une sauvegarde cohérente conserve la signature exactement ; une association dont l’activité a été modifiée sans invalidation est refusée avant restauration. Les anciennes sauvegardes V6 dépourvues de preuve restent compatibles.

## Impact sur la référence habituelle V2

Une activité associée n’est classée comme preuve `suggestion-linked` que si elle existe, conserve la date suggérée et correspond à la signature stockée. Une association invalidée ou incohérente ne maintient donc plus une référence confirmée. Elle reste une donnée réelle, mais son rôle vis-à-vis de la suggestion devient inconnu ou ambigu.

## Limites

- Les séries détaillées GPS, cardio et altitude ne font pas partie du résumé signé. Leur remplacement isolé, sans mise à jour du résumé sportif, n’est pas détecté par ce mécanisme.
- Une écriture IndexedDB extérieure au dépôt doit encore déclencher explicitement la réconciliation avant d’exploiter l’association.
- La confirmation publique d’une nouvelle association reste hors périmètre.
- Aucun état supplémentaire, aucune purge et aucune activation publique du Coach V2 ne sont introduits.
