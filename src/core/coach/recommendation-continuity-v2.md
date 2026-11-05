# D3b — mémoire de continuité calculée

`buildRecommendationContinuityV2({ sessions, occurrences })` est une fonction pure asynchrone : l'asynchronisme sert uniquement aux validations SHA-256 existantes. Aucun appel au stockage, à l'horloge, au catalogue ou au classement. Aucun import du module par le moteur, la réutilisation ou les perspectives.

## Modèle

- `recommendations` : une entrée par identifiant d'occurrence, triée par identifiant. État de continuité, cycle de vie (`active`, `associated`, `obsolete`), présentation, date prévue, dernière mise à jour, identité sportive D3a, éventuelle confirmation vérifiée et identifiant d'activité valide.
- `activities` : une seule entrée par identifiant non contradictoire, triée par identifiant. Date civile, instant de départ s'il existe, durée réelle en secondes, distance réelle en mètres, type déclaré et ressenti. Les champs absents ou invalides restent absents. Aucune confirmation ni mesure prescrite ne devient une mesure d'activité.
- `issues` : diagnostics dédupliqués et triés par source, identifiant puis code. Les entrées sans identifiant ne deviennent pas des recommandations ou activités artificielles.

Les six catégories sont `unconfirmed-proposal`, `unconfirmed-association`, `completed`, `partial`, `not-completed`, et les deux variantes d'incertitude `invalid-link` / `insufficient-data`. Le cycle de vie reste une dimension distincte : une proposition obsolète ne redevient jamais une proposition active.

L'identité sportive décrit exclusivement la prescription. Le type réel reste dans `activities.documentedType`. Ni le statut `completed`, ni le type réel, ni une durée proche ne prouvent l'exécution des blocs prescrits ou la bonne tolérance. Une séance `partial` conserve intégralement ses mesures réelles. Aucun nombre de répétitions restantes n'est calculé.

## Validation

Les contrats existants valident la forme des occurrences, les dates civiles, instants, fuseaux, états, réalisations, structures et empreintes de contenu/présentation. Une occurrence incomplète ou incohérente produit `insufficient-data` sans présentation ni confirmation exploitable. Le module n'assouplit pas les contrats historiques pour fabriquer une preuve de présentation.

Une association exige une activité admissible selon `matchingDate`, un identifiant unique, la même date civile que `suggestedFor`, une seule revendication et une signature conforme lorsqu'elle est présente. `associationEvidenceMatchesV2` est réutilisée. Les revendications malformées participent aussi à la détection d'ambiguïté.

Une réalisation positive exige, via le contrat existant, `confirmedBy: user`, une association et une signature. Une ancienne association sans signature reste `unconfirmed-association`, avec vérification `date-and-id`. Avec signature, sa vérification devient `sport-signature` mais elle ne devient pas une confirmation. Une proposition automatique n'est jamais confirmée implicitement.

Les doublons identiques sont fusionnés sans dépendre de l'ordre des propriétés. Des instantanés contradictoires sous un même identifiant sont exclus, sans choisir la première entrée ni la révision maximale. Cette comparaison est volontairement conservatrice, même si le conflit porte seulement sur une annotation. Les activités exclues sont signalées ; elles ne sont pas silencieusement remplacées par une charge nulle. Deux identifiants distincts désignent deux activités distinctes : aucune fusion heuristique par date ou mesures.

Une non-réalisation reste une déclaration sur la prescription, sans lien implicite vers une activité du même jour. Une activité indépendante demeure réelle. Les invalidations persistées sont conservées avec leur date et leur motif, sans ressusciter une réalisation.

## Corrections et limites pour D3c

Chaque appel reconstruit tout depuis l'état fourni, sans cache ni pénalité accumulée. Corriger ou supprimer une confirmation, supprimer une activité ou modifier sa signature retire immédiatement la preuve précédente. Les annotations courantes remplacent les anciennes sans modifier la signature sportive, conformément au mécanisme existant.

La mémoire décrit l'état courant ; elle n'est ni un journal exhaustif ni une reconstruction à une date passée. Aucun filtre implicite « aujourd'hui » : les dates fournies valides sont conservées. `updatedAt` n'est pas présenté comme la date de confirmation, qui n'est pas persistée séparément. Les occurrences déjà purgées ne peuvent pas être reconstituées.

`supersedesId` et `supersededById` sont des références déclarées recopiées depuis les occurrences valides, pas une chaîne historique résolue ou garantie complète. Leur cible peut avoir été purgée. Le cycle de vie enregistré fait autorité pour distinguer une occurrence obsolète ; ces références ne créent aucune réalisation.

Aucune lecture des descriptions libres ou tours Polar pour reconstruire des blocs. Aucun repli sur le type prescrit pour remplir un type réel manquant. Les données sportives incomplètes des occurrences non valides restent inconnues ; elles ne sont pas assimilées à une structure vide.

D3c devra choisir explicitement comment utiliser cette mémoire dans le classement. Cette étape n'introduit aucune préférence, dette de séance, réduction de difficulté ni règle anti-répétition. Les règles D2 et les délais de 2, 7, 10 et 14 jours restent hors de ce module.
