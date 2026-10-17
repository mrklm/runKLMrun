# Fondements scientifiques — cadre de travail

Phase 1, 17 octobre 2026. Documentation uniquement, sans modification du Coach.

« runKLMrun s’adapte au coureur, jamais l’inverse. »

Ce document distingue **principes documentés**, **résultats dépendants du contexte** et **hypothèses de conception**. Les références et leurs limites figurent dans [REFERENCES.md](REFERENCES.md). Les correspondances avec les fonctions actuelles sont dans [RULES_AUDIT.md](RULES_AUDIT.md).

## Principes pertinents

| Principe | Connaissances et degré de portée | Conséquence envisagée pour le produit — non implémentée |
|---|---|---|
| Spécificité | **Documenté** : modalités et doses d’exercice se choisissent selon les objectifs et réponses individuelles [R1](REFERENCES.md#r1--prescription-individualisée--acsm). | L’endurance, la vitesse et une préparation de course ne devraient pas être distinguées uniquement par leur intitulé. |
| Adaptation et progressivité | **Documenté au niveau général**, sans pourcentage universel : une prescription doit évoluer avec la personne ; l’essai [R7](REFERENCES.md#r7--progression-de-volume-chez-les-débutants) ne valide pas une règle de progression hebdomadaire de 10 %. | Rechercher une stimulation ajustable, jamais un accroissement automatique chaque semaine. Un plancher de durée n’est pas une preuve de capacité. |
| Alternance des sollicitations | **Contextuel** : les distributions d’intensité ont des effets dépendant de la population et de l’indicateur ; [R3](REFERENCES.md#r3--répartition-des-intensités--méta-analyse), [R4](REFERENCES.md#r4--comparaison-expérimentale-des-distributions-dintensité). | Ne pas convertir une répartition d’intensité publiée en nombre fixe de séances exigeantes. Varier les minutes ne suffit pas à créer des stimuli différents. |
| Endurance aérobie | **Documenté** : l’exercice aérobie régulier contribue à la santé ; les repères de l’[OMS, R2](REFERENCES.md#r2--santé-publique--oms) portent sur l’activité totale. | Ne pas transformer un repère hebdomadaire de santé en minimum de course pour chaque personne. |
| Intensité de l’effort | **Contextuel** : les effets des interventions d’endurance sont mesurés avec des protocoles et indicateurs précis [R3](REFERENCES.md#r3--répartition-des-intensités--méta-analyse). | Séparer l’intensité souhaitée, les mesures réellement disponibles et l’effort perçu. Ni une FC moyenne seule ni un libellé « facile » ne prouvent un domaine physiologique. |
| Récupération | **Documenté au niveau général** : elle dépend aussi du contexte extra-sportif et varie chez une même personne [R5](REFERENCES.md#r5--récupération-et-individualisation). | Un intervalle entre dates est un fait de calendrier, pas un indicateur de récupération. Pas de diagnostic automatique de fatigue ou de motivation. |
| Individualisation | **Documenté** : les caractéristiques, objectifs et réponses doivent être considérés [R1](REFERENCES.md#r1--prescription-individualisée--acsm). | La pratique enregistrée est une information imparfaite, pas une capacité certifiée. Une sortie courte peut être choisie, non subie. |
| Terrain | **Documenté pour la pente**, transfert au terrain réel partiel : la dépense énergétique change avec le relief [R6](REFERENCES.md#r6--pente-et-coût-énergétique). | Surface et relief doivent rester distincts ; plat, vallonné et côtes ne sont pas interchangeables à durée/allure égales. |

## Ce que les publications ne valident pas

Aucune source consultée ne valide la combinaison logicielle suivante : médiane de durées, fractions 0,5/0,8/1, trois références, étendue relative ≤ 0,5, fenêtre de quatre intervalles, ancienneté de deux intervalles, minimum de trente minutes, arrondi inférieur de cinq minutes et budget de sept jours. Ce sont des règles éditoriales à évaluer, même lorsque leur intention est raisonnable.

Le coefficient de **80 % de la médiane de durée** ne représente ni « 80 % de la FC maximale », ni une distribution « 80/20 » d’intensité. Ces quantités ont des significations différentes.

Le risque de blessure est multifactoriel. L’observation de variations par séance dans [R8](REFERENCES.md#r8--variations-par-séance--cohorte-récente) invite à ne pas surveiller uniquement un total hebdomadaire ; elle ne valide pas le budget du code ni un seuil individuel de sécurité.

## Hypothèses de produit à évaluer, pas des connaissances établies

1. Conserver un repère d’endurance habituelle distinct des séances intentionnellement courtes pourrait limiter l’auto-réduction des durées. Il faudrait vérifier sa fraîcheur, sa provenance et sa réversibilité.
2. Une seule dimension de difficulté modifiée à la fois rendrait les décisions plus explicables. Ce serait un garde-fou de conception, pas une loi physiologique.
3. Une courte période de stabilité observable pourrait précéder l’accès facultatif à une séance plus stimulante. Nombre de séances, durée de cette période et critères restent à établir.
4. Le ressenti pourrait enrichir le contexte sans être obligatoire. Les quatre catégories actuelles ne constituent pas une échelle RPE numérique validée ; aucune conversion arbitraire en score de charge n’est proposée.
5. Les préférences du coureur doivent permettre de décliner le terrain ou le type de séance sans pénalité ni rattrapage.

## Limites de l’observation locale

Le Coach voit des résumés enregistrés : une sortie absente peut avoir été effectuée, une importation tardive peut changer le diagnostic, et une course associée à une suggestion ne prouve pas son exécution fidèle. Les courbes conservées trente jours ne sont pas nécessaires au moteur actuel ; leur absence ne doit pas devenir une faute imputée au coureur.

Ni la météo, ni le sommeil, ni les blessures, ni une récupération physiologique ne sont établis par les données utilisées. Une future séance exigeante doit disposer de conditions d’éligibilité explicites et d’une solution simple pour rester en aisance ; ces conditions restent à concevoir et à documenter, sans prescription clinique dans cette phase.

## Critères de validation de la future politique

Avant implémentation : justifier chaque nouvelle règle par son intention, son niveau de preuve, ses limites, les données nécessaires et son comportement en cas d’incertitude. Ensuite seulement, comparer sur douze semaines le moteur actuel et les variantes conceptuelles décrites dans [OBJECTIVE_STRATEGIES.md](OBJECTIVE_STRATEGIES.md#simulations-sur-douze-semaines-à-décrire-puis-implémenter-ultérieurement).

Une simulation peut détecter une dérive algorithmique ; elle ne démontre ni l’efficacité sportive ni la sécurité clinique d’une stratégie.
