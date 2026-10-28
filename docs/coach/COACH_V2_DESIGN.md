# Coach V2 — conception des stratégies d'entraînement

Phase 2B, 17 octobre 2026. **Proposition à valider, documentation uniquement.** Aucun comportement décrit comme futur n'est implémenté par ce document. Aucun changement de moteur, d'interface, de schéma, de données, de sauvegarde ou de version n'est réalisé.

« runKLMrun s'adapte au coureur, jamais l'inverse. » Une suggestion reste facultative. Un objectif de progression autorise à proposer une stimulation adaptée, pas à imposer une augmentation ni à interpréter une sortie différente comme un échec.

## 1. Base examinée et constats

Les cinq documents ont été lus intégralement : [fondements](SCIENTIFIC_FOUNDATIONS.md), [bibliographie](REFERENCES.md), [audit](RULES_AUDIT.md), [stratégies initiales](OBJECTIVE_STRATEGIES.md), [simulations et tableaux des 36 trajectoires](LONGITUDINAL_SIMULATIONS.md).

Le code confirme les points suivants :

| Actuel, vérifié dans le code | Conséquence pour la conception |
|---|---|
| [proposals.ts](../../src/core/coach/proposals.ts) : `proposalEvidence()`, `selectDuration()`, `calculateProposals()`, `proposeSuggestions()` ; références mobiles, prudence 50/80 %, branche habituelle à la médiane, sept jours, trois suggestions au plus par calcul. | Séparer observation, stratégie et stabilité ; ne pas simplement changer un coefficient. |
| [product-policy.ts](../../src/core/coach/product-policy.ts) : minimum 30 minutes pour quatre objectifs, découverte 30/20 minutes pour débuter/reprendre, bornes de fraîcheur et variabilité. | Distinguer paramètres éditoriaux et capacité observée ; une transition ne doit pas réinitialiser une durée à la hausse sans justification. |
| [proposal-presentation.ts](../../src/core/coach/proposal-presentation.ts) : arrondi inférieur, surfaces route/chemins/tapis, relief plat ou peu vallonné/libre. | Une bibliothèque avec vallonné/côtes et intensités différentes dépasse le modèle actuel. |
| Interface historique du planning V1, retirée au lot 2 : recalcul après changements et passage de date ; planning séparé. | Le passage d'un rang 2 à un rang 1 ne doit plus transformer une sortie facile en habituelle. |
| [suggestions.ts](../../src/core/coach/suggestions.ts) : identité v1 incluant date, type, durée et terrain ; validation stricte des champs ; expiration à date + 8 jours. | Une identité stable à travers un changement de contenu ne peut pas être introduite discrètement dans le format v1. |
| [coach-suggestions.ts](../../src/storage/coach-suggestions.ts) : présentation validée, contrôle transactionnel du contexte, révisions, remplacement après présentation de l'ensemble. | Réutiliser ces garanties, mais concevoir explicitement le nouveau contrat de contenu. |
| [suggestion-matching.ts](../../src/core/coach/suggestion-matching.ts) : date civile, unicité, ambiguïtés conservées même avec anciennes identités remplacées. | Ne pas déduire le type réellement couru d'une association de date ; ne pas arbitrer les anciennes ambiguïtés par la durée. |
| [format.ts](../../src/backup/format.ts) : suggestions dans le format 5, intégrité SHA-256. | Une évolution de persistance implique un travail explicite sur validation, fusion, sauvegarde et restauration. |

Résultats observés en 2A, et non promesses générales : débutant suivant tout, 17 sorties/235 minutes et 50 jours sans nouveau résultat ; reprise, 16/165 et 54 jours ; régulier trois fois/semaine, 28 sorties toutes à 35 minutes, seulement deux associations finales. Quatre objectifs donnent les mêmes trajectoires dans le témoin à historique identique. La découverte sans réalisation peut être reproposée quotidiennement. Ces résultats dépendent du scénario de consultation quotidienne ; ils ne prouvent ni inefficacité physiologique ni danger clinique.

## 2. Architecture proposée : un socle commun et sept stratégies

Le moteur reste local, déterministe et explicable. Les fonctions pures reçoivent une date civile explicite et un instantané validé ; elles ne lisent pas l'horloge, IndexedDB ou le réseau. L'orchestrateur réalise les lectures et les écritures après calcul et présentation réelle.

### 2.1 Trois catégories d'information qui ne doivent jamais être fusionnées

| Catégorie | Exemples | Usage autorisé | Ce qu'elle ne prouve pas |
|---|---|---|---|
| **Faits observés** | Courses enregistrées, dates civiles, durées et distances disponibles, fréquence observée, associations factuelles avec une suggestion. | Décrire la pratique visible, établir des références accompagnées de leurs sources et calculer des limites sur les données connues. | L'exhaustivité de l'entraînement, l'intention du coureur, sa récupération ou sa capacité physiologique. |
| **Déclarations du coureur** | Objectif, expérience, jours disponibles, durée disponible, préférence de surface, ressenti facultatif. | Orienter la stratégie et plafonner les propositions ; conserver la provenance déclarative dans les explications. | Une capacité actuelle, l'obligation d'utiliser tous les créneaux ou l'aptitude à une séance exigeante. |
| **Hypothèses du moteur** | Référence habituelle, interruption possible, état maintenir/développer/alléger, admissibilité d'un type de séance. | Produire une décision réversible avec preuves, limites, date de validité et motif intelligible. | Un diagnostic médical, une causalité, une séance réellement suivie ou un bénéfice garanti. |

Une sortie manquante ne vaut pas absence d'activité ; une disponibilité ne vaut pas intention de courir ; une suggestion associée le même jour ne vaut pas exécution conforme. Toute sortie du moteur doit préserver ces distinctions jusque dans son diagnostic et son explication au coureur.

### 2.2 Chaîne de décision commune

| Étape proposée | Responsabilité | Sortie et limites |
|---|---|---|
| Observer | Réutiliser la normalisation des résumés, dates civiles, exclusions, durées/distance/ressenti lorsqu'ils existent. | Faits avec provenance et couverture ; absence ≠ zéro ; aucune classification automatique de fatigue. |
| Qualifier | Calculer fraîcheur, nombre de jours distincts, variabilité, données manquantes, cohérence entre fenêtres. | Référence exploitable, provisoire ou périmée ; raisons explicites, sans score pseudo-médical. |
| Établir les repères | Distinguer durée habituelle, durée de démarrage, volume réellement enregistré et rythme. | Valeurs avec séances sources, période et échéance de validité ; jamais une suggestion comme preuve de capacité. |
| Choisir la stratégie | Déterminer maintenir/développer/alléger selon objectif, observations et incertitudes. | Intention et candidats admissibles ; aucune écriture ni obligation de progression. |
| Composer | Sélectionner un type, une durée, une intensité et un terrain compatibles. | Modèle de séance expliqué ; échauffement/récupération inclus dans la durée totale si séance segmentée. |
| Placer et borner | Respecter disponibilités, rythme, volume cumulé, espacement et planning historique. | Zéro à trois suggestions dans l'horizon initial ; des créneaux disponibles peuvent rester vides. |
| Stabiliser | Conserver les suggestions déjà présentées encore compatibles, puis remplir les places réellement libres. | Ni changement de rôle par renumérotation ni déplacement quotidien automatique. |
| Présenter et mémoriser | Réutiliser la visibilité réelle, la validation du contexte et les protections de concurrence. | Rien de persisté pour un simple candidat calculé. |
| Rapprocher | Réutiliser la date civile et l'unicité ; traiter les révisions d'une même occurrence selon le contrat futur. | Association factuelle, sans conformité, note ni validation d'un stimulus physiologique. |

Les observations actuelles peuvent rester un module indépendant. Les nouveaux diagnostics doivent exposer les sources de chaque décision, sans remplacer les textes du coureur par des paramètres techniques.

## 3. Références explicables sans réduction récursive

### 3.1 Séparer quatre notions

- **Observation récente** : médiane brute et distribution des activités réellement enregistrées, toujours affichables dans le diagnostic.
- **Repère habituel** : résumé temporaire d'une pratique documentée ; ce n'est ni un maximum historique ni une capacité garantie.
- **Durée proposée** : résultat ponctuel tenant compte du type et des plafonds. Une sortie courte n'est pas une révision automatique du repère habituel.
- **État d'incertitude** : fraîcheur insuffisante, données partielles, interruption possible ou nouvelle pratique non encore caractérisée.

Une activité associée à une suggestion courte **ne sera pas étiquetée comme volontairement courte** sur cette seule base. Le rapprochement prouve uniquement une correspondance de date. La proposition passée renseigne l'intention du logiciel, pas celle du coureur. Les activités autonomes, associées ou ambiguës restent dans les observations et les volumes.

### 3.2 Méthode candidate : repère borné par épisode, réévaluation avec hystérésis

Décision proposée R01–R04 ; méthode à simuler avant de choisir ses paramètres.

1. À l'entrée d'un épisode documenté, établir le repère `B` à partir de la médiane des durées valides d'une fenêtre de référence complète et de jours distincts. Conserver les identifiants sources et dates, pas seulement le nombre obtenu. Ne pas sélectionner uniquement les plus longues sorties.
2. À chaque nouvelle activité, recalculer l'observation récente `M`, sa couverture et sa distribution, mais **ne pas appliquer une fraction à la précédente durée suggérée pour reconstruire B**. Un simple recalcul sans nouvel événement ne réévalue pas le repère.
3. Une sortie courte isolée modifie M et le volume, mais ne remplace pas B. Si des observations répétées et documentées deviennent incompatibles avec B, passer à un état provisoire : proposer à partir de la pratique actuelle sans déclarer une perte de capacité. La révision de B se fait une seule fois lors d'une transition justifiée, pas par multiplication répétée du coefficient de prudence.
4. Un repère conserve une date limite fondée sur ses preuves **réelles**. Des sorties systématiquement plus courtes ne renouvellent pas indéfiniment la validité d'un ancien repère long. À expiration, B devient indisponible pour développer ; il reste descriptif uniquement. Des durées fraîches plus courtes peuvent constituer un nouvel épisode, sans leur appliquer à nouveau une réduction simplement parce qu'elles sont courtes.
5. Des références plus longues peuvent justifier une réévaluation, sans transformer une sortie extrême en nouvelle norme. Une éventuelle progression au-delà de B relève d'une décision de stratégie distincte, avec des preuves et bornes explicites.
6. En cas de suppression, correction ou restauration d'une séance source, recalculer la validité de B avant toute nouvelle suggestion. Aucun état dérivé ne doit conserver une preuve supprimée.

L'hystérésis signifie ici qu'une fluctuation isolée ne suffit pas à changer d'état ; elle ne doit pas cacher une contradiction durable. Le nombre de preuves et la durée d'attente seront des paramètres de conception versionnés, pas des constantes scientifiques universelles.

**Cas de contrôle :** B issu de plusieurs sorties autour de 40 minutes, puis une sortie de 30 minutes : B ne devient pas automatiquement 30, puis 24. Plusieurs semaines exclusivement à 30 minutes ne permettent pas non plus de conserver 40 indéfiniment. Après expiration/reconstruction documentée, 30 devient une pratique actuelle possible, sans nouvelle décote automatique de 20 ou 50 %. Ce sont des invariants souhaités, pas des résultats déjà obtenus.

### 3.3 Débuter et reprendre : amorçage distinct

La prudence doit porter sur le **choix initial et les conditions d'évolution**, pas imposer une division à chaque nouvelle observation. Une durée initiale produit reste à documenter ; les valeurs actuelles 30/20 minutes ne deviennent pas des capacités par défaut.

Après des premières sorties courtes enregistrées, maintenir un repère provisoire court peut être plus cohérent que le réduire à nouveau. Si ces données vieillissent, revenir à une proposition de démarrage ne doit pas augmenter automatiquement la durée au-dessus de la dernière base encore pertinente. Si aucune base n'est exploitable, indiquer l'incertitude et proposer seulement une option d'amorçage validée, ou aucune suggestion chiffrée. Le choix entre ces deux comportements nécessite validation produit.

### 3.4 Paramètres restant à choisir

| Paramètre conceptuel | Rôle | Validation requise avant production |
|---|---|---|
| Fenêtre d'observation et fenêtre de référence | Séparer réaction récente et pratique habituelle. | Comparer rythmes faibles/forts, imports tardifs et transitions ; ne pas reprendre automatiquement quatre intervalles. |
| Nombre de jours documentés et couverture | Éviter qu'une journée multiple ou des mesures manquantes suffisent. | Définir les minimums par type admissible et objectif ; tester leurs frontières. |
| Tolérance de variation et confirmation | Réviser un repère sur observations répétées. | Analyse de sensibilité, alternance volontaire courte/longue, valeurs extrêmes. |
| Expiration absolue et relative au rythme | Ne pas figer une ancienne pratique. | Exiger une borne finie ; simuler faible fréquence et interruption. |
| Pas d'évolution et délai d'observation | Borner un essai de développement, sans hausse hebdomadaire. | Doses à justifier par type ; cinq minutes d'affichage ne sont pas un pas universel de progression. |

**Aucune valeur numérique nouvelle n'est approuvée ici.** La méthode devient codable après sélection explicite des paramètres et critères d'acceptation ; ce document ne doit pas être utilisé pour choisir silencieusement des seuils au développement.

## 4. Fréquence, volume et interruptions

### Fréquence et calendrier — R05

Distinguer rythme observé, fréquence souhaitée et disponibilité maximale. En maintien, rechercher un calendrier qui préserve le nombre habituel de sorties sur plusieurs semaines sans dépasser le souhait déclaré. Une médiane de 2,5 jours n'impose pas nécessairement trois jours entre toutes les sorties : comparer des placements civils alternés compatibles avec la pratique et les précautions, sans imposer des jours rapprochés pour rattraper un quota.

Conserver une échéance de placement stable par occurrence. Une suggestion passée sans activité n'est pas reportée mécaniquement au lendemain. Le prochain créneau vient du rythme d'offre établi, pas d'un compteur de séances « dues ». L'offre doit rester bornée sur plusieurs calculs, même si aucune activité n'est importée. Aucun manque ne crée une dette d'entraînement.

Pour le premier lot futur, conserver l'horizon de sept jours et le plafond de trois suggestions **par affichage**, en ajoutant un contrôle du cumul des occurrences offertes. Ce plafond reste une limite de produit et ne doit pas faire baisser la référence de fréquence d'un coureur plus actif. Développer la fréquence au-delà de l'habitude serait une dimension de progression distincte, pas l'effet d'un jour disponible supplémentaire.

### Volume cumulé — R06

Tenir trois registres distincts : réalisé enregistré, planning explicitement conservé, suggestions encore proposées. Aucune suggestion ne compte comme activité accomplie.

Pour chaque candidat, examiner les fenêtres civiles glissantes recouvrant sa date : durée réellement enregistrée dans la partie passée, durées futures planifiées et durées des autres suggestions compatibles que le coureur pourrait toutes réaliser. Le candidat n'est pas ajouté si cette projection dépasse le budget produit retenu. Sept jours est une fenêtre opérationnelle initiale à comparer à des horizons plus longs, pas une constante physiologique.

Ne pas additionner deux fois une suggestion et sa séance planifiée correspondante lorsqu'un lien explicite permet de les identifier. Une activité déjà réalisée remplace une projection correspondante ; en cas d'ambiguïté, ne pas inventer le lien : inhiber la suggestion future concurrente pour ce jour et comptabiliser les activités réelles, avec motif explicite. Deux activités réelles restent deux activités dans le total.

Si une sortie supplémentaire fait dépasser le budget après coup, conserver toutes les activités et adapter uniquement les possibilités futures. Ne pas faire disparaître des données ni raccourcir toutes les suggestions pour remplir un reste. Privilégier moins de propositions cohérentes. Un budget est une limite de proposition, pas une limite imposée au coureur ni une garantie de sécurité.

Les durées manquantes donnent un volume partiel : ne pas remplir le solde comme s'il était nul. La longue sortie et la densité des séances exigeantes nécessitent des contrôles séparés ; aucune conversion arbitraire minutes × intensité × relief en charge physiologique.

### Espacement et interruptions — R07

L'espacement dépend du rythme, de la durée relative et des exigences connues ; il ne démontre pas la récupération. Aucune séance exigeante si la tolérance n'est pas suffisamment renseignée. Une sortie facile n'efface pas automatiquement les effets d'une séance exigeante précédente.

Une absence d'activité enregistrée dégrade la confiance sans prouver un arrêt réel. Après interruption possible : suspendre le développement, rendre les repères anciens descriptifs, utiliser les nouvelles observations pour reconstruire un épisode. Un import tardif peut lever l'incertitude ; il ne justifie pas une augmentation rétroactive d'une suggestion déjà présentée. Pas de saut découverte → ancienne performance ni de cycle 5 → 30 → 5 provoqué par la seule branche logicielle.

## 5. Modèle conceptuel de séance

Ce contrat n'est pas compatible tel quel avec `StoredSuggestion` v1. Il décrit le modèle futur en mémoire et les informations à préserver si une évolution de stockage est validée.

| Champ | Contenu attendu |
|---|---|
| Occurrence, révision, politique | Identité de l'occasion proposée, révision de contenu, version de règles ; indépendantes des minutes et du rang d'affichage. |
| Type | Endurance facile, sortie longue, sortie soutenue, fractionné, côtes, récupération. |
| Durée | Secondes totales ; blocs facultatifs dont la somme inclut échauffement, efforts, récupérations et retour au calme. Plafonds appliqués avant affichage. |
| Intensité | Consigne qualitative et, seulement si justifié ultérieurement, cible étayée ; distinguer cible proposée et effort réellement renseigné. |
| Terrain | Relief plat/vallonné/côtes ou libre ; surface séparée ; préférence facultative, solution locale de remplacement. Aucun D+ cible. |
| Intention pédagogique | Ce que cette séance cherche à travailler, sans promesse de résultat. |
| Conditions | Données requises, état de référence, compatibilité avec objectif, volume, rythme et disponibilités. |
| Précautions et alternative | Limites utiles, possibilité de rester facile ou de ne pas effectuer la sortie ; aucun rattrapage. |
| Explication | Faits utilisés, choix de stratégie, limites ; aucune causalité fictive entre une association et une capacité. |

### Bibliothèque proposée — R08 à R13

Les textes ci-dessous sont des exemples conditionnels, non du contenu à afficher systématiquement. Les doses des séances exigeantes restent à documenter avant activation.

| Type | Durée / intensité / terrain | Intention et conditions | Précautions et explication possible |
|---|---|---|---|
| **Endurance facile** | Durée habituelle ou volontairement plus courte selon rôle ; aisance ; plat, vallonné familier ou libre. | Entretenir une pratique accessible ; repère provisoire possible avec durée conservatrice justifiée. | Une sortie courte ne requalifie pas la capacité. « Une sortie tranquille, plus courte que vos sorties habituelles » seulement si c'est vrai. |
| **Sortie longue** | Durée relativement longue pour ce coureur ; aisance ; terrain familier, sans ajout de difficulté simultané. | Développer l'endurance de durée ; références fraîches, tolérance suffisamment renseignée, budget et disponibilité compatibles. | Pas de durée longue universelle. « Une sortie un peu plus longue pour travailler la durée, sans chercher à accélérer. » Seulement après validation de la progression candidate. |
| **Sortie soutenue** | Bloc continu plus exigeant encadré de parties faciles ; durée totale bornée ; plat ou relief connu. | Travailler un effort continu distinct ; pratique documentée et informations suffisantes sur la tolérance. | Ne pas traduire une FC moyenne en seuil. « Un passage à effort soutenu, entre deux parties tranquilles. » Dose et définition précise à valider. |
| **Fractionné** | Alternance efforts/récupérations explicites ; durée totale incluant tous les blocs ; terrain régulier adapté. | Stimulation orientée vitesse pour profils admissibles, pas ajout automatique à tout objectif vitesse. | Ni sprint imposé ni recette reprise d'athlètes entraînés. « Des passages plus dynamiques, séparés par des récupérations. » Non activable tant que la dose n'est pas étayée. |
| **Côtes** | Relief comme stimulus ; intensité et durée définies séparément ; côtes facultatives, surface choisie. | Spécificité utile à un objectif ou à une pratique observée et tolérée ; accès local connu ou alternative. | Chemins ≠ côtes, descente ≠ récupération garantie. « Un travail en montée si vous disposez d'un terrain adapté ; sinon, conservez l'alternative facile. » Aucun itinéraire ou dénivelé inventé. |
| **Récupération** | Durée courte relativement au repère ; très aisée ; plat ou relief peu exigeant. | Option de faible sollicitation quand une sortie reste cohérente et souhaitée. | Ne garantit pas la récupération et ne remplace pas nécessairement le repos. « Une sortie très tranquille ; vous pouvez aussi ne pas courir aujourd'hui. » Ne pas ajouter une sortie pour atteindre un quota. |

Le relief n'est jamais une preuve d'intensité. Une proposition facile sur vallonné doit préciser que l'aisance prime sur l'allure ; si cette aisance ne peut pas être présumée, choisir une alternative simple. Avec seulement une préférence de surface, ne pas inventer des habitudes de relief. Les scénarios futurs « vallonné habituel » devront injecter une information synthétique explicitement déclarée ou validée, inexistante dans le profil actuel.

## 6. Stratégies distinctes pour les sept objectifs

Les conditions de développement communes sont précisées en section 7. L'expérience déclarée ne les remplace jamais.

### Débuter — R14

- **Intention :** construire une pratique renouvelable et compréhensible.
- **Types :** endurance facile de démarrage ; pas de fractionné, soutenu ou côtes automatiquement.
- **Exigeant :** non admissible dans la première stratégie débutant ; un futur changement doit être validé séparément, pas déclenché par le seul nombre de sorties.
- **Développer :** après références répétées, fraîches et suffisamment renseignées, proposer une petite variation d'une seule dimension ; ne pas diviser à nouveau une base courte acquise. La dose reste à calibrer.
- **Alléger :** durée ou fréquence moindre lorsque justifiée ; absence de ressenti ≠ bonne tolérance. L'absence d'activité ne déclenche ni sanction ni multiplication de découvertes.
- **Historique insuffisant :** option d'amorçage explicite ou absence de durée chiffrée, choix produit à valider ; aucun minimum obligatoire de trente minutes.
- **Interruption :** reconstruire depuis les données actuelles, sans retour automatique à la durée initiale supérieure.
- **Limites :** pas de protocole clinique ni garantie de tolérance musculosquelettique ; R1/R7 ne fixent pas de dose universelle.

### Reprendre — R15

- **Intention :** retrouver une pratique actuelle ; ancienne performance descriptive seulement.
- **Types :** endurance facile, éventuellement option de récupération ; pas de séance exigeante automatique.
- **Exigeant :** nécessite un nouvel épisode documenté et une décision de stratégie ultérieure ; l'expérience passée n'autorise pas à sauter cette étape.
- **Développer :** consolider les nouvelles sorties puis varier une dimension, sans chercher à rattraper l'ancien volume.
- **Alléger :** ajustement à la pratique récente et aux signaux réellement disponibles ; ne pas appliquer 50 % indéfiniment.
- **Historique insuffisant :** base provisoire distincte de l'ancien historique ; ne pas inventer la cause de l'arrêt.
- **Interruption renouvelée :** suspendre le développement et reconstruire, sans oscillation vers une découverte plus longue par défaut.
- **Limites :** absence de données sur blessure ou récupération ; ce n'est pas un protocole de retour après blessure. Preuves spécifiques de reprise à compléter.

### Plaisir et forme — R16

- **Intention :** préserver liberté, plaisir et entretien.
- **Types :** pas de planification structurée, conformément au comportement actuel. Des idées libres de types ne seraient ajoutées qu'après une décision produit distincte.
- **Exigeant / développer :** aucune introduction automatique, aucune progression imposée.
- **Maintenir / alléger :** informations descriptives et respect du choix ; pas de quota à remplir.
- **Historique insuffisant / interruption :** aucune séance de rattrapage, aucun blocage culpabilisant ; observations limitées aux données disponibles.
- **Limites :** les recommandations générales de santé R1/R2 ne sont pas des obligations individuelles de course.

### Améliorer son endurance — R17

- **Intention :** développer progressivement la durée soutenable, si les observations le permettent.
- **Types :** endurance facile et sortie habituelle ; sortie longue relative comme première différenciation. Soutenu seulement dans une évolution séparément justifiée.
- **Exigeant :** la sortie longue est déjà une sollicitation accrue par durée, même à intensité facile ; exiger les mêmes contrôles de volume et tolérance.
- **Développer :** faire évoluer ponctuellement une durée ciblée plutôt que toutes les sorties ; stabiliser ensuite. Préserver les sorties faciles présentées.
- **Alléger :** conserver des options courtes ou moins nombreuses quand volume ajouté, disponibilité ou incertitude l'exige ; ne pas abaisser automatiquement le repère habituel.
- **Historique insuffisant :** maintien facile ou aucun candidat chiffré cohérent ; pas de dépassement de référence pour « atteindre » trente minutes.
- **Interruption :** développement suspendu, nouvel épisode actuel avant sortie longue.
- **Limites :** une médiane ne prouve pas l'aisance ; dose et cadence de sorties longues non validées par la bibliographie actuelle.

### Améliorer sa vitesse — R18

- **Intention :** introduire une stimulation spécifique, sans transformer chaque sortie en travail rapide.
- **Types :** endurance facile conservée ; soutenu ou fractionné après admissibilité, pas nécessairement les deux ; côtes uniquement si pertinentes et documentées.
- **Exigeant :** références récentes documentées, tolérance connue et fenêtre compatible avec les autres sollicitations ; l'objectif seul ne suffit pas. Sans ces éléments, maintien facile et explication de la limite.
- **Développer :** modifier soit le temps d'effort, soit sa structure/intensité, avec durée totale et terrain non augmentés simultanément. Aucune cible d'allure ou de FC inventée.
- **Alléger :** retirer le stimulus exigeant ou réduire sa dose avant d'ajouter des séances de compensation.
- **Historique insuffisant / interruption :** pas de fractionné automatique ; reconstruire les références et l'information de tolérance.
- **Limites :** R3/R4 ne valident pas le transfert de protocoles d'athlètes entraînés à tout utilisateur ; recherche ciblée et validation des doses requises.

### Atteindre une distance — R19

- **Intention :** rapprocher progressivement la pratique d'une distance souhaitée, sans convertir la cible en obligation immédiate.
- **Types :** endurance facile, sortie longue relative ; intensité supplémentaire non nécessaire par défaut.
- **Exigeant :** augmentation de durée/distance seulement avec références correspondantes, budget et tolérance ; ne pas augmenter les deux cibles indépendamment.
- **Développer :** une exposition de durée ou distance mieux adaptée à l'objectif, puis consolidation ; ne pas extrapoler une allure moyenne pour garantir le temps nécessaire.
- **Alléger :** garder le cap de l'objectif mais réduire l'exposition ou espacer les propositions si contraintes ; aucune accélération pour compenser une séance ignorée.
- **Historique insuffisant :** travailler la régularité documentée avant une trajectoire chiffrée vers la cible ; faisabilité indéterminée explicitement.
- **Interruption :** suspendre la trajectoire, réévaluer les références sans changer silencieusement la cible personnelle.
- **Limites :** pas de garantie de réussite ; absence de mesure de tolérance à la distance ; règles spécifiques à compléter.

### Préparer une course — R20

- **Intention :** articuler les stimuli avec une épreuve et son échéance, sans promesse de chrono.
- **Types :** endurance facile et longue ; soutenu/fractionné selon objectif et admissibilité ; côtes seulement si contexte de l'épreuve ou préférence établis.
- **Exigeant :** mêmes conditions que les stratégies correspondantes ; une date proche ne les assouplit pas.
- **Développer :** distinguer consolidation, développement spécifique et allègement pré-épreuve, avec durées de phases à documenter ; aucune périodisation automatique validée à ce stade.
- **Alléger :** prévoir une option pré-épreuve et réagir au réalisé ; protocole d'affûtage à étudier, pas de réduction chiffrée inventée ici.
- **Historique insuffisant :** indiquer une faisabilité non établie et proposer uniquement ce que les références permettent.
- **Interruption :** réévaluer le projet, sans rattrapage ni conversion du délai restant en augmentation forcée.
- **Limites :** relief de course, météo, capacité au chrono et état de santé ne sont pas connus par défaut ; bibliographie spécifique de préparation/affûtage à compléter.

## 7. Maintenir, développer, alléger : transitions proposées — R21

| État | Conditions proposées | Décision |
|---|---|---|
| **Maintenir** | Références actuelles suffisantes pour une proposition familière, mais développement non souhaité ou preuves insuffisantes. | Séances cohérentes avec la pratique ; variation possible sans hausse de difficulté ; stabilité légitime. |
| **Développer** | Objectif de progression, références fraîches et cohérentes, observations répétées, informations de tolérance suffisantes pour le type, volume et calendrier compatibles. | Une stimulation candidate limitée, suivie d'observation ; pas une augmentation automatique chaque semaine. |
| **Alléger** | Contraintes nouvelles, volume autonome ajouté, effort défavorable réellement déclaré ou repères fragiles. | Moins de durée, d'intensité ou d'occasions ; distinguer allègement choisi et absence de données. Ne pas diagnostiquer la fatigue. |

Une sortie importée, un anniversaire de semaine ou une association ne suffisent jamais à passer à développer. Le ressenti est facultatif et qualitatif : aucun score de charge ne sera déduit des quatre catégories actuelles. Son absence peut limiter l'accès aux séances exigeantes, sans bloquer toute sortie facile ni imposer un questionnaire.

La progression doit rester **possible** : il ne suffit pas de maintenir à vie un plafond égal à la médiane. Un candidat de développement peut dépasser une référence habituelle après admissibilité et avec une borne propre au type à justifier. Sans dose validée, ce candidat reste désactivé ; ne pas prétendre que le développement est opérationnel.

Dimension modifiée explicitement : durée, fréquence, intensité ou difficulté de terrain. Une exception combinant plusieurs dimensions doit être justifiée et testée ; aucune exception implicite par substitution d'un terrain plat par des côtes. L'arrondi final ne doit pas supprimer toute variation autorisée ni dépasser une borne : si le pas de cinq minutes rend la dose incohérente, ne pas forcer une hausse ; réexaminer ce choix produit séparément.

## 8. Stabilité, identité et rapprochement — R22 à R25

### 8.1 Contrat souhaité

Une **occurrence** représente une occasion proposée ; son identifiant est indépendant de sa durée, de son type affiché, de sa position dans la liste et de la date si l'utilisateur la déplace explicitement. Une **révision** représente un contenu présenté de cette occurrence. Une empreinte de contenu permet l'idempotence ; elle n'est pas l'identité métier.

Le rôle et le contenu déjà présentés sont prioritaires tant qu'ils restent compatibles. Une révision candidate non vue ne remplace pas une révision présentée. Pour le rapprochement, plusieurs révisions d'une seule occurrence ne sont pas plusieurs suggestions distinctes ; deux occurrences indépendantes le même jour restent ambiguës. Aucun regroupement rétrospectif des anciennes identités par simple ressemblance.

### 8.2 Déclencheurs

| Événement | Réaction proposée |
|---|---|
| Rendu React, retour d'onglet, mêmes entrées | Réutiliser l'occurrence/révision ; aucune nouvelle écriture. |
| Jour suivant | Vieillir les preuves et l'horizon, conserver les suggestions futures compatibles ; ne pas renuméroter leur rôle. Ne pas reporter le passé. |
| Nouvelle sortie ou import tardif | Rapprocher puis réévaluer volume, espacement et références ; conserver les contenus compatibles ; ne pas attribuer le type suggéré à la sortie réelle. |
| Disponibilité réduite | Retirer ou proposer une révision compatible ; aucune proposition périmée présentée comme applicable. Pas de déplacement automatique vers le lendemain. |
| Disponibilité accrue / médiane un peu plus haute | Pas d'allongement d'une suggestion déjà présentée pour remplir le temps ; utiliser les nouvelles données pour les prochaines occurrences. |
| Changement d'objectif | Conserver le passé et le planning accepté ; maintenir une future suggestion facile compatible, sinon expliquer son remplacement. Pas de conversion silencieuse en séance intense. |
| Suppression/correction/restauration | Invalider les références et associations concernées, recalculer sur l'état validé ; ne pas ressusciter une révision obsolète. |
| Expiration | Respecter la conservation de sept jours civils après la date ; nettoyer éventuellement selon la politique existante, sans en inventer une nouvelle ici. |

Un calcul vide ne doit pas être interprété indifféremment comme « garder toutes les suggestions » ou « tout annuler ». Retourner explicitement : conservées, nouvelles candidates, devenues incompatibles avec motif. Une incompatibilité de plafond ou de date doit empêcher de présenter un ancien contenu devenu inapplicable ; ce retrait n'est pas un jugement sur le coureur.

### 8.3 Solution compatible à court terme et limite structurelle

**Sans nouveau schéma futur**, une première amélioration peut conserver les enregistrements v1 courants et compatibles, en utilisant leur contenu comme contrainte du moteur. Cela évite les remplacements gratuits et conserve leurs identifiants exacts. Ce lot ne sait cependant pas représenter tous les nouveaux types, une filiation de révisions ou un repère longitudinal durable.

Ne pas modifier `suggestionId()` en prétendant conserver le format : le validateur v1 exige l'égalité entre ID et contenu. Ne pas cacher une séance fractionnée sous `kind: easy`, ni des références durables dans les notes du planning ou localStorage. Ne pas prolonger silencieusement la conservation des suggestions pour mémoriser un repère.

**Recommandation à valider :** stabilisation v1 d'abord ; contrat v2 explicite ensuite, seulement si nécessaire aux stratégies retenues. La version applicative et le numéro de schéma futur ne sont pas choisis ici. Aucune migration n'est exécutée en phase 2B.

### 8.4 Plusieurs onglets

Un orchestrateur relit le contexte et les révisions avant d'enregistrer une présentation ; une transaction attribue ou réutilise l'occurrence unique d'un même créneau logique. Deux calculs concurrents ne créent pas deux occurrences. En cas de conflit, relire et recomposer en conservant la présentation déjà validée ; pas de « dernier onglet gagnant » silencieux.

Notifier seulement après transaction validée, avec les mécanismes existants de [changes.ts](../../src/storage/changes.ts). Une notification entraîne une relecture, pas une nouvelle suggestion systématique. La détection de visibilité reste obligatoire. Les tests doivent couvrir StrictMode, contenus partiellement visibles, restauration concurrente et interruptions entre calcul et écriture.

## 9. Traçabilité des règles proposées

Les références R1–R8 renvoient exclusivement à la vérification et aux limites déjà documentées dans [REFERENCES.md](REFERENCES.md). Aucune référence supplémentaire n'est invoquée et aucune dose nouvelle n'est présentée comme scientifiquement validée.

**A** = principe documenté ; **B** = choix de conception ; **C** = hypothèse à évaluer. Tous les mécanismes informatiques proposés restent B/C même quand leur intention rejoint un principe A.

| Règle | Principe / référence | Choix de conception | Hypothèse et limite |
|---|---|---|---|
| R01 Séparer observation, repère et proposition | Individualisation, R1 | B : objets et diagnostics séparés | C : réduit les confusions ; aucune capacité mesurée. |
| R02 Repère par épisode, sans réduction récursive | R1, intention générale seulement | B : réduction appliquée au candidat, pas à une précédente réduction | C : stabilité à démontrer ; une pratique durablement plus courte doit rester prise en compte. |
| R03 Réévaluation avec confirmation | Aucun seuil scientifique identifié | B : transition sur preuves répétées | C : paramètres inconnus ; risque de retard à l'adaptation. |
| R04 Expiration et amorçage sans saut | Individualisation/récupération R1/R5 | B : durée de validité finie et état provisoire | C : expiration non physiologique ; aucune preuve de désentraînement. |
| R05 Fréquence d'offre stable | R1 pour adaptation générale | B : occurrences non reportées, suivi du rythme sur plusieurs semaines | C : seuils d'offre à valider ; disponibilité ≠ obligation. |
| R06 Volume réalisé et projeté | R8 invite à distinguer exposition par séance et volume ; pas de formule validée | B : registres séparés, fenêtres glissantes, contrôle par séance | C : durée ≠ charge ; données partielles et sorties non importées. |
| R07 Espacement / interruption | R5 | B : suspendre développement en cas d'incertitude | C : calendrier ≠ récupération ; doses et intervalles à documenter. |
| R08 Endurance facile | R1/R2, activité aérobie générale | B : rôle familier ou court explicite | C : « facile » non vérifié par la durée seule. |
| R09 Longue | Spécificité générale R1 ; vigilance par séance R8 | B : longueur relative au coureur | C : dose spécifique non justifiée par ces seules sources. |
| R10 Soutenue | Résultats contextuels R3/R4 | B : bloc exigeant explicite, admissibilité séparée | C : pas de transposition directe des protocoles étudiés. |
| R11 Fractionné | R3/R4, contexte entraîné | B : blocs/récupération et durée totale | C : doses récréatives et critères d'entrée à documenter. |
| R12 Côtes et relief distinct de la surface | Coût de pente R6 | B : terrain facultatif et alternative | C : la pente ne fournit pas une charge ou une prescription individuelle. |
| R13 Récupération | R5 | B : option et possibilité de repos | C : bénéfice d'une course de récupération non établi par le consensus seul. |
| R14 Débuter | R1/R7 | B : pas d'intensité automatique ni décote récursive | C : doses initiales/progression à documenter ; pas de règle universelle de 10 %. |
| R15 Reprendre | R1/R5, indirects | B : épisode actuel distinct de l'ancien | C : littérature spécifique insuffisante ; aucune rééducation automatisée. |
| R16 Plaisir/forme | R1/R2 | B : préserver absence de plan structuré | Limite : choix produit, non démonstration d'une stratégie supérieure. |
| R17 Endurance | Spécificité R1 | B : durée comme première dimension de développement | C : efficacité et paramètres non démontrés par simulation. |
| R18 Vitesse | R3/R4 | B : intensité distincte seulement si admissible | C : généralisation limitée ; données de tolérance souvent absentes. |
| R19 Distance | Spécificité R1 | B : exposition progressive ciblée, sans allure extrapolée | C : faisabilité individuelle non garantie. |
| R20 Course | Spécificité R1 | B : phases conceptuelles et échéance sans rattrapage | C : affûtage/préparation spécifiques à documenter avant activation. |
| R21 Maintenir/développer/alléger | R1/R5 | B : une dimension à la fois sauf justification | C : pas une loi de sécurité ; dose et transition restent à valider. |
| R22 Stabilité de contenu | Constat logiciel 2A, pas référence physiologique | B : conserver rôle/occurrence | C : stabilité excessive si contexte devenu incompatible. |
| R23 Identité et révisions | Aucune justification scientifique nécessaire | B : identité métier distincte de l'empreinte | Limite : incompatible avec le validateur v1 sans contrat ultérieur explicite. |
| R24 Rapprochement factuel | Règle d'intégrité, pas preuve d'adhésion | B : unicité par occurrence, ambiguïtés non arbitrées | C : anciennes identités sans filiation restent ambiguës. |
| R25 Concurrence et migration | Intégrité logicielle | B : transaction, révision et vérification avant conversion | Limite : nécessite tests stockage/sauvegarde avant activation future. |

## 10. Migration compatible : plan futur, pas action de cette phase

1. **Conserver le témoin v1.** Garder les 36 simulations et attentes actuelles comme référence ; comparaison v1/v2 explicite, sans réécrire les résultats historiques pour masquer les écarts.
2. **Introduire les fonctions pures en mode expérimental**, après validation : observations, état de référence, stabilité en mémoire. Aucun nouveau contenu écrit dans un enregistrement v1.
3. **Stabiliser le sous-ensemble représentable en v1** si ce lot est validé : types existants et contenu inchangé ; aucune promesse de prise en charge complète des stratégies v2.
4. **Décider du contrat durable.** Pour la bibliothèque complète et les références par épisode, concevoir séparément un format discriminé v2 ou un magasin dédié. Préférer une séparation explicite plutôt qu'une modification ambiguë d'objets v1 stricts. Autorisation de migration, numéro de schéma et durée de conservation des métadonnées à obtenir avant développement du lot.
5. **Lecture des anciennes données.** Conserver IDs, associations, révisions, dates, notes et planning existants. Une ancienne suggestion est lue comme contenu historique ; ne pas lui inventer une intention, un état de progression ou une famille de révisions. Pas de fusion des anciennes ambiguïtés.
6. **Sauvegardes et restauration.** Préserver lecture JSON/gzip et anciens formats ; vérifier l'intégrité SHA-256 sur le document original avant conversion. Nouveau format seulement si le nouveau contrat le nécessite. Fusion avec contrôle de révision et conflit explicite ; aucune dégradation d'un enregistrement local plus complet. Tester atomicité et restauration d'un document antérieur sans références v2.
7. **Activation progressive et retour sûr.** Lecture compatible avant écriture v2 ; pas de conversion massive irréversible. Une ancienne application peut refuser les nouveaux champs : ne pas annoncer une compatibilité ascendante automatique. Un retour à v1 ne doit pas lancer deux moteurs visibles ni supprimer des données v2 ; prévoir un mode de lecture conservateur ou un refus explicite des écritures incompatibles.

Les repères dérivés durables doivent être minimaux, datés, invalidables et reconstruisibles autant que possible depuis les résumés. Aucun archivage indéfini des ressentis ou suggestions pour contourner leur conservation. Les règles de durée de conservation de ces métadonnées sont une décision distincte, non prise ici.

## 11. Plan de tests et comparaison mesurable

### Matrice longitudinale

Reprendre douze semaines par objectif, y compris plaisir/forme, avec pratiques faible, régulière et documentée plus soutenue. Croiser réalisation totale, une sur deux, préférentiellement courte, préférentiellement longue, aucune, sorties autonomes seules et activités supplémentaires. Les catégories d'expérience déclarée sont indépendantes de la richesse de l'historique.

Ajouter : interruption puis reprise à plusieurs dates, données incomplètes, imports tardifs, suppression d'une preuve, objectif changé en cours de simulation, échéance située dans la période, planning occupé, disponibilités courtes, consultations quotidiennes/hebdomadaires et cartes partiellement visibles. Tester plat uniquement, vallonné explicitement renseigné, relief inconnu et substitution locale ; aucune déduction du relief depuis la seule surface.

Les jeux sont fixes, synthétiques et reproductibles. Pour comparer honnêtement, conserver deux approches : même histoire imposée aux deux moteurs pour isoler leurs décisions ; boucle fermée où chaque comportement réalise les propres suggestions de chaque moteur pour mesurer la dérive. Ne pas confondre ces deux expériences.

### Critères avant validation

| Sujet | Mesure | Critère proposé |
|---|---|---|
| Réduction récursive | Trajectoire B, M, durée proposée et raison de chaque transition | Zéro réduction dont la seule justification est l'application répétée du coefficient à une sortie déjà réduite ; toute révision reliée à des preuves ou expiration. |
| Expiration | Âge des preuves du repère et temps de maintien après leur disparition | Aucun repère utilisé pour développer au-delà de sa borne approuvée ; pas de renouvellement par une simple présentation. |
| Oscillation | Nombre de retours de 5 vers 20/30 minutes sans nouvelle preuve | Zéro saut causé uniquement par le retour à la branche découverte dans les témoins 2A. |
| Stabilité | Révisions et changement de rôle d'une occurrence sans événement pertinent | Zéro modification sous mêmes entrées ; jour suivant seul ne transforme pas facile en habituelle. |
| Variété réelle | Types/durées des occurrences arrivant à leur date, pas seulement ensemble calculé | Variation conservée quand elle est admissible ; aucune obligation de diversité si données ou plafonds la rendent incohérente. |
| Fréquence | Réalisé, offre, intervalles et moyenne sur douze semaines | Pas de baisse due au seul arrondi systématique ; écart au souhait expliqué par contraintes. Pas de découverte quotidienne pour compenser l'absence d'import. |
| Volume | Réalisé + projections compatibles dans chaque fenêtre contrôlée | Aucun ajout algorithmique dépassant le budget approuvé ; dépassement autonome conservé et expliqué, sans modification rétroactive. |
| Progression | Occasions admissibles, essais proposés et dimension modifiée | Au moins un candidat de développement dans les fixtures explicitement admissibles ; zéro croissance hebdomadaire automatique. Dose et limites à préenregistrer. |
| Exigence | Séances exigeantes et exposition longue rapprochées | Aucune introduction sans conditions requises ; pas de cumul non justifié durée/intensité/relief. |
| Objectifs | Différences de types/rôles à données égales | Différences réelles dans les cas admissibles vitesse/endurance/distance/course ; maintien identique acceptable si les données ne permettent rien de plus. |
| Rapprochement | Faux liens, ambiguïtés, associations par occurrence | Zéro faux lien dans les fixtures ; plusieurs révisions connues d'une occurrence ne créent pas une fausse pluralité ; anciennes ambiguïtés conservées. |
| Respect du coureur | Rattrapage, pénalités, hausse après suggestion ignorée | Zéro dette, culpabilisation ou augmentation liée à une non-réalisation supposée. |

Les limites numériques restant à approuver doivent être fixées **avant** l'examen des résultats comparatifs, puis accompagnées d'une analyse de sensibilité. Ne pas optimiser un seul profil pour faire passer les tests. Une simulation démontre des invariants logiciels, pas l'efficacité physiologique ni la prévention de blessures.

### Tests techniques futurs

Fonctions pures : dates civiles/fuseaux, minuit, fenêtres, preuves manquantes, décisions idempotentes, somme des blocs, plafonds après arrondi, conservation des entrées. Intégration : visibilité/StrictMode, absence d'écriture au rendu, deux onglets, conflit de révisions, notification après validation seulement, suppression d'activité, restauration/fusion, anciennes sauvegardes et planning inchangés. Aucune base personnelle réelle.

## 12. Découpage recommandé et décisions à valider

1. **Valider le contrat produit** : repère temporaire, stabilité, maintien/développement/allègement ; choisir les paramètres expérimentaux et les informations minimales de tolérance.
2. **Prototyper les références et l'anti-rétroaction dans le banc**, sans raccordement UI ; comparer transitions débuter/reprendre et péremption.
3. **Prototyper stabilité, fréquence et budget cumulé**, avec consultation quotidienne, anciennes suggestions et activités supplémentaires.
4. **Valider la différenciation facile/longue**, puis seulement les stratégies exigeantes dont les doses auront été documentées ; compléter la littérature spécifique et la revue de contenu.
5. **Concevoir et approuver la persistance v2**, sauvegardes et migration si les lots retenus la nécessitent ; tester avant toute activation.
6. **Intégrer progressivement** avec diagnostics et compatibilité ; validation séparée avant chaque lot visible.

Questions bloquantes avant implémentation :

- Adopte-t-on un repère par épisode à durée de validité finie, avec réévaluation explicite plutôt qu'une médiane immédiatement réinjectée dans une décote ?
- Valide-t-on le gel des contenus présentés encore compatibles, et l'absence de report automatique d'une suggestion passée ?
- Quelles fenêtres, critères de confirmation et bornes d'expiration tester en premier, sans les présenter comme des normes physiologiques ?
- Pour débuter/reprendre sans références utilisables, préfère-t-on une option d'amorçage chiffrée documentée ou aucune durée chiffrée ? Le minimum historique de trente minutes pour les autres objectifs doit-il être réexaminé dans un lot distinct ?
- Quelles informations facultatives suffisent à autoriser une stimulation exigeante ? Tant qu'elles sont absentes ou les doses non étayées, accepte-t-on de rester sur des séances faciles ?
- Autorise-t-on ultérieurement un contrat persistant v2 pour identité stable, nouveaux types et repères, avec une politique de conservation propre ? Sans cela, le périmètre doit rester limité au sous-ensemble représentable en v1.

**Aucun développement n'est commencé.** Ces décisions et incertitudes doivent être validées avant l'implémentation.
