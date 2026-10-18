# Coach V2 — amorçage prudent de la référence habituelle

Phase 4C, 18 octobre 2026. Les trois politiques sont expérimentales et calculées en lecture seule. Elles ne modifient ni le Coach V1, ni les suggestions, ni le stockage.

## Paramètres du prototype

Une estimation provisoire demande quatre durées réelles appartenant au même épisode, une dernière activité vieille d'au plus 42 jours et une étendue relative maximale de 0,5 autour de la médiane. Ces valeurs servent uniquement à comparer les comportements ; elles ne sont pas présentées comme scientifiquement validées.

Une estimation provisoire ne transforme jamais ses sources en activités indépendantes. Elle conserve leurs identifiants et leur provenance incertaine. Une suggestion sans activité n'apporte aucune durée.

## Comparaison A/B/C

| Politique | Sources initiales admises | Niveau produit | Avantage | Risque observé |
|---|---|---|---|---|
| A — stricte | Observations confirmées par B 2G | Confirmé ou indisponible | Provenance la plus robuste | Reste souvent indisponible lorsque les anciennes suggestions ont expiré |
| B — provisoire | Durées réelles admissibles, y compris activités associées | Toujours provisoire | Peut amorcer avec un historique réel plus large | Les sorties liées à des suggestions courtes peuvent abaisser l'estimation |
| C — hybride | B 2G confirmé en priorité ; sinon activités indépendantes récentes ou anciennes à association inconnue | Provisoire puis confirmé | Récupère l'historique sans utiliser les activités associées pour amorcer | Peut rester provisoire longtemps si aucune nouvelle preuve indépendante n'arrive |

## Résultats synthétiques

| Scénario | A | B | C |
|---|---|---|---|
| Quatre anciennes sorties à 40 min, associations expirées | Indisponible | 40 min provisoires | 40 min provisoires |
| Quatre activités associées de 30 min | Indisponible | 30 min provisoires, risque signalé | Indisponible |
| Anciennes sorties à 40 min puis quatre suggestions raccourcies à 30 min | Indisponible | 35 min provisoires | 40 min provisoires |
| Deux activités seulement | Indisponible | Indisponible | Indisponible |
| Progression réelle confirmée de 40 à 45 min | 45 min confirmées | 45 min provisoires | 45 min confirmées |
| Réduction réelle confirmée de 40 à 35 min | 35 min confirmées | 35 min provisoires | 35 min confirmées |
| Plus de 42 jours sans activité | Indisponible | Indisponible | Indisponible |
| Une seule sortie de reprise après interruption | Indisponible | Indisponible | Indisponible |
| Associations ambiguës ou données invalides | Indisponible | Indisponible | Indisponible |

La politique B démontre le risque recherché : mélanger quatre anciennes sorties de 40 minutes et quatre activités associées de 30 minutes donne une médiane provisoire de 35 minutes. Ce résultat reste une durée réellement observée, mais il peut reproduire indirectement une baisse initiée par des suggestions courtes.

La politique C évite cette rétroaction : elle garde 40 minutes provisoires tant que les sorties de 30 minutes sont uniquement associées. Dès que quatre observations fiables permettent à B 2G de confirmer une progression ou une réduction, C abandonne l'estimation provisoire et expose la référence confirmée.

## Stabilité et garde-fous

- Aucun type sportif, date d'import, fatigue ou intention n'est déduit.
- Une suggestion présentée sans activité ne participe jamais au calcul.
- Les activités ambiguës et invalides restent exclues.
- Une interruption de plus de 42 jours invalide l'amorçage ; une reprise isolée ne restaure pas l'ancien repère.
- La référence provisoire n'est pas injectée dans B 2G et ne peut donc pas se confirmer elle-même.
- Le résultat contient son niveau de confiance, ses identifiants sources, ses motifs et un indicateur de risque lorsque des activités associées sont utilisées.

## Recommandation

La politique **C — hybride** est la meilleure candidate pour la suite. Elle réduit l'indisponibilité causée par l'expiration des suggestions, préserve les confirmations et révisions déjà validées en 4B et évite d'amorcer depuis des activités associées dont la durée pourrait refléter les propres suggestions du Coach.

Elle ne doit pas encore piloter les suggestions de production. Avant cela, il reste à décider :

1. si quatre observations, 42 jours et une étendue relative de 0,5 conviennent au produit ;
2. combien de temps une référence peut rester provisoire ;
3. comment présenter une confiance provisoire sans suggérer une capacité physique ;
4. comment réagir à la suppression ou restauration d'une source ;
5. si une provenance minimale doit être conservée au-delà de l'expiration des suggestions.
