# Stockage local

`database.ts` implémente `SessionRepository` avec IndexedDB via `idb`.
La base `runklmrun` (version 1) contient un magasin `sessions`, indexé par `id`.
Chaque opération ferme sa connexion après exécution. Les migrations futures
seront placées dans le callback `upgrade` en incrémentant la version de la base.
Les erreurs remontent à l'interface ; aucun stockage de secours silencieux.

`BackupService` réserve le contrat de sauvegarde et de restauration. Il n'a pas
d'implémentation et n'est pas exposé comme action dans l'interface. Avant de le
développer, définir un format versionné, une validation des données, une politique
de conflits et une restauration transactionnelle.

Les tests utilisent une base éphémère `fake-indexeddb`, jamais les données utilisateur.
