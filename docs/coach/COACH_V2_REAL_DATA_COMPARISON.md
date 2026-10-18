# Comparaison V1/V2 et enchaînements après fractionné

## Provenance des données

L’environnement de développement en ligne de commande ne peut pas lire l’IndexedDB du navigateur habituel : les données personnelles réelles n’ont donc pas été accessibles pendant cette phase. Aucun résultat synthétique n’est présenté comme réel et aucune donnée brute n’est copiée dans ce document.

Les résultats sportifs ci-dessous proviennent de scénarios synthétiques déterministes. La comparaison réelle doit être consultée localement dans le navigateur qui possède les données.

## Méthode locale en lecture seule

La page Coach contient désormais, uniquement dans un build de développement avec l’activation interne existante, un panneau **Comparaison Coach V1 / V2**. Pour l’ouvrir dans l’origine locale qui contient les données :

1. démarrer l’application en développement ;
2. ouvrir la page Coach ;
3. dans la console de ce navigateur, exécuter `localStorage.setItem('runklmrun:coach-v2-internal', 'enabled')` puis recharger la page ;
4. consulter le panneau de comparaison.

Le comparateur lit dans une seule transaction IndexedDB les activités, le profil, la configuration, le planning et les occurrences V2. Il transmet ensuite le même instantané et la même date de référence aux moteurs V1 et V2. La transaction est `readonly`. Aucun appel de présentation, d’association, de remplacement ou de configuration n’est effectué.

Le panneau montre côte à côte, sans compléter artificiellement V1 :

- dates et durées ;
- types réellement produits ;
- intensité et terrain disponibles dans chaque contrat ;
- raisons et limitations propres à chaque moteur.

## Résultat synthétique de contrôle

Avec six sorties réelles de 40 minutes réparties sur 28 jours, un objectif vitesse, une expérience déclarée et un créneau de 60 minutes :

- V1 conserve ses suggestions faciles et ses explications actuelles ;
- V2 peut sélectionner un fractionné découverte de 30 minutes, plat, à effort contrôlé ;
- V2 ne dépasse pas la disponibilité et ne modifie pas la référence à partir de la suggestion ;
- la différence provient de la règle expérimentale de découverte, pas d’une donnée physiologique inventée.

Cette différence ne suffit pas à déclarer V2 meilleur. Elle montre seulement que les deux stratégies ne sont plus identiques pour l’objectif vitesse.

## Enchaînements après fractionné

| Scénario | Résultat observé |
| --- | --- |
| Fractionné présenté puis ignoré | Aucune activité structurée n’est créée. L’espacement de présentation reste actif, sans dette ni état de récupération. |
| Fractionné associé à une activité réelle | L’association valide fournit un indice explicite de réalisation ; la séance suivante retenue est facile. |
| Sortie facile explicitement identifiée ensuite | Elle est reconnue comme activité douce. La variété normale revient lorsque l’espacement structuré restant est satisfait. |
| Activité indépendante de type inconnu | Elle reste inconnue et ne prouve pas qu’une récupération a été effectuée. |
| Association ensuite invalidée | Elle ne fournit plus de type réalisé. L’ancienne présentation peut encore conserver son propre espacement de présentation. |
| Fractionné puis interruption | Aucun rattrapage et aucune dette. La fenêtre récente peut rendre la découverte indisponible sans conclure à une perte physiologique. |

## Corrections et garanties

Le comparateur V1/V2 a été ajouté sans modifier V1. L’adaptateur V2 n’utilise une association comme indice sportif que si l’activité existe, si la date correspond et si l’empreinte sportive est encore valide. Une invalidation retire cette preuve sans supprimer l’historique de présentation.

La priorité douce après fractionné ne constitue pas un état persistant supplémentaire. Elle résulte des activités fiables et de l’espacement temporel existant. Une sortie douce ne supprime pas automatiquement la règle distincte d’espacement des séances structurées.

## Limites et risques

- La comparaison réelle doit encore être exécutée par l’utilisateur dans le navigateur contenant l’IndexedDB concernée.
- Une association indique un rapprochement confirmé, pas l’exécution exacte des intervalles.
- Les activités importées sans rôle explicite restent de type inconnu.
- Les seuils de découverte et d’espacement sont expérimentaux.
- Le panneau reste limité au développement ; le Coach V2 demeure désactivé publiquement.
