# Analyse des résumés

`session-summary.ts` regroupe les résumés par année/mois et semaine ISO, calcule
les totaux avec couverture des mesures, et filtre les années civiles avant le
regroupement hebdomadaire. Les fonctions sont pures, sans React, IndexedDB ni
lecture des détails. Les dates civiles sont calculées en UTC pour être
indépendantes du fuseau du navigateur. Aucune charge sportive n'est calculée.

Les interfaces mémorisent leurs appels avec `useMemo`. Les valeurs manquantes
restent distinctes du zéro ; un groupe sans séance est un zéro d'enregistrements.
Les tests n'utilisent que des résumés synthétiques.

## Bilan Entraînement

`training-history.ts` expose `analyzeTrainingHistory(sessions, weeks, referenceDate)`.
Le résultat typé distingue couverture, absences, invalidités et zéros. Il réutilise
`sumMeasure` et `validSessionDate`, sans accès au navigateur ni au stockage.
La référence est une date civile valide, obligatoire : le moteur ne lit pas l’horloge.
Les moyennes couvrent toute la fenêtre, les semaines actives sont des blocs de
sept jours, et la dernière activité est recherchée hors fenêtre si nécessaire.
Le calcul ne modifie pas les entrées et ne produit aucune recommandation sportive.
