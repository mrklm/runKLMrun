# Stockage local

`database.ts` implémente `SessionRepository` avec IndexedDB via `idb`.
La base `runklmrun` utilise le schéma version 2. La migration historique depuis
la version 1 ajoute uniquement `details` (clé `id`) et conserve `sessions` et ses
clés. La publication applicative v0.4.0 ne nécessite aucune nouvelle migration.
Chaque opération ferme sa connexion ; une mise à niveau dans un autre onglet
ferme également les connexions qui la bloqueraient.

`list()` lit seulement les résumés ; `getDetails(id)` lit les séries à la demande.
`addImported()` vérifie l’identifiant de séance puis ajoute résumé et détails
dans une transaction commune, sans écrasement. Pour une séance TCX, cette même
transaction vérifie aussi les doublons à partir du début, de la durée et de la
distance, selon les tolérances documentées dans `../importers/README.md`.
Le chemin ZIP/JSON Polar conserve sa détection par identifiant. Les transactions concurrentes
sont sérialisées par IndexedDB. La méthode historique `save()` conserve son
comportement de mise à jour explicite ; l'import ne l'utilise pas.

Les erreurs de stockage sont remontées, sans stockage de secours silencieux.
Une interruption conserve les séances déjà validées. Effacer les données du
site supprime l'historique. Pas de synchronisation entre appareils/origines,
ni de garantie de persistance en navigation privée.

`BackupService` reste un contrat sans implémentation. L'import Polar n'est pas
une restauration de sauvegarde runKLMrun. Les tests utilisent fake-indexeddb et
des données synthétiques isolées de l'application.
