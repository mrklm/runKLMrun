# Objectifs et stratégies envisagées

Phase 1 — 17 octobre 2026. **Document de conception, aucune nouvelle stratégie implémentée.** Le comportement actuel est décrit dans [RULES_AUDIT.md](RULES_AUDIT.md). Les principes et leurs limites bibliographiques figurent dans [SCIENTIFIC_FOUNDATIONS.md](SCIENTIFIC_FOUNDATIONS.md) et [REFERENCES.md](REFERENCES.md).

## Différences réellement présentes

Les sept objectifs sont définis dans [evolving-coach.ts](../../src/types/evolving-coach.ts), interprétés par [foundations.ts](../../src/core/coach/foundations.ts) et [product-policy.ts](../../src/core/coach/product-policy.ts), puis utilisés dans [proposals.ts](../../src/core/coach/proposals.ts).

| Objectif | Fonctionnement actuel distinct |
|---|---|
| Débuter la course | Découverte de 30 minutes sans médiane exploitable ; sinon réduction prudente à 50 %, minimum de 5 minutes, au plus une suggestion ; relief plat ou peu vallonné. Aucune alternance marche/course structurée. |
| Plaisir et forme | Pas de planification structurée, même avec consentement ; observations et historique restent disponibles. |
| Améliorer son endurance | Références représentatives à partir de trois durées cohérentes ; minimum de 30 minutes ; alternance possible durée habituelle/facile, toutes en aisance. |
| Améliorer sa vitesse | Mêmes calculs de durée, rythme, budget et intensité que l'endurance. Aucune séance rapide ou stratégie spécifique de vitesse. |
| Reprendre la course | Découverte de 20 minutes sans médiane ; sinon prudence à 50 %, minimum de 5 minutes, au plus une suggestion ; relief plat ou peu vallonné. L'ancienne performance n'est pas une cible de reprise. |
| Atteindre une distance | Même base que l'endurance ; distance cible décrite mais non convertie en durée. Une date cible facultative peut limiter le calendrier. |
| Préparer une course | Même base que l'endurance ; date de course obligatoire bornant le calendrier. Distance et chrono déclarés ne produisent ni allure cible ni périodisation. |

Les quatre objectifs à minimum de 30 minutes ne disposent donc pas encore de quatre stratégies d'entraînement différentes. L'expérience déclarée peut influencer la recommandation de relief, jamais établir une capacité. Les propositions actuelles restent facultatives.

## Stratégies possibles par objectif — à discuter et valider

Les capacités et types ci-dessous décrivent une intention, non une capacité diagnostiquée. Les références générales soutiennent l'individualisation et la spécificité ; elles ne valident pas les futurs seuils du logiciel. Aucun tableau ne constitue une prescription individuelle.

### Débuter la course

- **Intention :** découvrir une pratique accessible et renouvelable.
- **Capacités visées :** aisance à faible intensité, tolérance progressive à la pratique ; ne pas déduire la tolérance mécanique de quelques durées.
- **Types possibles :** endurance facile courte ; récupération seulement si son rôle est défini, sans obligation d'ajouter une sortie.
- **Conditions :** disponibilités explicites, absence de présomption de capacité, possibilité de marcher ou interrompre. Une progression éventuelle demanderait des observations répétées, pas seulement l'expérience déclarée.
- **Précautions :** ne pas multiplier les sollicitations ; une interruption ou un ressenti défavorable ne doit pas être interprété comme manque de volonté. La littérature sur les débutants ne valide pas une hausse universelle de 10 % (R7).
- **Écart actuel :** découverte fixe puis réduction à 50 %, sans trajectoire d'accompagnement. Priorité : examiner cette transition avant d'envisager variété ou progression.

### Plaisir et forme

- **Intention :** conserver une pratique libre sans programme structuré.
- **Capacités visées :** entretien général, confort et continuité selon les souhaits du coureur.
- **Types possibles :** aucune bibliothèque imposée ; éventuellement descriptions d'activités, uniquement si une future décision produit le demande.
- **Conditions :** préserver le choix de ne pas planifier ; aucune fréquence minimale déduite des jours disponibles.
- **Précautions :** les recommandations générales de santé portent sur l'activité totale, pas sur un quota obligatoire de course (R1–R2).
- **Écart actuel :** l'absence de planification est cohérente avec cet objectif et doit rester explicite.

### Améliorer son endurance

- **Intention :** entretenir puis, si souhaité, développer la capacité à courir confortablement plus longtemps.
- **Capacités visées :** endurance aérobie et tolérance à une durée soutenable ; aucune mesure directe actuelle de ces capacités.
- **Types possibles :** endurance facile, sortie habituelle, puis sortie longue relative à la pratique personnelle lorsque justifiée. Une sortie soutenue serait une évolution distincte à documenter.
- **Conditions :** références récentes suffisamment documentées, fréquence et volume compatibles, distinction entre sortie courte volontaire et durée habituelle. Une augmentation ne doit pas découler automatiquement du calendrier.
- **Précautions :** ne pas augmenter simultanément durée, fréquence et difficulté du terrain. Contrôler le volume cumulé et les sorties isolées, sans convertir les résultats observationnels de R8 en seuil universel.
- **Écart actuel :** variation courte/habituelle déjà présente ; aucune sortie dépassant volontairement la médiane, aucune progression longitudinale ou référence habituelle protégée contre une succession de sorties faciles.

### Améliorer sa vitesse

- **Intention :** améliorer la capacité à courir plus vite dans un contexte choisi.
- **Capacités visées :** selon la stratégie future, économie, endurance à intensité accrue ou puissance aérobie ; aucune de ces capacités n'est actuellement estimée par le moteur.
- **Types possibles :** endurance facile majoritaire dans une organisation à définir, puis sortie soutenue ou fractionné si les conditions le permettent.
- **Conditions :** pratique observée stable, connaissance suffisante de la tolérance à l'effort, consignes d'intensité compréhensibles, récupération possible. L'objectif déclaré seul n'autorise pas l'intensité.
- **Précautions :** les résultats sur sportifs entraînés (R3–R4) ne valident pas une transposition automatique aux débutants ; ne pas confondre 80 % d'une durée avec une distribution des intensités.
- **Écart actuel :** aucune spécificité de vitesse au-delà du discours. Les nouvelles intensités nécessitent une phase de conception séparée.

### Reprendre la course

- **Intention :** retrouver une pratique actuelle, sans rattraper automatiquement les anciennes performances.
- **Capacités visées :** aisance et tolérance présentes, non capacité historique supposée conservée.
- **Types possibles :** endurance facile adaptée ; aucune obligation de sortie longue, soutenue ou de côtes.
- **Conditions :** distinguer historique ancien et références actuelles ; les causes d'interruption restent inconnues si elles ne sont pas renseignées.
- **Précautions :** ce module n'est pas un protocole de retour après blessure. Ne pas déduire guérison, fatigue ou désentraînement d'une absence d'import.
- **Écart actuel :** découverte fixe de 20 minutes ou réduction à 50 %, sans règle de sortie progressive du régime de reprise. Examiner cette limite avant de proposer une progression.

### Atteindre une distance

- **Intention :** pouvoir parcourir une distance choisie dans des conditions acceptables pour le coureur.
- **Capacités visées :** endurance spécifique et tolérance à la durée nécessaire, sans convertir une allure ancienne en capacité garantie.
- **Types possibles :** endurance facile et, lorsque justifiée, sortie longue relative à l'historique.
- **Conditions :** cible valide, pratique actuelle documentée, temps disponible ; apprécier la faisabilité sans imposer de calendrier de rattrapage.
- **Précautions :** un objectif éloigné des références ne justifie pas une hausse brutale. Ne pas imposer la distance cible à chaque sortie ni promettre sa réussite.
- **Écart actuel :** cible essentiellement descriptive, date éventuelle utilisée comme borne ; pas de stratégie de rapprochement progressif vers cette distance.

### Préparer une course

- **Intention :** se préparer à une épreuve donnée, avec ou sans chrono personnel.
- **Capacités visées :** spécifiques à la distance et aux contraintes réelles de l'épreuve, lorsqu'elles sont connues.
- **Types possibles :** endurance facile, sortie longue, éventuellement soutenue, fractionné ou côtes après justification distincte.
- **Conditions :** échéance réaliste au regard des données disponibles, références actuelles, disponibilités et récupération ; informations de terrain seulement si connues.
- **Précautions :** aucune accélération automatique pour combler un délai court ; ne pas inventer profil du parcours, météo ou aptitude à un chrono.
- **Écart actuel :** arrêt des propositions à l'échéance, sans préparation spécifique, périodisation, affûtage ni évaluation de faisabilité. Ces éléments restent à concevoir et documenter.

## Bibliothèque conceptuelle à quatre dimensions

Ce modèle n'est ni un changement de types TypeScript, ni une migration de stockage, ni une nouvelle fonctionnalité. Il sert à éviter qu'un libellé différent masque une proposition identique.

| Dimension | Sens et informations nécessaires | Garde-fou envisagé |
|---|---|---|
| **Type** | Rôle recherché dans la pratique : facile, longue, soutenue, fractionné, côtes, récupération. | Relier le rôle à l'objectif et aux références observables ; pas de variété artificielle. |
| **Durée** | Durée totale, et structure éventuelle à définir pour les séances segmentées ; comparaison à une référence personnelle explicite. | Respecter disponibilités et volume cumulé ; ne pas transformer une suggestion courte suivie en nouvelle limite de capacité sans examen. |
| **Intensité** | Consigne qualitative compréhensible ; cible chiffrée seulement avec une justification et des données adaptées dans une phase ultérieure. | « Facile » n'est pas une mesure de l'effort réellement effectué. Ne pas inventer de zones cardio ou d'allures. |
| **Terrain** | Relief recommandé : plat, vallonné ou côtes ; surface séparée : route, chemins, tapis ou libre. | Indication facultative, sans itinéraire ni D+ cible. Ne pas confondre chemins et relief vallonné. |

### Types envisagés

| Type | Durée et intensité conceptuelles | Terrain et conditions |
|---|---|---|
| Endurance facile | Durée familière ou plus courte, aisance. | Plat ou relief libre selon références ; vallonné possible sans laisser entendre un effort identique au plat. |
| Sortie longue | Plus longue relativement à l'habitude personnelle, pas une valeur universelle ; intensité aisée. | Terrain évitant une hausse simultanée non justifiée de difficulté ; capacité et volume à documenter avant proposition. |
| Sortie soutenue | Effort continu plus exigeant, durée adaptée à cette exigence. | Terrain permettant de comprendre la consigne ; ne pas cumuler nouveauté de durée et de relief. |
| Fractionné | Segments d'effort et récupération ; durée totale distinguée du temps exigeant. | Intensité, répétitions et récupération à définir ultérieurement. Pas de prescription à partir du seul objectif « vitesse ». |
| Côtes | Sollicitation du relief comme composante centrale ; durée et effort adaptés. | Côtes explicites mais facultatives, sans pente ou D+ cible inventés ; ne pas simplement rebaptiser toute sortie sur chemins. |
| Récupération | Sortie éventuellement courte et très aisée, seulement si une sortie est pertinente. | Relief peu exigeant ; ne jamais supposer qu'ajouter une course remplace le repos ou démontre la récupération. |

L'effet du terrain sur le coût de l'effort est documenté (R6). La règle produit « éviter d'augmenter plusieurs dimensions simultanément sans justification » reste un garde-fou de conception, pas une garantie scientifique de sécurité. La bibliothèque ne doit pas transformer les suggestions en obligations.

## Simulations sur douze semaines à décrire puis implémenter ultérieurement

**Aucune simulation n'est implémentée ou exécutée dans cette phase.** Ces scénarios utilisent exclusivement des données synthétiques. Leur réussite future démontrerait des propriétés logicielles, pas l'efficacité clinique ou la prévention des blessures.

### Protocole proposé

1. Définir un historique initial, un objectif, des disponibilités et une date civile explicites. Conserver un scénario témoin avec historique indépendant des suggestions.
2. Avancer jour par jour pendant douze semaines. Recalculer comme l'application lors d'un changement de date, d'une activité ou d'une configuration ; distinguer calcul, affichage réel, mémorisation et réalisation.
3. Générer les activités synthétiques selon un comportement annoncé, sans supposer qu'une suggestion a été suivie parce qu'une sortie a la même date.
4. Enregistrer les diagnostics de chaque calcul : références retenues, médiane, fraîcheur, variabilité, coefficients, plafonds, budget, motifs de refus, identités et propositions.
5. Comparer trajectoires avec et sans boucle de réutilisation des sorties proposées. Examiner les seuils avant toute décision de les modifier.

### Matrice minimale

Chaque profil doit être croisé avec **toutes**, **certaines** et **aucune** des suggestions réalisées. Pour « certaines », distinguer sélection des sorties les plus courtes, des plus longues et choix indépendant. Pour « aucune », distinguer absence d'activité enregistrée et sorties autonomes documentées.

| Profil synthétique | Variantes essentielles | Risque recherché |
|---|---|---|
| Débutant sans historique | Passage de découverte aux premières durées ; références incomplètes ; jours rares. | Réduction répétée à 50 %, refus sous minimum, découverte disproportionnée aux premières données. |
| Coureur régulier | Médianes de 35, 37, 40, 43 et 45 minutes ; rythme de 2, 2,5 ou 3 jours ; plus de trois sorties habituelles par semaine. | Arrondis répétés, ralentissement de fréquence, baisse de la référence habituelle. |
| Reprise après interruption | Historique ancien long, reprise courte ; interruption réelle ou import tardif simulé. | Anciennes capacités réintroduites, passage discontinu entre découverte et réduction prudente. |
| Objectif endurance | Courtes/habituelles alternées ; disponibilités de 25, 30, 45 minutes ou sans plafond ; planning existant. | Stagnation, minimum de 30 minutes masquant une baisse, volume cumulé dépassant le budget apparent. |
| Objectif vitesse | Même historique que l'endurance ; comparaison des sorties et des explications. | Fausse spécificité d'un libellé, absence de stimulation distincte ; aucune intensification automatique attendue du moteur actuel. |
| Objectif distance/course | Date cible proche, lointaine ou dépassée ; cible éloignée des références. | Suggestions après échéance, promesse de faisabilité, rattrapage implicite. |
| Plaisir et forme | Historique riche, disponibilités multiples, consentement enregistré. | Apparition indue d'une planification structurée. |

Ajouter des perturbations contrôlées : une référence sortant de la fenêtre, passage de quatre à trois puis deux durées, durées manquantes, valeur extrême, jours actifs multiples, import tardif, affichages/recalculs répétés, changements de disponibilité et surface, échéance et changement de date civile. Les variations ne doivent pas être interprétées automatiquement comme fatigue ou motivation.

### Indicateurs à conserver

| Phénomène | Mesures à comparer | Interprétation prudente |
|---|---|---|
| Diminution artificielle | Médiane de référence, durée habituelle proposée, durée facile, cumul des pertes par arrondi et coefficient ; comparaison au témoin. | Une baisse volontaire d'activité n'est pas un défaut ; isoler la baisse produite par la boucle seule. |
| Progression excessive | Maximum de séance, variation de volume réellement réalisé sur fenêtres glissantes, fréquence, intensité et relief proposés. | Ne pas définir « sûr » par un pourcentage universel ; contrôler d'abord les plafonds annoncés et les transitions inattendues. |
| Stagnation | Nombre de semaines à propositions identiques malgré changements documentés, répétitions au minimum, refus récurrents. | Stabilité peut être adaptée ; ne pas imposer de progression pour faire varier un indicateur. |
| Fréquence incohérente | Intervalles observés/proposés/réalisés, effet de l'arrondi, nombre de suggestions distinctes cumulées après recalcul. | Trois par calcul ne garantit pas trois sur toute semaine glissante. |
| Accumulation exigeante | Durées longues relatives, séances soutenues/fractionnées/côtes, espacements et combinaison des dimensions. | Actuellement toutes les intensités sont faciles ; conserver l'indicateur pour les futurs types sans inventer une charge physiologique. |
| Incertitude et explications | Motif de refus exact, fraîcheur, références absentes, correspondance du texte au calcul. | Ne pas annoncer un problème de calendrier si le calcul de durée a échoué en amont. |

### Invariants et décisions attendues

- Aucun dépassement des disponibilités déclarées, aucun changement des séances existantes, aucune progression imposée pour compenser une suggestion ignorée.
- Identités déterministes pour une même proposition ; une proposition calculée mais non visible ne doit pas devenir une référence de présentation.
- Le rapprochement factuel reste distinct de l'adhésion à un entraînement.
- Aucun transfert implicite de performance ancienne vers une capacité actuelle ; diagnostics disponibles sans proposition.
- Présenter séparément les invariants violés, les effets de seuil et les choix produit discutables. Fixer les critères d'acceptation longitudinaux avant de comparer des variantes de moteur.

## Ordre de travail recommandé après validation

1. Valider cet audit et les hypothèses de simulation, surtout les transitions débuter/reprendre.
2. Simuler le moteur actuel avant de choisir de nouveaux coefficients ou une autre référence habituelle.
3. Définir une politique de volume et de fréquence tenant compte des recalculs et du réalisé, sans assimiler suggestion à engagement.
4. Choisir une première différence de stratégie utile par objectif, avec conditions observables et comportement explicite en cas d'incertitude.
5. Étudier les nouveaux types et intensités avec une bibliographie ciblée complémentaire et des tests de non-régression.

La phase 2 nécessite une validation distincte. Aucun changement de moteur, d'interface, de stockage ou de données n'est entrepris ici.
