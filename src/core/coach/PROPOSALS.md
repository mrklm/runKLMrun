# Moteur de proposition — phases 4A et 4A bis

`proposalEvidence()` analyse les résumés sans consentement requis.
`proposeNextSession()` reçoit la configuration évolutive facultative, le profil
historique, les résumés, une date civile de référence et une `ProposalPolicy`.
Ces fonctions sont pures, sans interface, réseau ou stockage.

## Politique explicite

Tous les paramètres sont fournis par l’appelant et rendus dans le résultat.
Aucune politique produit par défaut n’est activée. Les valeurs des tests sont
illustratives et ne constituent pas des prescriptions sportives.

- `horizonDays` : 1 à 14 jours à partir du lendemain ; borne logicielle de portée.
- `evidenceAgeLimitDays` : plafond d’ancienneté, de 1 à 365 jours.
- `rhythmIntervals` : nombre maximal d’intervalles retenus, de 1 à 365.
- `recentCycles` : fenêtre récente en multiples de l’intervalle médian, de 1 à 365.
- `staleCycles` : délai au-delà duquel le rythme n’est plus actuel, de 1 à 365.
- `minimumSuggestionSeconds` : minimum éditorial positif, pas un minimum
  physiologique. Les sorties plus courtes ne sont pas jugées inutiles.
- `discoverySeconds` : maximum indicatif facultatif, au moins égal au minimum
  éditorial, au plus 1 800 secondes. Sans durée récente et sans ce paramètre,
  le moteur signale l’insuffisance de données.
- `duration.minimumReferences` : nombre de durées exploitables requis pour la
  réduction modérée (2 à 365). Ce nombre ne mesure pas le niveau sportif.
- `duration.freshCycles` : ancienneté maximale de la dernière séance, en cycles
  du rythme personnel, strictement positive et au plus égale à `staleCycles`.
- `duration.maximumDurationSpread` et `maximumGapSpread` : étendue relative
  maximale `(maximum - minimum) / médiane`, non négative. Seule celle des
  durées choisit désormais la prudence ; le paramètre des intervalles est
  conservé pour compatibilité des politiques mais ne déclenche plus de réduction.
- `duration.supportedFraction` : fraction de la médiane proposée lorsque les
  références satisfont les critères éditoriaux ; strictement entre 0 et 1.
- `duration.cautiousFraction` : fraction prudente, positive et au plus égale à
  la précédente. Les réductions ne se cumulent pas.
- `duration.cautiousMaximumSeconds` : plafond éditorial appliqué uniquement
  au cas prudent, compris entre le minimum éditorial et 86 400 secondes.

Les bornes supérieures de validation limitent le domaine logiciel, sans valider
médicalement les durées. Une durée observée supérieure à 24 heures est exclue
comme référence pour cette première proposition.

## Rythme historique et actuel

Les dates invalides et futures sont exclues via `observeHistory()`. Plusieurs
sorties un même jour ne créent pas d’intervalles nuls. Les jours civils évitent
les décalages liés au changement d’heure.

`historicalMedianGapDays` décrit les derniers intervalles, même anciens.
Pour déterminer le rythme actuel, seuls les jours sous le plafond d’ancienneté
sont considérés. La fenêtre récente vaut `recentCycles × intervalle médian`,
plafonnée par `evidenceAgeLimitDays`. Le délai d’ancienneté excessive vaut
`staleCycles × intervalle médian`, avec le même plafond.

Si le dernier jour dépasse ce délai, ou si moins de deux jours appartiennent
au groupe récent, `medianGapDays` est nul : l’ancien rythme ne place plus la
prochaine suggestion. Il reste visible comme description historique.
Un trou n’atteste ni interruption, ni fatigue ; l’import peut être incomplet.
Une sortie tous les quinze jours peut rester une référence actuelle.

Les horizons ancien, récent et dernier exposent identifiants et critères.
Dernier ne signifie pas récent. Les durées isolées restent descriptives et ne
fixent aucune capacité actuelle. Aucune catégorie de niveau n’est attribuée.

## Durée observée, proposée et disponible

La médiane reste une observation, jamais la preuve que les sorties étaient faciles.
Le moteur produit séparément `durationBasis` : médiane observée, maximum proposé
avant disponibilité, plafond disponible, appréciation et raisons.

Une réduction prudente s’applique si les références sont trop peu nombreuses,
partiellement renseignées, trop éloignées selon les repères d’actualité, trop variables en durée,
ou si l’objectif est débuter/reprendre. Avec au moins le nombre requis de durées
et aucune durée manquante, la fraîcheur utilise le délai `staleAfterDays` déjà
calculé (deux cycles dans la politique produit). Sinon, `freshCycles` reste
applicable. La variabilité des intervalles reste descriptive et ne choisit
plus le coefficient à elle seule.
Sinon, la fraction modérée s’applique. Les coefficients restent 80 % et 50 %.
Pour endurance, vitesse, distance et course, la politique produit exige au moins
30 minutes. Si les références sont représentatives (80 %) et que leur médiane
atteint 30 minutes, le minimum éditorial peut relever le résultat du coefficient
à 30 minutes, sans dépasser cette médiane. Ce relèvement est explicite dans le
diagnostic et l’explication. Aucun relèvement ne s’applique au cas prudent.
Un créneau inférieur à 30 minutes est ignoré ; à défaut de créneau cohérent,
aucune proposition n’est créée. Sans référence actuelle, ces quatre objectifs
n’utilisent plus une durée de découverte arbitraire. Début et reprise gardent
leurs durées de découverte et leur minimum de cinq minutes. Les modifications
manuelles, y compris sous 30 minutes, ne passent pas par cette règle.

La durée proposée est limitée par le plafond du jour, puis arrondie vers le bas
par pas de 5 minutes. La valeur arrondie est affichée et acceptée sans conversion
supplémentaire. Cet arrondi ne touche jamais les activités, les séances déjà
enregistrées ou les modifications manuelles. Une durée inférieure au minimum éditorial fait chercher un
autre jour, sans dépasser les disponibilités. Le mode personnalisé ignore la
durée générale inactive. Un plafond absent n’est pas inventé.

Repères métier : mini-sortie de 15 à 20 minutes, petite sortie de 30 à 45 minutes,
première découverte de 30 minutes maximum. Ils ne classent pas les coureurs et
ne forcent pas les sorties à atteindre leur borne basse. La disponibilité peut
conduire à une durée plus courte. Le moteur ne plafonne pas toutes les sorties
à 45 minutes et ne transforme pas une cible de distance en sortie longue.

Exemples de la politique synthétique des tests : 3 références, fraîcheur de
1 cycle, étendues relatives de 0,5 pour la durée et 1 pour les intervalles,
fractions 0,8 et 0,5, plafond prudent de 45 minutes. Une médiane de 75 minutes
avec références suffisantes donne au plus 60 minutes ; deux références seules
donnent un maximum prudent de 37 min 30 s, puis une proposition de 35 minutes. Une disponibilité de 20 minutes reste prioritaire.
La découverte est testée à 15, 20 et 30 minutes, jamais fixée silencieusement.
Ces paramètres précis restent à valider avant intégration produit.

## Suggestions et consentement

Au plus une prochaine sortie facultative, jamais un programme complet :

1. Configuration valide et `canActivateStructuredPlanning()` obligatoires.
   Aucun objectif historique converti ; plaisir/forme exclu.
2. Disponibilités et préférences validées par les mêmes règles ciblées que le
   profil historique, sans reconstruire un objectif artificiel.
3. Espacement fondé uniquement sur le rythme actuel ; une fréquence souhaitée
   plus faible peut l’allonger, une fréquence supérieure ne l’accélère pas.
   Sans rythme actuel, l’ancien intervalle reste seulement descriptif.
4. Premier jour disponible compatible dans l’horizon, sans rattrapage ni
   obligation de remplir tous les jours disponibles.
5. Course à pied en aisance ressentie, durée maximum indicative. Possibilité
   de ralentir, raccourcir, marcher ou interrompre, sans alternance imposée.
6. Aucune allure ni FC cible. Vitesse, distance et course ne provoquent pas
   d’intensification automatique. Aucune préparation le jour de l’échéance
   ou après ; chrono et expérience déclarés ne deviennent pas des capacités.

## Limites

Les résumés ne prouvent ni aisance passée ni capacité actuelle. Les médianes
peuvent mêler saisons et changements de pratique. La prudence éditoriale n’est
pas une validation scientifique. Aucun modèle de charge, ressenti, météo,
programme complet, persistance, adaptation ou phase 4B.

## Phase 4B : politique produit et planning personnel

`product-policy.ts` centralise la politique éditoriale version 1. Les valeurs
validées sont : découverte débutant de 30 minutes maximum, reprise de 20 minutes,
ancienneté maximale de 180 jours, 4 références indicatives, fractions 80 % / 50 %,
plafond prudent de 45 minutes. Sans référence récente, seuls débuter et reprendre disposent d’une durée de
découverte. Les autres objectifs attendent des références exploitables.
Plaisir/forme reste exclu par le consentement et la règle d'activation.

Les autres repères de 4A bis sont conservés provisoirement dans
`EDITORIAL_TUNING`, **à confirmer avant publication** : horizon 14 jours,
8 intervalles, fenêtre de 4 cycles, ancienneté excessive après 2 cycles,
fraîcheur de 1 cycle pour les références insuffisantes et de 2 cycles pour
les références documentées, étendue relative maximale de 0,5 pour les durées.
L’étendue des intervalles reste diagnostiquée sans effet sur le coefficient.
Le minimum éditorial est de 30 minutes pour endurance, vitesse, distance et
course ; il reste de 5 minutes pour débuter et reprendre. L'horizon borne l'interface ;
les cycles conservent une sélection proportionnelle au rythme personnel.
Le minimum ne juge pas l'utilité d'une sortie plus courte. Aucun de ces repères
ne constitue une limite physiologique ou un classement de compétence.
L'espacement reste celui de 4A bis : médiane actuelle, éventuellement allongée
par une fréquence souhaitée plus faible ; jamais accélérée automatiquement.

Une suggestion ne devient persistante qu'après acceptation explicite.
`CoachPlanning` contient des séances indépendantes des activités et une liste
d'empreintes de contextes refusés. Une séance conserve sa proposition initiale,
son origine, sa date, sa durée, sa note, ses horodatages et son statut planifiée
ou annulée. La date passée ne crée aucun statut « manquée » ou « réalisée ».
Les modifications personnelles peuvent dépasser une disponibilité habituelle :
l'interface informe sans bloquer. Annuler n'entraîne aucun rattrapage.

L'empreinte SHA-256 du contexte contient la configuration, les disponibilités,
les préférences, les identifiants/dates/durées des résumés et la version de politique.
Elle exclut la date du jour : un refus ne réapparaît pas chaque matin avec une
date décalée. Un changement effectif de contexte peut permettre une nouvelle
proposition. Les contextes acceptés, même annulés ensuite, ne sont pas reproposés.
Une seule suggestion est calculée, sans appels répétés pour remplir un programme.
Les résumés et configurations ne sont pas copiés dans les empreintes persistées.

Le retrait du consentement et plaisir/forme arrêtent les nouvelles propositions,
pas la consultation ou la gestion des séances acceptées. L'acceptation et le
refus revérifient consentement et révisions dans la transaction. Les changements
de configuration entre onglets sont notifiés sans données personnelles ; une
écriture reste protégée même si la notification n'est pas disponible.


## Présentation et terrain

Le planning accepté précède la prochaine proposition, les observations puis la
configuration. Les limites détaillées restent sous « Pourquoi cette séance ? » ;
les échéances et l'absence de données suffisantes restent signalées.

Le terrain recommandé est transitoire et distingue surface et relief. La surface
vient d'abord de la préférence déclarée, sinon des sports explicitement renseignés
et concordants de toutes les séances récentes retenues (route, trail, tapis).
Une donnée absente ou un ensemble mixte ne permet pas d'inférer une surface.
Pour découvrir, reprendre ou une expérience déclarée débutante : plat ou peu
vallonné, en conservant la surface choisie. Sinon : relief libre. Aucun seuil de
D+ n'est introduit ; D+, titres et catégorie trail ne prouvent pas le relief.
Aucun itinéraire n'est inventé. Sans données de relief fiables, « vallonné » n'est
pas recommandé. Ces explications rejoignent le texte initial déjà sauvegardé
lors d'une nouvelle acceptation, sans nouveau champ persistant ni migration.
