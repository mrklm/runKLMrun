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

### Suggestions présentées — phase 5B.1 (schéma IndexedDB v8)

Migration additive : `coachSuggestions`, clé `id`, index civil `expiresOn`.
Les autres magasins, notamment le planning (notes, refus, révisions et états),
ne sont ni convertis ni réécrits lors de la migration.

`createSuggestionRepository` dans `coach-suggestions.ts` expose une API explicite :

- `recordPresented` : projection minimale d'une suggestion **effectivement présentée**.
  Identité déterministe v1 : date civile, type, durée et terrain. Les dates de création,
  diagnostics et motifs ne participent pas à cette identité. Une répétition renvoie
  le même enregistrement sans écriture, notification ni réactivation d'un état obsolète.
- `list` : lecture triée par date et identifiant, sans nettoyage implicite.
- `markObsolete(id, revision)` et `associateActivity(id, activityId, revision)` :
  contrôle transactionnel de la révision. L'activité doit exister dans `sessions`.
  Aucun rapprochement automatique, aucune conversion en séance acceptée.
- `deleteExpired(today, limit)` : nettoyage explicite par lot de 1 à 100 suggestions,
  via l'index d'expiration. Aucun résumé, détail, planning ou profil n'est supprimé.

Le modèle contient date de création/mise à jour, date civile suggérée, type, durée
exacte, terrain optionnel, expiration, révision, état `current`/`superseded` et lien
optionnel vers une activité. `suggestionFollowUp` déduit les états datés :
`past-unmatched` signifie uniquement « aucune activité associée enregistrée », jamais
« séance non réalisée ». L'expiration prime, puis l'association, puis l'obsolescence.

Politique initiale : conserver la date suggérée et les **sept jours civils suivants**,
expiration au début du huitième jour (exemple : 18 octobre → 26 octobre).
Ce délai court laisse une semaine pour un import différé, sans créer un historique
permanent de propositions. Il est indépendant des 30 jours des mesures détaillées.
Les dates civiles sont calculées sans dérive aux changements d'heure ; le jour courant
est local et injectable. Une nouvelle présentation déjà expirée est refusée.
Les enregistrements expirés restent lisibles/exportables jusqu'à un nettoyage explicite.

Les transactions sérialisent deux présentations simultanées et les révisions empêchent
l'écrasement d'une décision concurrente. Les notifications `suggestions` utilisent le bus
5A et BroadcastChannel après validation effective uniquement ; pas de message pour un
échec ou une opération identique. Le mécanisme existant évite les boucles inter-onglets.

**Aucun raccordement au moteur, à React ou à un entretien automatique en phase 5B.1.**
Le futur appelant devra garantir la présentation effective et déclencher le nettoyage.
Calculer une proposition ne produit aucune écriture. L'API accepte une projection
explicite, pas le résultat moteur complet avec ses diagnostics.

### Raccordement à la présentation — phase 5B.2

L’ancienne interface du planning V1, retirée au lot 2, calculait une proposition transitoire après lecture du
profil, de la configuration et du planning. Les changements de ces données, des
résumés ou du jour courant déclenchent son actualisation. Le moteur n'écrit rien.
Les propositions déjà acceptées ou refusées ne montent pas de carte à observer.

L'effet React attaché à la carte utilise `suggestion-presentation.ts` : intersection
avec le viewport, document visible, titre et ligne durée/terrain entièrement dans
la fenêtre, styles visibles et absence de recouvrement aux points contrôlés.
Deux frames successives confirment cette visibilité, ce qui exclut un montage
exploratoire StrictMode ou une proposition remplacée avant affichage. Le splash
est également exclu par le contrôle de recouvrement. Un démontage annule
l'observation ; il ne rend rien obsolète. Cela constate une possibilité de lecture,
**pas une preuve que le coureur a effectivement lu la suggestion**.

`recordPresented(input, presentation)` reçoit le contexte exact ayant produit la
carte et une garde de visibilité. Avant une nouvelle insertion, une transaction
vérifie les résumés (sans détails), le profil, la configuration et le planning contre
cet instantané. Une modification concurrente ou une présentation annulée empêche
l'écriture. Une identité déjà enregistrée est un no-op, y compris après remontage,
recalcul, retour d'onglet ou restauration. Aucune réactivation implicite d'une
ancienne identité obsolète. Pas de cache permanent susceptible d'ignorer une restauration.

Règle de remplacement du créneau unique : **uniquement lors de l'insertion d'une
nouvelle identité effectivement affichée**, rendre obsolètes les autres suggestions
`current` datées d'aujourd'hui ou du futur, non expirées et non associées à une
activité. Exclure celles dont type/date/durée correspondent à la proposition
initiale d'une séance du planning (même modifiée ou annulée). Cette correspondance
prudente peut préserver plusieurs suggestions de terrain différent ; aucune séance
acceptée, note ou révision du planning n'est modifiée. Les suggestions passées
restent « sans activité associée enregistrée », sans jugement sur leur réalisation.
Un refus continue d'être géré exclusivement par les règles actuelles du planning.

Insertion et obsolescence sont atomiques ; un échec annule l'ensemble. Une seule
notification `suggestions` est émise après commit. L’ancienne interface du planning V1 ne s'abonnait pas
à ce scope : aucune boucle de recalcul/écriture. Les autres onglets peuvent observer
l'invalidation avec le bus 5A ; les transactions sérialisent leurs insertions.

Une erreur de stockage affiche un message et permet le rechargement du planning,
sans bloquer ses actions. Pas de retry automatique infini, pas de nettoyage ajouté,
pas de rapprochement avec des activités ni de modification du format de sauvegarde.
Sans IntersectionObserver, l'enregistrement est omis plutôt que présumé. Une carte
hors écran ou partiellement lisible attend un défilement permettant de voir son titre
et sa durée ensemble.

### Suggestions libres affichées — phase 5C.2

L’ancienne interface du planning V1 lisait les données et appelait `proposeSuggestions(input,
planning)`. Ses cartes historiques étaient affichées sans validation et observaient chaque
carte avec le mécanisme 5B.2 (onglet visible, absence de recouvrement, deux frames).
Aucun calcul ne se produit pendant le rendu des cartes. Les actions de modification
et d'annulation sont exclusivement réservées à l'ancien planning, conservé intégralement.
Les refus historiques restent stockés sans devenir des réponses aux suggestions libres.

`recordPresentedSetMember(carte, ensemble, présentation)` utilise une transaction
commune aux suggestions et aux données du contexte. Elle vérifie le contexte actuel,
la visibilité et les identifiants, puis insère **uniquement** la carte présentée.
Les autres membres calculés ne sont jamais insérés par anticipation.

Obsolescence conservatrice : attendre que tous les membres de l'ensemble soient déjà
mémorisés après présentation (éventuellement dans un autre onglet ou lors d'un affichage
antérieur du même contenu). Alors seulement, `replacementCandidates` exclut les membres
de l'ensemble et sélectionne les suggestions futures encore actives à remplacer.
Les suggestions passées, expirées, associées à une activité ou correspondant à une
proposition initiale du planning restent intactes. Une carte manquante reporte toute
obsolescence : d'anciennes suggestions peuvent donc rester actives jusqu'à une présentation
complète ou au nettoyage explicite existant. Un ensemble vide ne modifie rien.

Insertion et obsolescence sont atomiques ; erreur ou contexte périmé = rollback.
Une transaction sans modification ne notifie rien. Le scope `suggestions` n'est pas
écouté par le calcul du Coach, ce qui évite les boucles entre onglets. Les identités
existantes ne sont pas réactivées ni leurs horodatages renouvelés. StrictMode et les
retours de navigation peuvent relire le stockage mais ne réécrivent pas les cartes.
Aucun format, magasin, schéma ni règle de sauvegarde ne change.

La méthode 5B.2 de remplacement unique reste disponible pour compatibilité technique,
mais n'est plus appelée par les composants. La liste n'est jamais transmise à cette méthode
carte par carte. Aucun rapprochement automatique ni entretien nouveau n'est ajouté.

### Rapprochement factuel — phase 5D.1

`startSuggestionReconciliation` est conservé comme outil explicite de compatibilité
technique, mais n'est plus démarré par l'application. Les imports Polar/TCX,
`save`, restauration/fusion et suppressions notifiées ne modifient donc pas
automatiquement les suggestions V1. Il ne crée ni suggestion ni séance et ne
recalcule pas le moteur. Aucun nouvel écran.

`reconcileActivities` lit uniquement les résumés et les suggestions dans une même
transaction IndexedDB en écriture. Les transactions des autres onglets sont
sérialisées ; les révisions sont calculées sur l’état courant. Seuls les liens
modifiés sont écrits, avec révision et horodatage mis à jour. Les autres champs,
le planning, le profil, les détails et les associations de chaussures restent intacts.

Règle pure (`suggestion-matching.ts`) : une seule suggestion mémorisée et une seule
course pertinente à la même **date civile source**, sans conversion de fuseau du
navigateur. Les TCX conservent le jour écrit dans leur horodatage (y compris UTC) ;
aucun fuseau local absent du fichier n’est inventé. Une date invalide, un horodatage
inexploitable ou contradictoire et un sport explicitement inconnu/non course sont
exclus. Les résumés historiques sans sport restent des courses selon le contrat
historique du magasin `sessions`. Aucun titre ne sert à deviner un sport.

Les durées, distances, allures, terrains et intensités ne sont pas comparés.
Plusieurs courses ou plusieurs suggestions le même jour empêchent le lien ; même
une suggestion remplacée compte dans cette ambiguïté. Une suggestion remplacée
ne reçoit pas de nouveau lien. Un lien existant valide peut être conservé ; un lien
orphelin, contradictoire ou devenu ambigu est retiré. Une activité remplacée par
un nouvel identifiant est réévaluée avec les mêmes critères d’unicité. Une ancienne
revendication contradictoire est d’abord retirée ; un passage suivant peut associer
l’activité si le conflit a disparu. Jamais deux suggestions pour la même activité.
L’API explicite `associateActivity` contrôle également date, sport et unicité dans
sa transaction, en plus de la révision attendue.

Les imports tardifs peuvent correspondre tant que la suggestion est encore dans
le magasin, même après sa date d’expiration. Aucun nettoyage supplémentaire n’est
introduit ; une suggestion déjà supprimée ne peut être reconstruite. Une suggestion
calculée mais jamais présentée n’est jamais insérée par ce rapprochement.

Les notifications rapprochées sont regroupées ; une seule exécution locale à la
fois et un passage supplémentaire si les données changent pendant celle-ci. La
notification d’un lien déclenche au plus une vérification sans écriture lorsque
l’état est stabilisé : aucun renvoi de notification sans modification, donc aucune
boucle inter-onglets. Le regroupement des imports existant évite un parcours par
fichier. Les mesures détaillées ne sont jamais lues.

Un échec transactionnel laisse les liens inchangés et produit uniquement un message
technique générique sans données personnelles. Reprise au prochain événement ou
démarrage, sans retry permanent. La convergence est asynchrone après le commit de
l’activité ; les écritures directes hors dépôts doivent émettre `sessions` après
validation. Il n’existe actuellement ni écran de création manuelle ni API de
suppression de séance : le chemin `save` et les suppressions notifiées sont couverts.
Le format 5 et les règles de sauvegarde restent inchangés : le lien `activityId`
existant est exporté/restauré, puis réévalué après restauration ou fusion. Un lien
n’affirme jamais que le coureur a suivi exactement la suggestion.

### Informations temporaires sur l’accueil — phase 5D.2

L’ancienne information historique V1 affichait seulement les suggestions mémorisées, passées, actuelles,
non associées, de J+1 à J+7 inclus (`expiresOn` à J+8). Aucun message n’est persisté.
Le service de rapprochement expose un état local de préparation : l’information
est masquée au démarrage, pendant une actualisation ou après une erreur. Une
lecture transactionnelle commune aux résumés et suggestions vérifie également que
les liens stockés correspondent au résultat du rapprochement. Aucune écriture
n’est effectuée par l’affichage.

Plusieurs suggestions à la même date (même remplacées) ou la présence d’une activité
ce jour-là masquent l’information. Cela inclut une activité non exploitable pour le
rapprochement : absence de lien ne signifie pas absence de course. Les dates civiles
source sont conservées, sans conversion de fuseau. Le jour courant est local au
navigateur, comme dans le reste du Coach.

Notifications `sessions`/`suggestions`, fin du rapprochement, retour au premier plan
et changement de jour actualisent la lecture ; un compteur ignore les réponses
asynchrones anciennes. Le contrôle d’horloge chaque seconde ne lit pas IndexedDB
si le jour n’a pas changé. Les messages sont absents dans un onglet masqué.

Les restaurations/remplacements notifient déjà après transaction validée. Aucun
chemin existant de suppression individuelle n’a été trouvé ; une suppression future
doit émettre `sessions` après commit, comme le vérifient les tests synthétiques.
Les écritures directes sans notification ne sont pas observées en temps réel.
Aucun questionnaire, aucune qualification de l’effort du coureur, aucune action
obligatoire. Les styles `notice` existants utilisent les couleurs du thème.
