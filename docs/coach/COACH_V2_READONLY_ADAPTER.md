# Coach V2 — adaptateur applicatif en lecture seule

Phase 6B, 18 octobre 2026. L’adaptateur relie les données locales au pipeline V2 sans affichage, écriture, identité d’occurrence ni génération.

## Sources de données

`readCoachV2Snapshot()` ouvre une transaction IndexedDB `readonly` unique sur :

- `sessions` : activités réellement enregistrées ;
- `coachProfile` : disponibilités et préférences déclarées ;
- `evolvingCoach` : objectif, expérience et consentement déclarés ;
- `coachSuggestionsV2` : présentations, provenances et associations V2 persistées.

Les valeurs sont validées puis clonées. Le magasin V1 n’est ni lu ni utilisé comme substitut. L’instantané ne contient aucun type de séance documenté, car le stockage actuel ne fournit pas cette information de façon fiable.

La sortie distingue :

- `facts` : identifiants des activités et occurrences réellement lus ;
- `declarations` : objectif et disponibilités du coureur ;
- `uncertainties` : absence de date future, absence habituelle de type fiable et séparation entre calcul et présentation.

## Référence habituelle

`habitualReferenceFromOccurrencesV2()` classe prudemment les activités :

- une association V2 valide donne une observation `suggestion-linked` ;
- un identifiant cité par une provenance V2 `confirmed` donne une preuve indépendante admissible ;
- une activité le jour d’une suggestion présentée mais non associée reste ambiguë ;
- les autres activités réelles peuvent seulement alimenter l’amorçage provisoire.

La politique bornée B et la validité 2G sont réutilisées. Une activité associée peut maintenir une référence confirmée, sans la réviser automatiquement. Une provenance confirmée est la seule manière actuelle d’obtenir une référence confirmée depuis V2.

Sans cette preuve, quatre durées réelles cohérentes et actuelles peuvent produire une estimation explicitement `provisional`. Des durées trop peu nombreuses, trop anciennes ou trop dispersées produisent `unavailable`. Il n’existe aucun retour silencieux vers la référence V1.

Les seuils restent ceux du prototype expérimental : quatre observations, écart relatif maximal de 0,5 et fenêtre de 42 jours. Ils ne sont pas présentés comme des constantes scientifiques.

## Pipeline

`adaptCoachV2Readonly()` enchaîne :

```text
instantané réel
  → référence hybride issue des occurrences V2
  → catalogue enrichi
  → orchestrateur temporel
  → zéro ou une séance candidate en mémoire
```

Le catalogue accepte désormais une référence déjà calculée par `proposeExperimentalCatalogFromReferenceV2()`. L’ancien point d’entrée expérimental fondé sur V1 reste disponible et inchangé pour ses tests antérieurs.

Lorsqu’une séance est sélectionnée, elle conserve type, durée, intensité, terrain, résumé, consignes et blocs structurés du catalogue. Les raisons du catalogue et les incertitudes de l’adaptateur accompagnent le résultat. Si aucune séance n’est possible, `reason` distingue l’indisponibilité du catalogue, une activité récente, une présentation récente ou l’absence de candidat.

Les occurrences existantes fournissent uniquement des preuves de présentations passées à l’orchestrateur. Le calcul courant ne crée jamais une nouvelle présentation.

## Disponibilités et date

Les disponibilités viennent exclusivement du profil déclaré. Le plafond existant du catalogue est conservé. L’adaptateur ne choisit pas encore un jour compatible et retourne toujours :

```ts
selectedDate: null
```

Une séance candidate n’est donc pas une proposition datée. Elle ne possède ni ancre, ni clé de présentation, ni identifiant persistant, ni génération. Une consultation de l’adaptateur n’est pas mémorisée.

## Garanties vérifiées

- aucun accès IndexedDB `readwrite` ;
- aucun appel à `add`, `put` ou `delete` pendant lecture et calcul ;
- aucune lecture ou modification des suggestions V1 ;
- aucun type sportif déduit d’une durée, d’une date ou d’un terrain ;
- aucune séance structurée sans type documenté explicitement ;
- aucune modification d’interface, de navigation ou du comportement V1 ;
- résultats déterministes avec les mêmes données.

Un scénario de douze semaines alimente explicitement l’historique avec des courses personnelles. Les séances calculées ne sont jamais réinjectées comme activités ou présentations. La variante provisoire reste stable à 30 minutes et ne crée aucune progression récursive.

## Limites et dépendances de la phase 6C

1. Choisir un jour futur parmi les disponibilités et appliquer son plafond propre.
2. Définir une ancre stable à partir d’un fait réellement disponible.
3. Attribuer la génération transactionnellement sans la faire dépendre des consultations.
4. Définir la relation entre une sélection recalculée, une occurrence existante et un remplacement explicite.
5. Ajouter un marqueur fiable de couverture V2 si l’absence de suggestion doit un jour prouver qu’une activité est indépendante.
6. Conserver l’interface et la persistance désactivées tant que ces décisions ne sont pas validées.

