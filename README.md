# runKLMrun — v0.3.0 (non publiée)

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
```

Vitest exécute les tests unitaires. Les tests du stockage utilisent
`fake-indexeddb` et vérifient une base vide, la persistance après réouverture et
la migration v1 → v2, les doublons, les détails, les conversions et les erreurs d’import. Leurs données sont isolées : aucune donnée sportive
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
Les pages Entraînement et Paramètres restent accessibles en cas d’erreur de stockage.

Les agrégations de résumés restent indépendantes de React, du DOM et d’IndexedDB.
Aucun calcul de charge sportive ni planificateur n’est implémenté. Recharts affiche
les statistiques ; son code est chargé à l’ouverture de la page Statistiques.
L’importateur Polar est disponible dans Paramètres ; son périmètre exact est décrit ci-dessous.

## Données et prochaines étapes

La base `runklmrun`, version 2, contient les magasins `sessions` (résumés) et `details` (séries). Il n’y a ni
synchronisation ni envoi des activités à un service distant. Effacer le stockage
du site supprime les données ; le mode privé peut limiter ou supprimer la
persistance. Le stockage dépend de l’origine du site et n’est pas partagé entre
navigateurs ou appareils. Aucune garantie de fonctionnement hors connexion
n’est apportée à cette étape : aucun service worker n’est installé.

Le contrat `BackupService` réserve la sauvegarde et la restauration ; aucune
implémentation de sauvegarde/restauration n’est disponible. Le format versionné,
la validation et les règles de restauration restent à définir. Voir
[`src/storage/README.md`](src/storage/README.md).

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
s'applique immédiatement à toutes les pages et la prévisualisation montre les
six couleurs originales. **Revenir au thème par défaut** restaure
**[Sombre] Midnight Garage**.

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

**Statistiques** (`#/statistiques`) propose « Toutes les années » ou une année
civile disponible. Le filtre s'applique au nombre de séances, aux kilomètres,
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
l'historique et sont exclues des statistiques avec un message explicite.
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
