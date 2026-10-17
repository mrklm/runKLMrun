# Suggestions libres — préparation 5C.1

API pure : `proposeSuggestions(input, planning?)` dans `proposals.ts`.
Elle retourne les mêmes observations, diagnostics et contraintes que le moteur
historique, ainsi qu'une liste comportant un identifiant 5B et une explication courte.
`proposeNextSession(input)` reste l'entrée de l'interface, avec son horizon et son
comportement existants. Les deux entrées partagent le même calcul : aucune simulation
de sorties futures, aucune écriture, aucun ajout de suggestion à l'historique.

## Sélection

- Sept jours civils, de demain à J+7 inclus. Au maximum trois suggestions ; il s'agit
  d'un plafond produit modéré, pas d'une fréquence recommandée.
- Plusieurs suggestions uniquement si le calcul existant qualifie les durées de
  représentatives (`supported`) et dispose d'un rythme récent. Sinon, au plus une,
  voire aucune. L'expérience déclarée ne change pas cette condition.
- Consentement et objectifs existants préservés, dont l'absence de planification
  pour plaisir/forme. Débuter et reprendre gardent leurs règles de prudence.
- Espacement : maximum du rythme médian récent et de l'espacement correspondant à
  une fréquence souhaitée moins élevée, arrondi au jour supérieur. Aucune fréquence
  minimale ajoutée. Les jours disponibles ne sont pas tous remplis.
- Une séance `planned` bloque sa date et les dates plus proches que cet espacement,
  avant ou après elle, même si elle est située juste hors de l'horizon. Une séance
  annulée ne bloque pas. Dates déplacées et durées modifiées sont respectées.
- Budget descriptif de durée : médiane récente × 7 / espacement retenu, auquel sont
  soustraites les durées déjà planifiées dans l'horizon. Une candidate dépassant ce
  reste est omise, sans raccourcissement artificiel. Ce budget n'est ni une estimation
  de capacité ni une mesure physiologique de charge ; il évite de multiplier le volume
  simplement parce que des jours sont disponibles.

## Durée et variation

Les fractions 50/80 %, les critères de fraîcheur/représentativité, les minimums,
les plafonds par jour et l'arrondi inférieur à cinq minutes sont réutilisés.
L'endurance documentée peut donc dépasser 30 minutes sans ajouter de nouveau
coefficient. La deuxième candidate retenue est une sortie facile raccourcie de cinq
minutes avant arrondi, uniquement si le minimum le permet. La troisième retrouve
le plafond de base, jamais un plafond supérieur. Si le minimum interdit de raccourcir,
la durée peut se répéter : aucune variété artificielle n'est inventée.

Tous les efforts restent faciles. Les types `endurance`/`easy` décrivent cette variation,
pas des intensités différentes. Préférences et recommandations de terrain utilisent
la même fonction existante. Une explication factuelle accompagne chaque suggestion ;
les diagnostics détaillés restent disponibles. Aucune progression multi-semaines,
fatigue ou motivation supposée, aucun rattrapage.

## Identité et présentation future

L'identifiant utilise exactement `suggestionId` de 5B : date, type, durée et terrain.
Pour une future persistance, projeter ces champs vers `PresentedSuggestion` ; ne pas
transmettre l'objet moteur entier, qui contient des diagnostics non persistants.

**Ne pas brancher cette liste sur l'enregistrement à remplacement unique de 5B.2.**
`replacementCandidates` prépare un calcul pur sur un ensemble effectivement présenté :
les membres de l'ensemble ne se rendent pas obsolètes entre eux ; un ensemble vide
ne provoque aucune obsolescence. Les exclusions liées au planning et les contrôles
transactionnels devront rester appliqués lors du futur raccordement 5C.2.
Aucune modification de la persistance ni de l'interface n'est effectuée ici.

Limites : horizon court, choix chronologique déterministe, pas d'optimisation globale
pour maximiser les créneaux. Les absences de données peuvent limiter à une seule
suggestion. Les refus historiques sont préservés, mais leur clé de contexte relève
toujours de l'interface unique ; aucun nouveau sens ne leur est donné par cette API.

## Raccordement 5C.2

L'interface utilise désormais `proposeSuggestions`, en transmettant le planning.
`proposeNextSession` reste disponible pour compatibilité technique et non-régression.
Les calculs de cette phase ne sont pas modifiés. L'obsolescence est raccordée par
`recordPresentedSetMember` uniquement après mémorisation de tous les membres de
l'ensemble ; voir [la documentation du stockage](../../storage/README.md).

## Variation 5E

Dans `proposeSuggestions`, les objectifs endurance, vitesse, distance et course
peuvent alterner durée habituelle et facile uniquement lorsque l’évaluation
existante est `supported`. Les références, la fraîcheur et la variabilité restent
inchangées. Durée habituelle : médiane retenue, disponibilité du jour, puis arrondi
inférieur à cinq minutes. Durée facile : règle existante des 80 % et minimum de
30 minutes, disponibilité puis même arrondi. Le retrait supplémentaire de cinq
minutes disparaît. Aucun changement pour débuter, reprendre ou les références
incertaines ; `proposeNextSession` conserve son contrat historique.

Une durée habituelle limitée en dessous de la médiane arrondie est libellée facile.
Si une durée endurance égale une durée facile dans l’ensemble final, son libellé
devient également facile. Les identifiants sont calculés après cette harmonisation.
Les explications ne disent « plus courte » que si la durée est inférieure à la
médiane. Tous les efforts restent faciles, sans séance rapide ni progression.

Le rythme, l’espacement avec le planning et le budget restent inchangés : médiane
multipliée par 7 / espacement (au moins un jour), moins les durées déjà planifiées
dans l’horizon. Le budget n’est pas relevé pour accueillir les nouvelles durées.
Une séance qui ne tient pas est écartée, pas raccourcie pour remplir le calendrier.
Le nombre reste compris entre zéro et trois, sans fréquence minimale. Les
coefficients et plafonds effectivement utilisés sont exposés par suggestion ; le
diagnostic global décrit la première suggestion retenue (sinon le calcul initial).

Aucune écriture du moteur : les suggestions déjà mémorisées ne sont pas recalculées
ou migrées. Même contenu = même identifiant ; une durée ou un type réellement
nouveau produit une nouvelle identité, soumise au mécanisme de présentation existant.
