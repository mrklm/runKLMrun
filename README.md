# runKLMrun — v0.6.1

Socle d’une application web open source de suivi et de planification des
entraînements de course à pied. Interface en français, responsive, sans compte,
sans serveur applicatif et sans service payant. Les données sportives restent
dans IndexedDB, sur le navigateur et l’appareil utilisés.

## Prérequis et installation

Node.js 22.12 ou supérieur et npm sont nécessaires.

```bash
git clone https://github.com/mrklm/runKLMrun.git
cd runKLMrun
npm install
```

Le fichier `package-lock.json` fixe les versions installées. Utilisez `npm ci`
pour une installation reproductible, notamment dans l’intégration continue.

## Développement

```bash
npm run dev
```

Ouvrez l’URL indiquée par Vite, généralement
<http://localhost:5173/runKLMrun/>.

## Tests

```bash
npm test
npm run test:watch
# Mesure expérimentale séparée, sur 3 000 résumés synthétiques :
npm run test:performance
```

Vitest exécute les tests unitaires. Les tests du stockage utilisent
`fake-indexeddb` et vérifient une base vide, la persistance après réouverture et
les migrations v1 → v2 → v3, le profil du coureur, les doublons, les détails, les conversions et les erreurs d’import. Leurs données sont isolées : aucune donnée sportive
de démonstration n’est injectée dans l’application.

## Compilation et aperçu

```bash
npm run build
npm run preview
```

La compilation vérifie TypeScript puis génère les fichiers statiques dans
`dist/`. L’aperçu est généralement accessible à
<http://localhost:4173/runKLMrun/>. Les commandes `dev` et `preview` sont des outils
locaux de développement : l’application publiée ne nécessite aucun serveur applicatif.

## GitHub Pages

La base Vite est configurée à `/runKLMrun/`. La navigation par fragment
(`#/historique`, `#/entrainement`, `#/parametres`) permet de rafraîchir ou d’ouvrir
une page directement sans règle de réécriture serveur.

Le workflow `.github/workflows/pages.yml` installe les dépendances, teste,
compile et publie `dist/` lors d’un push sur `main`, ou d’un déclenchement manuel.
Pour l’utiliser, choisissez **GitHub Actions** dans **Settings → Pages → Build
and deployment → Source** du dépôt. URL prévue :
<https://mrklm.github.io/runKLMrun/>. Aucune publication n’est réalisée par la
simple création de ce socle local.

## Architecture

```text
src/
├── components/        # Composants de présentation réutilisables
├── pages/             # Accueil, Historique, Entraînement, Paramètres
├── core/              # Agrégations métier, sans React ni stockage
│   ├── analysis/       # Totaux, regroupements calendaires et semaines ISO
│   ├── planning/       # Réservé à la planification
│   └── safety/         # Réservé aux règles métier de sécurité
├── importers/         # Import Polar local dans un Web Worker
├── storage/           # Contrats et accès IndexedDB
└── types/             # Types partagés indépendants de React
```

L’interface lit les sorties via le contrat `SessionRepository`. Le dépôt
IndexedDB expose la lecture, l’enregistrement et l’ajout transactionnel sans
écrasement des séances Polar. Les états de chargement, de base vide et d’erreur sont distincts.
Les Paramètres restent accessibles en cas d’erreur de stockage. Entraînement
utilise les mêmes états de chargement et d’erreur que les pages fondées sur les résumés.

Les agrégations de résumés restent indépendantes de React, du DOM et d’IndexedDB.
Le Coach propose une prochaine séance et un planning personnel ; aucun programme automatique sur plusieurs semaines ni calcul de charge sportive n’est implémenté. Recharts affiche
les statistiques ; son code est chargé à l’ouverture de la page Statistiques.
L’importateur Polar est disponible dans Paramètres ; son périmètre exact est décrit ci-dessous.

## Données et prochaines étapes

La base `runklmrun`, version 7, contient les résumés, les détails, le profil,
les chaussures et leurs associations, la configuration du Coach et le planning
personnel. Les migrations sont additives. Il n’y a ni
synchronisation ni envoi des activités à un service distant. Effacer le stockage
du site supprime les données ; le mode privé peut limiter ou supprimer la
persistance. Le stockage dépend de l’origine du site et n’est pas partagé entre
navigateurs ou appareils. Le démarrage hors connexion n’est pas garanti : aucun
service worker n’est installé. Les sauvegardes peuvent être traitées hors ligne
par l’application de production déjà chargée.

Les sauvegardes locales sont disponibles dans **Paramètres → Données et sauvegardes**.
Le format JSON versionné, exporté en gzip, inclut les séances, leurs détails
encore présents, le profil, les chaussures, la configuration du Coach et le planning. Consultez
la [documentation du format et de la restauration](src/backup/README.md).

## Tester l'import Polar

1. Lancer `npm run dev`, puis ouvrir **Paramètres → Importer des données Polar**.
2. Sélectionner localement le ZIP d'export de compte Polar. Ne jamais le copier
   dans le dépôt. Attendre le compte rendu ; les autres pages restent utilisables.
3. Ouvrir **Historique** : date/heure, distance, durée, allure, FC moyenne et
   dénivelé positif des courses reconnues sont affichés, sans données fictives.
4. Recharger la page pour vérifier la persistance, puis réimporter le même ZIP :
   le compte rendu indique les doublons et aucune séance n'est remplacée.
5. Un faux fichier `.zip` ou un JSON invalide dans un ZIP permet de vérifier
   les messages d'erreur. Les tests automatisés créent leurs archives synthétiques
   en mémoire (`npm test`) ; aucune archive personnelle n'est nécessaire.

Le traitement, la décompression et l'écriture IndexedDB restent locaux.
Les seuls fichiers lus sont `training-session_*.json` et `training-session-*.json`.
Deux schémas sont acceptés, avec un unique exercice : sport textuel et durée
ISO 8601 (compatibilité initiale), ou `sport.id` et `durationMillis` (format réel).
Les codes numériques vérifiés sont `1` (course), `2` (cyclisme) et `16` (autre sport
extérieur). Les codes non vérifiés, notamment `11`, `23`, `103`, restent inconnus ;
aucun sport n'est déduit du titre. Le bilan distingue les autres sports des rejets
et détaille les motifs, sans données personnelles.

Les séries régulières, GPS et zones cardiaques sont conservés avec leurs unités
explicites. Les positions `"NaN"` restent nulles ; un temps de zone absent reste
absent. Une course sans durée est rejetée explicitement, sans durée ni allure
inventées. Limite : 64 Mio par JSON décompressé ; multisport non pris en charge.
Les tests initiaux sont conservés et complétés par des fixtures synthétiques du
format réel. La validation locale des archives utilise le même pipeline en lecture
seule, sans copie des données ni modification de l'historique du navigateur.

Voir [formats, champs, unités et limites de l'import](src/importers/README.md)
et [migration et stockage](src/storage/README.md). L'import ne calcule ni charge
sportive ni planification ; il conserve les métriques Polar disponibles.


## Apparence

Dans **Paramètres → Apparence**, choisissez l'un des 16 thèmes. Le changement
s'applique immédiatement à toutes les pages et reste mémorisé après rechargement.
La section compacte se trouve tout en bas des Paramètres et contient uniquement
le titre Apparence, le libellé Thème et la liste déroulante. Pour retrouver le thème
initial, sélectionnez **[Sombre] Midnight Garage** dans la liste.

| Groupe | Thèmes |
| --- | --- |
| Sombre | Midnight Garage ; AIR-KLM Night flight ; Café Serré ; Matrix Déjà Vu ; Miami Vice 1987 ; Cyber Licorne |
| Clair | AIR-KLM Day flight ; Matin Brumeux ; Latte Vanille ; Miellerie La Divette |
| Pouêt | Chewing-gum Océan ; Pamplemousse ; Raisin Toxique ; Citron qui pique ; Barbie Apocalypse ; Compagnie Créole |

Le catalogue `src/themes/themes.ts` conserve exactement les couleurs fournies :
`BG → --bg`, `PANEL → --panel`, `FIELD → --field`, `FG → --fg`,
`FIELD_FG → --field-fg`, `ACCENT → --accent`. Des variables supplémentaires
adaptent les textes, liens et libellés des boutons aux différentes surfaces :
la couleur prévue est conservée si son contraste atteint 4,5, sinon une couleur
noire ou blanche est utilisée. Les six valeurs originales ne changent jamais.
Les états sélectionnés, survolés et focalisés disposent aussi d'indications
visuelles (soulignement, bordure ou contour).

La clé **`runklmrun.theme`** de localStorage contient uniquement le nom du thème.
Elle est restaurée avant le premier rendu React. Une préférence inconnue ramène
au thème par défaut. Si localStorage est bloqué ou plein, les thèmes restent
utilisables pour la session et un message indique que la préférence ne peut pas
être mémorisée. Les changements ne sont pas synchronisés entre onglets ouverts ;
un rechargement restaure la dernière préférence enregistrée.

L'apparence n'utilise pas IndexedDB et ne modifie ni les entraînements ni
l'importateur Polar. Les graphiques utilisent `--chart-line`, `--chart-grid`,
`--panel-fg` et les couleurs de surface pour les axes, légendes et infobulles ;
ils suivent immédiatement les changements de thème. Les menus natifs peuvent conserver certains détails visuels propres
au navigateur ou au système.


## Historique et statistiques

**Historique** regroupe les séances par année puis par mois, du plus récent au
plus ancien. Chaque niveau affiche le nombre de séances et la distance cumulée.
L'année et le mois les plus récents sont ouverts à l'arrivée ; les autres sont
repliés. Les éléments natifs `details/summary` s'utilisent au clavier (Tab, Entrée
ou Espace) et exposent leur état aux lecteurs d'écran. Les informations de chaque
séance sont conservées. Les listes des mois repliés ne sont pas rendues.

**Statistiques** (`#/statistiques`) propose quatre périodes :

- **7 derniers jours**, par défaut : aujourd'hui et les six jours précédents,
  selon le calendrier local du navigateur, même aux changements de mois,
  d'année ou d'heure. Il ne s'agit pas d'une semaine civile.
- **Mois** : mois et année sélectionnables, initialisés au mois courant à chaque
  activation de ce mode.
- **Année** : année sélectionnable, initialisée à l'année courante.
- **Tout** : toutes les séances enregistrées.

La période active est affichée explicitement. Les trois graphiques sont
journaliers pour les sept derniers jours et le mois (jusqu'à 31 jours).
Pour Année et Tout, les regroupements suivants sont utilisés. Le filtre s'applique au nombre de séances, aux kilomètres,
aux heures et au dénivelé positif cumulé, ainsi qu'aux trois graphiques :

- distance parcourue par semaine, en km ;
- nombre de sorties par mois, en séances ;
- dénivelé positif par semaine, en m.

Les semaines ISO vont du lundi au dimanche ; leur année ISO peut différer de
l'année civile. Le filtre d'année est appliqué **avant** le regroupement : début
janvier peut figurer dans la dernière semaine ISO de l'année précédente, mais
aucune séance datée d'une autre année civile n'est ajoutée. La date civile du
résumé est utilisée, sans conversion selon le fuseau du navigateur.

Pour une année choisie, les douze mois et toutes les semaines qui intersectent
l'année sont affichables. Pour toutes les années, la période va de la première
à la dernière séance. Les graphiques restent chronologiques et présentent une
fenêtre initiale des 26 dernières semaines ou 12 derniers mois. Les boutons
précédent/suivant permettent de parcourir les longues périodes sans compresser
tous les points ; ils ne changent pas les quatre indicateurs. Les valeurs de
chaque fenêtre sont aussi disponibles dans un tableau accessible. Dans le
graphique, Tab puis les flèches permettent de parcourir les points, selon le
[support clavier de Recharts](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx).

### Données manquantes et limites

Une mesure absente, non finie ou négative n'est pas assimilée à zéro. Chaque total
conserve le nombre de mesures renseignées : un total partiel est accompagné de
sa couverture. Si toutes les mesures manquent, « — » est affiché et la courbe
présente une interruption. Une valeur zéro est conservée lorsqu'elle existe.
Les périodes sans séance enregistrée affichent zéro : cela décrit uniquement
l'historique local, pas une certitude d'absence d'activité physique.

Les dates inutilisables restent visibles dans une section distincte de
l'historique. Elles sont exclues des périodes datées ; dans Tout, elles sont
incluses dans les indicateurs mais ne peuvent pas être placées sur les graphiques.
Un message explicite signale cette différence.
Les totaux sont calculés sans arrondi intermédiaire ; l'affichage utilise au
maximum deux décimales. Les temps sont des heures décimales, pas un format h:min.
Les statistiques concernent exclusivement les séances enregistrées, pas les
sports ignorés ou rejetés à l'import.

Le calcul est mémorisé par jeu de résumés et période sélectionnée. Seule la
lecture existante `SessionRepository.list()` est utilisée : ni détails GPS/FC,
ni migration, ni réécriture des données, ni modification de l'importateur.
Les tests couvrent aussi 10 000 résumés synthétiques et les couleurs des 16 thèmes.
Les diagrammes ne sont pas virtualisés sur leur plage complète : les longues
périodes sont parcourues par fenêtres ; aucune carte ni analyse physiologique
n'est ajoutée.

### Vérification manuelle

1. Ouvrir Historique : seule l'année la plus récente et son dernier mois sont
   ouverts. Déplier les autres groupes au clavier et vérifier leurs totaux.
2. Ouvrir Statistiques et sélectionner une année : comparer ses indicateurs
   avec l'historique ; vérifier les trois graphiques et leurs infobulles.
3. Parcourir les fenêtres et consulter les tableaux ; vérifier les semaines de
   fin décembre/début janvier lorsque des séances sont présentes.
4. Dans Paramètres, choisir successivement Midnight Garage, AIR-KLM Day flight
   et Compagnie Créole ; revenir aux statistiques et vérifier axes et infobulles.
5. Réduire la largeur à 320 px : navigation, indicateurs, tableaux et boutons
   restent accessibles. Sur une origine de navigateur sans données, vérifier
   les états vides, sans effacer l'historique existant.


## Fiche de séance — v0.4.0

Depuis l’accueil ou l’historique, sélectionnez le titre d’une sortie pour ouvrir
sa fiche (`#/seance/<identifiant encodé>`). Un lien permet de revenir à l’historique.
La fiche réutilise le résumé déjà chargé et lit uniquement ses détails dans
IndexedDB. Les erreurs peuvent être retentées ; une réponse tardive ne remplace
pas la nouvelle séance. Une ancienne séance sans détails conserve son résumé.

La fiche présente date, heure source, durée, distance, allure moyenne, FC moyenne
et maximale, dénivelés positif et négatif, charge cardio Polar et Running Index.
Les zones Polar sont affichées telles qu’enregistrées. « — » signifie une donnée
absente, jamais un zéro inventé.

Les courbes disponibles montrent la FC (bpm), l’allure (minutes et secondes/km),
l’altitude (m) et la cadence source (rpm, sans multiplication par deux).
L’allure vaut `1000 / vitesseEnMètresParSeconde` ; les vitesses nulles,
négatives ou non finies interrompent la courbe. Chaque série conserve ses temps
en secondes et son échantillonnage ; aucun alignement par indice ni comblement
des trous n’est effectué. Les valeurs non finies deviennent des interruptions.
Les points aux temps invalides sont exclus et une rupture est ajoutée au prochain
temps valide. Les séries sont triées sur une copie sans écriture dans la base.

Les longues courbes sont réduites par blocs en conservant les extrema,
les extrémités et les limites des interruptions. La cible de 800 points est souple :
les séries très fragmentées peuvent la dépasser. Un tableau paginé de 100 lignes
permet de consulter toutes les valeurs préparées, sans réduction, au clavier ou
sur écran tactile. Les graphiques suivent les 16 thèmes.

Limites : le détail complet d’une seule séance est chargé en mémoire ; pas de zoom,
de carte GPS, de RPE ni de synchronisation avec le GPS. Les pauses et les origines
propres aux flux ne sont pas reconstruites. Un grand nombre de ruptures peut
encore alourdir le rendu. Aucun changement de schéma IndexedDB ni réimport n’est
nécessaire.


## Importer des séances Polar — v0.4.0

Dans **Paramètres → Importer des séances Polar**, sélectionnez une archive ZIP
Polar ou un ou plusieurs fichiers TCX, puis cliquez sur **Importer les séances**.
Les extensions sont reconnues sans distinction de casse (`.zip`, `.ZIP`, `.tcx`,
`.TCX`). Les lots mixtes et les lots de plusieurs ZIP sont refusés avec explication.
Le traitement reste local ; les moteurs ZIP/JSON et TCX et leur dédoublonnage
restent inchangés. Aucune migration ni modification des séances existantes.

Le compte rendu affiche ajouts, doublons, autres sports, fichiers non pris en
charge et erreurs. Pour un ZIP, la progression compte les entrées JSON reconnues ;
pour le TCX, elle compte les fichiers sélectionnés. L’analyse initiale du ZIP est
indéterminée. Une archive sans entraînement produit un message explicite, pas un
compte rendu 0/0. Les rejets TCX restent comptabilisés, avec leurs motifs.

Le TCX accepte une activité de course par fichier (16 Mio maximum), même composée
de plusieurs tours. Durée, distance, FC, altitude, GPS, cadence et vitesse fournie
par l’extension reconnue sont conservés lorsqu’ils existent. Les métadonnées des
tours sont stockées sans affichage spécifique. Les valeurs absentes ne sont pas
interpolées. La cadence TCX conserve son unité source, sans conversion arbitraire.

À l’ajout TCX, les doublons sont détectés par identifiant puis par combinaison du
départ (±1 s), de la durée (±2 s) et de la distance (au plus min(5 m, 0,2 % de la
plus petite distance)). Les deux séances doivent être des courses avec des mesures
complètes et des fuseaux fiables. En cas d’incertitude, la nouvelle séance est
ajoutée. Un ZIP ajouté ensuite garde sa détection historique par identifiant.

Consultez les [formats et limites détaillés](src/importers/README.md).

## Lisibilité des graphiques — v0.4.0

Les axes temporels et infobulles affichent `08:20`, puis `1:08:20` au-delà d’une
heure, en respectant les temps réels. L’allure est calculée en **secondes/km**
puis affichée `5:30 min/km` ; son axe est inversé (rapide en haut). Les vitesses
nulles, négatives ou non finies restent des interruptions.

La FC, l’altitude et la cadence utilisent leurs minima/maxima avec une marge de
8 % de l’étendue (minimum 0,5 unité). Les altitudes négatives et les cadences
réellement nulles sont conservées ; aucune valeur extrême de cadence n’est cachée.
La cadence Polar reste en rpm, sans doublement. La cadence TCX marquée « unité
source » conserve cette indication.

Pour l’allure, à partir de huit mesures valides, l’échelle adaptée utilise les
barrières de Tukey : Q1 − 1,5 × IQR et Q3 + 1,5 × IQR, avec quartiles interpolés.
Les bornes des mesures retenues reçoivent une marge de 8 % (minimum 1 seconde/km).
Si les quartiles sont égaux, seules les valeurs égales à ce centre définissent
l’échelle. Cette règle est statistique, sans seuil sportif. Pour moins de huit
mesures, toutes les valeurs définissent l’échelle.

Les points hors champ deviennent des interruptions **uniquement pour le dessin**.
Un message indique leur nombre ; **Afficher l’échelle complète** permet de les
revoir. Toutes les valeurs restent disponibles dans le tableau paginé. Ce choix
peut masquer temporairement une variation légitime : le signalement et le retour
à l’échelle complète restent donc accessibles. Les données stockées ne changent pas.

FC rouge/rose, allure bleue, altitude verte et cadence orange sont centralisées
dans les variables du thème. Leur contraste sur le panneau est testé pour les
16 thèmes (au moins 3:1). Les grilles restent discrètes, les infobulles utilisent
les couleurs du thème. Les compteurs de points sont dans **Détails techniques**.
Les courbes gardent une hauteur de 320 px, 280 px sur smartphone ; le tableau
permet aussi une consultation tactile et au clavier.


## Curseur temporel synchronisé — v0.4.0

Survolez une courbe : un repère apparaît au même temps réel sur toutes les
courbes disponibles. Un panneau commun indique **Instant : 12:35** et les quatre
mesures, sans multiplier les infobulles. Quitter le tracé efface le survol.
Sur écran tactile, touchez le tracé pour conserver la sélection ; le défilement
vertical reste autorisé. **Effacer la sélection** retire le repère.
Le contrôle **Choisissez un instant dans la séance** permet aussi la navigation
au clavier avec les commandes natives du curseur (flèches, début et fin).
La sélection tactile ou clavier reste visible après la sortie du pointeur.

Les graphiques partagent un axe de zéro jusqu’au dernier échantillon disponible
(minimum une seconde pour un point isolé). Le temps sélectionné reste en secondes,
sans synchronisation par indice. La projection du pointeur utilise le rectangle
de tracé fourni par Recharts, et `ReferenceLine` affiche le même instant partout.
Les mesures sont recherchées par dichotomie dans les séries complètes préparées,
pas dans les points réduits. Les index et intervalles sont préparés une seule fois.
Les mouvements de souris sont regroupés à raison d’un rendu par image au maximum ;
les tableaux sont mémorisés et aucun accès IndexedDB supplémentaire n’est effectué.

La tolérance de proximité est propre à chaque série : moitié de l’intervalle
médian positif entre points, plafonnée à **5 secondes**. Un point isolé ne répond
qu’à son temps exact. Aucune extrapolation avant ou après une série. Entre deux
points, une valeur nulle à l’une des bornes ou un intervalle supérieur à
**max(10 secondes, trois intervalles médians)** interdit le rapprochement.
Un marqueur nul suivi d’une valeur au même temps reste une rupture à cet instant.
Les valeurs non finies sont indisponibles. Aucun lissage ni interpolation.

Une mesure proche indique explicitement son véritable instant d’acquisition
(y compris les secondes décimales). Sans mesure fiable : **Donnée indisponible**.
Une valeur hors de l’échelle adaptée reste consultable dans ce panneau et dans
le tableau. Les échelles, l’inversion de l’allure et les données originales ne
changent pas. Pour des séries très irrégulières, la règle prudente peut laisser
certains instants sans valeur ; le tableau conserve tous les points.


## Tests de navigation dans le navigateur

Les cartes de séance sont des liens sur toute leur surface : titre, date,
mesures et marges intérieures. Elles s’ouvrent aussi au clavier avec Entrée.

Les tests d’intégration Playwright montent l’application réelle dans Chromium,
avec les vrais composants Recharts et IndexedDB. Chaque test utilise un contexte
navigateur neuf, une origine locale dédiée (port 4187) et des séances synthétiques.
Ils n’accèdent pas à votre profil navigateur ni à vos entraînements personnels.

Après installation des dépendances :

```bash
npx playwright install chromium
npm run test:e2e
```

Le serveur Vite de test est démarré puis arrêté automatiquement. Les erreurs
JavaScript sont vérifiées ; les rapports locaux sont exclus du dépôt. La suite
`npm test` conserve les tests unitaires existants. Playwright est une dépendance
de développement et n’est pas inclus dans l’application publiée.

### Présentation compacte (v0.4.0)

L'Accueil commence directement par les dernières sorties, sans bandeau de
présentation. La fiche conserve ses informations principales visibles dans une
grille compacte. « Détails complémentaires » regroupe la FC maximale, le dénivelé
négatif, la charge cardio Polar, le Running Index et les zones cardiaques.
Les explications des mesures et du curseur sont repliables. Les quatre courbes,
le curseur synchronisé, les échelles et les tableaux accessibles sont conservés.
Aucune donnée ni aucun schéma IndexedDB n'est modifié.

Les tests Chromium vérifient les changements de période dans un fuseau différent
de UTC, les quatre courbes et l'absence de débordement sur ordinateur, tablette
et smartphone, avec des données synthétiques dans un navigateur isolé.

### Identité graphique et écran de lancement

Les originaux `logo.png`, `titre.png` et `splash.png` sont copiés sans modification
sous `public/images/`. L'en-tête affiche uniquement le titre graphique centré, agrandi de 5 %,
sur fond transparent sans ombre ni filtre ; leur lien revient à l'Accueil.
Les dimensions s'adaptent au mobile en conservant les proportions.

Une fenêtre blanche centrée de 360 × 380 px, arrondie et adaptée aux petits écrans,
affiche l'illustration entière pendant trois secondes à chaque
chargement du document, jamais lors des navigations internes. Un léger voile sombre
laisse l’application visible derrière. L'application
continue de charger derrière cette présentation ; ses contrôles sont temporairement
inactifs. Une disparition discrète termine l'affichage, sans animation lorsque
le système demande de réduire les mouvements. Aucun stockage n'est réinitialisé.
La version de l'en-tête et du splash provient de `package.json`, injectée par Vite
à la compilation. Une modification de version nécessite une nouvelle compilation
(ou un redémarrage du serveur de développement).

## Bilan de l’activité récente — v0.5.0

L’onglet **Entraînement** présente un bilan descriptif des résumés enregistrés,
sans programme, score de niveau ou recommandation sportive. Le choix initial est
**8 semaines** ; les choix 4 et 12 semaines sont également disponibles.

Les fenêtres contiennent 28, 56 ou 84 dates calendaires, aujourd’hui inclus.
Aujourd’hui est déterminé dans le fuseau du navigateur ; les dates civiles des
séances sont conservées, sans conversion de leur heure de départ vers UTC.
Les semaines actives sont des blocs de sept jours depuis le début de la fenêtre,
pas des semaines ISO. Les moyennes divisent les totaux par 4, 8 ou 12, y compris
les blocs sans enregistrement. Plusieurs séances le même jour restent plusieurs
séances, mais un seul jour actif. Les dates invalides et futures sont exclues.

Le bilan indique les séances, les jours et semaines actifs, la fréquence,
les distances et durées totales et hebdomadaires. La sortie la plus longue est
celle de plus grande **distance valide dans la fenêtre**, avec lien vers sa fiche.
À distance égale, la date la plus récente puis l’identifiant départagent les séances.
La dernière activité et le nombre de jours écoulés sont recherchés sur tout
l’historique jusqu’à aujourd’hui, même hors fenêtre.

Une mesure absente (`undefined` ou `null`) est distincte d’une mesure invalide
(négative, non numérique ou non finie) et d’un zéro enregistré. Les totaux et
moyennes partiels portent une indication de couverture ; sans aucune mesure
exploitable, ils affichent « — ». Une période vide affiche un message explicite.
Une durée zéro est conservée comme valeur source, sans en déduire un effort.
L’absence de séances enregistrées ne prouve pas l’absence d’entraînement.

Le calcul pur `analyzeTrainingHistory` reçoit une date de référence explicite.
La page réutilise les résumés chargés par l’application ; aucun détail, parcours
GPS ou point de graphique n’est lu. Le stockage et le schéma IndexedDB restent
inchangés. La date de référence est rafraîchie au retour sur la fenêtre et toutes
les minutes pendant l’affichage. Les mesures physiologiques ne sont pas utilisées.

## Profil du coureur — v0.5.0

Sous le bilan récent, **Votre profil de coureur** permet d’enregistrer vos
objectifs, disponibilités et préférences. Vous pouvez laisser tous les champs
non renseignés et continuer à consulter votre bilan. Après enregistrement, un
résumé et le bouton **Modifier mon profil** permettent de revenir au formulaire.

Objectifs proposés : régularité, reprise, endurance, préparation d’une distance
ou d’une compétition. Distances proposées : 5 km, 10 km, semi-marathon (21,0975 km),
marathon (42,195 km) et distance personnalisée en kilomètres. L’échéance est
facultative. Changer d’objectif conserve les autres informations, y compris une
distance et une échéance précédemment choisies ; vous pouvez les retirer explicitement.

Les disponibilités comprennent les jours, le nombre souhaité de séances et la
durée disponible. Les terrains sont sans préférence, route, chemins/sentiers ou
tapis. « Non renseigné » est distinct de « Sans préférence », de zéro séance et
d’une liste explicitement vide de jours. Aucune préférence n’est préremplie depuis
les données Polar. Cette étape ne propose pas de suggestion ni de programme.

Validations (limites de saisie, pas recommandations sportives) :

- Nombre entier de séances de 0 à 7 ; cette première représentation permet au
  plus une séance par jour disponible. Si des jours sont renseignés, leur nombre
  doit être suffisant. Les choix incohérents restent affichés pour correction.
- Durée entière de 1 à 1 440 minutes, soit au plus une journée.
- Distance personnalisée finie, strictement positive, dans la plage numérique
  sûre en mètres ; virgule et point décimaux sont acceptés.
- Date calendaire valide, aujourd’hui ou ultérieure lors d’une nouvelle saisie.
  Une échéance enregistrée devenue passée reste conservée et peut être modifiée.

Le profil unique porte l’identifiant `local`, des dates de création/modification
et une révision. Ses objectifs, disponibilités et préférences sont séparés des
observations historiques. Ces déclarations ne prouvent aucune capacité physique.
La migration IndexedDB v2 → v3 ajoute seulement `coachProfile` ; elle ne réécrit
aucune séance ni série Polar. Les dépôts partagent l’ouverture de base, mais leurs
opérations restent séparées. Aucun magasin de programme ou de ressenti n’est créé.

Les erreurs de lecture sont distinctes d’un profil absent. Une erreur d’écriture
conserve les saisies. Si un autre onglet a modifié le profil, l’enregistrement est
refusé et vous pouvez recharger explicitement sa version ; ce rechargement remplace
le brouillon. Une migration bloquée demande de fermer les autres onglets puis de
réessayer. Le profil n’est pas synchronisé entre appareils et reste soumis aux
limites du stockage local ; exportez régulièrement une sauvegarde.

### Durées disponibles selon les jours (étape 2 bis)

Par défaut, le profil utilise le mode simple : la durée habituelle reste indicative.
« Personnaliser la durée selon les jours » affiche un champ facultatif pour chaque
jour disponible. Ces durées sont des maxima disponibles, jamais des durées
d’entraînement imposées. Vous pouvez souhaiter 3 séances avec 5 jours disponibles.

Les durées sont des minutes entières de 1 à 1 440 (limite calendaire, pas une
recommandation sportive). Un champ vide reste non renseigné et apparaît comme
« Durée non précisée » dans le résumé ; aucune valeur n’est déduite.
Décocher un jour ou désactiver la personnalisation conserve les valeurs saisies,
y compris après enregistrement. Elles sont ignorées tant que leur jour ou le mode
personnalisé est inactif. Une valeur invalide, même masquée, empêche l’enregistrement :
le message indique comment réafficher le champ pour la corriger ou le vider.

Le mode choisi persiste. Les profils plus anciens restent en mode simple.
Ces champs facultatifs ne nécessitent aucune migration supplémentaire (base v3) ;
les séances, leurs détails, les dates du profil et sa protection contre les
modifications concurrentes conservent leur fonctionnement.

### Sauvegarde et restauration (étape 3)

Dans **Paramètres → Données et sauvegardes**, « Exporter mes données » télécharge
un fichier `.json.gz` non chiffré avec vos séances, détails (GPS compris) et profil complet.
Le thème reste une préférence propre à l’appareil, inchangée par la restauration.
Conservez ce fichier personnel dans un endroit sûr.

« Restaurer une sauvegarde » accepte les anciens `.json` et les nouveaux `.json.gz`,
vérifie leur contenu réel et leur empreinte, puis présente
sa date, son format, son contenu et les éventuels conflits. Vous pouvez annuler
sans changement. Choisissez la fusion ou le remplacement, le traitement du profil,
puis cochez la confirmation et validez :

- **Fusion** : identifiants absents ajoutés ; en cas de conflit, données locales
  conservées. Des détails manquants peuvent être complétés si les résumés sont
  identiques. Aucun rapprochement automatique sur une date ou une distance.
- **Remplacement** : toutes les séances, détails et le profil sont remplacés ;
  l’absence de profil dans le fichier supprime le profil local.
- **Profil en fusion** : conservé par défaut, restauré seulement sur votre choix.

L’opération est atomique : en cas d’échec, aucune restauration partielle ne reste.
Si les données changent entre prévisualisation et confirmation, sélectionnez à
nouveau le fichier. Les pages sont actualisées après succès. L’empreinte SHA-256
détecte des altérations mais ne garantit pas l’authenticité du fichier.

Tout reste local, sans synchronisation ni transmission. L’application de production
déjà chargée fonctionne pour ces opérations hors ligne (Web Crypto, HTTPS/localhost).
Les gros fichiers nécessitent de la mémoire ; l’analyse et le calcul d’empreinte
s’effectuent dans un worker. Voir les [limites détaillées](src/backup/README.md).

### Sauvegardes volumineuses et gzip (étape 3 bis)

L’export est compressé avec les API natives, sans perte de détails ni de précision.
Le format logique reste `runKLMrun-backup`, version 1, avec la même empreinte
SHA-256 calculée avant compression. Les tailles avant/après et la réduction sont
affichées après téléchargement.

Limites distinctes : 128 Mio pour gzip, 384 Mio pour le JSON brut ou décompressé.
La décompression s’arrête aussi en cas d’expansion anormale ; la profondeur et le
nombre d’éléments JSON sont bornés avant analyse. Voir les
[seuils précis et leur justification](src/backup/README.md).
Le volume dépend des détails, pas seulement du nombre de séances.

Le traitement reste local et hors ligne dans l’application de production déjà
chargée. Gzip n’est pas du chiffrement. Chromium est testé ; un navigateur sans
les API de compression natives affiche un message explicite.
Le correctif réduit les copies mais conserve des données et buffers complets en
mémoire : il ne garantit pas un fonctionnement à mémoire constante ni sur tout
appareil pour les plus gros fichiers.


### Diagnostic des limites de sauvegarde (correctif 3 ter)

Les messages distinguent taille, profondeur, nombre de nœuds, nombre de valeurs
et propriétés par objet, avec valeur observée et plafond. Les millions de mesures
ne sont plus mélangés aux clés et aux conteneurs généraux. Leur budget séparé est
calculé à partir des 384 Mio autorisés et de la taille minimale d’un échantillon.
Aucun plafond d’octets n’est relevé, aucune mesure n’est supprimée. Les protections
contre les JSON pathologiques restent actives ; voir la
[justification et la reproduction GPS](src/backup/README.md#correctif-3-ter--profondeur-et-volume-ne-sont-plus-confondus).


### Mes chaussures

Le suivi reste facultatif et local. Le mode initial « Plusieurs paires — Par séance »
conserve les associations existantes. Le sélecteur « Chaussures utilisées » est disponible
directement dans l’historique et dans chaque fiche. La paire par défaut est seulement
proposée pour les nouvelles séances récentes ; les imports historiques et doublons
ne reçoivent aucune attribution automatique.

Le mode « Une seule paire — Automatique » calcule les kilomètres depuis les dates
de première utilisation, jusqu’à la veille du début de la paire suivante. La date
est saisissable au calendrier ou manuellement, modifiable, indépendante de l’achat
et sauvegardée. Les dates identiques ou manquantes suspendent le calcul et demandent
une correction. Les paires futures ne deviennent pas actuelles avant leur date.

Changer de mode conserve toutes les associations manuelles. Leur reprise depuis les
périodes automatiques nécessite un aperçu et une confirmation, sans écraser les choix
existants. Les durées d’utilisation sont calendaires et inclusives ; les fins déduites
ne représentent pas la dernière sortie enregistrée. Les seuils d’usure restent des
repères personnels facultatifs. Les sauvegardes avec chaussures utilisent le format 2,
tout en conservant la lecture du format 1.

### Entretien et opérations longues

Les détails des séances de plus de 30 jours sont désormais nettoyés automatiquement
au démarrage et après une importation réussie, sans action dans les Paramètres.
Les résumés, le profil et les associations de chaussures restent permanents ; les
dates incertaines sont protégées. Les graphiques détaillés expirés ne sont plus disponibles.
Le nettoyage reste silencieux, ne prolonge pas le splash et ne s’exécute pas pendant
une restauration. Un navigateur sans Web Locks n’exécute pas cet entretien.

Les imports et les opérations de sauvegarde/restauration partagent un indicateur
local à leur section, affiché après 400 ms et retiré dès la fin ou l’erreur.
Les opérations plus courtes n’affichent pas d’indicateur. Les actions incompatibles
sont temporairement désactivées sans bloquer la navigation.

### Premier Coach évolutif — v0.6.0

Le Coach unique remplace la présentation Conseiller / Entraîneur. Sept objectifs
sont disponibles : débuter, reprendre, endurance, vitesse, distance, course,
plaisir et forme. L’expérience déclarée reste distincte des habitudes observées.
Les références récentes et historiques sont analysées localement ; la durée,
les disponibilités et les préférences de terrain guident la proposition.
Les explications sont accessibles dans « Pourquoi cette séance ? ».

Avec votre accord explicite à la planification, le Coach propose au plus une
prochaine sortie facultative. Vous pouvez l’accepter, adapter sa durée ou sa date,
ou la refuser sans remplacement automatique. Les séances acceptées restent
consultables et modifiables après un changement d’objectif ou un retrait de
consentement. Une annulation n’est pas un échec ; une date passée ne prouve pas
qu’une séance a été réalisée ou manquée.

Le planning et les refus restent sur cet appareil dans IndexedDB. Ils sont inclus
dans les sauvegardes JSON/gzip au format 4. En fusion, les modifications et
annulations locales restent prioritaires ; en remplacement, une ancienne
sauvegarde sans planning le vide. Les versions précédentes de l’application ne
peuvent pas lire le format 4. La politique éditoriale et ses paramètres provisoires
sont détaillés dans [PROPOSALS.md](src/core/coach/PROPOSALS.md).

Les propositions sont arrondies vers le bas par pas de cinq minutes après
application de la politique de durée. Pour endurance, vitesse, distance et course,
une séance simple dure au moins 30 minutes, uniquement avec des références et un
créneau compatibles. Débuter et reprendre peuvent conserver des séances plus
courtes ; une modification manuelle reste libre. Le mode plaisir et forme ne
propose pas de planning structuré.

Le Coach ne rapproche pas automatiquement prévu et réalisé et n’adapte pas le
planning après une séance manquée. Il n’analyse ni fatigue subjective ni météo réelle.
Le panneau « Diagnostic Coach », fermé par défaut, est réservé à `npm run dev` ;
il expose les calculs exacts sans écriture et disparaît du build de production.
