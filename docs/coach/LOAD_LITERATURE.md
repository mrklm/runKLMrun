# Charge d'entraînement : ce que dit la littérature

Étude préalable, 8 novembre 2026. Aucune règle n'est activée par ce document : la politique A reste appliquée. Objectif : fonder une future adaptation du Coach sur des méthodes publiées, à partir des mesures déjà disponibles, **sans ajouter de question** au coureur. Complète [REFERENCES.md](REFERENCES.md) (R5 Kellmann, R7 Buist, R8 Frandsen).

## Constat de départ

Sur un historique réel de plusieurs années (analyse en lecture seule d'une sauvegarde, hors dépôt) :

- la charge cardio Polar (`cardioLoad`) est présente sur environ 92 % des séances ;
- l'effort perçu ne l'est que sur 2 %, toujours avec la même valeur, et le type d'entraînement sur 1 % ;
- la plupart des écarts entre séances font 1 ou 2 jours.

Conséquence : les protections actuelles fondées sur le type déclaré (14 jours entre structurées, 10 entre longues) ne se déclenchent presque jamais sur un historique réel. Une adaptation utile doit partir de ce qui est mesuré automatiquement.

## Mesures retenues

### Charge cardio Polar (mesure principale)

La documentation technique de Polar [P1] indique que la charge cardio est un **TRIMP de Banister** [B1] : calcul seconde par seconde à partir de la fréquence cardiaque, de la FC de repos et maximale des réglages et du sexe, avec une pondération exponentielle issue de la relation fréquence cardiaque–lactate. Une séance typique de 60 minutes vaut de 70 à 130 [P2].

- Avantages : mesurée sans saisie, déjà importée, méthode publiée et largement utilisée.
- Limites déclarées par Polar : sous-estime les efforts très brefs et intenses ; pondération générique qui ne distingue que le sexe ; dépend de la justesse des FC de repos et maximale réglées dans la montre.
- Conséquence projet : une séance dont la fréquence cardiaque est exclue (`heartRateIgnored`) ou absente n'a **pas** de charge cardio ; aucune valeur n'est estimée.

### Effort perçu de séance (complément)

La méthode session-RPE [F1] multiplie l'effort perçu (échelle CR-10 modifiée, celle de la v1.3.0) par la durée en minutes. Elle a été comparée à des méthodes fondées sur la fréquence cardiaque sur plusieurs types d'exercice ; Polar l'intègre aussi (« Perceived load ») [P1].

- Avantage : seule mesure disponible pour une séance sans fréquence cardiaque ; capte une fatigue que la fréquence cardiaque ne montre pas.
- Limite : subjective ; facultative ici, donc souvent absente.
- **Charge cardio et charge perçue ne s'additionnent pas** : unités différentes. Polar les présente séparément [P1]. Deux séries distinctes, jamais une conversion inventée.

### Repère individuel plutôt que seuil absolu

Aucune des sources ne fournit de valeur absolue de charge « trop élevée » applicable à tous. Polar compare chaque séance à la moyenne des 90 jours précédents, mais précise que ses bornes (0,5 / 0,75 / 1,25 / 2) **ne reposent pas sur des preuves scientifiques solides** [P1]. Toute comparaison devra donc se faire par rapport à l'historique du coureur lui-même, et ses bornes resteront des choix à évaluer, pas des seuils validés.

### Pic de distance par séance

Frandsen et al. [R8 de REFERENCES.md] associent les blessures de surutilisation à une séance dont la distance dépasse la plus longue des trente jours précédents. Repère simple, calculable sans saisie, observationnel (pas causal).

### Intensité déduite des zones cardiaques

Le modèle à trois zones de Seiler [S1, S2] décrit une majorité de travail à basse intensité chez les sportifs d'endurance entraînés. Il permettrait de distinguer une séance exigeante sans demander son type. Limite : les zones de Seiler reposent sur des seuils ventilatoires ou lactiques, alors que les zones Polar importées sont en général des pourcentages de FC maximale ; la correspondance n'est qu'approximative et doit être présentée comme telle.

## Méthodes écartées

| Méthode | Motif |
|---|---|
| Ratio charge aiguë/chronique (ACWR, Gabbett [G1]) et, par conséquent, le « Cardio load status » et l'alerte de risque de Polar (charge 7 jours / charge 28 jours) | Critiques méthodologiques importantes : artefacts mathématiques du ratio, causalité supposée [I1]. Polar reconnaît que la confirmation manque pour les sports d'endurance individuels [P1]. |
| Règle des 10 % par semaine | Pas d'effet démontré sur les blessures de débutants (R7 Buist). |
| Monotonie et contrainte de Foster [F2] comme règle | Méthode publiée, mais pensée pour un entraînement quotidien ; la monotonie reste basse chez un coureur qui alterne jours de course et de repos. Le seuil de 2 souvent cité n'a pas été vérifié dans le texte original. Utilisable en observation, pas comme déclencheur. |
| Dossiers d'éligibilité D4c/D4e (6 dates, intervalles exacts) | Critères éditoriaux sans appui bibliographique. |

## Ce que la littérature ne donne pas

Aucun nombre universel de jours de récupération entre deux séances exigeantes (R5 Kellmann). Les délais 2/7/10/14 jours de la politique A sont des choix prudents du projet ; toute nouvelle règle temporelle le sera aussi. L'enjeu est de les rendre **relatifs à la pratique mesurée** du coureur et testables sur son historique.

## Pistes à tester dans le prototype (hors application)

1. **Séance exigeante mesurée** : charge cardio nettement au-dessus de la moyenne personnelle récente, ou effort perçu ≥ 7 (« très difficile ») → la suivante est proposée facile (principe d'alternance difficile/facile, sans durée de récupération inventée).
2. **Semaine chargée** : charge cardio hebdomadaire au-dessus de l'habitude personnelle → pas de séance exigeante proposée.
3. **Pic de distance** : une sortie proposée ne dépasse pas la plus longue des 30 derniers jours [R8].
4. Données manquantes : sans charge cardio ni effort perçu, la règle ne s'applique pas ; rien n'est estimé.

Pour chaque piste, rejouer l'historique réel en lecture seule et mesurer : fréquence de déclenchement, cohérence avec les semaines effectivement difficiles, effet de chaque borne. Une piste qui se déclenche presque toujours ou jamais est abandonnée ou recalibrée avant toute décision d'activation.

## Références

- **[B1]** Morton RH, Fitz-Clarke JR, Banister EW. (1990). *Modeling human performance in running.* Journal of Applied Physiology. Source du modèle impulsion–réponse et du TRIMP. Texte non consulté ; référence relevée dans la littérature secondaire et chez Polar.
- **[F1]** Foster C, Florhaug JA, Franklin J, et al. (2001). *A new approach to monitoring exercise training.* Journal of Strength and Conditioning Research, 15(1), 109–115. Résumé consulté.
- **[F2]** Foster C. (1998). *Monitoring training in athletes with reference to overtraining syndrome.* Medicine & Science in Sports & Exercise, 30(7), 1164–1168. DOI [10.1097/00005768-199807000-00023](https://doi.org/10.1097/00005768-199807000-00023). Résumé consulté.
- **[G1]** Gabbett TJ. (2016). *The training-injury prevention paradox: should athletes be training smarter and harder?* British Journal of Sports Medicine, 50, 273–280. [Article](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789704).
- **[I1]** Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. (2020). *Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls.* International Journal of Sports Physiology and Performance, 15(6), 907–913. DOI [10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864). Résumé consulté.
- **[P1]** Polar Research and Technology. *Polar Training Load Pro — White Paper* (12 novembre 2019, révision mars 2025). [PDF](https://www.polar.com/img/static/whitepapers/pdf/polar-training-load-pro-white-paper.pdf). Texte intégral consulté.
- **[P2]** Polar. *Training Load Pro* (aide en ligne). [Page](https://support.polar.com/en/training-load-pro). Consultée le 8 novembre 2026.
- **[S1]** Seiler S. (2010). *What is best practice for training intensity and duration distribution in endurance athletes?* International Journal of Sports Physiology and Performance, 5(3), 276–291. DOI [10.1123/ijspp.5.3.276](https://doi.org/10.1123/ijspp.5.3.276). Résumé consulté.
- **[S2]** Seiler S, Kjerland GØ. (2006). *Quantifying training intensity distribution in elite endurance athletes: is there evidence for an "optimal" distribution?* Scandinavian Journal of Medicine & Science in Sports, 16(1), 49–56. [PubMed](https://pubmed.ncbi.nlm.nih.gov/16430681/). Résumé consulté ; population : jeunes skieurs de fond.
