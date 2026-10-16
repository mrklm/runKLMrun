# Sauvegardes locales JSON/gzip — formats 1 et 2

Le format de fichier est indépendant du schéma IndexedDB (actuellement 5) et de
la version de l’application (0.4.0). La migration additive des chaussures est indépendante du format de fichier. L’export produit désormais
`runKLMrun-sauvegarde-AAAA-MM-JJ.json.gz` ; les anciens `.json` restent lisibles.

## Audit et données incluses

La base `runklmrun` contient six magasins sans index secondaire : `sessions`, `details`, `coachProfile`,
`shoes`, `shoeAssignments` et `shoeSettings`. Leur clé est `id`, sauf
`shoeAssignments` qui utilise `sessionId`. Un ensemble de détails porte exactement la clé du résumé.
Un résumé sans détails est valide. Des détails orphelins ou des clés dupliquées
dans le fichier sont refusés. Les clés historiques sont conservées : les imports
Polar utilisent `polar:<identifiant source>`, les TCX leur identifiant déterministe ;
des clés anciennes sans ces préfixes restent admises.

Toutes les propriétés du modèle actuel sont sauvegardées : mesures, unités source,
temps irréguliers, interruptions `null`, GPS, zones cardiaques, charge cardio,
et profil avec champs facultatifs et métadonnées. Les propriétés `undefined`
sont omises selon les règles JSON, sans convertir les absences en zéro.
Aucun objet d’entrée n’est modifié.

Le thème de l’appareil (localStorage) n’est pas inclus : c’est une préférence
d’affichage locale conservée lors d’une restauration. Les fichiers source ZIP/TCX,
rapports d’importation, filtres, brouillons non enregistrés, curseurs et caches
ne font pas partie des données persistantes sauvegardées.

## Enveloppe

```json
{
  "format": "runKLMrun-backup",
  "formatVersion": 1,
  "exportedAt": "2026-10-10T12:00:00.000Z",
  "appVersion": "0.4.0",
  "data": {
    "sessions": [],
    "details": [],
    "coachProfile": null
  },
  "integrity": {
    "algorithm": "SHA-256",
    "digest": "<64 caractères hexadécimaux minuscules>"
  }
}
```

L’empreinte porte sur toute l’enveloppe **sans** `integrity`, encodée en UTF-8.
La sérialisation est celle de `canonicalJson` : les clés de chaque objet sont
triées lexicographiquement avant `JSON.stringify` (les clés numériques suivent
l’ordre numérique natif de JavaScript), l’ordre des tableaux est inchangé,
aucune indentation. Les nombres suivent la représentation JSON de JavaScript.
Le calcul et la vérification utilisent Web Crypto SHA-256. Gzip ne change ni le
payload couvert par l’empreinte, ni le format logique : l’empreinte porte sur
l’enveloppe JSON canonique **non compressée**, jamais sur les octets gzip.
Le document décompressé contient toujours `integrity` en plus du payload.

La version, les champs, les types, les nombres finis dans la plage sûre, les dates,
les identifiants, les coordonnées et les relations sont contrôlés avant écriture.
Les champs inconnus sont refusés pour éviter une restauration partielle d’un
futur modèle non pris en charge. Les séries historiques signées ou non triées
restent conservées ; aucun rééchantillonnage ni nettoyage implicite.
Les doublons de séances/détails par identifiant sont refusés dans le fichier.

**Une empreinte dans le même fichier n’authentifie pas son auteur.** Elle détecte
une altération accidentelle ; une personne peut modifier le contenu et recalculer
l’empreinte. Le JSON est lisible et non chiffré. Aucun contenu n’est exécuté ni
injecté comme HTML, aucune donnée personnelle n’est journalisée ou envoyée.

## Export et restauration

- Export : une transaction `readonly` commune lit les six magasins, puis un
  worker valide et sérialise l’instantané, calcule SHA-256, puis compresse avec
  `CompressionStream("gzip")`. Aucune écriture de données métier.
- Prévisualisation : détection de la signature gzip `1f 8b` (pas de décision
  fondée sur l’extension ou le MIME), taille contrôlée avant lecture, décompression
  par `DecompressionStream("gzip")` avec compteur d’octets, précontrôle lexical,
  analyse JSON, validation et
  vérification SHA-256 ; présentation des compteurs et avertissements de fusion.
  Annuler ne modifie rien.
- Remplacement : confirmation explicite, remplacement des six magasins dans
  une transaction unique. Un profil `null` supprime le profil local.
- Fusion : ajout seulement des identifiants absents. Même identifiant/résumé
  différent : le résumé et les détails locaux sont conservés. Même résumé :
  détails absents complétés, détails présents jamais remplacés ; une différence
  produit un avertissement, même si le fichier semble plus riche.
- Les identifiants différents sont conservés. Les ressemblances TCX/Polar selon
  les tolérances de l’importateur sont signalées mais ne suppriment aucune séance.
  La proximité des dates seule ne détermine jamais un doublon.

L’import actuel est asymétrique : JSON vérifie l’identifiant, TCX vérifie aussi
départ/durée/distance. La sauvegarde n’appelle pas `addImported` ; sa politique
par identifiant est symétrique et indépendante de l’ordre des formats.

Le profil est un choix indépendant en fusion : conserver le profil local (ou
son absence) par défaut ; restaurer celui du fichier uniquement sur choix explicite.
Un fichier sans profil ne supprime pas le profil local en fusion.
Sans profil local, ses dates et sa révision sont restaurées exactement. En cas
de remplacement d’un profil existant, sa date de création sauvegardée est conservée,
`updatedAt` devient la date de restauration et la révision devient
`max(révision locale, révision sauvegardée) + 1` : un ancien formulaire sera rejeté.
Les durées personnalisées, même inactives, restent inchangées.

Avant la transaction d’écriture, les opérations et les empreintes sont préparées.
Dans la transaction verrouillée, les six magasins sont relus et comparés à
l’instantané de prévisualisation. Toute modification intermédiaire entraîne un
refus sans écriture et demande une nouvelle sélection du fichier. Aucune attente
Web Crypto, fichier, worker ou réseau n’a lieu dans la transaction.
Un échec de quota, de requête ou un abandon annule toute la transaction, y compris
les suppressions. Une fermeture avant validation ne conserve pas d’état partiel.

L’interface recharge les résumés après succès, et les pages relisent le profil et
les détails. Un message BroadcastChannel sans données personnelles avertit les
autres onglets ouverts. Sans cette API, ces onglets doivent être rechargés ; le
contrôle transactionnel protège quand même leurs restaurations obsolètes.

## Limites et protection de la lecture

Les seuils sont distincts, centralisés dans `limits.ts`, et indépendants du nombre
de séances. Aucun nombre de séances, y compris 523, ne détermine une taille fixe.

| Contrôle | Limite | Justification |
| --- | --- | --- |
| Fichier gzip | 128 Mio | Borne le fichier lu et le téléchargement généré |
| JSON UTF-8, brut ou décompressé | 384 Mio | Trois fois l’ancien plafond, sans accepter un JSON non borné ni approcher la limite courante des chaînes JavaScript |
| Expansion gzip | max(1 Mio, 1 000 × taille gzip) | Arrête un contenu anormalement compressible ; tolérance aux très petits fichiers |
| Nœuds structurels hors objets de mesure | 8 000 000 | Ancien plafond conservé pour la structure générale |
| Valeurs primitives hors mesures | 40 000 000 | Borne les scalaires, sans y compter les clés |
| Objets de mesure reconnus | 14 380 470 | floor(384 Mio / 28), d’après la représentation minimale d’un échantillon |
| Primitives dans les mesures | 28 760 940 | Deux fois le budget de points ; les points GPS consomment plus d’octets par primitive |
| Propriétés par objet | 64 | Plus du double du résumé le plus large du modèle courant ; bloque les objets à très grand nombre de clés |
| Profondeur JSON | 32 | Très supérieure au modèle courant ; bloque les imbrications excessives |
| Chaîne JSON individuelle | 1 048 576 caractères source | Borne les chaînes anormales sans limiter les grands tableaux de mesures |

Le volume décompressé et l’expansion sont vérifiés **à chaque bloc avant
accumulation**. Le flux est annulé dès dépassement, sans attendre `JSON.parse`.
Le décodeur UTF-8 est strict. L’API native vérifie le gzip (notamment CRC et
troncature). Un précontrôle lexical sans second buffer UTF-8 limite ensuite
profondeur, nœuds, primitives, propriétés par objet et chaînes avant la création des objets JSON.
Ce précontrôle ne remplace pas la validation de syntaxe ni la validation métier.
Les mêmes budgets sont appliqués à l’export : aucun fichier n’est proposé s’il
serait refusé par ces règles. Un contenu légitime extrêmement répétitif peut
atteindre la limite d’expansion et être refusé explicitement.

Les erreurs distinguent fichier gzip trop grand, contenu JSON trop grand,
expansion anormale, profondeur excessive, trop de nœuds, de primitives, de mesures ou de propriétés, gzip endommagé, JSON invalide et
empreinte incorrecte. Aucun dépassement ne déclenche d’écriture IndexedDB.

## Mémoire : ce qui change, ce qui reste

L’ancien export appliquait 128 Mio au JSON canonique **avant compression**, et
créait une copie complète supplémentaire par `JSON.parse(canonicalJson(...))`,
puis sérialisait de nouveau. Cette limite explique le message observé ; elle
ne mesurait ni le fichier compressé ni la mémoire totale.

Le nouvel export en production sérialise le payload canonique une seule fois,
sans cette copie d’objets par JSON. Son buffer UTF-8 sert à Web Crypto, puis est
fourni en vues de 64 Kio au flux gzip. Le champ d’intégrité est ajouté en suffixe,
sans deuxième sérialisation ni concaténation de tout le JSON. Les statistiques
de taille utilisent des compteurs déjà disponibles. La copie explicite du
brouillon avant `postMessage` a aussi été retirée : le worker fait déjà une copie
structurée synchrone. Le processeur de test natif conserve sa propre isolation.

**Ce n’est pas un export progressif d’IndexedDB ni un traitement à mémoire constante.**

Allocations restantes :

- `getAll` conserve l’instantané complet des six magasins sur le thread principal.
- Le transfert au worker clone cet instantané : deux graphes d’objets au minimum.
- La chaîne canonique, son buffer UTF-8 et une éventuelle copie interne Web Crypto
  existent pendant le calcul. La chaîne devient libérable après encodage.
- Les blocs gzip sont accumulés pour produire un Blob téléchargeable.
- À la lecture, les blocs de texte sont réunis en une chaîne pour `JSON.parse` ;
  le JSON analysé, la sérialisation canonique de vérification et son buffer existent
  à nouveau. Le worker renvoie ensuite les objets validés à l’interface.
- La préparation et la comparaison transactionnelle de restauration conservent
  leurs instantanés et chaînes complètes ; leur coût reste important.

Le worker évite compression, décompression, analyse et empreinte sur le thread
UI. Le clonage, certaines validations et la comparaison finale peuvent encore
provoquer une pause. La mémoire nécessaire dépasse largement la taille du JSON,
particulièrement sur mobile ; les plafonds ne garantissent pas assez de RAM.
Aucun échantillon n’est supprimé, arrondi ou rééchantillonné.

Évolution possible : un format futur segmenté avec manifeste et empreintes par
segment, lecture IndexedDB par curseur et stockage temporaire validé avant
transaction finale. Cela demanderait une refonte explicite ; Web Crypto ne
fournit pas ici de SHA-256 incrémental natif.

## Compatibilité, tests et confidentialité

La lecture des anciens JSON v1 conserve SHA-256 et les règles de restauration.
Le chemin gzip emploie les API natives, sans dépendance ajoutée. Chromium est
couvert par Playwright. Pour les autres navigateurs, la présence de
`CompressionStream` et `DecompressionStream` est contrôlée à l’exécution :
en cas d’absence, message explicite ; un ancien JSON reste lisible sans gzip.
Aucune version minimale Firefox/Safari n’est affirmée sans test sur ces navigateurs.

Le worker est intégré au bundle de production : une application déjà chargée peut
exporter/restaurer hors ligne sans téléchargement de code supplémentaire. Cela
ne constitue pas une installation PWA ni une garantie de démarrage hors ligne.
Web Crypto exige HTTPS ou localhost. Le serveur de développement peut encore
charger ses modules à la demande.

Les tests ordinaires utilisent de petits budgets injectés pour couvrir les
dépassements sans centaines de Mio d’allocation à chaque exécution. Le contrôle
lourd synthétique vérifie réellement un JSON supérieur à l’ancien plafond de
128 Mio, son export et la conservation de chaque échantillon après relecture :

```sh
RUN_LARGE_BACKUP_TEST=1 npm test -- src/backup/large-backup.test.ts --maxWorkers=1
```

Ce contrôle est désactivé dans la suite rapide. Il utilise 4,5 millions de points
GPS synthétiques, nécessite beaucoup de mémoire et peut prendre plusieurs minutes.
Aucune fixture Polar réelle n’est utilisée ou enregistrée.

Gzip **ne chiffre pas** les données. Pas de signature, authentification,
serveur, compte, synchronisation automatique ou accès NAS. Conservez vos fichiers
dans un emplacement sûr. Une variante conflictuelle reste dans le fichier,
sans interface de résolution automatique dans cette étape.

## Correctif 3 ter : profondeur et volume ne sont plus confondus

L’ancien message « structure JSON trop complexe » regroupait trois contrôles :
profondeur 32, total de 8 millions de conteneurs, total de 40 millions de jetons.
Ce dernier comptait **objets, tableaux, clés et valeurs primitives**, y compris
les nombres et nulls des mesures. Il intervenait à l’export après sérialisation,
avant l’empreinte, et à l’import avant `JSON.parse`.

Un échantillon `{timeSeconds,value}` comptait cinq jetons ; un point GPS avec
altitude, neuf. Le test précédent de 3,1 millions d’échantillons produisait
environ 15,5 millions de jetons. Il ne couvrait donc pas le plafond de 40 millions.
Le nouveau contrôle lourd utilise 4,5 millions de points GPS : plus de 40,5
millions d’anciens jetons, moins de 8 millions d’objets, profondeur six.
Il reproduit spécifiquement le dépassement de jetons, sans incriminer la profondeur.

Le modèle exporté est validé avant inspection : ses enregistrements ne peuvent
atteindre 32 niveaux. Pour l’historique réel signalé, les plafonds globaux de
volume expliquent donc le rejet ; l’ancien message ne permet pas de distinguer
celui des conteneurs de celui des jetons sans les données ou un relevé numérique.
Aucune mesure de l’historique personnel n’est prétendue dans cet audit.

L’inspecteur réalise un seul passage, sans graphe temporaire de tous les nœuds.
Il distingue :

- Les objets/tableaux structurels.
- Les valeurs primitives (nombre, chaîne, booléen, null), séparées des clés.
- Les objets directs des séries reconnues à
  `data.details[*].heartRate|speed|cadence|altitude|distance|gps`.
- Les primitives de ces objets de mesure.
- Le nombre de propriétés de chaque objet et la profondeur maximale.

Les budgets généraux restent actifs. Les objets de mesure ont leur propre budget,
dérivé du plafond JSON inchangé : `{"timeSeconds":0,"value":0}` utilise 27 octets,
28 avec un séparateur. Le budget est `floor(402653184 / 28)`, soit 14 380 470
points et deux fois autant de primitives. Les points GPS demandent davantage
d’octets par primitive, donc respectent aussi cette borne. Ce budget ne dépend
ni de 523 séances, ni d’une fréquence supposée. Aucune série n’est tronquée.

Seuls les chemins reconnus bénéficient du budget de mesure. Les tableaux inconnus,
les éléments tableaux imbriqués et les objets imbriqués dans un point gardent
le budget structurel. La validation métier complète reste obligatoire après
analyse ; un nom de chemin ne rend pas un contenu invalide admissible.

Les messages distinguent chaque contrôle et fournissent la valeur observée **au
moment de l’arrêt** et le plafond. Ils ne donnent ni titre, ni identifiant, ni
coordonnées. Un arrêt n’effectue pas un second parcours pour calculer un total.
Les erreurs d’allocation identifiables sont signalées comme mémoire insuffisante ;
un processus tué par le navigateur ne permet pas toujours ce diagnostic.

Le coût du champ `integrity`, ajouté à l’export après empreinte, est vérifié à
partir des compteurs et des octets du suffixe, sans deuxième inspection complète.
Compression, intégrité, anciennes sauvegardes et règles de restauration restent
inchangées. Les limites de RAM et les allocations complètes décrites plus haut
restent valables.


## Extension chaussures (format 2)

Une sauvegarde contenant des chaussures, associations ou un mode de suivi utilise
`formatVersion: 2`. Les anciens lecteurs v1 refusent ces champs inconnus : le numéro
2 évite une perte silencieuse de données. Les sauvegardes v1 restent lisibles ; un
export sans données chaussures peut encore utiliser v1.

Le format 2 ajoute `data.shoes` et `data.shoeAssignments`, ainsi que le champ facultatif
`data.shoeSettings`. Ajouter le mode ne nécessite donc pas de format 3. Une ancienne
v2 sans mode revient au mode manuel. Toutes les données, y compris les dates de première
utilisation et le mode, participent au SHA-256 vérifié avant transformation.

En fusion, les paires et associations locales conflictuelles sont conservées. Une
association entrante liée à une paire ou un résumé conflictuel n’est pas ajoutée.
La paire locale par défaut et le mode local sont préservés. Si la base ne contient
aucune donnée chaussures, le mode entrant peut être restauré. En remplacement,
chaussures et mode suivent le fichier ; un ancien fichier sans chaussures les efface
après l’avertissement et la confirmation. Les révisions sont renouvelées pour les
paires et le mode déjà présents, afin d’invalider les formulaires obsolètes.

Les six magasins sont couverts par le snapshot, la détection des modifications
concurrentes et la transaction atomique. Le filtrage des mesures de plus de 30 jours
n’affecte ni les résumés ni leurs associations de chaussures.

### Coach évolutif : format 3

Lorsqu'un état `data.evolvingCoach` existe (configuration ou suppression explicite),
JSON et gzip utilisent `formatVersion: 3`. Sinon, les formats 1/2 sont conservés.
Ce numéro appartient au format de fichier, pas à la version de l'application.
Les anciennes sauvegardes restent lisibles ; les anciens lecteurs refusent le
format 3 plutôt que d'ignorer les nouveaux choix.

Le nouvel état est validé et couvert par SHA-256 comme le reste du document.
La vérification précède toute transformation. L'aperçu et le contrôle de
concurrence incluent le magasin, ainsi que la transaction de restauration.

- Fusion : un état local prime toujours, y compris une suppression explicite.
  Une absence dans une ancienne sauvegarde n'efface rien. Sans état local,
  l'état entrant est repris exactement. Les choix divergents sont signalés
  dans le compte rendu ; l'option du profil historique reste indépendante.
- Remplacement : les choix correspondent au fichier. Une sauvegarde ancienne
  retire donc la configuration. Une révision technique est conservée/incrémentée
  si un état local existait, afin de bloquer les brouillons obsolètes.
- Les révisions et dates de mise à jour peuvent changer lors du remplacement,
  comme pour les profils existants ; les choix déclarés ne sont pas réinterprétés.

Aucune configuration ni aucun consentement n'est inventé à partir du profil
historique. Aucun programme n'est activé par la restauration.

### Planning personnel : format 4

La présence de `data.coachPlanning` déclenche le format 4, en JSON comme en gzip.
Les formats 1, 2 et 3 restent lisibles ; les anciennes applications refusent le
format 4 plutôt que d'ignorer le planning. Aucun ancien fichier n'est modifié.
La validation stricte du planning et le SHA-256 précèdent la préparation.
Les séances acceptées, leurs modifications/annulations et les empreintes de
refus sont sauvegardées. L'aperçu affiche leurs nombres, sans écriture.

En fusion, les séances locales restent prioritaires pour tout conflit d'identifiant
ou d'empreinte de proposition, quel que soit l'horodatage du fichier. Un conflit
est signalé. Les séances absentes sont ajoutées ; les refus sont réunis sans doublons.
En remplacement, le planning du fichier remplace le planning local. Une sauvegarde
ancienne sans planning le vide. Une révision avancée protège les brouillons ouverts.
Toutes ces écritures appartiennent à la transaction atomique de restauration et
au contrôle existant de modification depuis l'aperçu. Aucun consentement n'est
créé à partir de la présence d'une séance planifiée.
