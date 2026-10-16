# Stockage local

`database.ts` implémente `SessionRepository` avec IndexedDB via `idb`.
La base `runklmrun` utilise désormais le schéma version 5. La migration historique depuis
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

`BackupService` est implémenté dans `backup.ts`. L'import Polar n'est pas
une restauration de sauvegarde runKLMrun. Les tests utilisent fake-indexeddb et
des données synthétiques isolées de l'application.

## Profil du coach (chantier v0.5.0)

`database-connection.ts` centralise la migration additive et l’ouverture pour les
deux dépôts. Depuis v2, seul `coachProfile` (clé `id`) est ajouté. `sessions` et
`details` restent intacts. Les opérations de migration appartiennent à la
transaction native `versionchange` d’IndexedDB.

`coach-profile.ts` implémente `CoachProfileRepository` : `get()` lit le profil
`local` et `save(values, expectedRevision)` crée ou modifie ce profil après
validation. Le dépôt préserve la date de création, incrémente la révision et refuse
les écritures concurrentes obsolètes dans la même transaction. L’horloge et le nom
de base sont injectables pour les tests. Une valeur corrompue produit une erreur
de lecture, jamais une réinitialisation silencieuse.

L’événement `blocking` ferme les connexions de cette application. L’événement
`blocked` remonte `StorageBlockedError` avec consigne de fermer les autres onglets.
Une ouverture en attente ne peut pas être annulée nativement : si elle aboutit
après l’erreur, sa connexion est fermée et aucune opération métier différée n’est
exécutée. L’utilisateur peut réessayer ; aucun délai arbitraire ne déclenche de
suppression de base.


L’étape 2 bis ajoute au profil des champs facultatifs de mode et de durées par
jour, sans changer le schéma v3 ni les magasins. Le dépôt utilise la validation
commune pour ces champs et conserve également les durées inactives. Les anciens
profils sans ces champs sont acceptés ; aucune réécriture à la lecture.


## Sauvegardes (étape 3)

`backup.ts` lit un instantané dans une transaction readonly commune aux trois
magasins. La restauration valide son entrée avant une transaction readwrite unique.
Elle compare alors l’état courant à la prévisualisation, puis applique le plan.
Toute erreur annule les écritures et suppressions. Le schéma courant est en version 5.
La fusion est fondée sur les identifiants, sans réutiliser l’asymétrie de dédoublonnage
des imports. Voir le [format, les conflits et les limites](../backup/README.md).


### Compression des sauvegardes (étape 3 bis)

L’enveloppe logique v1 et IndexedDB v3 restent inchangés. L’export produit un
`.json.gz` ; la prévisualisation accepte aussi les anciens JSON. Détection réelle
du gzip, décompression bornée, précontrôle de complexité, validation métier et
SHA-256 précèdent toute transaction d’écriture.
Les règles de fusion, de profil, de conflit et d’atomicité sont inchangées.
Le processeur worker copie les entrées via `postMessage`, sans clone préalable
redondant ; le processeur natif fige lui-même son entrée.
Les lectures `getAll` et la comparaison finale restent complètes en mémoire :
voir les [limites et allocations](../backup/README.md).


## Chaussures et mode de suivi

La migration additive crée `shoes` (clé `id`), `shoeAssignments` (clé `sessionId`)
et `shoeSettings` (réglage `local`). Elle ne réécrit aucun résumé ni détail.
`shoes.ts` contrôle les révisions des paires et du mode, l’unicité de la paire
active par défaut et les références des associations. Sans réglage, le mode est
manuel, compatible avec les associations existantes.

Le mode automatique calcule les périodes depuis les dates de première utilisation,
sans écrire d’associations. Le changement de mode ne supprime rien. Une conversion
explicite vers les associations manuelles exige un aperçu puis une confirmation ;
la transaction revérifie les résumés, paires, associations et le mode. Les associations
existantes ne sont pas écrasées.

### Entretien automatique des détails

Le service de conservation existant intervient au démarrage, sans attendre une
activation locale, et après un import réussi (ajouts ou doublons reconnus).
Il ne dépend plus du délai journalier ni du nombre de séances ajoutées.
Les erreurs sont absorbées par les déclencheurs ; un prochain démarrage ou import
peut réessayer. L’interface et le splash n’attendent pas la maintenance.

Seuls les détails strictement expirés selon la règle centralisée des 30 jours
sont supprimés, par lots de 25, avec relecture du résumé dans la transaction.
Les dates incertaines, résumés invalides et détails orphelins restent protégés.
Les magasins de résumés, profil et chaussures ne sont jamais supprimés par ce service.
La restauration prend le même Web Lock exclusif que le nettoyage, depuis sa
préparation jusqu’à sa fin. Un nettoyage ne démarre pas si ce verrou est occupé.
Sans Web Locks, aucun nettoyage n’est exécuté ; la restauration conserve ses
transactions et contrôles de concurrence IndexedDB existants.

L’action manuelle des Paramètres est remplacée par une explication. Ce changement
rend automatique la suppression des détails anciens existants, y compris sur les
appareils où la politique n’avait pas été activée. Il n’étend pas la règle des 30 jours.

### Coach évolutif (fondations, sans interface)

IndexedDB v6 ajoute uniquement `evolvingCoach`, clé `id: "local"`.
Aucun profil historique ni aucune activité n'est converti. La configuration
initiale est absente. `createEvolvingCoachRepository()` expose `get`, `save` et
`remove`, avec révision attendue obligatoire à chaque modification.

L'enregistrement contient `configuration` (objectif `evolving`, expérience et
préférence de planification facultatives), `revision`, `createdAt`, `updatedAt`.
Aucune disponibilité n'est dupliquée. Les champs inconnus sont refusés.
Une suppression conserve `configuration: null` et une révision technique,
sans conserver les anciens choix : un ancien onglet ne peut pas les ressusciter.
Une recréation doit fournir cette dernière révision. Les conflits utilisent
`ProfileConflictError`, comme le profil historique.

Aucun appel de l'interface ne crée cette configuration. Un consentement stocké
n'active aucun moteur ; il reste soumis à la politique métier de l'objectif.

### Planning du Coach : IndexedDB v7

Migration additive : magasin `coachPlanning`, clé `id: "local"`. Aucun magasin
historique n'est réécrit. Le document contient les séances acceptées et les
empreintes de propositions refusées ; les activités importées restent séparées.
Une révision partagée protège toutes les décisions concurrentes. Les écritures
contrôlent et incrémentent la révision dans une transaction ; acceptation/refus
contrôlent aussi le consentement et les révisions du profil et du Coach.
Un conflit demande un rechargement, sans écrasement silencieux du brouillon.
Aucune annulation ou date passée ne supprime une séance acceptée.
Le remplacement par une ancienne sauvegarde vide le planning mais garde une
révision avancée pour invalider les anciennes saisies des autres onglets.
