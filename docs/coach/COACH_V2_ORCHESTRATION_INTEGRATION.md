# Coach V2 — intégration expérimentale de l’orchestrateur

Phase 4F, 18 octobre 2026. Cette intégration relie en mémoire la référence hybride C, le catalogue enrichi et l’orchestrateur temporel. Elle ne remplace pas le Coach V1, n’est appelée par aucune interface et n’écrit aucune donnée.

## Points de raccordement

`proposeExperimentalOrchestratedV2()` exécute trois opérations distinctes :

1. `proposeExperimentalCatalogV2()` calcule la référence V2 et les candidats ;
2. `orchestratePrototypeSession()` sélectionne zéro ou un candidat ;
3. l’appelant pourra ultérieurement constater une présentation, en dehors de cette API.

Les présentations déjà connues sont donc une entrée explicite. Le calcul ne transforme jamais une consultation, un recalcul ou une suggestion V1 persistée en présentation V2.

Le résultat conserve le candidat original sans modifier sa durée, ses blocs, ses consignes, son intensité ni son terrain. Il ajoute seulement une empreinte déterministe de contenu. Cette empreinte stabilise les recalculs identiques, mais ne constitue pas une identité persistante définitive.

## Données temporelles

| Donnée | Source admise | Limite |
|---|---|---|
| Date d’activité | Date civile valide du résumé d’une course | Aucune date d’import n’est déduite |
| Type d’activité | Table explicite fournie par l’appelant | L’absence reste inconnue ; durée et import ne déterminent jamais le type |
| Date de présentation | Preuve explicite fournie par l’appelant | Une consultation ne crée aucune preuve |
| Disponibilité | Profil déclaré | Le catalogue conserve provisoirement une seule durée prudente |
| Référence | Politique hybride C | Une référence indisponible ne revient pas silencieusement à V1 |

Les dates civiles sont validées strictement. Elles sont comparées en UTC à minuit afin d’éviter une dépendance au fuseau du navigateur, sans convertir l’heure de départ en une autre date civile.

## Politique expérimentale conservée

- deux jours après une activité réellement enregistrée ;
- trois jours après une présentation connue ;
- quatorze jours entre séances structurées documentées ou présentées ;
- dix jours entre sorties longues documentées ou présentées.

Ces valeurs sont des choix expérimentaux issus de 3F, pas des constantes scientifiques. Une présentation ignorée agit seulement sur la stabilité de présentation pendant trois jours. Elle n’est jamais traitée comme un effort physique.

## V1 et V2

V1 demeure le chemin implicite et explicite de `proposeSuggestions()`. Aucun champ, résultat ou objet persistant V1 n’est modifié.

V2 exige l’appel explicite de `proposeExperimentalOrchestratedV2()`. Une référence confirmée peut alimenter le catalogue complet lorsque des types fiables sont fournis. Une référence provisoire reste limitée aux alternatives prudentes du catalogue. Une référence indisponible retourne zéro sélection et le motif `catalog-unavailable`.

## Stabilité et absence d’effet

Deux appels avec les mêmes entrées donnent la même sélection et la même empreinte. Aucun appel :

- ne crée une présentation ;
- ne persiste une suggestion ;
- ne modifie les suggestions V1 existantes ;
- ne rapproche une séance d’une activité ;
- ne crée de dette après une suggestion ignorée.

Une future intégration devra fournir séparément la preuve qu’une sélection a été réellement rendue visible, puis définir une identité persistante compatible avec les suggestions déjà enregistrées.

## Limites avant activation réelle

- Aucun composant ne consomme l’API V2.
- Les données actuelles ne qualifient généralement pas le type des activités importées.
- Aucune date de présentation V2 n’existe encore en production.
- L’empreinte de contenu ne remplace pas une identité métier.
- La disponibilité par jour n’est pas encore associée à une date candidate précise.
- La sélection porte sur la date de consultation et ne constitue pas un calendrier.
- L’API ne persiste, ne restaure et ne rapproche aucune séance V2.

Avant activation, il faudra définir la frontière de présentation effective, une identité stable, le stockage compatible, la disponibilité attachée au jour choisi et les règles de migration sans réécrire les suggestions V1.
