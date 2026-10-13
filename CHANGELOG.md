# Historique des versions

## [Non publié]

## v0.5.0 — 2026-10-13

- feat(chaussures): suivre une seule paire automatiquement selon les dates de première
  utilisation, à partir des résumés permanents, avec historique, kilomètres et durées.
- feat(chaussures): attribuer manuellement une paire depuis l’historique ou une fiche,
  proposer une paire par défaut pour les nouvelles séances récentes et conserver les
  associations lors des changements de mode ; confirmer toute conversion des périodes.
- feat(chaussures): gérer les paires, les dates indépendantes de l’achat, l’archivage
  et les limites kilométriques avec alertes personnalisables ; signaler les dates ambiguës.
- feat(sauvegarde): conserver chaussures, dates, associations et mode de suivi dans
  les sauvegardes JSON/gzip, avec compatibilité des anciennes sauvegardes, intégrité
  SHA-256, aperçu, fusion et remplacement atomiques avec protection des conflits.
- feat(conservation): conserver les détails des nouvelles importations pendant 30 jours,
  préserver les résumés et proposer un nettoyage par lots après confirmation explicite,
  avec entretien glissant après activation ; appliquer la règle après vérification des sauvegardes.
- test(chaussures): couvrir les périodes, attributions, changements de mode, sauvegardes
  et parcours navigateur sur données synthétiques, dont l’affichage mobile.

- fix(sauvegarde): séparer profondeur, nœuds et valeurs primitives ; réserver aux
  séries de mesures un budget dérivé de la taille JSON, sans troncature.
- fix(sauvegarde): préciser les contrôles dépassés avec leurs valeurs et plafonds,
  limiter les propriétés par objet et signaler les erreurs mémoire identifiables.
- test(sauvegarde): reproduire le plafond historique de 40 millions de jetons
  avec 4,5 millions de points GPS synthétiques, sans augmenter les limites d’octets.

- fix(sauvegarde): lever le plafond unique de 128 Mio de JSON avant export,
  réduire les copies et distinguer les limites gzip, JSON et complexité.
- feat(sauvegarde): exporter en .json.gz, lire gzip et les anciens JSON v1,
  conserver SHA-256 et afficher les tailles avant/après compression.
- test(sauvegarde): couvrir corruption gzip, troncature, expansion excessive,
  compatibilité JSON et conservation des données, avec contrôle synthétique > 128 Mio.

- feat(sauvegarde): exporter et restaurer séances, détails et profil dans un JSON
  versionné avec empreinte SHA-256, traitement local et prévisualisation.
- feat(stockage): remplacer ou fusionner dans une transaction unique, conserver
  les conflits et demander un choix explicite pour le profil, sans migration.
- test(sauvegarde): couvrir intégrité, relations, atomicité, concurrence,
  restauration, téléchargement, clavier et affichage mobile.

- feat(profil): personnaliser les durées maximales par jour disponible, avec mode
  simple par défaut, résumé lisible et conservation des valeurs entre les modes.
- test(profil): vérifier les durées facultatives, les anciens profils, la
  persistance, les erreurs de saisie et les parcours clavier/mobile, sans migration.

- feat(profil): ajouter objectifs, distances, échéances, disponibilités et terrain
  dans Entraînement, avec formulaire facultatif, résumé et modification explicite.
- feat(stockage): ajouter le profil unique par migration additive IndexedDB v3,
  sans réécrire les séances ; signaler les migrations bloquées et conflits entre onglets.
- fix(profil): conserver les saisies en cas d’erreur, valider les contraintes
  déclarées et ne déduire aucune préférence de l’historique.
- test(profil): couvrir validation, persistance, migration, conservation des données,
  erreurs, concurrence, clavier et affichage mobile.

- style(identite): retirer le logo de l’en-tête, centrer le titre, l’agrandir de 5 %
  et supprimer son effet d’ombre.

- feat(entrainement): afficher un bilan récent sur 4, 8 ou 12 semaines glissantes,
  avec volumes, fréquence, semaines actives, sortie la plus longue et dernière activité.
- fix(analysis): distinguer mesures absentes, invalides et réellement égales à zéro,
  signaler les totaux partiels et exclure les dates invalides ou futures.
- test(entrainement): couvrir les limites calendaires, la couverture des mesures,
  les changements de période et la navigation réelle sur ordinateur et mobile.

## v0.4.0 — 2026-10-10

- feat(session): consulter les détails d’une séance depuis l’Accueil ou l’Historique,
  avec informations générales, zones cardiaques et chargement ciblé des données.
- feat(charts): afficher fréquence cardiaque, allure, altitude et cadence avec
  échelles adaptées, tableaux accessibles et respect des interruptions de mesure.
- feat(charts): synchroniser le curseur temporel et les mesures entre les quatre
  courbes, à la souris, au clavier et sur écran tactile.
- feat(import): importer plusieurs fichiers TCX et réunir ZIP/JSON Polar et TCX
  dans une interface commune avec progression, validation et compte rendu explicite.
- feat(storage): détecter prudemment les doublons TCX et interformats sans écraser
  les séances existantes ni modifier le schéma IndexedDB.
- feat(statistiques): filtrer les indicateurs et graphiques sur les sept derniers
  jours locaux, un mois, une année ou tout l’historique, avec agrégations adaptées.
- fix(navigation): rendre les cartes de séance entièrement cliquables ; compacter
  les fiches et replier les informations secondaires ; supprimer le bandeau d’Accueil.
- feat(identite): intégrer le logo et le titre graphiques ainsi qu’un splash compact
  de trois secondes, avec version automatique et prise en charge des animations réduites.
- refactor(parametres): placer le sélecteur compact des 16 thèmes en bas de page,
  en conservant l’application immédiate et la mémorisation locale.
- style(interface): supprimer « Un pas après l’autre. À votre rythme. » du pied de page.
- test(interface): couvrir les imports, graphiques, périodes, thèmes et navigations,
  avec tests Chromium sur ordinateur et mobile.

## v0.3.0


- feat(home): limiter « Dernières sorties » aux cinq séances les plus récentes
  et ajouter le lien vers l’historique complet, en conservant les informations
  affichées et l’accueil sans séance.
- test(home): vérifier la limite, l’ordre chronologique, les petites listes,
  l’état vide et le lien vers l’historique.

- feat(history): regrouper les séances par années et mois repliables avec leurs
  totaux et ouvrir par défaut les périodes les plus récentes.
- feat(statistics): ajouter une page filtrable par année, quatre indicateurs et
  trois graphiques Recharts (distance hebdomadaire, sorties mensuelles et dénivelé
  hebdomadaire) avec semaines ISO, tableaux et navigation par fenêtres.
- fix(statistics): distinguer les mesures absentes des zéros et signaler les
  totaux partiels ; filtrer l'année civile avant le regroupement ISO.
- test(statistics): vérifier les regroupements, frontières d'année, totaux,
  données manquantes, volumes importants et contrastes des seize thèmes.
- docs(statistics): décrire les calculs, limites et vérifications manuelles.

- feat(themes): ajouter les 16 palettes Sombre, Clair et Pouêt, avec leurs noms
  et couleurs exacts, une prévisualisation et une application immédiate.
- feat(themes): mémoriser le choix dans localStorage et restaurer Midnight Garage
  par défaut ou si la préférence est inconnue ; proposer un bouton de réinitialisation.
- fix(styles): appliquer les couleurs à toutes les pages, formulaires, boutons et
  messages, avec des couleurs de texte dérivées pour les fonds peu lisibles.
- test(themes): vérifier les palettes, contrastes dérivés, changements, persistance
  et gestion d'un stockage local indisponible.

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
