# runKLMrun — v0.2.0

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
├── core/              # Futur moteur métier, sans React ni stockage
│   ├── analysis/       # Réservé aux analyses
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

Le moteur métier recevra des données typées et restera indépendant de React,
du DOM et d’IndexedDB. Aucun calcul sportif ni planificateur n’est implémenté.
Recharts est installé pour les futurs graphiques mais n’est pas encore utilisé.
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
