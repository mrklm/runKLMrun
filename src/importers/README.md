# Import Polar — v0.3.0

L'import est local : pas d'API Polar à l'exécution, de télémétrie, d'envoi de
fichier, de copie du ZIP dans le dépôt ou de journalisation des données sportives.

## Deux schémas acceptés

Le ZIP doit être lisible et non chiffré. Seuls les noms finaux
`training-session_*.json` et `training-session-*.json` sont traités, y compris en
sous-dossier et sans distinction de casse. Les fichiers sommeil, activité et
profil sont ignorés sans décompression. Le JSON doit être strict et contenir
`exercises` avec **un seul exercice**.

- **Schéma initial** : `exercises[0].sport` est une chaîne comme `RUNNING`,
  `duration` est une durée ISO 8601, les séries contiennent des couples `time/value`.
- **Schéma observé dans les archives réelles** : `sport` est un objet `{id: "…"}`,
  les durées sont numériques en millisecondes, les séries sont typées et régulières.
  `polar.ts` délègue ce schéma à `polar-modern.ts`. Le pipeline ZIP, le worker et
  le stockage existants sont conservés.

Les fixtures de tests sont entièrement synthétiques. Aucune séance réelle, même
anonymisée, n'est intégrée aux tests ou à la documentation.

## Identification du sport et sources

Le titre (`name`) n'est jamais utilisé. Ni distance, ni vitesse, ni sous-chaîne
ne servent à deviner le sport. La correspondance numérique est une liste exacte.

| Code `sport.id` | Signification vérifiée | Traitement |
| --- | --- | --- |
| `1` | Running / course à pied | Import |
| `2` | Cycling / cyclisme | Autre sport |
| `16` | Other outdoor / autre sport extérieur | Autre sport |
| `11`, `23`, `103` | Correspondance non vérifiée | Sport non reconnu, rejet explicite |
| Tout autre code | Inconnu | Sport non reconnu, rejet explicite |

Les codes `1`, `11`, `16`, `23`, `103` ont été observés localement. Seuls les codes
vérifiés sont classés ; aucune correspondance n'est tirée des titres des séances.
Source officielle des codes `1`, `2`, `16` :
[Polar BLE SDK, `PolarExerciseSession.SportProfile`](https://github.com/polarofficial/polar-ble-sdk/blob/master/sources/iOS/ios-communications/Sources/PolarBleSdk/sdk/api/model/PolarExerciseSession.swift).
Les autres correspondances restent à établir ; le catalogue pris en charge n'est
pas un catalogue complet des sports Polar.

Pour le schéma textuel, les courses reconnues restent exactement : `RUNNING`,
`ROAD_RUNNING`, `TRAIL_RUNNING`, `TREADMILL_RUNNING`, `TRACK_AND_FIELD_RUNNING`,
`ULTRARUNNING_RUNNING`, `JOGGING`, `CROSS_COUNTRY_RUNNING`.
Les autres sports explicitement reconnus sont listés dans `OTHER_SPORTS` de
`polar-sports.ts` (cyclisme, marche, natation, etc., dont `WATER_RUNNING`, jamais
classé comme course à pied). L'import ZIP signale toute autre chaîne comme inconnue.
L'appel historique à deux arguments de `parsePolar` garde son retour `null` pour
les chaînes exclues ; le ZIP active le classement strict du troisième argument.
Référence des noms textuels : [catalogue Polar](https://www.polar.com/accesslink-api/#sport).

## Résumés et unités

Les chemins sont relatifs à l'exercice, sauf mention « racine ». Les champs
facultatifs absents ou `null` restent absents. Aucun remplacement automatique par
zéro. Aucun calcul de charge sportive ; seule l'allure moyenne est dérivée.

| Donnée interne | Schéma initial | Schéma réel | Unité interne |
| --- | --- | --- | --- |
| `polarId`, clé `polar:<id>` | Racine `id`, puis `identifier.id`, sinon suffixe du nom de fichier | Identique | Identifiant source |
| `sport` | Code textuel | Correspondance vérifiée de `sport.id` | Code Polar textuel |
| `polarSportId` | Non renseigné | `sport.id` | Code numérique original sous forme de chaîne |
| Date/heure | `startTime`, sinon racine | Identique | Chaîne originale et date civile séparée |
| Décalage UTC | Non renseigné | `timezoneOffsetMinutes`, sinon racine | Minutes, sans inventer de fuseau |
| Durée | `duration`, sinon racine, ISO `P…DT…H…M…S` | `durationMillis`, sinon racine | Secondes, division par 1000 pour les millisecondes |
| Distance | `distance` | `distanceMeters`, sinon racine | Mètres |
| FC moyenne/maximale | `heartRate.average/maximum` | `statistics.statistics[]` de type `STATISTICS_TYPE_HEART_RATE`, champs `avg/max`, puis `hrAvg/hrMax` de l'exercice ou de la racine | bpm |
| Dénivelé + / − | `ascent/descent` | `ascentMeters/descentMeters` | Mètres |
| Running Index | Nombre `runningIndex` ou `.value` | Nombre `runningIndex` | Indice fourni par Polar |
| Charge cardiovasculaire | `trainingLoadPro.cardioLoad`, puis `trainingLoad.cardioLoad`, puis `cardioLoad` | `trainingLoadReport.cardioLoad`, exercice puis racine | Score cardiovasculaire Polar |
| Allure | Durée / distance × 1000 | Identique | Secondes/km, uniquement si durée et distance positives |

La priorité des statistiques FC évite de confondre vitesse, cadence et fréquence
cardiaque. Les autres statistiques typées ne sont pas utilisées pour la FC.
La charge Polar n'est **ni sRPE, ni muscleLoad, ni perceivedLoad**, ni un calcul
runKLMrun. Le champ global `trainingLoad` n'est pas assimilé à `cardioLoad`.

Le modèle exige une durée. Une course sans durée à la fois dans l'exercice et à
la racine est rejetée avec le motif **Durée manquante**. Aucun calcul à partir des
dates, des séries ou du GPS ne remplace cette information ; aucune allure n'est créée.

Pour le schéma réel, les nombres renseignés doivent être numériques, finis et
compris dans une plage sûre. Durées, distances, FC, cadence, charges et dénivelés
sont non négatifs ; les altitudes peuvent être négatives. Une durée nulle avec
une distance positive, une FC moyenne supérieure à la maximale, des bornes de
zone inversées ou des temps GPS décroissants produisent **Données numériques
invalides**. Les valeurs numériques sous forme de chaîne ne sont pas converties
implicitement. Le schéma initial conserve son filtrage des mesures facultatives
invalides pour compatibilité.

## Séries temporelles

Le schéma réel utilise `samples.samples[]` avec `type`, `intervalMillis` et
`values`. Les cinq types observés sont pris en charge :

| Type | Unité Polar confirmée | Stockage |
| --- | --- | --- |
| `HEART_RATE` | bpm | `details.heartRate`, bpm |
| `SPEED` | km/h | `details.speed`, m/s (division par 3,6) |
| `CADENCE` | tours/minute (rpm) | `details.cadence`, même unité, aucun doublement |
| `ALTITUDE` | mètres | `details.altitude`, mètres |
| `DISTANCE` | mètres | `details.distance`, mètres |

Source des unités : [définitions officielles Polar `PbSampleType` et `PbDataType`](https://github.com/polarofficial/polar-ble-sdk/blob/master/sources/Android/android-communications/library/src/sdk/proto/types.proto).

L'échantillon d'indice `i` garde `timeSeconds = i × intervalMillis / 1000`.
L'intervalle doit être strictement positif. Chaque flux garde son propre intervalle.
`"NaN"` et `null` deviennent `value: null` : toutes les positions sont conservées,
sans interpolation. Un nombre incohérent ou une autre chaîne produit un rejet
numérique explicite. Deux flux du même type sont rejetés comme structure ambiguë
plutôt que d'en écraser un. Les types non pris en charge sont ignorés, sans
conversion d'unité supposée.

Le schéma initial conserve `samples.heartRate/speed/cadence/altitude[]`, avec
`time` ISO 8601 → secondes et `value`. Les trous `"NaN"`/`null` dont le temps est
valide sont également conservés. Les temps invalides restent filtrés comme avant.

## GPS et zones cardiaques

Le nouveau schéma lit `routes.route.wayPoints[]` dans l'ordre d'origine :
`elapsedMillis / 1000` → `timeSeconds`, coordonnées en degrés et altitude en
mètres. Les temps sont relatifs au début de la route ; `gpsStartTime` conserve
`route.startTime` si fourni. Sans cette origine, aucun horodatage absolu n'est
inventé. Les coordonnées `"NaN"`/`null` restent nulles à leur position ; des
coordonnées hors limites sont rejetées. Les routes de transition multisport ne
sont pas importées. Le schéma initial conserve `recordedRoute[]` avec `time`
ISO 8601 et son filtrage des points invalides.

Seuls les groupes `zones[]` dont `type === "ZONE_TYPE_HEART_RATE"` sont importés.
Dans leur tableau `zones`, `lowerLimit/higherLimit` sont en bpm et `inZone` est
converti de millisecondes en secondes. Les groupes de vitesse sont ignorés.
Un temps de zone absent reste `durationSeconds: undefined` ; les limites sont
conservées, sans inventer un temps nul. Le schéma initial lit toujours
`zones.heartRate[]`, `lowerLimit/upperLimit`, `inZone` ISO 8601.
Source : [schémas officiels Polar, `trainingsessionZone`, `Route`, `IntervalValues`](https://www.polar.com/polar-api-v4/).

## Erreurs, mémoire et stockage

Le bilan agrège séparément : JSON invalide, structure non reconnue, sport non
reconnu, autre sport, identifiant manquant/invalide, date invalide/absente, durée
manquante, données numériques invalides, fichier trop volumineux, décompression/
intégrité, chiffrement. Les motifs proviennent de messages fixes, sans identifiant,
nom de fichier, titre, date ou coordonnée. Au plus 20 détails numérotés sont affichés,
mais les compteurs agrégés couvrent toute l'archive. Le premier motif rencontré
est retenu pour chaque fichier. Les sports vérifiés hors course sont ignorés avant
l'analyse de leurs mesures ; les sports inconnus restent dans les rejets.

Un fichier invalide n'arrête pas les autres. Une erreur IndexedDB interrompt
l'import avec un message distinct. Les séances déjà validées restent conservées.
Un ZIP dont le catalogue est illisible produit une erreur globale.

Le Web Worker utilise `BlobReader` (lecture par plages) et traite un seul JSON à
la fois. Limite : **64 Mio décompressés par fichier**, pas de limite globale
artificielle. Le catalogue du ZIP reste en mémoire ; chaque JSON et ses objets
peuvent occuper davantage de mémoire que leur taille brute. La progression compte
les fichiers terminés. La navigation interne reste possible ; fermer/recharger
l'onglet arrête l'import et une réimportation peut le reprendre.

IndexedDB v2 conserve les résumés dans `sessions` et les détails dans `details`.
L'ajout est atomique et ne remplace jamais une clé existante, même si l'export a
changé. Les migrations et la politique de dédoublonnage restent inchangées.

## Limites connues

- Correspondances sportives numériques limitées aux codes vérifiés ci-dessus.
- Multisport, GPX/TCX/FIT/CSV, archives chiffrées et JSON avec le jeton non standard
  `NaN` non pris en charge. La chaîne JSON valide `"NaN"` est prise en charge.
- Pas de courbes/cartes dans cette version ; lecture à la demande par
  `SessionRepository.getDetails(id)`.
- Sans identifiant dans le JSON, renommer le suffixe du fichier change la clé.
- Champs, types de série et statistiques non documentés ici non conservés.
- Des valeurs réellement invalides dans un champ reconnu du nouveau schéma
  peuvent entraîner le rejet de la séance entière ; elles ne sont pas corrigées
  arbitrairement.
