# Coach V2 — fondations techniques de persistance en mémoire

Phase 5B, 18 octobre 2026. Le module `persistence-foundations-v2.ts` matérialise le contrat de la phase 5A sans interface, IndexedDB, sauvegarde ou effet persistant.

## Types

Le contrat V2 est autonome et n’utilise pas les types des suggestions V1. Il distingue :

- `CandidateV2`, résultat calculé du catalogue ;
- `SelectedSuggestionV2`, choix en mémoire de l’orchestrateur ;
- `PersistableOccurrenceV2`, instantané créé seulement après une présentation constatée ;
- `ImmutableSessionContentV2`, contenu sportif immuable ;
- `OccurrenceId`, `ContentFingerprint` et `PresentationKey`, trois identités typées et séparées ;
- `CivilDate`, `InstantIso` et `IanaTimeZone` ;
- `PresentationStateV2`, limité à `presented` et `superseded`.

Le contenu conserve le type, la durée totale, l’intensité, le terrain, le résumé, les consignes et les blocs éventuels. Il n’inclut ni activité réalisée, ni date d’import, ni donnée physiologique supposée.

## Validation

Les validateurs refusent explicitement :

- les dates civiles impossibles et les instants non canoniques UTC ;
- les fuseaux inconnus de `Intl` et les décalages hors de −840 à +840 minutes ;
- les valeurs absentes, non entières, négatives ou hors limites ;
- les dimensions sportives hors des énumérations V2 ;
- les propriétés inconnues ;
- une séance structurée sans blocs ;
- des blocs sur une séance libre ;
- une somme de blocs différente de la durée totale ;
- une clé ou une empreinte incohérente dans une occurrence.

Les blocs structurés restent ordonnés. Une sortie facile sur terrain en côtes reste une séance libre `easy-endurance` avec terrain `hills`, distincte d’une séance structurée de type `hills`.

## Canonicalisation et empreinte

`canonicalSessionContentV2()` projette uniquement les propriétés significatives dans un ordre fixe. L’ordre initial des propriétés JavaScript et les propriétés extérieures au contenu n’ont aucun effet. Les tableaux conservent leur ordre, notamment les blocs et les consignes. Une liste facultative vide est normalisée comme une absence.

`contentFingerprintV2()` calcule ensuite :

```text
sha256:<empreinte hexadécimale du JSON canonique UTF-8>
```

L’empreinte décrit le contenu. Elle n’est jamais un identifiant d’occurrence.

## Clé de présentation

`presentationKeyV2()` calcule un SHA-256 déterministe sur :

1. la version du contrat ;
2. l’objectif ;
3. la date civile candidate ;
4. une ancre temporelle fiable : activité, présentation précédente ou amorçage ;
5. le jour disponible et son plafond déclaré éventuel ;
6. un numéro de génération explicite.

La clé exclut le contenu, l’instant exact de consultation et le fuseau de consultation. Un recalcul identique conserve donc la même clé. Une durée ou une consigne différente sur la même occasion produit un conflit de contenu, sans écrasement.

Le numéro de génération commence à 1. Son incrément est une décision explicite de remplacement ou de nouvelle occurrence après expiration. Il ne progresse jamais à cause d’une simple consultation. Cette génération n’impose aucun calendrier : la date candidate reste une proposition facultative attachée à une disponibilité réellement déclarée.

## Transitions en mémoire

```text
candidat ── selectCandidateV2() ──> sélection
sélection ── observePresentationV2() ──> occurrence présentée
```

`selectCandidateV2()` clone et fige les données. Il ne crée ni identifiant, ni moment de présentation, ni occurrence.

`observePresentationV2()` reçoit explicitement le moment constaté, les occurrences déjà connues et une fabrique d’identifiant :

- clé absente : `created`, avec une nouvelle occurrence figée ;
- même clé et même empreinte : `existing`, sans nouvel identifiant ;
- même clé et autre empreinte : `content-conflict`, sans écrasement ;
- génération explicitement différente : nouvelle clé et nouvelle occurrence légitime.

La fonction ne lit et n’écrit aucun stockage. La liste `existing` représente seulement l’instantané que fournira une future transaction.

## Validation réalisée

Les tests ciblent la canonicalisation, l’ordre des blocs, SHA-256, les dates, instants et fuseaux, la somme des blocs, les propriétés invalides, la séparation identité/empreinte/clé, la déduplication, les présentations répétées, les conflits de contenu, la génération suivante et l’absence d’effet d’une sélection.

## Limites avant persistance

- La composition fonctionnelle de la clé est implémentée, mais son ancre devra être fournie par l’orchestrateur de production de façon stable.
- Le numéro de génération n’a pas encore de propriétaire transactionnel.
- La fabrique d’identifiant est injectée ; une future API utilisera `crypto.randomUUID()` au moment de l’écriture.
- Aucune règle de rétention, association ou obsolescence n’est appliquée ici.
- La concurrence est simulée par un instantané ; l’unicité réelle nécessitera un index IndexedDB et une transaction.
- Les types ne sont ni exportés dans une sauvegarde, ni acceptés par les validateurs actuels.

La prochaine étape doit tester la création de `presentationKey` depuis les sorties réelles de l’orchestrateur, toujours en lecture seule, avant toute migration IndexedDB.
