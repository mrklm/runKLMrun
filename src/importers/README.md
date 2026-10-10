# Import Polar — v0.4.0

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

## Import de fichiers TCX — v0.4.0

Le parcours `tcx.ts` → `tcx-files.ts` → `SessionRepository.addImported()` est
indépendant de l'import ZIP/JSON. `PolarImport` propose un sélecteur commun ZIP/TCX et permet de sélectionner plusieurs
fichiers, traités séquentiellement avec un compte rendu par fichier : ajout,
doublon, fichier invalide ou sport non pris en charge. Les erreurs de stockage
interrompent le lot et conservent les ajouts déjà validés. Aucun contenu personnel
ni nom de fichier n'apparaît dans les messages d'erreur.

Le navigateur utilise son `DOMParser` natif. `@xmldom/xmldom` est une dépendance
**de développement uniquement**, utilisée pour les tests Node. Aucun accès réseau
n'est réalisé par l'importateur. Les DTD et déclarations d'entités sont refusées.
La limite est de **16 Mio par fichier** ; XML, objets et empreinte sont en mémoire.
La lecture XML est synchrone sur le fil principal ; le navigateur reprend la main
entre les fichiers. La sélection et les compteurs suivent les styles des thèmes.

### Périmètre et données

TCX v2 avec l'espace de noms officiel, une seule `Activity` par fichier et
`Sport="Running"`. Les espaces de noms sont interprétés indépendamment de leurs
préfixes. Les autres sports sont comptés à part, sans déduction depuis le titre.
Les fichiers multi-activités, multisports et les parcours `Courses` ne sont pas
pris en charge. Plusieurs `Lap` deviennent **une seule séance**.

- Départ : `StartTime` du premier tour. Les dates doivent comporter un fuseau
  explicite (`Z` ou décalage). `Activity/Id`, généralement une date, n'est pas
  utilisé seul comme identifiant de séance.
- Durée : somme des `TotalTimeSeconds` des tours, obligatoires. C'est la durée
  fournie, qui peut différer du temps écoulé en présence de pauses.
- Distance : somme des `DistanceMeters` des tours seulement si tous sont connus.
  Aucun total partiel ni estimation depuis le GPS n'est enregistré comme total.
- FC : courbe `HeartRateBpm/Value` en bpm. Moyenne des tours pondérée par leur
  durée uniquement si toutes les moyennes sont fournies ; maximum des maxima
  uniquement si tous sont disponibles. Aucun calcul depuis une série lacunaire.
- Altitude : `AltitudeMeters` en mètres, valeurs négatives acceptées.
- Vitesse : extension `ActivityExtension/v2`, `TPX/Speed`, en m/s, sans division
  par 3,6. Sans cette extension, aucune vitesse n'est déduite des distances.
  L'allure moyenne est dérivée de durée/distance ; la fiche dérive sa courbe
  d'allure de la vitesse, en conservant les interruptions.
- Cadence : `TPX/RunCadence`, sinon `Trackpoint/Cadence`. Les nombres sont
  conservés sans conversion. `cadenceUnit: 'source'` empêche la fiche d'attribuer
  arbitrairement l'unité Polar rpm ou des pas/minute à ces valeurs TCX.
- Distance des points : valeurs source en mètres, sans correction des remises
  à zéro éventuelles entre tours. Elles ne servent pas à calculer la vitesse.
- GPS : latitude/longitude en degrés et altitude en mètres. Les coordonnées
  absentes, non numériques ou hors limites deviennent nulles ; les autres
  mesures du point restent conservées. Un tracé sans aucune paire valide n'est
  pas enregistré. Aucun filtre des sauts géographiques n'est appliqué.
- Tours : leurs débuts, durées et distances sont conservés dans `details.laps`.
  Leur affichage individuel n'est pas ajouté à cette étape.

Chaque temps de point est la différence en secondes entre `Trackpoint/Time` et
le début de séance, sans arrondi ni rééchantillonnage. Temps absents, invalides,
antérieurs au départ ou décroissants : fichier invalide. Les intervalles peuvent
être irréguliers, les temps égaux sont conservés. Les mesures manquantes restent
nulles au bon instant ; une rupture explicite est ajoutée entre les pistes.
Les séries entièrement absentes ne sont pas inventées. Les autres nombres
renseignés invalides entraînent le rejet du fichier. Il n'y a pas de validation
XSD exhaustive ; seuls la structure et les champs utilisés sont contrôlés.

Charge cardio, Running Index, zones cardiaques, dénivelés, puissance, calories,
notes et extensions propriétaires non décrites ici ne sont pas importés. Aucun
calcul de dénivelé depuis l'altitude ni aucune interpolation ne les remplace.

Références de structure : [TrainingCenterDatabase v2](https://www8.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd)
et [ActivityExtension v2](https://www8.garmin.com/xmlschemas/ActivityExtensionv2.xsd).
Les tests sont synthétiques ; la compatibilité avec chaque variante d'export
Polar Flow n'est pas une garantie de validation sur des fichiers réels.

### Dédoublonnage et conservation

L'identifiant TCX est `tcx:<SHA-256 du contenu normalisé importé>`. Il ne dépend
pas du nom de fichier ni de la mise en forme XML. Le contrôle par clé existant
reste prioritaire et n'écrase jamais résumé ou détails.

Pour chaque **nouvel import TCX**, un contrôle complémentaire compare les résumés
TCX et Polar existants dans la même transaction IndexedDB. Il exige simultanément :

1. Deux sports reconnus comme course à pied.
2. Des débuts convertibles en temps absolu, distants d'au plus **1 seconde**.
3. Des durées positives connues, distantes d'au plus **2 secondes**.
4. Des distances positives connues, distantes d'au plus **min(5 mètres, 0,2 % de
   la plus petite distance)**.

Un départ Polar sans suffixe de fuseau n'est comparable que si son
`timezoneOffsetMinutes` est enregistré. Le fuseau du navigateur n'est jamais
supposé. Sans mesure complète ou fuseau fiable, l'import est conservé ; une
ressemblance de distance seule ne suffit jamais. Les tolérances ne constituent
pas une preuve absolue d'identité mais sont volontairement étroites.

Le contrôle et l'ajout résumé/détails sont atomiques : deux imports TCX
concurrents ne contournent pas ce contrôle. **Le parcours ZIP/JSON reste inchangé** :
une archive importée après un TCX conserve sa détection par identifiant Polar ;
le rapprochement complémentaire est effectué uniquement lors de l'ajout TCX.
Importer l'archive initiale avant les nouveaux fichiers TCX est le parcours prévu.
Aucune déduplication rétroactive ni suppression n'est effectuée.

`RunningSession.source`, `SessionDetails.laps` et `cadenceUnit` sont facultatifs.
Les magasins `sessions` et `details`, leurs clés et la version IndexedDB 2 restent
inchangés. Les anciennes données ne sont ni migrées ni réécrites.


### Interface unifiée et comptes rendus

Dans Paramètres, la section **Importer des séances Polar** propose un seul
sélecteur acceptant ZIP et TCX (sans distinction de casse), suivi d’un bouton
**Importer les séances**. `selectPolarFiles` valide la sélection avant le traitement :
un ZIP unique ou plusieurs TCX. Aucun lot mixte ni lot de plusieurs ZIP n’est lancé.
Les `File` sont copiés avant réinitialisation du champ et au lancement du lot.

Le ZIP utilise toujours `polar.worker.ts` et `importPolarArchive`. Le TCX utilise
`importTcxFiles`. `ImportReportView` présente les deux rapports via des adaptateurs
sans inventer de compteur. Pour le ZIP, le total est celui des JSON d’entraînement
reconnus dans l’archive ; pendant sa lecture initiale, la progression est
indéterminée. Une archive sans entraînement est signalée explicitement sans 0/0.
Pour le TCX, chaque fichier sélectionné est compté, même rejeté. Un arrêt sur erreur
de stockage conserve le nombre réellement traité et affiche une alerte.

Les motifs de rejet détaillés (20 maximum) ne contiennent ni nom de fichier ni
donnée personnelle. Les moteurs, limites de taille et règles de dédoublonnage
ne changent pas. Les anciennes sections distinctes sont remplacées par ce parcours.
