# D4b — politique commune de récupération

## Contrat et périmètre

`evaluateRecoveryV2` est une fonction pure, déterministe, sans stockage, horloge implicite ni dépendance à D4a. Elle reçoit une date civile explicite et des preuves déjà admissibles. Les jours sont calculés en UTC à partir des dates civiles, sans durée glissante ni décalage saisonnier.

| Protection | Sources | Périmètre | Levée |
| --- | --- | --- | --- |
| Repos minimal | Activités admissibles, même sans durée | Toutes les séances | J+2 |
| Ressenti difficile | Activité avec `hard` | Préférence facile, pas une interdiction | J+7 |
| Ressenti très difficile | Activité avec `very-hard` | Séances structurées et longues interdites ; facile possible | J+7 |
| Sortie longue | Type réel déclaré `long-run` | Sorties longues uniquement | J+10 |
| Séance structurée | `intervals`, `steady-run`, `hills`, `endurance-variations` | Les quatre familles ensemble | J+14 |

À la frontière exacte, la protection cesse. Pour plusieurs protections applicables, `notBefore` est leur date de levée maximale. Cette date n'est pas une promesse de recommandation.

Le résultat expose la date, les paramètres, les protections avec périmètre/délai/date/sources/motif, les décisions `gates`, la préférence facile, les inconnues et les limites. `spacing` expose la seule étape d'espacement : l'orchestrateur l'utilise avant le traitement du ressenti pour conserver son ordre historique et ses motifs. Ce champ n'est pas une autorisation sportive complète. `gates` inclut aussi `very-hard`.

Les paramètres de simulation historiques restent accessibles via les anciens exports de l'orchestrateur. La production conserve 2/7/10/14. Aucun seuil adaptatif n'est introduit.

## Audit et chemins effectivement raccordés

- `interpretRecentLoadV2` dans `load-adaptation-policy-v2.ts` appelle la politique commune avec les activités D2a. Ses protections, dates et motifs sont adaptés au contrat D2 existant. Les préférences de volume, la qualité et la progression D2 restent inchangées.
- `applyLoadAdaptationV2` dans `load-adaptation-selection-v2.ts` emploie la classification commune des périmètres et les décisions D2 précédentes.
- `orchestratePrototypeSession` appelle directement la politique commune pour le repos, les espacements et les ressentis. Classement, tempéraments et D3c sont conservés.
- `coachV2ProgressionState` réutilise la fenêtre de ressenti commune. Ses critères de régularité et de progression restent identiques ; aucun fichier du catalogue n'est modifié.
- `adaptCoachV2Readonly` / `adaptCoachV2WithContinuity` dans `application-adapter-v2.ts` conservent leur contrat et obtiennent la politique par D2 et l'orchestrateur, pour chaque date calculée.
- `admissibleCoachV2Content` / `reusableActiveOccurrenceV2` dans `presentation-identity-v2.ts` consomment les candidats ainsi réévalués. Une active incompatible n'est pas réutilisée ; ces fonctions ne modifient pas son historique.
- `coachV2Perspectives` dans `perspectives-v2.ts` réutilise l'orchestrateur et les décisions par date. Les intentions précédentes sont transmises séparément, sans devenir des réalisations.
- `presentCoachV2Selection` recalcule toujours l'adaptateur avant la mémorisation. `replaceCoachV2Selection` le fait désormais aussi. Tous deux vérifient le même instantané sous transaction avant une écriture.

Aucun calcul de récupération dupliqué n'est ajouté à l'adaptateur, à l'identité ou aux perspectives.

## Intentions et qualité

Une intention ne fournit que date et type à l'espacement d'une projection. Ses sources portent `kind: intention`, sans effort ni identifiant d'activité. Une intention postérieure à la date examinée est ignorée. Elle n'ajoute ni ressenti, ni confirmation, ni preuve de tolérance.

Les types, efforts et identifiants absents sont exposés. Une durée n'est pas requise pour le repos minimal. Les sources futures sont signalées et exclues. Les doublons identiques sont dédupliqués de façon déterministe ; les contradictions résiduelles de même identifiant sont signalées et leurs protections connues se cumulent, sans arbitrage inventé.

Le filtrage des sports, la validation des associations, les corrections et la gestion amont des contradictions restent sous la responsabilité de D1/D2a et des lecteurs existants. La politique ne doit pas recevoir directement des activités brutes non filtrées. Les confirmations `completed` n'entrent pas dans son contrat. Elle ne mesure aucune récupération physiologique.

## Mémorisation et concurrence

Le remplacement conserve son interface publique, sa génération, ses liens de succession et ses contrôles de révision. Avant préparation, il recalcule l'admissibilité sportive à la date civile de présentation et contrôle le tempérament. Avant écriture, une transaction sur les quatre magasins existants compare activités, profil, configuration, tempérament et occurrences avec l'instantané calculé.

Si les sources ont changé, aucune mutation n'est faite : la lecture et le calcul recommencent. Une nouvelle sélection incompatible est refusée avec `CoachV2SelectionChanged`. Un conflit de révision reste un conflit de cycle de vie. Aucun remplacement automatique ni chaîne de remplacements n'est créé. Comme la présentation existante, la relecture optimiste peut attendre la stabilisation des sources sous des modifications continuelles.

Le dépôt bas niveau `replacePresented` conserve son rôle de persistance de décisions déjà prises. Son argument optionnel d'instantané sert au chemin applicatif protégé ; il ne constitue pas un nouveau moteur sportif.

**Différence volontaire de validation :** le remplacement applicatif peut désormais refuser une sélection périmée que l'ancien chemin aurait mémorisée. Les décisions sportives calculées ne changent pas ; cette correction ferme le défaut identifié par l'audit D4.

## Comparaison et tests

`recovery-compatibility-v2.test.ts` et son snapshot contiennent 111 empreintes SHA-256 figées avant les modifications de production : 31 scénarios complets pour chacun des trois tempéraments, plus 18 cas d'orchestrateur historique avec/sans facile et avec `hard`, `very-hard` ou sans ressenti. Les objets comparés comprennent les résultats complets avant/après ajout d'une occurrence, la réutilisation active et les perspectives, pas seulement le type sélectionné.

La matrice couvre les frontières 2/7/10/14, quatre familles et alternance, longue, volume, données insuffisantes, sport exclu, futur, doublon, débutant, reprise, soirée et continuité. Les captures complètes facultatives `D4B_CAPTURE=before|after` sont écrites dans `/tmp` pour diagnostiquer les différences. Ne pas régénérer les snapshots pour masquer une divergence.

Le cas de doublon ne crée pas d'occurrence : le validateur historique de référence confirmée refuse ce scénario après création. Ce comportement préexistant n'est pas corrigé par D4b. Les doublons de la politique commune sont testés séparément.

`recovery-policy-v2.test.ts` vérifie les frontières, indépendance longue/structuré, intentions, inconnues, ordre, doublons/contradictions, corrections et suppression. `recovery-persistence-v2.test.ts` vérifie remplacement valide, refus périmé, courses avant transaction pour présentation/remplacement, changement compatible et deux remplacements concurrents. Tous utilisent des données synthétiques ; la persistance utilise `fake-indexeddb` et des noms `d4b-*`.

Les suites D2, D3c, identité, perspectives et simulations existantes restent des contrôles complémentaires. Les tests navigateur utilisent les profils isolés du dispositif `protected-test`, qui interdit la base historique.

## Limites avant D4c

Aucune donnée D4a n'assouplit un délai. Les habitudes descriptives ne démontrent ni tolérance ni récupération. Avant D4c, toute évolution des délais devra avoir un contrat explicite, des critères de données suffisantes et des comparaisons distinctes. Les inconnues actuelles, le cas historique de référence avec doublons et les changements continus durant une transaction ne doivent pas être interprétés comme des preuves physiologiques.

## Résultats de validation D4b

- Tests ciblés : 7 fichiers, 215 tests réussis.
- Comparaison avant/après : 111 snapshots inchangés ; égalité supplémentaire des 111 objets complets capturés.
- Suite complète : 108 fichiers réussis, un ignoré ; 1 790 tests réussis, un ignoré.
- Navigateur : 11 tests réussis (`coach-v2-continuity`, `coach-v2-load`, `coach-v2-internal`).
- `npx tsc -b`, `npm run build`, `git diff --check` : réussis. Espaces de fin de ligne des fichiers nouveaux contrôlés séparément.
- Avertissements : bundle Vite supérieur à 500 kB ; conflit cosmétique `NO_COLOR`/`FORCE_COLOR` dans Playwright.
- Empreintes initiales vérifiées : seuls les cinq fichiers de production prévus ont changé. Modifications préexistantes, `.agents/`, D4a, version, changelog, schéma et sauvegardes préservés.

Aucune opération Git d'écriture, migration, publication ni intervention sur la base historique. D4c non commencé.
