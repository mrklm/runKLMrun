# Coach V2 — première présentation interne

## Activation

L’espace expérimental est rendu uniquement lorsque les deux conditions suivantes sont réunies :

1. l’application fonctionne avec `import.meta.env.DEV` ;
2. la clé locale `runklmrun:coach-v2-internal` vaut `enabled`.

Activation dans la console du navigateur de développement :

```js
localStorage.setItem('runklmrun:coach-v2-internal', 'enabled');
location.reload();
```

Désactivation :

```js
localStorage.removeItem('runklmrun:coach-v2-internal');
location.reload();
```

La valeur locale ne peut pas activer le composant dans un build de production. Par défaut, le composant retourne `null`, ne lit pas IndexedDB et n’écrit aucune occurrence. Le Coach V1 et ses suggestions restent inchangés.

## Présentation effective

Les étapes demeurent séparées :

```text
lecture → calcul → sélection → affichage expérimental → confirmation explicite → écriture
```

L’affichage de la carte, y compris hors écran, ne suffit jamais à persister une présentation. Seule l’action explicite « Confirmer que cette suggestion est affichée » appelle `presentCoachV2Selection()`. Le clic constitue le constat testable que l’espace expérimental a effectivement montré la suggestion.

Si une occurrence active compatible existe, son contenu immuable est affiché et aucune confirmation supplémentaire n’est demandée. Une première présentation concurrente dans deux onglets converge vers la même identité grâce à la clé unique transactionnelle.

## Contenu et états

La carte affiche la date, le type, la durée, l’intensité, le terrain, le résumé, les consignes facultatives et les blocs structurés disponibles. Elle est explicitement marquée « Développement uniquement ».

Les états visibles sont :

- calcul en cours ;
- suggestion disponible mais pas encore enregistrée ;
- occurrence existante réutilisée ;
- aucune suggestion admissible ;
- ancre temporelle absente ;
- erreur de lecture ou de stockage.

Aucun état de séance manquée, dette ou rattrapage n’est introduit.

## Synchronisation

Le scope `suggestions-v2` du bus de stockage est émis seulement après validation d’une écriture V2. Le composant recharge alors un instantané en lecture seule. Le même événement traverse `BroadcastChannel`, ce qui permet à un autre onglet de retrouver l’occurrence persistée sans recalcul destructeur. Les restaurations signalent également ce scope après leur transaction.

## Validation et limites

Les tests navigateur vérifient l’invisibilité par défaut, l’absence d’écriture pendant le calcul, la confirmation explicite, le réaffichage stable, la visibilité inter-onglets et la présence de l’occurrence dans une sauvegarde V6. La concurrence transactionnelle entre deux onglets reste couverte par les tests du dépôt V2.

Avant une intégration publique, il reste à définir le déclenchement produit d’une présentation, les textes définitifs, la gestion publique des erreurs et la stratégie de transition avec le Coach V1. Aucun de ces choix n’est activé ici.
