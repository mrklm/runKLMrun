# Analyse des résumés

`session-summary.ts` regroupe les résumés par année/mois et semaine ISO, calcule
les totaux avec couverture des mesures, et filtre les années civiles avant le
regroupement hebdomadaire. Les fonctions sont pures, sans React, IndexedDB ni
lecture des détails. Les dates civiles sont calculées en UTC pour être
indépendantes du fuseau du navigateur. Aucune charge sportive n'est calculée.

Les interfaces mémorisent leurs appels avec `useMemo`. Les valeurs manquantes
restent distinctes du zéro ; un groupe sans séance est un zéro d'enregistrements.
Les tests n'utilisent que des résumés synthétiques.
