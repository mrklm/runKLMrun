# Phase 3D — simulations longitudinales des séances V2

Ces simulations évaluent le prototype 3C pendant douze semaines. Elles restent isolées du Coach de production, du stockage et de l'interface. Elles démontrent des propriétés logicielles, pas l'efficacité ou la sécurité physiologique des séances.

## Méthode

La matrice croise :

- sept objectifs ;
- quatre profils : débutant sans historique, occasionnel, régulier et expérimenté ;
- cinq comportements : pratique stable, progression réelle, suggestions ignorées, interruption puis reprise et disponibilités variables ;
- douze consultations hebdomadaires.

Cela représente **140 trajectoires** et **1 680 semaines simulées**.

Chaque consultation appelle uniquement `selectPrototypeSessions()`. Une activité rejoint ensuite l'historique si, et seulement si, le scénario la déclare explicitement. Aucune suggestion n'est transformée en activité. L'orchestration ne contient ni date proposée, ni statut « manqué », ni dette, ni rattrapage : elle ne constitue pas un planificateur.

La référence habituelle est recalculée depuis les activités synthétiques indépendantes. Une progression de référence n'apparaît donc que dans le scénario qui augmente explicitement les durées réellement courues.

## Différenciation observée

Profil expérimenté, pratique stable et références complètes :

| Objectif | Types candidats observés | Candidats structurés sur 12 consultations |
|---|---|---:|
| Débuter | Endurance facile | 0 |
| Reprendre | Récupération | 0 |
| Plaisir et forme | Endurance facile | 0 |
| Améliorer l'endurance | Endurance facile, sortie longue | 0 |
| Améliorer la vitesse | Endurance facile, fractionné | 12 |
| Atteindre une distance | Endurance facile, sortie longue | 0 |
| Préparer une course | Endurance facile, sortie longue, côtes | 12 |

Les objectifs sont donc réellement différenciés lorsque le profil fournit les preuves requises. Un débutant ou un profil insuffisamment documenté ne reçoit pas les candidats exigeants ou structurés.

## Résultats significatifs

### Activités et progression

- Les scénarios `ignored` ne créent aucune activité et les suggestions n'influencent jamais la référence.
- La pratique stable conserve une durée stable tant que ses activités restent documentées.
- Plaisir et forme ne progresse pas sous l'effet des suggestions. Sa référence augmente uniquement dans le scénario `real-progression`, après des activités explicitement plus longues et les confirmations du prototype de référence.
- L'interruption fait passer la preuve à `insufficient`. Les candidats soutenus ou fractionnés disparaissent alors ; les nouvelles activités de reprise doivent reconstruire des références.

### Disponibilités et contenus

- Chaque durée candidate reste inférieure ou égale à la disponibilité de sa semaine.
- Une disponibilité courte supprime une sortie longue ou structurée devenue incohérente au lieu de dépasser le créneau.
- Toutes les séances structurées conservent une somme de blocs exactement égale à leur durée totale.
- Les séances libres restent sans blocs.

### Accumulation des candidats

Le sélecteur 3C ne connaît ni séances déjà proposées, ni espacement, ni volume cumulé. Il retourne donc le même candidat fractionné aux douze consultations du profil expérimenté « vitesse », et le même candidat de côtes aux douze consultations « course ».

Ce résultat ne signifie pas que douze séances seraient planifiées ou réalisées : aucun calendrier n'existe. Il révèle cependant qu'un raccordement direct du catalogue à une interface hebdomadaire pourrait accumuler des offres structurées sans contrôle. La fréquence des sorties longues présente la même limite conceptuelle, même si leur intensité reste facile.

## Données insuffisantes

- Le débutant commence avec une option facile et aucune séance exigeante.
- Le profil occasionnel ne devient documenté qu'après des activités réelles suffisantes.
- Une interruption réelle retire les variantes structurées tant que les nouvelles preuves restent insuffisantes.
- Les objectifs distance et course conservent séparément cible, distance documentée et échéance ; une donnée manquante réduit le résultat à l'alternative facile.

## Limites

- La consultation hebdomadaire est une cadence de mesure, pas un calendrier recommandé.
- Les activités réalisées sont synthétiques et indépendantes des candidats ; aucun comportement humain n'est prédit.
- Les types déjà observés restent fournis par les profils fictifs. Leur qualification fiable n'existe pas encore en production.
- Le prototype ne contrôle pas la fréquence des types, le volume cumulé, l'espacement ni les interactions entre plusieurs candidats.
- Les paramètres de durée et d'admissibilité restent des choix expérimentaux.

## Recommandations

La prochaine étape doit ajouter un **orchestrateur expérimental de sélection**, distinct du catalogue 3C et toujours sans persistance. Il devra :

1. choisir zéro ou un candidat parmi les variantes compatibles pour une occurrence ;
2. tenir compte des types récemment proposés et des activités réellement enregistrées ;
3. empêcher la répétition rapprochée de séances structurées ou longues ;
4. rester sans dette, rattrapage ni progression automatique ;
5. comparer plusieurs règles d'espacement sans les présenter comme des normes scientifiques.

Le catalogue de séances peut être conservé. Il ne doit pas être raccordé directement comme plan hebdomadaire tant que cette sélection temporelle n'est pas définie et simulée.

# Phase 3E — orchestrateur temporel expérimental

## Règles essayées

L'orchestrateur reçoit le catalogue 3C sans modifier ses durées, ses blocs ou ses explications, puis choisit zéro ou un candidat. Il travaille avec les dates civiles réelles, pas avec le numéro de semaine de la simulation.

Les seuils suivants sont des **choix éditoriaux expérimentaux** et non des constantes scientifiques :

- au moins 2 jours depuis la dernière activité enregistrée ;
- au moins 3 jours depuis la dernière suggestion présentée ;
- au moins 14 jours entre deux présentations de séances structurées (`fractionné`, `sortie soutenue`, `côtes`) ;
- au moins 10 jours entre deux présentations de sorties longues.

Une activité au type inconnu compte uniquement pour l'espacement général. Elle ne prouve jamais qu'une séance structurée ou longue a été réalisée. Seul un type documenté de façon fiable peut participer à l'espacement propre à ce type. Une suggestion présentée reste une présentation : elle n'est jamais ajoutée aux activités.

Lorsque le candidat spécialisé est temporairement écarté, l'orchestrateur peut retenir le candidat facile déjà fourni par le catalogue. Il renvoie zéro suggestion après une activité ou une présentation trop récente, ou lorsqu'aucun candidat ne respecte la disponibilité. Il ne crée ni dette, ni remplacement, ni rattrapage.

## Comparaison sur les trajectoires 3D

| Cas observé sur 12 consultations | Catalogue 3C | Avec orchestrateur 3E |
|---|---:|---:|
| Fractionné disponible, objectif vitesse expérimenté | 12 | 6 sélectionnés |
| Côtes disponibles, préparation de course expérimentée | 12 | 6 sélectionnées |
| Suggestions ignorées | aucune activité créée | aucune activité, dette ou séance de remplacement créée |
| Références insuffisantes après interruption | variante structurée absente | variante structurée toujours absente |

La réduction de 12 à 6 provient de consultations espacées de sept jours face au délai expérimental de quatorze jours. C'est un effet de seuil attendu : ce résultat ne constitue pas une recommandation de fréquence.

Les scénarios à une et deux courses par semaine laissent une proposition possible lorsque la dernière activité est assez ancienne. Dans le scénario synthétique à quatre courses par semaine, une activité la veille conduit à zéro suggestion. Les dates irrégulières produisent le même résultat selon leur écart réel ; aucun calendrier hebdomadaire implicite n'est utilisé.

Les trajectoires où les suggestions sont ignorées confirment aussi que l'orchestrateur ne fait pas progresser la référence. Les durées sélectionnées restent exactement celles du catalogue et les observations réelles restent la seule source d'évolution du prototype de référence habituelle.

## Limites et recommandation

- Les délais de 2, 3, 10 et 14 jours doivent faire l'objet d'une analyse de sensibilité ; leur intérêt physiologique n'est pas établi ici.
- L'orchestrateur filtre une liste de candidats déjà construite. Il ne calcule ni charge, ni fatigue, ni récupération.
- Il ne choisit pas de date future et ne constitue toujours pas un calendrier.
- La provenance fiable du type d'une activité devra être définie avant toute intégration en production.
- Une activité au type inconnu peut empêcher brièvement toute suggestion, mais ne prolonge jamais le délai propre aux séances structurées.

La suite recommandée est de simuler des consultations quotidiennes et irrégulières avec plusieurs valeurs de seuil, puis de vérifier la fréquence totale des suggestions faciles, longues et structurées. L'intégration au Coach de production doit attendre cette analyse et la définition d'une source fiable pour les types d'activités.

# Phase 3F — sensibilité temporelle

## Méthode

Le banc rejoue douze semaines avec des consultations quotidiennes, hebdomadaires, irrégulières et répétées le même jour. Les quatre seuils de 3E sont injectés dans l'orchestrateur ; ses valeurs par défaut restent inchangées. Les suggestions ignorées, parfois réalisées, les activités indépendantes et une interruption suivie d'une reprise sont distinguées explicitement.

Une présentation et une activité restent deux faits séparés. Le délai après présentation stabilise ce que l'application propose. Le délai après activité représente seulement un espacement éditorial fondé sur un effort réellement enregistré. Le simulateur ne crée une activité depuis une suggestion que lorsque le scénario la déclare expressément réalisée.

## Comparaison des seuils

Consultations quotidiennes pendant 84 jours, avec un catalogue documenté et sans activité ajoutée :

| Paramètre isolé | Valeur testée | Résultat observé |
|---|---:|---|
| Après activité | 1 / 2 / 3 jours | Première nouvelle présentation exactement à J+1 / J+2 / J+3 |
| Après présentation | 1 / 3 / 5 jours | Au plus 84 / 28 / 17 présentations |
| Séance structurée | 7 / 10 / 14 jours | 12 / 9 / 6 séances structurées |
| Sortie longue | 7 / 10 / 14 jours | 12 / 9 / 6 sorties longues |

Ces nombres décrivent les scénarios et leurs consultations, pas une fréquence d'entraînement recommandée. Les seuils créent des effets de palier prévisibles. Par exemple, avec une consultation hebdomadaire, un seuil structuré de 10 ou 14 jours conduit dans les deux cas à une sélection toutes les deux semaines.

## Fréquence de consultation

Avec la politique 3E (2 / 3 / 14 / 10 jours) :

| Consultations sur douze semaines | Séances structurées sélectionnées | Observation |
|---|---:|---|
| Quotidiennes | 6 | Le seuil de 14 jours domine ; les affichages intermédiaires sont faciles |
| Hebdomadaires | 6 | Une variante structurée une consultation sur deux |
| Irrégulières | 4 | La sélection suit les dates réelles disponibles |
| Trois consultations le même jour, chaque semaine | 6 | Une seule présentation possible par date civile |

La fréquence d'ouverture ne change donc pas le nombre de séances structurées entre les scénarios quotidien et hebdomadaire avec la politique actuelle. Elle change toutefois le nombre total de présentations faciles : le prototype ne mémorise pas encore une suggestion active à réafficher. Cette stabilité d'identité relève d'une future intégration, pas d'un abaissement artificiel des seuils.

## Comportements vérifiés

- Une suggestion ignorée ne crée ni activité, ni progression, ni dette, ni remplacement.
- Une suggestion parfois réalisée produit une activité uniquement aux occurrences déclarées par le scénario.
- Une activité indépendante récente peut conduire à zéro suggestion ; l'autorisation revient exactement à l'échéance du seuil.
- Après une interruption, une suggestion redevient possible sans rattrapage des semaines écoulées.
- Une disponibilité trop courte produit zéro suggestion au lieu de réduire ou déformer les candidats.
- Les durées et les blocs du catalogue restent inchangés.
- Plusieurs consultations le même jour ne créent pas plusieurs présentations.

## Politique recommandée et limites

La politique 3E reste une base raisonnable pour poursuivre les simulations : 2 jours après activité, 3 jours après présentation, 14 jours entre présentations structurées et 10 jours entre sorties longues. Ce choix limite les répétitions sans blocage durable dans les scénarios testés. Il reste **expérimental** et ne constitue pas une prescription physiologique.

Avant une intégration en production, il faut encore :

- définir la durée de vie et l'identité d'une suggestion active afin qu'une ouverture répétée réaffiche la même proposition plutôt que d'en calculer une nouvelle ;
- tester des historiques plus denses où activités indépendantes et suggestions réalisées se chevauchent ;
- décider quelles sources peuvent documenter fiablement le type d'une activité ;
- vérifier la politique avec des fuseaux horaires et changements de date civile ;
- conserver la possibilité de zéro suggestion sans transformer l'absence en dette.
