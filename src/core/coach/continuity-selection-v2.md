# D3c — sélection avec mémoire calculée

## Intégration

`adaptCoachV2WithContinuity` reconstruit D3b depuis l'instantané courant, puis
appelle l'adaptateur synchrone avec cette mémoire authentifiée. Les lectures
applicatives, la projection commune et la vérification avant présentation passent
par cette frontière. L'adaptateur synchrone sans mémoire reste disponible pour
les simulations et les comparaisons avant/après.

`selectContinuityV2` est pure. L'orchestrateur l'appelle après ses protections et
D2, puis le classement du tempérament. Les perspectives l'appellent après leurs
préférences et leurs espacements d'intentions. La réutilisation d'une occurrence
active consulte la même politique sur le groupe admissible de sa date.

Aucune modification du catalogue, des formulaires, du schéma, des sauvegardes,
des migrations, du numéro de version ou du changelog. Aucun accès à une base dans
la politique. Aucun journal, compteur, dette ou état de progression ajouté.

## Règles activées

- Identité sportive D3a : les identifiants et textes ne départagent pas les
  contenus ; les blocs restent significatifs.
- Observation des prescriptions proposées depuis moins de 28 jours civils,
  date de prescription incluse ; J+28 exclu. C'est une fenêtre éditoriale de
  mémoire, pas un délai obligatoire. Elle ne diffère aucune séance.
- Une présentation postérieure à la date examinée ne fournit aucune source.
  Les activités sources doivent aussi être datées dans la fenêtre examinée.
- Une alternative doit déjà appartenir aux candidats admissibles. D3c conserve
  le type et l'intensité choisis par les critères existants du Coach.
- Comparabilité : même durée et terrain, avec blocs différents ; pour l'endurance
  facile, les options déjà prévues par le catalogue sont aussi reconnues : plat
  à durée identique après vallonné, ou un palier de 300 secondes plus court sur
  le même terrain. D3c ne construit jamais ces options et ne relève aucune durée.
- Une alternative sans prescription identique récente est préférée. En cas de
  plusieurs possibilités, l'identité canonique ordonne le départage de façon
  déterministe. Aucun score de difficulté ou de progression n'est inventé.
- Si toutes les variantes comparables ont aussi été proposées, le choix initial
  reste pertinent. Sans alternative comparable, la répétition reste autorisée.
  Sans identité ou historique exploitable, le classement initial reste inchangé.

Les décisions exposent un statut, des motifs, les identifiants et dates des
prescriptions sources, leur statut explicite, et les mesures déclaratives
pertinentes de l'activité liée (identifiant, date, type réel, ressenti). La clé
sportive de l'alternative choisie est fournie. L'adaptateur expose les décisions
par date ; les perspectives exposent leur propre décision.

## Bilans et protections

`partial` ne signifie pas échec. `completed` ne prouve aucune facilité.
`not-completed` compte uniquement comme proposition passée et ne produit aucune
activité. Une association historique reste non confirmée. Le type réellement
déclaré peut différer du type conseillé : la prescription reste une proposition,
pas une preuve d'exécution de ses blocs. Les descriptions libres sont ignorées.

Le ressenti et le type réels restent consommés par D2 ; D3c les cite sans créer
une deuxième pénalité. Les protections existantes restent de 2 jours après
activité, 7 jours pour les ressentis difficiles, 10 jours entre sorties longues
et 14 jours entre séances structurées. Aucune option exclue par D2 ne revient.

Chaque consultation reconstruit la mémoire. Une correction completed/partial ou
la suppression d'une confirmation change les sources explicites ; la proposition
historique peut rester pertinente. La suppression de l'activité invalide son
lien et retire cette source de la politique. Corriger type ou ressenti recalcule
D2 et les sources, sans pénalité mémorisée.

## Actives et perspectives

L'occurrence active examinée à sa date ne se pénalise pas elle-même. Les anciennes
propositions explicitement remplacées ne déclenchent pas un nouveau remplacement.
Une ancienne active moins pertinente n'est pas réutilisée. Son historique et ses
associations ne sont pas modifiés : le mécanisme applicatif existant choisit ou
présente une nouvelle occurrence. Celle-ci peut ensuite être réutilisée, sans
créations en boucle. Les recommandations passées d'autres dates restent des
sources, même si leur état est encore actif.

Les perspectives utilisent la mémoire réelle, jamais une confirmation fabriquée.
Leurs intentions conservent seulement les espacements et préférences existants.
Elles n'ajoutent aucune activité à D3b ou D2.

## Différences avant/après vérifiées

| Situation synthétique | Avant D3c | Après D3c |
| --- | --- | --- |
| Fractionné A récemment proposé, variante B admissible de mêmes type/durée/intensité/terrain | A, selon classement existant | B, avec source de A et motif |
| Même cas, bilan partial facile, difficile ou sans détail, hors protection D2 | A | B ; statut partiel conservé, aucune dette |
| Bilan completed très difficile à J+2 | Facile ou aucun candidat selon options | Même protection D2 |
| Non-réalisation ou association sans confirmation | Historique sans effet sur le départage | Proposition passée utilisée ; aucune réalisation déduite |
| Même sport sous deux identifiants | Deux objets distincts | Une même identité, pas une alternative |
| Catalogue réel facile vallonné, Pas à pas ou Rentre dedans | Option facile initiale répétée | Option facile comparable déjà présente |
| Catalogue réel, Évolution Active déjà sur l'option la plus courte | Option courte | Répétition autorisée faute d'alternative comparable |
| Ancienne active répétée avec alternative | Réutilisation de l'active | Ancienne conservée ; nouvelle occurrence admissible réutilisable |
| Aucune alternative ou historique insuffisant | Classement initial | Choix sportif inchangé, diagnostic explicite |
| Perspective avec variante admissible | A | B sans activité supplémentaire |

## Vérification et limites

Les tests dédiés couvrent les trois tempéraments, les frontières temporelles,
l'ordre des données, les corrections et suppressions, les actives, les perspectives,
un catalogue réel et des écritures dans une base `d3c-<UUID>` isolée. Le test
navigateur utilise un contexte neuf et le garde existant interdisant toute ouverture
ou suppression de `runklmrun`.

La comparabilité est volontairement conservatrice : aucune substitution entre
familles n'est ajoutée. Les variantes structurées ne sont sélectionnables que si
elles existent dans le groupe fourni ; le catalogue actuel n'est pas enrichi par
D3c. Les blocs réellement effectués ne sont pas connus. Une déclaration de type
ne suffit pas à reconstruire une prescription réellement exécutée. Le choix entre
alternatives équivalentes reste éditorial, sans prétention physiologique.

D4 n'est pas engagé.

## Fichiers de cette étape

Créés :

- `src/core/coach/continuity-selection-v2.ts`
- `src/core/coach/continuity-selection-v2.test.ts`
- `src/core/coach/continuity-selection-v2.md`
- `e2e/coach-v2-continuity.spec.ts`

Modifiés en préservant le travail déjà présent :

- `src/core/coach/application-adapter-v2.ts`
- `src/core/coach/simulation/session-orchestrator-v2.ts`
- `src/core/coach/presentation-identity-v2.ts`
- `src/core/coach/perspectives-v2.ts`
- `src/storage/coach-v2-readonly.ts`
- `src/storage/coach-suggestions-v2.ts`
- `src/components/coach-v2-projection.ts`

## Résultats de validation

- Tests ciblés : 140 réussis dans 5 fichiers, dont 34 cas D3c.
- Suite complète : 1 623 réussis, 1 ignoré ; 104 fichiers réussis, 1 ignoré.
- Navigateur : 11 tests pertinents réussis, dont le nouveau scénario D3c.
- `npx tsc -b` : réussi.
- `npm run build` : réussi ; avertissement Vite sur un paquet supérieur à 500 ko.
- `git diff --check` : réussi.

Les tests navigateur nécessitent l'accès au serveur local hors restriction réseau
du bac à sable. Ils utilisent les gardes de profils isolés. Aucune opération Git
d'écriture ni déploiement n'a été effectué.
