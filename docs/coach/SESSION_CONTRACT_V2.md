# Contrat enrichi des séances Coach V2

Phase 3B — conception uniquement. Ce contrat décrit un futur objet métier en mémoire. Il ne modifie ni le Coach actuel, ni `StoredSuggestion`, ni le stockage.

Une séance reste une proposition facultative. Son contenu explique une intention du Coach ; il ne décrit pas automatiquement ce que le coureur réalisera réellement.

## 1. Contrat conceptuel

```ts
type SessionType =
  | 'easy-endurance'
  | 'long-run'
  | 'steady-run'
  | 'intervals'
  | 'hills'
  | 'recovery';

type QualitativeIntensity = 'very-easy' | 'easy' | 'steady' | 'controlled-hard';
type QualitativeTerrain = 'flat' | 'rolling' | 'hills';

interface CoachSessionV2 {
  type: SessionType;
  totalDurationSeconds: number;
  intensity: QualitativeIntensity;
  terrain: QualitativeTerrain;
  shortSummary: string;
  optionalInstructions?: string[];
  structure?: SessionStructure;
  rationale: {
    observedFacts: string[];
    runnerDeclarations: string[];
    designChoices: string[];
    uncertainties: string[];
  };
  optional: true;
}

interface SessionStructure {
  warmUp?: SessionBlock;
  efforts: SessionBlock[];
  recoveries?: SessionBlock[];
  coolDown?: SessionBlock;
}

interface SessionBlock {
  repetitions?: number;
  durationSeconds: number;
  intensity: QualitativeIntensity;
  instruction: string;
}
```

Les quatre dimensions principales restent le type, la durée totale, l'intensité qualitative et le terrain qualitatif. Elles doivent être explicites et indépendantes : `rolling` n'implique pas `steady`, et `easy` peut être proposé sur un terrain familier vallonné.

### Résumé et consignes

- `shortSummary` tient sur une ligne et décrit seulement les quatre dimensions utiles, par exemple : « Sortie longue · 45 min · Facile · Plat ».
- `optionalInstructions` contient des consignes brèves accessibles sur demande. Leur absence est valide.
- `structure` est réservée aux séances réellement structurées. Une endurance libre ou une sortie longue ne reçoit pas artificiellement des blocs.
- Les instructions ne contiennent ni promesse de résultat, ni jugement en cas de modification ou d'absence de réalisation.

### Invariant de durée

Pour une séance structurée, la somme développée des blocs doit être exactement égale à `totalDurationSeconds` :

```text
échauffement
+ somme(répétitions × effort)
+ somme(répétitions × récupération)
+ retour au calme
= durée totale
```

Une récupération absente vaut « aucun bloc », jamais une durée supposée nulle cachée. Le validateur devra refuser une somme incohérente, une durée négative, une répétition non entière ou une structure exigée mais incomplète.

## 2. Informations nécessaires par objectif

Les faits observés, les déclarations du coureur et les hypothèses du moteur restent séparés.

| Objectif | Informations minimales | Informations utiles supplémentaires | Comportement prudent si elles manquent |
|---|---|---|---|
| Débuter | Objectif, disponibilité, absence ou état de la référence actuelle | Premières sorties documentées, préférence de terrain | Endurance facile d'amorçage ou aucune durée chiffrée ; jamais de séance exigeante automatique |
| Reprendre | Référence actuelle distincte de l'ancien historique, disponibilité | Nouvelles sorties depuis la reprise, préférences | Récupération ou endurance facile ; ancienne performance uniquement descriptive |
| Plaisir et forme | Choix explicite de cet objectif, disponibilité | Terrain préféré, pratique récente | Idée facile facultative sans progression, quota ni séance de rattrapage |
| Améliorer l'endurance | Référence habituelle valide, historique suffisamment documenté | Sorties longues observées, volume et rythme récents | Endurance facile ; aucune sortie plus longue si sa justification est insuffisante |
| Améliorer la vitesse | Référence valide et pratique récente documentée | Séances soutenues ou fractionnées réellement renseignées, disponibilité adaptée | Endurance facile ; l'objectif seul n'autorise pas le fractionné |
| Atteindre une distance | Distance visée, distance actuellement documentée, référence valide | Échéance facultative, sorties longues observées | Ne pas annoncer la faisabilité ; rester facile ou ne pas proposer de développement |
| Préparer une course | Distance visée, distance documentée, échéance si connue | Pratique structurée observée, terrain de l'épreuve seulement s'il est déclaré | Ne pas inventer l'échéance, le parcours ou une progression de rattrapage ; proposition facile seulement |

Pour les objectifs mesurables :

- `targetDistanceMeters` est une déclaration du coureur ;
- `documentedDistanceMeters` provient de courses enregistrées et qualifiées avec leur période ;
- `eventDate` est facultative sauf décision produit contraire pour « préparer une course » ;
- aucune de ces valeurs ne doit être reconstruite depuis une autre ;
- une distance cible supérieure à la distance documentée décrit un écart, pas une capacité ni une progression obligatoire.

## 3. Garde-fous du contrat

1. Une séance soutenue, fractionnée ou structurée en côtes exige des faits suffisants et une règle d'admissibilité explicable. L'expérience déclarée seule ne suffit pas.
2. Le terrain ne remplace jamais l'intensité. Aucun D+, pourcentage de pente ou itinéraire n'est produit.
3. Une proposition ne crée aucune dette et n'impose aucune progression.
4. Une évolution ordinaire ne doit augmenter qu'une dimension parmi durée, intensité et difficulté du terrain. Toute exception future devra être explicite, justifiée et testée.
5. Une association entre suggestion et course prouve une correspondance de date, pas le type effectivement réalisé. Le type d'une course importée reste inconnu sans donnée indépendante fiable.
6. Les pas de durée, proportions, nombres de répétitions et critères d'entrée sont des paramètres de conception versionnés. Ils ne sont jamais présentés comme des constantes scientifiques.
7. Toute proposition porte `optional: true`. Les textes visibles conservent la possibilité de modifier, remplacer ou ignorer la séance.
8. Une donnée absente ne devient ni zéro ni une valeur moyenne inventée. Une incertitude peut supprimer un candidat exigeant sans bloquer une option facile cohérente.

## 4. Exemples par objectif

Ces exemples illustrent le contrat. Leurs durées sont des choix éditoriaux de démonstration, pas des doses validées.

### Débuter

**Endurance facile · 15 min · Facile · Plat**

Consigne facultative : courir à une allure permettant de rester à l'aise. Aucun découpage imposé et aucune progression promise.

### Reprendre

**Récupération · 15 min · Très facile · Plat**

L'ancien historique peut expliquer le contexte, mais ne fixe pas cette durée. L'alternative « ne pas courir aujourd'hui » reste recevable.

### Plaisir et forme

**Endurance facile · 40 min · Facile · Vallonné**

Le vallonné correspond ici à une préférence déclarée. Il ne transforme pas la séance en effort soutenu et n'impose aucune augmentation ultérieure.

### Améliorer l'endurance

**Sortie longue · 45 min · Facile · Plat**

Cette variante suppose une référence habituelle de 40 minutes et des sorties longues déjà documentées. Seule la durée augmente ; l'intensité et le terrain restent simples.

### Améliorer la vitesse

**Fractionné · 30 min · Effort contrôlé · Plat**

Structure illustrative dont la somme est exacte :

| Bloc | Calcul | Durée |
|---|---:|---:|
| Échauffement facile | 1 × 10 min | 10 min |
| Efforts contrôlés | 4 × 2 min | 8 min |
| Récupérations faciles | 4 × 2 min | 8 min |
| Retour au calme | 1 × 4 min | 4 min |
| **Total** |  | **30 min** |

Cet exemple n'est admissible que si une pratique structurée comparable est suffisamment documentée. Il ne prescrit ni allure chiffrée, ni fréquence cardiaque, ni sprint.

### Atteindre une distance

**Sortie longue · 45 min · Facile · Plat**

La distance visée et la distance documentée sont affichées séparément dans le diagnostic. La séance ne promet pas d'atteindre la cible et ne demande pas de la parcourir à chaque sortie.

### Préparer une course

Deux contenus restent distincts :

- **Endurance facile · 30 min · Facile · Côtes** : sortie libre sur un relief familier, sans blocs ;
- **Côtes · 30 min · Facile · Côtes** : séance structurée, seulement si cette pratique est admissible.

Structure illustrative de la seconde :

| Bloc | Calcul | Durée |
|---|---:|---:|
| Échauffement facile | 1 × 10 min | 10 min |
| Montées maîtrisées | 4 × 1 min | 4 min |
| Récupérations très faciles | 4 × 2 min | 8 min |
| Retour au calme | 1 × 8 min | 8 min |
| **Total** |  | **30 min** |

Le simple choix du terrain `hills` ne suffit jamais à changer le type en `hills`. La séance structurée exige une justification distincte et n'ajoute ici ni durée ni intensité qualitative élevée.

Si le terrain de l'épreuve n'est pas connu, le Coach ne le suppose pas et conserve une alternative plate ou libre.

## 5. Intégration future

### Données supplémentaires nécessaires

- provenance et état de validité de la référence habituelle ;
- couverture des activités récentes et raisons d'incertitude ;
- pratique structurée réellement documentée sans la déduire d'une association ;
- distance cible, distance documentée et échéance séparées ;
- disponibilité applicable à la date proposée ;
- préférence de relief distincte de la surface ;
- politique et paramètres expérimentaux ayant produit la séance.

### Adaptations minimales du prototype 3A

1. Remplacer le résultat plat par `CoachSessionV2` avec résumé, consignes, justification et structure facultative.
2. Ajouter un validateur pur des blocs et de leur somme.
3. Séparer l'admissibilité d'un type de sa composition et de son placement calendrier.
4. Remplacer `observedSessionTypes` fourni artificiellement par une preuve explicitement qualifiée ; tant qu'elle n'existe pas, conserver l'état inconnu.
5. Garder la référence B 2G comme entrée opaque : le sélecteur de séance ne doit ni la recalculer ni prolonger sa validité.

### Points à tester en phase 3C

- validation exacte des sommes, répétitions et bornes de disponibilité ;
- absence de structure sur les séances libres ;
- sept objectifs avec données complètes, partielles et contradictoires ;
- refus des séances exigeantes sans preuve suffisante ;
- séparation terrain/intensité et distinction « terrain en côtes » / « séance de côtes » ;
- une seule dimension accrue et alternative facile lorsque le candidat est refusé ;
- stabilité du résumé et des consignes pour les mêmes entrées ;
- comportement après interruption, import tardif ou disparition d'une preuve ;
- simulations longitudinales des fréquences de séances longues ou structurées.

## 6. Questions ouvertes

- Quelle information fiable peut établir qu'une séance structurée a déjà été pratiquée, sans l'inférer de sa durée ou d'une suggestion associée ?
- Une échéance doit-elle être obligatoire pour « préparer une course » et facultative pour « atteindre une distance » ?
- Quels vocabulaires d'intensité et de terrain seront compris sans être interprétés comme des zones physiologiques ?
- Quelles structures de fractionné et de côtes peuvent être activées, et sur quelles références spécifiques ?
- Une séance de récupération doit-elle rester disponible sans ressenti récent, ou l'incertitude doit-elle conduire à ne rien proposer ?
- Le contrat doit-il mémoriser les blocs en production, ou seulement les reconstruire à partir d'une politique versionnée ?
- Comment faire évoluer le format persistant tout en conservant les suggestions v1, leurs identifiants, associations et sauvegardes ?
