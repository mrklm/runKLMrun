# Analyse descriptive D2a

> État historique de livraison. Le raccordement désormais actif est décrit dans
> [Intégration D2b-2](./load-adaptation-integration-v2.md). Le module reste pur.

`analyzeRecentLoadV2({ activities, referenceDate, reference })` est pure et
indépendante des décisions. Aucun appel n'est ajouté au pipeline applicatif.
`activities` reçoit les preuves D1 ; `reference` reçoit le résultat existant de
`habitualReferenceFromOccurrencesV2`, calculé pour la même date. La régularité
sur 28 jours et les espacements de l'orchestrateur ne sont pas recalculés ici.

## Indicateurs

- Référence habituelle : durée existante, strictement positive et finie,
  disponible et actuelle. Sa confiance, ses sources et ses raisons restent
  exposées. Une référence provisoire reste provisoire. Aucun nouveau calcul
  de médiane, seuil de confirmation ou durée de remplacement.
- Durée relative : durée réelle / référence habituelle, sans arrondi ni
  pondération. `null` si l'une des durées est inconnue ou le quotient non fini.
- Fenêtres : 3, 7 et 14 jours civils, jour de référence inclus. Sept jours
  signifie J−6 à J, quatorze jours J−13 à J. Trois jours est une fenêtre
  descriptive de concentration, jamais un délai de récupération.
- Volume : somme des durées connues en secondes ; somme complémentaire des
  distances connues en mètres. Chaque somme expose les nombres de mesures
  connues et inconnues. Une fenêtre vide vaut zéro ; des activités sans
  aucune mesure donnent `null`. Une somme partielle reste explicitement
  partielle. Un dépassement numérique donne `null` et `overflow: true`.
- Concentration : nombre d'activités, nombre de dates actives et maximum
  d'activités sur une même date dans chaque fenêtre ; détail de chacune des
  quatorze dernières dates, y compris les dates sans activité.
- Ressenti : effectifs `easy`, `moderate`, `hard`, `very-hard`, `unknown` par
  fenêtre. Aucun coefficient, moyenne ou score de ressenti.
- Types déclarés : identifiants des fractionnés, côtes, séances soutenues et
  variations (famille structurée existante de l'orchestrateur), identifiants
  des sorties longues séparément, nombre de types inconnus. Une sortie
  longue n'est pas automatiquement déclarée intense. Le type recommandé
  n'est jamais consulté.

## Données et qualité

Une durée valide est finie et strictement positive ; une distance valide est
finie et positive ou nulle. Valeurs absentes ou invalides deviennent `null`.
Les ressentis/types inconnus ne sont pas déduits d'un texte ou d'une mesure.
Les identifiants manquants sont comptés, les dates invalides/futures sont
exclues avec leur motif. La date de référence invalide provoque une erreur.

Les preuves sont regroupées par identifiant avant agrégation. Des doublons
normalisés identiques comptent une fois. Des doublons contradictoires sont
entièrement exclus et signalés ; aucune version n'est choisie selon l'ordre.
Les métadonnées de confirmation, inutilisées pour la charge, ne constituent
pas un conflit. Les résultats sont triés par date et identifiant, les listes
qualité par identifiant, rendant aussi les additions indépendantes de l'ordre.

`partial` conserve les mesures réelles. Aucune confirmation, ancienne
association ou réponse `not-completed` ne crée de ligne d'effort. D1 ne lie
pas les réponses négatives à une activité. La fonction reçoit uniquement les
activités et n'interprète pas les confirmations comme des mesures.

## Limites et D2b

Ces indicateurs décrivent les données présentes, pas une charge physiologique.
Aucun classement faible/moyen/élevé, aucun seuil sportif, aucun effet sur le
catalogue, les perspectives ou la réutilisation n'est introduit.

Le calcul utilise les dates civiles fournies, pas l'heure, les durées glissantes
de 24 heures ou le temps écoulé depuis la séance. L'absence d'activité à une
date ne prouve pas l'exhaustivité des imports. Deux identifiants différents ne
sont pas fusionnés. D1 choisit déjà la première entrée pour un identifiant
dupliqué : un conflit éliminé en amont n'est plus détectable ici. Les instantanés
IndexedDB réels possèdent des identifiants uniques.

L'appelant doit fournir une référence calculée à la date demandée : le contrat
historique de référence ne contient pas sa date de calcul. Les champs invalides
et absents déjà omis par D1 ne peuvent plus être distingués.

D2b pourra examiner les rapports de durée, volumes et couverture des mesures,
la concentration, les ressentis et types déclarés. Toute règle d'adaptation
et son raccordement au moteur nécessitent une validation séparée.
