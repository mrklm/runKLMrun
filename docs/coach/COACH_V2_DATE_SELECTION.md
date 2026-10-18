# Coach V2 — sélection de date et ancre temporelle

## Périmètre

Cette étape complète l'adaptateur applicatif en lecture seule. Elle ne présente ni ne persiste une suggestion, ne crée aucun identifiant d'occurrence et n'attribue aucune génération.

## Disponibilités utilisées

La sélection lit exclusivement `CoachProfileValues.availability` : jours déclarés, mode de durée et plafond du jour. En mode simple, `minutesPerSession` s'applique aux jours déclarés. En mode personnalisé, seul `maxMinutesByDay[jour]` est accepté. Une valeur absente, nulle ou invalide n'est pas remplacée par une valeur implicite.

## Algorithme de sélection

À partir de la date civile de référence, l'adaptateur examine au plus sept jours civils, date courante incluse. Il retient le premier jour qui réunit ces conditions :

1. le jour figure dans les disponibilités déclarées ;
2. un plafond positif est réellement renseigné pour ce jour ;
3. le catalogue peut produire une séance avec ce plafond exact ;
4. l'orchestrateur accepte la séance en tenant compte des activités et présentations connues.

Le catalogue est recalculé pour chaque jour admissible avec le plafond de ce jour. Une séance n'est donc jamais calculée avec un plafond puis affectée après coup à un autre jour. Sa durée ne peut pas dépasser le plafond retenu.

Les calculs de jours utilisent des dates `YYYY-MM-DD` à midi UTC. Cette représentation sert uniquement à l'arithmétique civile et évite les décalages aux changements d'heure ; elle ne transforme pas une date civile en instant de pratique.

Les absences sont distinguées : aucune ancre persistée, aucune disponibilité exploitable dans la fenêtre, catalogue indisponible, ou aucun jour admissible après application des espacements.

## Ancre temporelle

L'ancre est le dernier événement persistant connu à la date de référence :

- une activité enregistrée, avec son identifiant et sa date civile ;
- ou une occurrence V2 effectivement présentée, avec son identifiant et sa date civile de présentation.

L'événement de date civile la plus récente est retenu. En cas d'égalité, l'activité est choisie selon une règle déterministe. La consultation, le contenu calculé, un nombre aléatoire et une génération implicite n'interviennent jamais. Deux appels avec le même instantané produisent donc la même ancre. Sans événement persistant admissible, le résultat reste indisponible.

## Résultat applicatif

Le résultat expose `selectedDate`, `dailyMaximumSeconds`, `temporalAnchor` et, si nécessaire, `temporalAnchorReason`, en plus de la référence, du catalogue, de la séance, des faits, déclarations et incertitudes déjà disponibles.

## Limites avant 6C-2

- La fenêtre de sept jours est un choix de conception borné, pas une recommandation scientifique.
- La sélection reste un calcul pur : elle ne prouve pas une présentation réelle.
- Aucun identifiant persistant, numéro de génération ou verrou transactionnel n'est attribué.
- Les disponibilités au-delà de sept jours ne sont pas examinées.
- L'activation dans l'interface et l'enregistrement atomique d'une présentation restent hors périmètre.
