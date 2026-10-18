# Coach V2 — contrat de persistance des suggestions

Phase 5A, 18 octobre 2026. Ce document définit un contrat futur. Aucun type, magasin IndexedDB, format de sauvegarde ou comportement de production n’est modifié par cette phase.

## 1. Principes

Une suggestion est facultative. Sa présentation ne prouve ni sa lecture, ni sa réalisation. Son absence de réalisation ne crée aucune dette. Une activité reste un fait séparé et ne reçoit jamais le type de la suggestion à laquelle elle est éventuellement associée.

Le cycle de calcul et le cycle persistant sont séparés :

1. **candidat calculé** : objet en mémoire du catalogue ;
2. **suggestion sélectionnée** : résultat en mémoire de l’orchestrateur ;
3. **suggestion présentée** : premier état qui justifie une écriture ;
4. **association éventuelle** : lien factuel vers une activité, sans affirmation de conformité ;
5. **obsolescence** : la suggestion n’est plus proposée, mais son historique peut rester utile pendant sa rétention.

Une consultation ou un recalcul s’arrête aux deux premiers états. Il ne crée aucun enregistrement.

## 2. Modèle proposé

Le magasin `coachSuggestions` peut accueillir une union discriminée. Les valeurs V1 restent strictement inchangées. Une valeur V2 proposée serait :

```ts
interface StoredSuggestionV2 {
  schemaVersion: 2;

  // Identité de l’occurrence, immuable et indépendante du contenu.
  id: string;
  presentationKey: string;

  // Empreinte distincte, recalculable sur le contenu canonique.
  contentFingerprint: string;

  suggestedFor: string;       // YYYY-MM-DD, date civile candidate
  presentedAt: string;        // instant ISO 8601 UTC
  presentedOn: string;        // YYYY-MM-DD observé au moment de la présentation
  presentationTimeZone: string;
  presentationUtcOffsetMinutes: number;
  civilDateRule: 'device-local-at-presentation';

  content: {
    type: 'easy-endurance' | 'long-run' | 'steady-run'
      | 'intervals' | 'hills' | 'recovery';
    totalDurationSeconds: number;
    intensity: 'very-easy' | 'easy' | 'steady' | 'controlled-hard';
    terrain: 'flat' | 'rolling' | 'hills';
    shortSummary: string;
    optionalInstructions?: string[];
    structure?: SessionStructure;
  };

  provenance: {
    engine: 'coach-v2';
    contractVersion: 1;
    referenceConfidence: 'provisional' | 'confirmed';
    referenceSourceIds: string[];
    limitationCodes: string[];
    availability: {
      weekday: Weekday;
      maximumSeconds?: number;
    };
  };

  state: 'presented' | 'superseded';
  activityId?: string;
  supersedesId?: string;
  revision: number;
  updatedAt: string;
  retainUntil: string;         // premier jour civil supprimable
}
```

`SessionStructure` reprend exactement le contrat V2 : échauffement, efforts, récupérations et retour au calme facultatifs, avec une somme égale à `totalDurationSeconds`. Une séance libre ne reçoit pas de blocs.

Les textes de justification complets du calcul ne sont pas nécessaires à la persistance. Des codes de limites stables conservent les faits utiles sans figer le discours d’interface. Les identifiants de sources servent à l’audit local ; ils ne transfèrent aucun type à une activité.

## 3. Identité, empreinte et révision

### Identité d’occurrence

`id` identifie une occurrence présentée et ne dépend ni de sa durée, ni de son résumé, ni de ses blocs. Il est généré une seule fois, idéalement par `crypto.randomUUID()`, après validation de visibilité et avant la transaction d’écriture.

`presentationKey` est une clé de déduplication distincte. Elle représente l’occasion stable proposée par l’orchestrateur, à partir d’éléments déterministes connus avant le rendu : version de contrat, date candidate, objectif, ancre temporelle réelle et créneau déclaré. Elle ne contient pas le contenu de séance. Sa composition exacte doit être figée avant l’implémentation, car elle détermine si deux calculs représentent la même occasion.

Un index IndexedDB **unique** sur `presentationKey` empêche deux onglets d’enregistrer deux occurrences pour la même occasion. Le gagnant de la transaction fournit l’enregistrement que l’autre onglet relit.

### Empreinte de contenu

`contentFingerprint` est le SHA-256 de la représentation JSON canonique du seul `content`. Elle détecte un changement de proposition, mais n’est jamais utilisée comme clé primaire. Elle est calculée avant la transaction, puis vérifiée à la lecture et lors d’une restauration.

### Révisions

Avant présentation, candidats et sélection peuvent changer librement puisqu’ils ne sont pas persistés. Après présentation, le contenu mémorisé décrit ce qui a réellement été affiché et devient immuable.

Si un contenu différent doit réellement remplacer une occurrence déjà présentée :

- une nouvelle occurrence reçoit un nouvel `id` et une nouvelle `presentationKey` de génération ;
- `supersedesId` désigne l’ancienne occurrence ;
- l’ancienne passe à `superseded` dans la même transaction ;
- aucune obsolescence n’a lieu tant que le nouveau contenu n’a pas été effectivement présenté.

Le champ `revision` reste réservé au contrôle optimiste des métadonnées mutables : état, association et rétention. Il n’est pas une version du contenu. Une même occurrence réaffichée après redémarrage conserve son identifiant et ne provoque aucune écriture.

Les identifiants V1 existants, dérivés du contenu, restent intacts et ne sont jamais convertis automatiquement.

## 4. Présentation effective et atomicité

Le déclenchement reprend le principe V1 : carte connectée, contenu essentiel visible, onglet visible, confirmation différée et annulation lors du démontage exploratoire de React StrictMode.

L’écriture de première présentation doit utiliser une seule transaction `readwrite` couvrant :

- `coachSuggestions` ;
- les magasins qui forment le contexte de calcul à revérifier : séances, profil, configuration et planning si celui-ci intervient encore ;
- aucune autre donnée sans nécessité.

Ordre proposé :

1. figer avant toute attente le contexte et la sélection ;
2. confirmer la visibilité ;
3. préparer `id`, `presentationKey`, contenu canonique, empreinte et dates ;
4. ouvrir la transaction ;
5. relire le contexte et vérifier qu’il correspond toujours à celui de la sélection ;
6. tenter l’ajout protégé par l’index unique `presentationKey` ;
7. appliquer dans la même transaction une éventuelle obsolescence ;
8. notifier les autres onglets uniquement après validation de la transaction.

Une collision sur `presentationKey` n’est pas une erreur utilisateur : l’appelant relit l’occurrence gagnante. Une collision avec un contenu différent doit être signalée comme contexte devenu obsolète et provoquer un nouveau calcul, jamais écraser silencieusement le contenu mémorisé.

Les associations utilisent `id`, `activityId` et `revision`. Une activité ne peut rester associée qu’à une occurrence. Une suppression d’activité retire le lien par transaction contrôlée ; elle ne transforme pas la suggestion en échec.

## 5. Temps et dates civiles

`presentedAt` est l’instant UTC exact obtenu au moment de la visibilité effective. `presentedOn` est calculé une seule fois dans le fuseau civil actif à cet instant. Il n’est jamais reconstruit plus tard depuis `presentedAt` avec le fuseau courant.

Le contrat conserve :

- le nom IANA du fuseau lorsque `Intl` le fournit, par exemple `Europe/Paris` ;
- l’écart UTC effectif en minutes, qui capture le côté été ou hiver à cet instant ;
- la règle `device-local-at-presentation`.

Un changement ultérieur de fuseau ne déplace ni `presentedOn`, ni `suggestedFor`. Les délais de l’orchestrateur utilisent les dates civiles persistées et un calcul en jours civils, sans soustraction d’instants de 24 heures. Les changements d’heure d’été ou d’hiver ne créent donc pas un jour supplémentaire ou manquant.

La date d’une activité reste la date civile déjà enregistrée dans `RunningSession`. Sa date d’import n’existe pas et ne doit pas être inventée. Un rapprochement près de minuit suit la règle existante de date civile source ; l’incertitude reste explicite si les données se contredisent.

## 6. Disponibilité et date candidate

`suggestedFor` rattache la proposition à un jour civil réellement disponible au moment du calcul. La provenance mémorise le jour de semaine et, lorsqu’elle existe, la durée maximale déclarée utilisée comme plafond.

Ce rattachement n’est pas un calendrier obligatoire :

- il n’effectue aucune réservation ;
- il ne crée aucune séance de remplacement ;
- il ne déclenche aucun rattrapage ;
- le coureur peut l’ignorer ou courir un autre jour ;
- un changement de disponibilité ne réécrit pas une suggestion déjà présentée.

Si aucun jour compatible n’est démontré, l’orchestrateur retourne zéro sélection. Il ne fabrique pas de date. La règle exacte de choix entre plusieurs jours admissibles reste à décider avec l’orchestrateur avant persistance.

## 7. Conservation

Il faut distinguer visibilité, mémoire d’orchestration et provenance de référence :

- une suggestion passée peut cesser d’être affichée selon les règles produit actuelles ;
- les présentations structurées doivent rester disponibles au moins quatorze jours ;
- les associations utiles à la référence hybride doivent survivre à la fenêtre actuelle de sept jours.

Politique proposée : `retainUntil` vaut le premier jour civil après **42 jours révolus** à compter de la plus tardive entre `presentedOn` et `suggestedFor`. Ce choix couvre le maximum expérimental de validité de la référence V2 et, par inclusion, les délais de 14 et 10 jours. Il reste un paramètre de conception, pas une durée scientifiquement validée.

Le nettoyage reste borné par lots et fondé sur l’index `retainUntil`. Une occurrence peut être supprimée seulement si elle est arrivée à échéance et si aucune opération transactionnelle en cours ne la référence. La suppression ne touche jamais l’activité associée.

Les occurrences `superseded` ne sont pas supprimées immédiatement : leur présentation passée compte encore pour éviter une répétition temporelle. Une suppression de toutes les données Coach efface naturellement cette mémoire ; le Coach doit alors déclarer ses preuves insuffisantes plutôt que reconstruire des présentations.

Une limite supplémentaire par volume n’est pas nécessaire tant que le rythme maximal reste borné par le produit, mais un diagnostic devra surveiller le nombre d’enregistrements. Toute future limite doit conserver en priorité la fenêtre temporelle utile et les associations, sans échantillonnage silencieux.

## 8. Compatibilité V1, IndexedDB et sauvegardes

### IndexedDB

Le même magasin peut contenir `StoredSuggestionV1 | StoredSuggestionV2`. Toutefois, l’index unique `presentationKey` et l’index `retainUntil` exigent une montée de version IndexedDB additive. La migration :

- crée les index sans réécrire les valeurs V1 ;
- laisse les champs absents non indexés pour V1 ;
- n’invente ni présentation civile, ni fuseau, ni contenu V2 pour les anciennes suggestions ;
- doit être atomique et rester bloquable proprement par un ancien onglet.

Créer un magasin V2 séparé éviterait les index hétérogènes, mais dupliquerait fusion, rapprochement, notifications et nettoyage. L’union dans le magasin existant est recommandée sous réserve de confirmer que les index uniques ignorent correctement les enregistrements V1 sans `presentationKey` dans les navigateurs pris en charge.

### Sauvegardes

Le format 5 est strict et ne doit pas être étendu silencieusement. La première sauvegarde contenant V2 doit utiliser un nouveau format, proposé comme format 6 :

1. vérifier le SHA-256 du document original avant toute transformation ;
2. accepter une liste mêlant V1 et V2 avec validateurs séparés ;
3. préserver intégralement les identifiants, empreintes, présentations, associations et états ;
4. fusionner V1 par son identifiant historique et V2 par `id`, puis contrôler l’unicité de `presentationKey` et `activityId` ;
5. en conflit V2, conserver la valeur locale et signaler le conflit plutôt que choisir la révision la plus grande sans preuve de filiation ;
6. en remplacement, restaurer atomiquement l’ensemble validé.

Les sauvegardes JSON et gzip restent deux encodages du même document. Les formats 1 à 5 continuent à être restaurés sans enrichissement artificiel. Une restauration ancienne produit seulement des suggestions V1.

Une version plus ancienne de runKLMrun recevant un format 6 doit le refuser clairement avant toute écriture. Elle ne doit ni ignorer les champs V2, ni restaurer partiellement le reste. La compatibilité descendante est donc sûre, mais pas fonctionnelle. Pour permettre une restauration dans une ancienne version, l’utilisateur doit conserver une sauvegarde créée par cette version ; aucun export dégradé V2 vers V1 n’est proposé car il inventerait une équivalence de contenu.

## 9. Validations requises

Le validateur V2 doit notamment vérifier :

- liste fermée de champs et discriminant exact ;
- dates civiles et instants ISO valides ;
- fuseau et décalage bornés, sans recalcul rétroactif ;
- identifiants non vides et longueurs bornées ;
- durée positive et bornée ;
- énumérations fermées ;
- blocs positifs dont la somme égale la durée totale ;
- absence de blocs pour une séance libre ;
- empreinte correspondant au contenu canonique ;
- `retainUntil` cohérent ;
- révision positive ;
- `supersedesId` différent de `id` ;
- activité associée existante lors d’une écriture ou restauration complète ;
- unicité des identités, clés de présentation et associations.

Les limites de taille JSON, profondeur et nombre de propriétés déjà utilisées par les sauvegardes continuent à protéger le contenu textuel et les tableaux de blocs.

## 10. Risques et décisions ouvertes

1. **Composition de `presentationKey`** : définir l’ancre stable qui distingue une révision d’une nouvelle occasion sans dépendre du contenu.
2. **Choix du jour** : arbitrer plusieurs disponibilités compatibles sans construire un calendrier rigide.
3. **Réaffichage** : décider si une occurrence déjà présentée doit rester visible jusqu’à sa date, même si le moteur sélectionnerait autre chose.
4. **Nouvelle génération** : définir quand un remplacement constitue une nouvelle occurrence plutôt qu’un recalcul transitoire.
5. **Rétention de 42 jours** : confirmer qu’elle couvre les besoins de la référence hybride sans conserver inutilement des données.
6. **Provenance minimale** : confirmer les codes de limites et les identifiants sources nécessaires au diagnostic et aux sauvegardes.
7. **Index unique** : vérifier sur les navigateurs ciblés le comportement des valeurs V1 dépourvues de `presentationKey` avant de retenir le magasin partagé.
8. **Conflits de restauration** : définir le rapport utilisateur précis lorsque `id` ou `presentationKey` entre en conflit avec un contenu différent.

## 11. Plan d’implémentation progressif

### Étape 1 — Types et fonctions pures

Ajouter l’union V1/V2, la canonicalisation du contenu, le calcul d’empreinte, les validateurs et la fonction pure de rétention. Tester les entrées invalides, les blocs, les dates, les fuseaux et l’absence de conversion V1.

### Étape 2 — Clé d’occasion expérimentale

Figer et tester `presentationKey` avec consultations répétées, modification de contenu, changement de jour, redémarrage et données concurrentes. Cette étape doit rester sans écriture tant que les frontières de génération ne sont pas validées.

### Étape 3 — Migration additive et dépôt isolé

Créer les index nécessaires, puis une API V2 distincte dans le dépôt existant. Tester la migration depuis la version actuelle, les enregistrements V1 inchangés, l’ajout atomique, les collisions entre onglets et les notifications après validation uniquement.

### Étape 4 — Présentation réelle

Raccorder la détection de visibilité à l’API V2. Vérifier StrictMode, carte masquée, contexte devenu obsolète, réaffichage, fermeture/réouverture et absence d’écriture lors d’un simple calcul.

### Étape 5 — Association, obsolescence et nettoyage

Étendre le rapprochement prudent, puis tester ambiguïtés, suppression d’activité, remplacement effectivement présenté, rétention de 42 jours et nettoyage borné.

### Étape 6 — Sauvegarde format 6

Adapter export, validation, aperçu, fusion et remplacement après vérification SHA-256. Tester JSON, gzip, formats 1 à 5, mélange V1/V2, corruption, conflits, atomicité et refus explicite par contrat d’un format futur.

### Étape 7 — Activation contrôlée

Brancher l’interface seulement après validation des étapes précédentes. Conserver V1 lisible et restaurable, comparer les comportements sur données synthétiques et ne jamais réécrire les anciennes suggestions.

La première étape recommandée est la définition testable des types, de la canonicalisation et de `presentationKey`, encore entièrement en mémoire. La migration IndexedDB ne doit commencer qu’après validation de cette identité d’occasion.
