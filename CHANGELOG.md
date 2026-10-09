# Historique des versions

## [Non publié]

- fix(import): prendre en charge les exports Polar à `sport.id`, `durationMillis`,
  distances/dénivelés en mètres, statistiques FC et charge `trainingLoadReport.cardioLoad`.
- fix(import): limiter les correspondances sportives aux codes vérifiés et
  distinguer les sports inconnus des autres sports, sans utiliser les titres.
- fix(import): conserver les séries régulières et leurs positions manquantes,
  les routes horodatées et les zones cardiaques, y compris sans temps renseigné.
- fix(import): détailler les motifs de rejet agrégés sans données personnelles ;
  rejeter explicitement les courses sans durée et poursuivre les autres fichiers.
- test(import): compléter les tests synthétiques sans modifier les tests existants,
  vérifier la persistance, les réimportations et les erreurs ZIP.
- docs(import): documenter les deux schémas, sources, unités et limites connues.

## v0.2.0 — 2026-10-09

- Ajout de l'import local progressif des ZIP Polar depuis Paramètres, dans un
  Web Worker, avec progression et compte rendu des erreurs et doublons.
- Reconnaissance explicite des sports de course ; filtrage des fichiers annexes.
- Conservation des métriques disponibles et des séries FC, vitesse, cadence,
  altitude et GPS ; unités documentées, sans calcul de charge sportive.
- Migration IndexedDB v1 vers v2 : séparation des résumés et détails, ajouts
  atomiques sans écrasement des séances existantes.
- Historique responsive affichant les sorties réellement enregistrées.
- Tests synthétiques de conversion, erreurs ZIP/JSON, migration, conservation
  et dédoublonnage ; documentation des formats et limites.

## v0.1.0

- Socle React, TypeScript et Vite, interface responsive en français.
- Stockage IndexedDB des séances et tests Vitest.
- Configuration du déploiement GitHub Pages.
