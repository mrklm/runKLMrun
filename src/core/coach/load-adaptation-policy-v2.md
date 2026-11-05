# Politique préparatoire D2b-1

> État historique de livraison. Le raccordement désormais actif est décrit dans
> [Intégration D2b-2](./load-adaptation-integration-v2.md). Le module reste pur.

`interpretRecentLoadV2(load)` reçoit directement le résultat non modifié de
`analyzeRecentLoadV2` pour la date examinée. Fonction pure, sans stockage et
sans raccordement au Coach. Pour une date future, recalculer D2a puis la
politique à cette date ; ne pas réutiliser une décision ancienne comme une
preuve de récupération acquise.

## Décision structurée

- `protections` : protections existantes, portée, délai, première date non
  bloquée et identifiants des activités concernées.
- `decisions.allSessions`, `structured`, `longRun` : `defer` si une protection
  applicable est encore active ; sinon `review` si les données nécessaires
  sont insuffisantes ; sinon `baseline-only`.
- `baseline-only` n'autorise aucune séance : les filtres existants du Coach,
  dont le catalogue, les disponibilités et les intentions futures, restent
  nécessaires. La politique n'interprète que les activités réelles.
- `notBefore` est le maximum des dates des protections applicables connues.
  Ce n'est jamais une garantie d'admissibilité à cette date. `review` ne
  fabrique pas de date de récupération.
- `preference` : `recovery`, `cautious` ou `unchanged`. Une préférence ne
  remplace pas les protections. `recovery` signifie préférer une option
  facile/récupération déjà admissible, pas créer une nouvelle séance.
- `progression` : `do-not-increase` en présence d'une préférence de récupération
  ou d'incertitudes ; sinon `baseline-only`, jamais une autorisation de progresser.
- `reasons` : codes stables, origine (`existing-protection`,
  `proposed-preference`, `data-quality`), activités sources et explication.
- `evidence` et `quality` : faits descriptifs, couverture et limites explicites.

## Plancher de protections existantes

Les constantes sont importées de l'orchestrateur, pas redéfinies ni modifiées.
Les délais sont civils ; une activité du jour D bloque tant que J−D < délai.

| Protection | Portée | Fin du blocage |
| --- | --- | --- |
| Activité réelle, même sans durée | Toutes les séances | D+2 |
| Fractionné, côtes, soutenu, variations déclarés | Types structurés | D+14 |
| Sortie longue déclarée | Sorties longues | D+10 |
| Ressenti `very-hard` | Structuré et sortie longue | D+7 |

Le ressenti `hard` déclenche la préférence facile pendant sept jours, sans
blocage supplémentaire : il reste une préférence comme dans l'orchestrateur.
`very-hard` ajoute la protection exigeante existante : sans option facile
admissible, ne rien sélectionner d'exigeant. Une activité facile n'annule
aucune protection issue d'une autre activité.

L'architecture sépare ces planchers des préférences. Aucun paramètre permettant
de réduire 10 ou 14 jours n'est exposé. Une évolution ultérieure de ces durées
nécessitera une décision explicite, distincte des signaux de charge.

## Nouvelles préférences proposées, non activées

Une concentration signifie plusieurs activités dans J−2 à J, fenêtre descriptive
existante de D2a. Elle ne prouve pas, seule, une surcharge.

Préférer la récupération si la concentration est accompagnée d'au moins un
fait concordant :

1. Une de ces activités dure plus que la référence habituelle **confirmée et
   actuelle**, sans exclusion de données contradictoires/non datables.
2. Le volume observé de J−6 à J dépasse celui de J−13 à J−7, avec durées
   intégralement connues, sommes finies, aucune exclusion problématique et au
   moins une activité dans chacune des deux fenêtres.

Le volume des sept jours précédents est calculé par `volume14 − volume7`.
Comparer directement volume7 et volume14 serait comparer des fenêtres
imbriquées. Une semaine sans activité enregistrée n'est pas considérée comme
une preuve de repos : la comparaison reste inconnue. La référence habituelle
n'est pas requise pour comparer deux volumes réellement mesurés.

Justification : deux observations concordantes fondent une préférence prudente,
réversible, sans ajouter de délai. « Plusieurs » et « supérieur » décrivent
les données ; aucun multiplicateur de ressenti, score de charge ou seuil
physiologique de type 1,5× n'est introduit. Cette règle reste **éditoriale et
proposée**, non une norme sportive validée. Une seconde de différence ne
prouve pas une surcharge : le résultat ne porte aucune qualification de ce
nom et n'impose aucun délai supplémentaire.

Une séance isolée plus longue, une hausse de volume sans concentration, une
concentration seule ou un ressenti facile ne déclenchent pas cette nouvelle
préférence. Ils ne raccourcissent jamais les protections existantes.

`pattern` distingue absence d'activité récente, séance isolée, plusieurs
activités espacées et concentration sur trois jours, dans la fenêtre de sept
jours. Les identifiants des séances au-dessus de l'habitude et les types
réellement déclarés restent exposés pour expliquer la décision.

## Données insuffisantes

Les cas suivants empêchent de justifier une intensification et demandent une
réévaluation des séances exigeantes non déjà bloquées :

- aucune activité dans les sept derniers jours ;
- référence habituelle absente, périmée ou non confirmée ;
- durée manquante dans les quatorze jours ou somme numérique non représentable ;
- ressenti manquant dans les sept jours ;
- type manquant dans les quatorze jours ;
- identifiant manquant, date invalide ou identifiant aux données contradictoires.

Le dernier cas demande aussi une réévaluation générale : une activité récente
et son espacement pourraient avoir disparu de l'analyse. Les protections des
activités encore connues restent prioritaires. Les données exclues ne
permettent pas de reconstruire une date de fin de protection.

Un doublon identique ne crée pas d'accumulation. Une activité future exclue
n'est pas une incertitude sur l'effort passé. Les distances restent
complémentaires : leur couverture est exposée, leur absence ne bloque pas
l'interprétation des durées. Aucune moyenne de ressentis n'est calculée.

Une séance `partial` utilise ses mesures exactes. La fonction ne reçoit ni
recommandations ni statut de réalisation exploitable : `not-completed` et les
anciennes associations ne créent donc jamais d'effort. D1/D2a conservent la
responsabilité de normaliser les preuves. Un conflit déjà éliminé par D1 ne
peut pas être retrouvé ici ; deux identifiants différents ne sont pas fusionnés.

## D2b-2, après validation seulement

Pourraient être activés : préférence facile en présence de faits concordants,
absence d'intensification avec données insuffisantes, réévaluation explicite,
et protections datées communes. Leur raccordement doit conserver la priorité
des protections, vérifier les recommandations déjà affichées et les
perspectives, et éviter de convertir `baseline-only` en autorisation.

D2b-1 ne change aucun appel, catalogue, classement, perspective, mécanisme de
réutilisation, format de stockage ou formulaire.
