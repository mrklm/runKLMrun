# Historique des versions

## v0.15.2 — 2026-10-29 — Profils et chaussures

- Profils : commandes de création, modification et suppression indisponible regroupées dans un panneau repliable, avec des sélecteurs indépendants et adaptés au mobile.
- Accueil : suivi de une à trois paires actives, avec priorité à la paire de la dernière sortie, kilométrage, limite personnelle et alertes d’usure réelles.
- Accueil : nouveau visuel local des chaussures, cliquable vers leur gestion et adapté aux thèmes et aux petits écrans.

## v0.15.1 — 2026-10-28 — Identité graphique

- Identité graphique : titre de l’application remplacé et ajusté dans l’en-tête ; numéro de version repositionné.

## v0.15.0 — 2026-10-28 — Profils multiples et Coach V2

### Ajouté

- Gestion locale de plusieurs profils coureurs, avec isolation des données sportives.
- Tests d’isolation, de changement de profil et de suppression sécurisée des données.

### Modifié

- Le Coach V2 devient l’unique interface publique de recommandations.
- Les anciennes suggestions du Coach V1 ne sont plus actualisées automatiquement.
- Calendrier, sauvegardes et tests E2E adaptés à l’architecture multiprofils.

### Sécurité

- La suppression des profils reste désactivée dans l’interface publique.
- Les données historiques restent prises en charge lors des migrations et restaurations.

## v0.14.3 — 2026-10-25 — Identité graphique

- Identité graphique : nouveau titre et photographie de démarrage ; numéros de version repositionnés et plus lisibles.

## v0.14.2 — 2026-10-24 — Parcours GPS

- Parcours GPS : section dépliable, ouverte automatiquement lorsqu’un parcours est disponible et repliée avec l’indication « Parcours GPS · Indisponible » sans coordonnées.
- Carte : chargée seulement à l’ouverture ; Leaflet est démonté à la fermeture. En-tête accessible au clavier et adapté au mobile.

## v0.14.1 — 2026-10-24 — Aide

- Aide : nouvel onglet expliquant l’enregistrement et l’import des séances, les sauvegardes, le Coach, la carte GPS et le fonctionnement local de l’application.

## v0.14.0 — 2026-10-23 — Cartographie des parcours GPS

### Nouvelle fonctionnalité

- Visualisation des parcours GPS sur fond OpenStreetMap, affichée automatiquement dans les fiches séances disposant de coordonnées exploitables.
- Marqueurs de départ et d’arrivée, cadrage automatique du parcours et affichage adapté aux écrans mobiles.
- Respect des interruptions GPS et séparation du tracé au franchissement de l’antiméridien ; affichage de la position lorsqu’un seul point est disponible.

### Améliorations techniques

- Chargement différé de Leaflet uniquement lorsqu’une carte est nécessaire ; attribution OpenStreetMap conservée.
- Coordonnées GPS conservées localement, sans envoi du parcours à une API externe ; seules les tuiles cartographiques sont chargées auprès du fournisseur.
- Messages adaptés aux séances sans données GPS exploitables et aux fonds cartographiques indisponibles.
- Tests unitaires de préparation des parcours et tests Playwright de la cartographie, des écrans mobiles, de la navigation et de la stabilité de la carte pendant les interactions avec les formulaires.
- Politique de conservation des détails inchangée : 30 jours, sans migration des données existantes.

## v0.13.3 — 2026-10-23 — Fiabilité des séances et des tests

- Séances : clés React distinctes pour le ressenti et le type d’entraînement, afin d’éviter l’accumulation des formulaires « Votre ressenti » lors des navigations.
- Initialisation React : réutilisation de la racine existante lors d’une réévaluation du module d’entrée.
- Tests : contrôle de l’unicité du formulaire après plusieurs navigations et de l’absence d’avertissement de clés dupliquées.
- Coach V2 : scénario de calendrier à date et fuseau fixes ; test de présentation concurrente initialisé dans une base dédiée, avec vérification d’une seule occurrence persistée.
- Tests : maintien du rejet des entrées invalides de la stratégie V2, notamment des références non entières.

## v0.13.2 — 2026-10-22 — Coach V2

- Coach V2 : durée de référence habituelle arrondie à la seconde pour la stratégie, y compris après confirmation ; les calculs de validité conservent la médiane exacte.

## v0.13.1 — 2026-10-21 — Identité visuelle

- Accueil : icône remplacée par le coureur, affiché à deux fois la taille précédente.
- Version centrée sous le titre avec une opacité de 20 %, sans décaler la mise en page.
- Pied de page : nom de l’application et version centrés ensemble.

## v0.13.0 — 2026-10-21 — Coach V2 adaptatif

- Coach V2 : suggestions adaptées à l’objectif, au tempérament et aux activités réellement effectuées ; les protections de récupération et les espacements restent inchangés.
- Coach V2 : confirmation de la durée habituelle depuis un historique réel admissible, reconnaissance encadrée de la progression et types complémentaires pour l’objectif endurance.
- Variations modérées : correction du seuil voisin de 30 min, sans modifier le coefficient, les autres types de séance ni la disponibilité déclarée.
- Activités : champ facultatif « Type d’entraînement » modifiable sur les séances existantes ; six types déclaratifs, conservés dans les sauvegardes et compatibles avec les anciennes données, sans qualification GPS automatique.
- Perspectives : diversité selon les séances admissibles, indicatives et révisables, sans assimilation à des activités réalisées ni nouvelle persistance ; cohérence Accueil / Calendrier.

## v0.12.0 — 2026-10-20 — Suggestions et paramètres

- Coach : calendrier synchronisé avec la suggestion V2 courante et ses perspectives révisables, sans écriture supplémentaire.
- Interface : suggestions homogènes, activités récentes et type de Coach repliés par défaut.
- Paramètres : bilan Coach, chaussures et sauvegardes accessibles dans des sections repliables ; titres harmonisés.

## v0.11.0 — 2026-10-20 — Coach V2 public

- Coach V2 devient le Coach principal en développement comme en production, sans activation locale ; le moteur V1 reste disponible comme secours dans le code.
- Accueil et entraînement : suppression du double affichage V1/V2 ; le comparateur V1/V2 reste réservé au développement.
- Calendrier public : les suggestions futures V1 sont masquées, sans suppression des données historiques.
- Suggestions : présentation unifiée des séances et perspectives révisables, avec trois cartes au fond thématique et une bordure d’accent pour la prochaine séance.
- Données, associations, sauvegardes et occurrences historiques conservées sans migration.

## v0.10.1 — 2026-10-20 — Horaires et interface

- Activités : affichage local des horodatages zonés, tout en conservant les heures source sans fuseau.
- Nouveaux imports Polar et TCX : date civile cohérente près de minuit, sans migration des activités existantes.
- Interface : D+ arrondi à l’affichage, durées du calendrier au format `hh:mm:ss`, résumé des activités enrichi et paramètres simplifiés.

## v0.10.0 — 2026-10-20 — Coach V2 adaptatif

- Type de Coach : sélecteur à trois boutons, accessible et adapté aux écrans mobiles.
- Coach V2 : récupération renforcée après un ressenti très difficile récent.
- Coach V2 : relief réel documenté pris en compte de manière qualitative, sans déduire de préférence ni créer de séance de côtes.
- Coach V2 : ajout d’une endurance à allure modulée, distincte du fractionné rapide.
- Coach V2 : progression de durée limitée à des preuves d’historique réel régulier, sans cumul automatique.
- Perspectives V2 : une seule évolution de durée possible sur sept jours, indicatives et révisables selon les activités réelles.
- Explications V2 : motifs plus clairs pour maintien, récupération, relief, variations et progression.

## v0.9.0 — 2026-10-18 — Type de Coach et Coach V2

- Accueil : les activités récentes incluent désormais la dernière course enregistrée et conservent l’ordre chronologique.
- Ajout du réglage « Type de Coach » : Pas à Pas, Évolution Active et Rentre dedans.
- Coach V2 : prise en compte temporaire d’un ressenti difficile déclaré sur une activité réelle, sans assimiler les suggestions à des activités.
- Coach V2 : différenciation des propositions selon le tempérament, après les protections sportives communes.
- Espacements, récupération, plafonds, accès au fractionné, disponibilités et contraintes d’historique restent inchangés pour les trois tempéraments.
- Les profils contenant `coachTemperament` ne sont pas compatibles avec les anciennes versions qui rejettent ce nouveau champ.

## v0.8.1 — 2026-10-18 — Simplification de l’interface Coach

- Accueil : résumé des périodes visible et observations détaillées repliées par défaut, avec bouton accessible « Afficher les détails » / « Masquer les détails », sans modification de leur contenu.
- Lien vers la configuration et l’ancien planning personnel déplacé sous les observations, avec conservation de la route `#/entrainement`.
- Configuration du Coach : libellé du programme structuré simplifié en « Propositions autorisées », sans changement de logique.
- Correction du test des suggestions V2 ignorées : vérification explicite qu’une présentation ne devient pas une activité et n’impose pas de récupération, tout en conservant les contraintes des activités réelles.
- Aucun changement des règles sportives, des sauvegardes ou de l’activation interne de V2.

## v0.8.0 — 2026-10-18 — Coach V2 expérimental et perspectives sur sept jours

- Coach V2 réservé au mode interne : comparaison en lecture seule avec V1, explications en français, durées lisibles et limites explicites.
- Référence de durée fondée sur les activités réelles, avec distinction entre repère provisoire et confirmé ; catalogue de séances soumis aux critères d'admissibilité V2.
- Prochaine séance accompagnée de perspectives facultatives et révisables sur sept jours, selon les disponibilités et les plafonds enregistrés. Espacement entre intentions, sans progression automatique ni assimilation à des activités réalisées.
- Présentations séparées de l'espacement sportif ; à partir de 18 h locales, les nouveaux calculs commencent demain sans prolonger l'horizon.
- Renouvellement à la consultation ou au retour sur l'onglet, sans minuteur à minuit ; conservation des propositions présentes et futures compatibles.
- Priorité aux activités réelles pour la compatibilité sportive ; une association ne transfère pas le type conseillé à l'activité effectuée.
- Persistance des propositions effectivement présentées, conservation de l'historique et des associations tardives, déduplication transactionnelle entre onglets. Les perspectives seules ne créent pas d'occurrences persistées.
- Sauvegarde au format 6 des occurrences V2 avec contrôle d'intégrité et compatibilité des formats précédents, issue des phases préparatoires.
- V2 reste expérimental et non activé publiquement ; aucune sanction ni séance de rattrapage pour une suggestion non suivie.

## v0.7.0 — 2026-10-17 — Suggestions libres et espace Courses

- Coach : jusqu’à trois suggestions facultatives sur sept jours, avec variation prudente des durées selon la pratique et les disponibilités.
- Mémorisation des suggestions réellement présentées, rapprochement factuel avec les sorties et informations temporaires sur les suggestions passées.
- Navigation simplifiée : Accueil, Courses et Paramètres ; accueil recentré sur les sorties et le Coach.
- Courses réunit importation, saisie manuelle, statistiques, calendrier mensuel et historique repliable ; anciennes routes conservées.
- Ressenti facultatif à quatre niveaux et commentaire personnel, modifiables après chaque sortie.
- Sauvegarde des suggestions et annotations, compatibilité avec les anciens fichiers et protections contre les conflits entre onglets.

## v0.6.1 — 2026-10-16 — Amélioration du Coach et synchronisation des données

### Améliorations
- Le Coach peut proposer une séance d'endurance à partir de trois références récentes cohérentes.
- Amélioration de la cohérence des propositions et des diagnostics du Coach.
- Actualisation automatique des activités après importation TCX ou Polar.
- Synchronisation des données entre plusieurs onglets du navigateur.
- Actualisation du profil, de la configuration et du planning du Coach.
- Protection contre les réponses asynchrones obsolètes.
- Conservation des saisies lors des conflits entre onglets.

### Fiabilité
- Centralisation des notifications après validation des écritures.
- Gestion des imports successifs et partiellement réussis.
- Ajout de tests fonctionnels et de tests navigateur.

## v0.6.0 — 2026-10-15 — Premier Coach évolutif

### Coach

- feat(coach): réunir l’accompagnement dans un Coach unique, avec sept objectifs
  de course et déclaration facultative de l’expérience du coureur.
- feat(coach): analyser les habitudes récentes et historiques, comparer les périodes
  et expliquer les observations personnalisées, y compris avec des données partielles.
- feat(coach): proposer une prochaine séance selon les références disponibles,
  les disponibilités et les préférences de terrain, avec durées par pas de cinq minutes.
- feat(planning): demander un consentement explicite et permettre d’accepter,
  modifier, déplacer ou annuler les séances dans le planning personnel.
- style(coach): simplifier les explications des propositions, accessibles à la demande.
- feat(sauvegarde): conserver la configuration et les séances planifiées dans les
  sauvegardes JSON/gzip, avec lecture des anciennes sauvegardes.

Le Coach ne génère pas de programme automatique sur plusieurs semaines et ne
rapproche pas automatiquement les séances prévues et réalisées. Aucune adaptation
après une séance manquée, analyse de fatigue subjective ou météo réelle n’est annoncée.

### Importation TCX

- fix(tcx): ignorer les mesures facultatives inutilisables avec avertissement et
  distinguer les erreurs de fichier, de format et les erreurs techniques.
- feat(tcx): estimer le D+ depuis les altitudes avec filtrage, sans changer les
  identifiants ; signaler les estimations partielles et les conserver dans les sauvegardes.
- fix(affichage): présenter les fréquences cardiaques sans décimale et le D+ avec
  trois décimales maximum, en français, sans arrondir les données enregistrées.

### Conservation des données

- feat(conservation): nettoyer automatiquement les détails expirés après 30 jours
  au démarrage et après import réussi, en conservant les résumés permanents.
- refactor(conservation): retirer l’action manuelle, protéger les dates incertaines
  et coordonner nettoyage et restauration entre onglets, avec transactions par lots.

### Interface

- feat(interface): différer de 400 ms les indicateurs des imports, sauvegardes et
  restaurations, sans durée minimale ni faux pourcentage ; protéger les actions incompatibles.
- style(chaussures): présenter les modes de suivi sous forme de cartes accessibles,
  adaptées aux thèmes et aux écrans mobiles, avec restitution du focus clavier.

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
