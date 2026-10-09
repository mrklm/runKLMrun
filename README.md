# runKLMrun

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
la mise à jour sans doublon. Leurs données sont isolées : aucune donnée sportive
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
├── importers/         # Réservé aux conversions de fichiers externes
├── storage/           # Contrats et accès IndexedDB
└── types/             # Types partagés indépendants de React
```

L’interface lit les sorties via le contrat `SessionRepository`. Le dépôt
IndexedDB expose la lecture et l’enregistrement, sans interface de saisie à
cette étape. Les états de chargement, de base vide et d’erreur sont distincts.
Les pages Entraînement et Paramètres restent accessibles en cas d’erreur de stockage.

Le moteur métier recevra des données typées et restera indépendant de React,
du DOM et d’IndexedDB. Aucun calcul sportif ni planificateur n’est implémenté.
Recharts est installé pour les futurs graphiques mais n’est pas encore utilisé.
L’importateur Polar et les autres mécanismes d’ajout de sorties sont hors périmètre.

## Données et prochaines étapes

La base `runklmrun`, version 1, contient le magasin `sessions`. Il n’y a ni
synchronisation ni envoi des activités à un service distant. Effacer le stockage
du site supprime les données ; le mode privé peut limiter ou supprimer la
persistance. Le stockage dépend de l’origine du site et n’est pas partagé entre
navigateurs ou appareils. Aucune garantie de fonctionnement hors connexion
n’est apportée à cette étape : aucun service worker n’est installé.

Le contrat `BackupService` réserve la sauvegarde et la restauration ; aucune
implémentation ni action d’export/import n’est disponible. Le format versionné,
la validation et les règles de restauration restent à définir. Voir
[`src/storage/README.md`](src/storage/README.md).
