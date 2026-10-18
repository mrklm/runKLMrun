# Coach V2 — corrections fonctionnelles avant activation

Phase 6H, 18 octobre 2026. Le Coach V2 reste réservé au développement. Les corrections concernent uniquement le catalogue et l’adaptateur V2 ; le Coach V1, l’interface publique et les formats persistants sont inchangés.

## 1. Durée d’une pratique stable

### Reproduction

- Entrée : quatre activités réelles stables de 40 minutes, objectif endurance, référence provisoire, disponibilité de 60 minutes.
- Avant : première suggestion de 30 minutes, puis les sorties réellement effectuées à cette durée entraient dans la référence provisoire. Le coefficient de 80 % était réappliqué et la suggestion atteignait 20 minutes.
- Cause : `selectPrototypeSessions()` appliquait `cautiousRatio` à toute référence insuffisamment confirmée, sans distinguer l’objectif ni le fait que cette référence provenait déjà de durées réellement courues.

### Correction

Pour endurance, distance et préparation de course, une séance facile fondée sur une référence provisoire conserve la durée réellement observée, limitée par la disponibilité et arrondie au pas existant. Elle n’augmente ni intensité ni terrain et ne débloque aucune séance structurée.

Débuter, reprendre, plaisir/forme et vitesse conservent la réduction prudente. Une disponibilité plus courte reste prioritaire : une séance de 20 minutes demeure possible lorsque le plafond déclaré vaut 20 minutes.

Résultat sur douze semaines : la trajectoire stable reste à 40 minutes ; aucune réduction récursive n’apparaît.

## 2. Amorçage d’un débutant

### Reproduction

- Entrée : objectif débuter, profil et disponibilités enregistrés, aucune activité et aucune occurrence V2.
- Avant : `habitualReferenceFromOccurrencesV2()` retournait une référence indisponible ; le catalogue refusait alors tout candidat et `temporalAnchorFromSnapshotV2()` ne trouvait ni activité ni présentation.
- Cause : l’enregistrement `evolvingCoach` possédait déjà un `createdAt` persistant, mais `readCoachV2Snapshot()` supprimait cette information en ne transmettant que les valeurs de configuration.

### Correction

L’instantané transmet désormais la date civile de création de la configuration. Pour le seul objectif débuter, elle fournit une ancre `bootstrap` déterministe lorsque aucune activité ni présentation n’existe. Le catalogue utilise alors son amorçage prudent historique, sans créer d’activité, de présentation ou de capacité fictive.

La date provient d’IndexedDB, reste identique entre consultations et onglets, et n’utilise ni l’heure de consultation ni un identifiant aléatoire. Les autres objectifs continuent de refuser une référence indisponible.

Résultat : une séance facile de 15 minutes est proposée dans le cas synthétique avec disponibilité de 30 minutes ; deux onglets calculent la même occasion et convergent vers une seule occurrence après confirmation.

## 3. Endurance et vitesse avec référence provisoire

### Reproduction

- Entrée : quatre durées cohérentes de 40 minutes, expérience déclarée, rôles historiques éventuellement documentés, référence encore provisoire.
- Avant : les deux objectifs recevaient uniquement `easy-endurance` de 30 minutes.
- Cause : le catalogue interdisait justement les séances exigeantes en confiance provisoire, mais utilisait aussi exactement la même réduction de durée pour tous les objectifs.

### Correction

Les garde-fous structurés restent inchangés. La différence porte sur une dimension sûre et observable :

- endurance : séance facile proche de la référence réelle, soit 40 minutes ;
- vitesse : séance facile raccourcie à 80 %, soit 30 minutes.

Aucun fractionné, effort soutenu ou type historique n’est inventé. Le catalogue expose une raison distincte pour chaque politique provisoire. La différenciation est donc fonctionnelle par la durée, sans prétendre entraîner la vitesse avant confirmation suffisante.

## Résultats longitudinaux

Le banc rejoué couvre les six trajectoires applicatives et les 140 trajectoires expérimentales sur douze semaines.

- progression et réduction continuent de suivre uniquement les activités réelles ;
- les suggestions ignorées ne créent ni pratique ni dette ;
- les interruptions conservent les transitions prudentes ;
- les séances exigeantes restent soumises à une référence confirmée, une expérience compatible et un rôle explicitement documenté ;
- les plafonds quotidiens restent prioritaires ;
- les blocs structurés et les références habituelles restent stables.

## Limites restantes

- Le ratio de 80 %, l’amorçage de 20 minutes avant réduction et les fenêtres temporelles restent des choix expérimentaux, pas des constantes scientifiques.
- La séance initiale de 15 minutes pour débuter devra être validée éditorialement avant exposition publique.
- L’objectif vitesse avec référence provisoire propose une sortie facile plus courte ; il n’apporte volontairement aucun travail de vitesse tant que les preuves nécessaires manquent.
- Le déclenchement public d’une présentation reste à définir ; aucune activation publique n’est réalisée ici.
