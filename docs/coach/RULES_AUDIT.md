# Audit des règles du Coach

Audit du 17 octobre 2026, version 0.7.0, référence Git `29efc6f`. Lecture du code et des tests existants ; aucun accès aux données personnelles, aucune simulation exécutée. Les risques ci-dessous sont des déductions du code, pas des résultats cliniques ou des incidents constatés chez un utilisateur.

## Classification

- **A** : principe général documenté scientifiquement. Cela ne valide pas sa traduction numérique dans le logiciel.
- **B** : choix de conception explicite, sans validation scientifique directe identifiée.
- **C** : règle ou hypothèse à réévaluer, notamment par simulation et analyse des conséquences.

L'individualisation, la spécificité et la récupération sont des principes **A** : voir [fondements](SCIENTIFIC_FOUNDATIONS.md) et [références R1–R8](REFERENCES.md). Les seuils ci-dessous sont **B** ou **C**, jamais des seuils physiologiques établis.

## Chemin d'exécution et données

L’interface historique du planning V1, retirée au lot 2, appelait `proposeSuggestions()` avec les résumés, la configuration évolutive, le profil historique et le planning. Dans [proposals.ts](../../src/core/coach/proposals.ts), cette API réutilise `calculateProposals()`, également employé par `proposeNextSession()`, mais impose un horizon de sept jours et permet plusieurs suggestions. Le commentaire « sans raccordement à l'interface » de cette API n'est plus conforme à son utilisation réelle.

Les changements de séances, profil, configuration, planning et date civile alimentent le recalcul. La date est surveillée périodiquement ; les protections asynchrones évitent qu'une réponse ancienne remplace un état plus récent. Une suggestion calculée n'est pas nécessairement affichée ou mémorisée.

Les calculs utilisent essentiellement **dates civiles et durées des résumés**. Les distances, D+, fréquences cardiaques et autres mesures peuvent être décrites par `observeHistory()`, mais ne déterminent pas la durée ou l'intensité proposées. Les séries détaillées, GPS et annotations de ressenti ne sont pas exploités par ce moteur. L'expérience déclarée ne prouve aucune capacité actuelle. Les disponibilités du profil historique et l'objectif évolutif ont des rôles distincts : aucun objectif historique n'est converti automatiquement.

## Inventaire des règles

Les paramètres proviennent de [product-policy.ts](../../src/core/coach/product-policy.ts), `EDITORIAL_TUNING` et `productPolicy()`. Leur validation technique ne constitue pas une validation scientifique.

| Règle et emplacement | Fonctionnement et données | Intention | Classe et limite |
|---|---|---|---|
| Observation — [foundations.ts](../../src/core/coach/foundations.ts), `observeHistory()` | Exclut les dates invalides ou futures, trie les activités, refuse les identifiants dupliqués. Les jours actifs sont uniques. | Décrire uniquement des données utilisables. | **B** : suppose un historique de course déjà normalisé ; ne prouve pas son exhaustivité. |
| Activation — `calculateProposals()`, `canActivateStructuredPlanning()` | Configuration évolutive et consentement `accepted` nécessaires. Objectif plaisir/forme exclu. | Respecter le choix du coureur. | **B** : ce consentement n'est pas une validation médicale. |
| Références — `proposalEvidence()` | Candidats âgés d'au plus **180 jours** ; médiane des **8 derniers intervalles** entre leurs dates actives. | Adapter les fenêtres au rythme observé. | **C** : huit intervalles ne signifient pas huit dernières séances. Un rythme ancien et peu fréquent peut élargir les références. |
| Fenêtre récente — même fonction | Avec intervalle médian `g`, fenêtre `min(180, ceil(4 × g))` jours, bornes incluses. Sans intervalle, seules les activités de la dernière date sont décrites. | Écarter les références trop éloignées du rythme courant. | **C** : fenêtre mobile discontinue ; perte possible de plusieurs références d'un jour à l'autre. |
| Interruption possible — même fonction | Si l'âge de la dernière candidate dépasse strictement `min(180, ceil(2 × g))`, les références de durée sont écartées. | Ne pas transférer automatiquement une ancienne pratique. | **C** : absence d'import et interruption réelle sont indiscernables. Ce n'est pas une mesure de désentraînement. |
| Durées utilisables — même fonction | Durées finies, strictement positives, au plus **86 400 s**. Médiane utilisable seulement avec au moins deux dates récentes distinctes. | Éviter les valeurs invalides et une référence isolée. | **B/C** : plusieurs séances le même jour pèsent séparément dans la médiane et le nombre de durées. |
| Représentativité — `selectDuration()` | Minimum **3 durées** pour endurance/vitesse/distance/course, **4** pour les autres objectifs ; toute durée récente manquante déclenche la prudence. | Exiger un historique documenté. | **C** : seuils éditoriaux, pas preuve de capacité. Trois durées peuvent provenir de seulement deux dates. |
| Fraîcheur — même fonction | Historique complet atteignant le minimum : tolérance de deux intervalles arrondis, plafonnée à 180 jours. Sinon : **un intervalle médian**. | Distinguer historique documenté et fragile. | **C** : changement de tolérance au seuil ; pratique peu fréquente et données manquantes influencent fortement le résultat. |
| Variabilité — même fonction | `(durée max − durée min) / médiane > 0,5` déclenche la prudence. Variabilité des intervalles descriptive seulement. | Détecter une médiane peu représentative. | **C** : l'étendue dépend des extrêmes ; une alternance volontaire courte/longue peut être pénalisée. `maximumGapSpread = 1` reste validé mais ne déclenche plus de réduction. |
| Coefficient — même fonction | **50 %** si une raison de prudence existe, sinon **80 %**. Débuter/reprendre ajoute toujours une raison de prudence. Plafond prudent **45 min**. | Réduire la durée proposée face à l'incertitude. | **C** : aucune source consultée ne valide ces fractions ni leur application répétée. Une durée réduite ne garantit pas un effort facile. |
| Minimum — même fonction | Minimum **30 min** pour endurance/vitesse/distance/course ; **5 min** pour débuter/reprendre. Une base à 80 % peut être relevée à 30 min uniquement si les références sont représentatives et leur médiane atteint 30 min. | Assurer une suggestion jugée cohérente éditorialement. | **C** : ce n'est pas un minimum scientifique d'efficacité. Une base prudente n'est jamais relevée. |
| Absence de médiane — même fonction | Aucun coefficient inventé. Découverte **30 min** pour débuter, **20 min** pour reprendre ; aucune découverte pour les quatre objectifs à minimum de 30 min. | Permettre une première proposition sans extrapoler l'ancien historique. | **C** : durées fixes sans capacité mesurée ; transitions vers/depuis cette branche à examiner. |
| Variation — `calculateProposals()` | En mode multiple, références représentatives : suggestions acceptées par le calcul aux rangs 1 et 3 plafonnées à **100 % de la médiane**, rang 2 à la base prudente de 80 %. | Distinguer durée habituelle et sortie plus courte, sans progression. | **B/C** : rang chronologique, pas stratégie individualisée de cycle. Un créneau rejeté ne change pas le rang. |
| Arrondi et disponibilités — même fonction et [proposal-presentation.ts](../../src/core/coach/proposal-presentation.ts) | Plafond global ou propre au jour, puis arrondi inférieur par **300 s**. Plafond absent = aucun plafond de disponibilité, jamais zéro. Sous le minimum : rejet. | Respecter le temps déclaré et proposer des durées simples. | **B/C** : effet de seuil ; 37 min deviennent 35 min même dans la branche habituelle. |
| Vérification préalable — `calculateProposals()` | La base 50/80 % arrondie doit atteindre le minimum avant la recherche de jours et la variation habituelle. | Ne pas contourner une base jugée insuffisante. | **C** : le refus initial doit être distingué d'un problème de calendrier. |
| Espacement — même fonction | `max(intervalle médian observé, 7 / fréquence souhaitée)` ; arrondi supérieur en jours pour placer les séances. Une fréquence souhaitée plus élevée ne raccourcit pas le rythme observé. | Respecter habitudes et souhait de moindre fréquence. | **C** : arrondir peut ralentir progressivement le rythme ; ce n'est pas une règle physiologique de récupération. |
| Nombre et calendrier — même fonction | De demain à sept jours ; jusqu'à **3** suggestions si références représentatives, sinon au plus **1**. Jours disponibles, échéance et espacement peuvent ramener ce nombre à zéro. | Éviter de remplir toutes les disponibilités. | **B** : trois est un maximum par calcul, pas un quota global d'activités sur toute semaine glissante. |
| Planning — même fonction | Séances historiques de statut `planned` bloquent les dates trop proches ; leurs durées dans l'horizon sont soustraites du budget. | Éviter de doubler un engagement déjà planifié. | **B** : suggestions mémorisées et séances planifiées sont différentes ; les premières ne sont pas soustraites comme engagements. |
| Budget — même fonction | Si références représentatives : `floor(médiane × 7 / max(1, espacement))`, moins les durées planifiées dans l'horizon. Une suggestion dépassant le solde est écartée, pas raccourcie pour le remplir. | Limiter le volume proposé au rythme descriptif. | **C** : ce n'est ni le volume réel des sept derniers jours ni une charge physiologique. Sinon budget non borné dans ce calcul, mais au plus une suggestion et les autres plafonds restent actifs. |
| Intensité — même fonction | Toutes les suggestions ont `intensity.kind = easy`, sans allure ou fréquence cardiaque cible. | Ne pas prescrire une intensité non justifiée par les résumés. | **B** : aucun entraînement spécifique de vitesse, seuil ou fractionné actuellement. |
| Libellés — même fonction | Une durée habituelle non réduite peut être « endurance ». Si une suggestion facile a la même durée, le libellé endurance est normalisé en facile. | Ne pas inventer deux stratégies identiques. | **B** : distinction réelle essentiellement de durée, pas d'intensité. |
| Objectifs distance/course — même fonction | Cible conservée, mais ni distance cible ni chrono ne fixent durée/allure. Échéance : aucune séance à partir de cette date. | Ne pas accélérer une préparation pour satisfaire une date. | **B** : faisabilité de l'objectif, périodisation et affûtage non évalués. |

### Exemples bornés, pas simulations longitudinales

Avec références cohérentes et fraîches, calendrier et budget suffisants, disponibilités non limitantes :

| Médiane | Durées possibles de trois suggestions |
|---|---|
| 35 min | 35 / 30 / 35 min |
| 37 min | 35 / 30 / 35 min |
| 40 min | 40 / 30 / 40 min |
| 43 min | 40 / 30 / 40 min |
| 45 min | 45 / 35 / 45 min |

Ces cas figurent dans [suggestion-set.test.ts](../../src/core/coach/suggestion-set.test.ts). Ils ne prouvent pas la stabilité sur douze semaines. La présence de huit sorties dans l'interface ne garantit pas leur inclusion dans la fenêtre du moteur.

## Terrain : surface et relief séparés

`recommendTerrain()` dans [proposal-presentation.ts](../../src/core/coach/proposal-presentation.ts) utilise d'abord la préférence de surface : route, chemins ou tapis. Sans préférence, une surface n'est déduite que si toutes les références sélectionnées portent un sport explicite et concordant (`ROAD_RUNNING`, `TRAIL_RUNNING`, `TREADMILL_RUNNING`). Un sport générique ou des références mixtes ne permettent pas cette déduction.

Le relief est **plat ou peu vallonné** pour découverte, expérience déclarée débutante ou objectif débuter/reprendre ; sinon **libre**. Une préférence chemins reste compatible avec un relief peu vallonné. Aucun D+, tracé GPS ou nom d'activité n'est utilisé pour déduire le relief. Aucun itinéraire ni objectif chiffré de dénivelé n'est produit. Le profil ne distingue pas actuellement une préférence personnelle de relief à exploiter comme telle.

Classification **B** pour la séparation surface/relief ; **C** pour l'adéquation de ces seuls choix aux futurs types de séances. Le fait que la pente modifie le coût de l'effort est documenté (**A**, [R6](REFERENCES.md#r6--pente-et-coût-énergétique)), mais ne valide pas cette règle exacte.

## Observations et ressenti : ne pas les confondre avec les propositions

[comparison.ts](../../src/core/coach/comparison.ts), [observations.ts](../../src/core/coach/observations.ts) et [training-history.ts](../../src/core/analysis/training-history.ts) comparent des périodes égales de 4, 8 ou 12 semaines ; l'accueil utilise huit semaines. Distance et durée sont traitées indépendamment, sans annoncer une comparaison complète quand les mesures nécessaires manquent.

Les observations sélectionnent au plus quatre messages selon des priorités déterministes : interruption possible, fréquence souhaitée, jours pratiqués, disponibilité en durée, évolution de fréquence/volume, objectif historique. Le repère d'interruption utilise notamment au moins quatre sorties dans la période précédente et une ancienneté d'au moins `max(7, ceil(2 × durée de période en jours / nombre de sorties))`.

Ce sont des choix **B/C**, distincts des règles de `proposalEvidence()`. Ces textes ne pilotent pas le coefficient de durée. Les annotations de ressenti stockées par [session-feeling.ts](../../src/storage/session-feeling.ts) ne sont pas des entrées de `proposeSuggestions()`. Ne pas décrire le Coach comme un outil d'analyse de fatigue, douleur ou blessure.

## Persistance et rapprochement

| Mécanisme | Code et fonctionnement | Limite / classe |
|---|---|---|
| Présentation réelle historique | Cartes V1 retirées au lot 2, [suggestion-presentation.ts](../../src/components/suggestion-presentation.ts) : observation de visibilité, document visible, vérifications de position/occlusion, attente de rendu avant écriture. | **B** : visibilité technique, pas preuve de lecture ou d'acceptation. |
| Identité | [suggestions.ts](../../src/core/coach/suggestions.ts), `suggestionId()` : date, type, durée, surface, relief. | **B** : déterministe ; changer la durée peut créer une nouvelle identité, sans réécrire l'ancienne. |
| Écriture | [coach-suggestions.ts](../../src/storage/coach-suggestions.ts), `recordPresentedSetMember()` : transaction et contrôle du contexte courant, révisions et notifications ; une identité déjà enregistrée n'est pas réécrite à chaque affichage. | **B** : le calcul seul n'écrit rien ; aucun apprentissage de capacité depuis la mémorisation. |
| Remplacement | L'obsolescence d'un ancien ensemble attend que les membres du nouvel ensemble soient mémorisés ; protections des suggestions associées, passées et liées au planning historique. | **B** : démonter un composant ne rend pas une suggestion obsolète. |
| Conservation | Expiration civile à date suggérée + 8 jours, soit sept jours suivant cette date ; masquage des éléments expirés. | **B/C** : l'API `deleteExpired()` existe mais aucun appel de production n'a été trouvé ; ne pas confondre expiration logique et suppression physique garantie. |
| Association factuelle | [suggestion-matching.ts](../../src/core/coach/suggestion-matching.ts) et [suggestion-reconciliation.ts](../../src/storage/suggestion-reconciliation.ts) : activité de course et suggestion présentée, même date civile, correspondance non ambiguë. Durée/allure/distance identiques non exigées. | **B** : association descriptive, jamais preuve d'obéissance. Pas d'adaptation automatique de la progression. |
| Information passée | [past-suggestions.ts](../../src/core/coach/past-suggestions.ts) : suggestion passée, non associée, non obsolète, non expirée, rapprochement à jour ; ambiguïté ou activité ce jour-là empêchent l'affirmation d'absence. | **B** : absence d'import ne démontre pas absence de sortie. |
| Sauvegarde | [format.ts](../../src/backup/format.ts) et API de stockage : prise en charge des suggestions dans le format 5, magasin `coachSuggestions` introduit en v8. | **B** : compatibilité de données, pas validation du moteur. Aucun changement proposé ici. |

## Risques de rétroaction et progression

### Durées : baisse possible, pas inévitable

La médiane suivante utilise les activités réalisées, sans distinguer une sortie volontairement courte d'une limite de capacité. Si le coureur réalise surtout les propositions faciles, ces durées peuvent abaisser la médiane suivante. Le coefficient de réduction est alors appliqué à une référence déjà réduite. L'arrondi inférieur ajoute une réduction discrète.

La branche habituelle à 100 % de la médiane atténue ce mécanisme : suivre 35 / 30 / 35 ne produit pas forcément une diminution continue. Le plancher de 30 minutes peut stabiliser certaines propositions, mais un historique devenu trop court, incomplet ou variable peut aussi produire un refus. **On ne peut pas conclure à une baisse systématique pour tous les profils.**

Débuter/reprendre appelle une vigilance particulière : ces objectifs imposent toujours 50 % lorsqu'une médiane est disponible. À médiane remplacée intégralement par les durées proposées, l'illustration algébrique 30 → 15 → 5 → sous le minimum montre un risque. Ce n'est pas une simulation : nombre de références, fenêtres et dates peuvent modifier cette trajectoire. Le passage inverse vers une durée fixe de découverte après perte des références peut également augmenter la proposition par rapport aux dernières séances courtes.

### Fréquence : arrondi et plafond peuvent entretenir un rythme réduit

Un intervalle observé de 2,5 jours devient trois jours pour la proposition. Si le coureur adopte ce rythme, il devient la référence suivante. Le plafond de trois suggestions et le choix du maximum entre rythme observé et souhaité empêchent une augmentation volontaire de fréquence par ce moteur. Ils peuvent aussi réduire la fréquence d'un coureur auparavant plus actif s'il ne réalise plus que les suggestions.

### Progression : aucune stratégie longitudinale implémentée

Le moteur ne programme ni progression sur plusieurs semaines, ni alternance de cycles, ni intensification. Une médiane plus élevée issue de sorties indépendantes peut augmenter les propositions suivantes : c'est une réaction à l'historique, pas une progression structurée. Inversement, plafonner à la médiane ne permet pas de proposer délibérément une sortie plus longue que l'habitude.

Cette absence de stratégie ne prouve pas l'absence d'amélioration physiologique : des sorties faciles peuvent être utiles. Elle empêche simplement d'attribuer au logiciel une progression spécifique qu'il ne calcule pas.

### Volume et incertitude

Le budget d'un ensemble ne retranche pas les sorties déjà réalisées dans une semaine glissante et ne réserve pas les suggestions précédemment mémorisées. Des recalculs successifs peuvent produire des ensembles différents. Le nombre d'idées affichées au fil du temps et le volume réellement couru ne sont donc pas bornés par la seule somme d'un calcul.

Les minutes ne capturent ni intensité réelle, ni pente, ni fatigue, ni contraintes personnelles. Les sources sur la charge et la récupération ne permettent pas de présenter ce budget comme une garantie contre les blessures. Les seuils de représentativité, fraîcheur, variabilité, minimum et arrondi doivent être évalués ensemble.

## Priorités à valider avant modification

1. Décrire puis simuler douze semaines, en séparant références habituelles et sorties faciles suivies : voir [stratégies](OBJECTIVE_STRATEGIES.md).
2. Examiner la stabilité des branches débuter/reprendre et des passages entre découverte, prudence et références représentatives.
3. Évaluer le volume réellement cumulé et la fréquence après recalculs, pas seulement un ensemble de trois suggestions.
4. Définir les différences de stratégies par objectif avant d'ajouter de nouveaux types ou intensités.
5. Justifier chaque paramètre comme hypothèse produit testable ; préserver les diagnostics et l'absence de pénalité pour une suggestion ignorée.

Aucune de ces pistes n'est implémentée dans cette phase.
