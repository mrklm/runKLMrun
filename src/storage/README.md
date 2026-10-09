# Stockage local

`database.ts` implémente `SessionRepository` avec IndexedDB via `idb`.
La base `runklmrun` passe de la version 1 à la version 2. La migration ajoute
uniquement `details` (clé `id`) et conserve intégralement `sessions` et ses clés.
Chaque opération ferme sa connexion ; une mise à niveau dans un autre onglet
ferme également les connexions qui la bloqueraient.

`list()` lit seulement les résumés ; `getDetails(id)` lit les séries à la demande.
`addImported()` vérifie la clé `polar:<identifiant>` et ajoute résumé et détails
dans une transaction commune, sans écrasement. Les transactions concurrentes
sont sérialisées par IndexedDB. La méthode historique `save()` conserve son
comportement de mise à jour explicite ; l'import ne l'utilise pas.

Les erreurs de stockage sont remontées, sans stockage de secours silencieux.
Une interruption conserve les séances déjà validées. Effacer les données du
site supprime l'historique. Pas de synchronisation entre appareils/origines,
ni de garantie de persistance en navigation privée.

`BackupService` reste un contrat sans implémentation. L'import Polar n'est pas
une restauration de sauvegarde runKLMrun. Les tests utilisent fake-indexeddb et
des données synthétiques isolées de l'application.
