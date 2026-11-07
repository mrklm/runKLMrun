# runKLMrun — consignes pour les agents

Application web de suivi de course à pied (React, TypeScript, Vite, IndexedDB). Principe : « runKLMrun s'adapte à vous, pas l'inverse. »

## Données personnelles
- Ne jamais ouvrir, modifier, migrer ou supprimer la base IndexedDB historique `runklmrun` : elle contient des données réelles.
- Chaque profil a sa base `runklmrun-user-<uuid>`, avec un registre `runklmrun-profiles`. Toujours passer le nom de base explicitement, jamais `DATABASE_NAME` par défaut.
- Tests uniquement sur données synthétiques. Les tests navigateur utilisent `e2e/helpers/protected-test`, qui bloque tout accès à `runklmrun`.
- Pas de migration ni de changement du stockage sans validation.

## Coach V2
- Politique de récupération A active : 2 jours après une course, 7 jours de ressenti, 10 jours entre sorties longues, 14 jours entre séances structurées. Ne pas activer la politique B (12/9 jours) sans décision explicite. Voir `docs/coach/D4_FINAL.md`.
- Les modules expérimentaux (D4a, D4c à D4e) ne doivent pas être branchés dans l'application.
- Ne jamais inventer de données (répétitions, fréquence cardiaque, récupération physiologique).

## Imports et mesures
- L'identifiant TCX est une empreinte SHA-256 du contenu lu : toute analyse se fait à côté du parsing, sans modifier les mesures.
- Une anomalie de fréquence cardiaque n'invalide jamais durée, distance ou GPS. L'exclusion manuelle (`heartRateIgnored`) est réversible et conserve les mesures d'origine.

## Sauvegardes
- Un nouveau champ persistant impose un nouveau format de sauvegarde (voir `src/backup/version.ts`), utilisé seulement lorsque le champ est présent.

## Interface
- Tous les textes destinés aux utilisateurs emploient le vouvoiement.

## Vérifications
```sh
npm test               # Vitest
npx tsc -b             # TypeScript
npm run build
npm run test:e2e       # Playwright, environ 15 min
git diff --check
```
Le workflow GitHub Pages (tests unitaires, build, déploiement) s'exécute à chaque push sur `main`.

## Git
- L'utilisateur garde le contrôle exclusif de `git add`, `commit`, `push`, `tag` et du déploiement : fournir les commandes, ne pas les exécuter.
- Préserver le dossier `.agents/` et les modifications locales existantes.
