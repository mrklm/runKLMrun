# Clôture D4 — maintien de la politique A

Décision : conserver A. B (12 jours pour les structurées ou 9 pour les longues) n’est pas activée. Aucune décision sportive, version, entrée de changelog, migration ou structure de stockage n’est modifiée par cette clôture.

## Fonctions réellement actives

D4b centralise la politique dans `recovery-policy-v2.ts` : repos minimal de 2 jours après une course admissible, fenêtre de ressenti de 7 jours, 10 jours entre longues, 14 jours entre toutes les familles structurées. À la frontière exacte, la protection cesse ; cela ne promet pas une recommandation. `hard` conserve une préférence facile ; `very-hard` protège contre les séances exigeantes. Les contrôles D2 de charge et de qualité restent applicables.

La politique est utilisée par l’adaptation de charge, la sélection, la progression et l’orchestrateur. L’adaptateur applicatif, les recommandations actives et les perspectives reçoivent ces décisions. Les intentions ne deviennent pas des activités réalisées. Une active incompatible n’est pas réutilisée, sans effacement de son historique.

Présentation et remplacement recalculent l’admissibilité avant mémorisation et contrôlent l’instantané sous transaction. Un résultat périmé est refusé ou recalculé. Cette correction D4b de validation ne change pas le choix sportif calculé. Les courses concurrentes sont testées sur `fake-indexeddb`, dans des bases synthétiques `d4b-*`.

D4a est intégré comme analyse pure et testée, **sans appel dans l’application**, conformément à son contrat. Il décrit semaines et jours actifs, espacements, durées, ressentis, charge et qualité des données. Aucun raccordement à la sélection ni nouvel affichage n’est ajouté pour la clôture.

## Études conservées, inactives

- `training-habits-v2.ts` : analyse descriptive D4a, réutilisée par les études.
- `volume-observations-v2.ts` : observations de volume utilisées par D4c/D4d.
- `spacing-eligibility-v2.ts` : éligibilité expérimentale D4c et consolidation.
- `simulation/spacing-calibration-v2.ts` et ses fixtures : comparaison des hypothèses D4d.
- `simulation/frequency-history-v2.ts` et ses fixtures : étude de fréquence historique.
- `simulation/hybrid-dossier-v2.ts`, `hybrid-calendar-v2.ts` et ses fixtures : proposition et calendriers D4e-1.
- Tests, snapshots et documents associés : preuves et reproductibilité conservées.

Audit des imports depuis `src/main.tsx`, imports relatifs statiques et dynamiques littéraux compris : 152 modules accessibles, politique D4b présente, aucun des sept modules descriptifs/expérimentaux ci-dessus accessible. Les imports de types sont inclus conservativement. Le dossier `simulation/` n’est pas entièrement inactif : l’orchestrateur historique et certains outils de référence servent réellement l’application.

Ces fichiers sont inutilisés par le parcours applicatif, mais utilisés par les tests ou les études. Aucun n’est supprimé. Les fichiers étrangers à D4 déjà présents dans la copie de travail sont également préservés.

## Limites et décision

L’absence d’activité enregistrée ne prouve pas l’absence de pratique. Une réalisation, même `completed`, ne prouve ni tolérance ni récupération physiologique. Historique incomplet, doublons et corrections restent des limites documentées ; la politique commune n’effectue pas le filtrage sportif amont.

D4e-1 compare 19 scénarios synthétiques sur 56 jours. Deux cas B conditionnels modifient le calendrier, mais aucun n’est activable avec le contrat actuel. Un total identique peut masquer une concentration accrue sur 14 jours. Les simulations à catalogue fixe ne remplacent pas une validation complète du parcours applicatif, et le cumul après correction/suppression reste à recalculer avant toute éventuelle expérimentation.

Ces limites ne bloquent pas le maintien de A. Toute reprise de B demanderait une décision distincte sur les seuils, le cumul et le repli, les blocages D4c, puis une autorisation explicite. Aucun seuil expérimental n’est médicalement ou physiologiquement validé.

## Proposition de publication — non appliquée

Version proposée : **v1.1.1**, consolidation interne et correction de validation, sans nouvelle politique sportive ni nouvelle fonctionnalité visible. Lors de la clôture, la version était **v1.1.0**. La préparation ultérieure de **v1.1.1** met à jour les métadonnées et le changelog ; sa publication reste à la décision de l’utilisateur.

Entrée proposée :

> ### v1.1.1 — Consolidation du Coach V2
> - Politique commune de protection, avec maintien des délais de 2, 7, 10 et 14 jours.
> - Validation renforcée des recommandations avant mémorisation et remplacement, y compris lorsque les données changent.
> - Analyses descriptives et études de calendrier conservées hors de l’application ; adaptation expérimentale 12/9 jours non activée.
> - Compatibilité vérifiée des recommandations, actives et perspectives pour les trois tempéraments, sans estimation de récupération physiologique.

La modification des versions et du changelog reste une étape ultérieure explicitement distincte.

## Commandes ultérieures — non exécutées

Relire les différences puis sélectionner exclusivement les fichiers D4 ci-dessous. Cette liste exclut `.agents/`, les changements de style/aide et les fichiers étrangers au chantier. Elle n’inclut aucune préparation de version.

```sh
git diff --check
git status --short
git diff -- src/core/coach src/storage/coach-suggestions-v2.ts
git add -- \
  src/core/coach/load-adaptation-policy-v2.ts \
  src/core/coach/load-adaptation-selection-v2.ts \
  src/core/coach/progression-state-v2.ts \
  src/core/coach/simulation/session-orchestrator-v2.ts \
  src/storage/coach-suggestions-v2.ts \
  docs/coach/D4_FINAL.md \
  src/core/coach/__snapshots__/recovery-compatibility-v2.test.ts.snap \
  src/core/coach/recovery-compatibility-v2.test.ts \
  src/core/coach/recovery-persistence-v2.test.ts \
  src/core/coach/recovery-policy-v2.md \
  src/core/coach/recovery-policy-v2.test.ts \
  src/core/coach/recovery-policy-v2.ts \
  src/core/coach/simulation/frequency-history-fixtures-v2.ts \
  src/core/coach/simulation/frequency-history-v2.md \
  src/core/coach/simulation/frequency-history-v2.test.ts \
  src/core/coach/simulation/frequency-history-v2.ts \
  src/core/coach/simulation/hybrid-calendar-decision-v2.md \
  src/core/coach/simulation/hybrid-calendar-fixtures-v2.ts \
  src/core/coach/simulation/hybrid-calendar-results-v2.md \
  src/core/coach/simulation/hybrid-calendar-v2.test.ts \
  src/core/coach/simulation/hybrid-calendar-v2.ts \
  src/core/coach/simulation/hybrid-dossier-v2.ts \
  src/core/coach/simulation/hybrid-policy-proposal-v2.md \
  src/core/coach/simulation/spacing-calibration-fixtures-v2.ts \
  src/core/coach/simulation/spacing-calibration-v2.md \
  src/core/coach/simulation/spacing-calibration-v2.test.ts \
  src/core/coach/simulation/spacing-calibration-v2.ts \
  src/core/coach/spacing-eligibility-consolidation-v2.md \
  src/core/coach/spacing-eligibility-v2.md \
  src/core/coach/spacing-eligibility-v2.test.ts \
  src/core/coach/spacing-eligibility-v2.ts \
  src/core/coach/training-habits-v2.md \
  src/core/coach/training-habits-v2.test.ts \
  src/core/coach/training-habits-v2.ts \
  src/core/coach/volume-observations-v2.ts
git diff --cached --stat
git diff --cached
git commit -m "Consolide D4 et conserve la politique A"
git push origin main
```

Le workflow `.github/workflows/` publie GitHub Pages à chaque push sur `main`, après tests et build. **La dernière commande déclenche donc aussi le déploiement**, sous réserve de réussite du workflow. Aucun tag n’est nécessaire. Ne lancer le push que lorsque la publication est souhaitée ; aucune de ces commandes d’écriture n’a été exécutée ici.

## Vérifications de clôture

- Tests ciblés : **234 réussis**, six fichiers (D4a, politique D4b, persistance D4b, compatibilité, identité et D4c).
- Compatibilité : **111 empreintes historiques inchangées**, dont 31 scénarios applicatifs pour chacun des trois tempéraments et 18 cas d’orchestrateur. Résultats complets, réutilisation active et perspectives sont comparés ; aucun snapshot n’a été régénéré.
- Suite complète : **2 102 réussis, 1 ignoré**, 112 fichiers réussis et un ignoré. Le test ignoré est le gros export GPS optionnel, activable par `RUN_LARGE_BACKUP_TEST=1`, sans rapport avec D4.
- TypeScript (`npx tsc -b`) et build : réussis. Avertissement existant : bundle principal de 577,18 kB, supérieur au seuil indicatif de 500 kB.
- `git diff --check` : réussi. Les empreintes de tous les fichiers préexistants sont inchangées ; seul ce document est ajouté pour la clôture.

Le champ historique `policy: 'hybrid'` de la référence de durée dans l’adaptateur ne désigne pas l’option d’espacement B. Aucun paramétrage 12/9 n’est fourni par le parcours applicatif.

Commandes de validation utilisées :

```sh
npx vitest run src/core/coach/training-habits-v2.test.ts src/core/coach/recovery-policy-v2.test.ts src/core/coach/recovery-persistence-v2.test.ts src/core/coach/recovery-compatibility-v2.test.ts src/core/coach/presentation-identity-v2.test.ts src/core/coach/spacing-eligibility-v2.test.ts
npm test
npx playwright test e2e/coach-v2-continuity.spec.ts e2e/coach-v2-load.spec.ts e2e/coach-v2-internal.spec.ts
npx tsc -b
npm run build
git diff --check
```

Navigateur : **11 tests réussis** sur continuité, charge et parcours interne. Contextes Chromium neufs, données synthétiques et garde `protected-test` interdisant toute ouverture/suppression de `runklmrun`. Le premier lancement a été bloqué par les restrictions réseau locales (`EPERM`) ; la relance autorisée a réussi. Avertissement cosmétique existant : `NO_COLOR`/`FORCE_COLOR`.

Aucun problème bloquant identifié pour conserver A. Aucun accès à la base historique ni opération Git d’écriture n’a été réalisé.
