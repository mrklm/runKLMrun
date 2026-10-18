# Préparation de l’activation publique du Coach V2

## Activation

Le parcours V2 possède désormais deux activations distinctes :

- l’activation interne existante, limitée aux builds de développement par la clé locale `runklmrun:coach-v2-internal` ;
- l’interrupteur de déploiement `COACH_V2_PUBLIC_DEPLOYMENT_ENABLED`, fixé à `false` dans le code.

Une valeur locale ne peut donc pas activer V2 dans un build de production. Quand les deux activations sont absentes, les composants V2 ne sont pas montés, aucune donnée V2 n’est écrite et le Coach V1 garde son comportement. Le futur mode public masquera les nouvelles propositions V1 sans convertir ni supprimer leurs enregistrements. Revenir immédiatement à V1 consiste à refermer l’interrupteur public ; les occurrences V2 restent intactes.

## Présentation effective

Une carte calculée ne constitue pas une présentation. L’enregistrement commence seulement quand le navigateur confirme que le titre et le résumé de la carte sont entièrement visibles, non recouverts, pendant deux images successives. La détection combine `IntersectionObserver`, l’état visible du document, la géométrie et un contrôle par `elementFromPoint`.

Le nettoyage React annule une observation interrompue. Un onglet masqué, une carte hors écran, un rendu interrompu ou un simple calcul ne déclenchent donc aucune écriture. Ce signal prouve seulement que le contenu a été affiché ; il ne prouve ni lecture ni compréhension.

L’API transactionnelle existante arbitre les appels concurrents. Après l’écriture, l’interface adopte toujours le contenu immuable de l’occurrence réellement retenue par IndexedDB. Une nouvelle notification ou un double rendu ne crée pas de génération supplémentaire.

## Erreurs et nouvel essai

Une erreur de stockage laisse la suggestion visible avec le message :

> La suggestion est affichée, mais elle n’a pas pu être mémorisée.

Le bouton **Réessayer** relance la même occasion. L’unicité transactionnelle protège contre un doublon si la première réponse était incertaine. L’interface ne prétend pas que la présentation est mémorisée avant d’avoir récupéré l’occurrence retenue.

## Textes retenus

- Suggestion disponible : **Suggestion du Coach**, suivie de la date, du type, de la durée, de l’intensité et du terrain.
- Absence : **Aucune suggestion adaptée n’est disponible actuellement.**
- Repère initial absent : **Le Coach ne dispose pas encore d’un repère stable pour proposer une séance.**
- Présentation mémorisée : **Cette suggestion vous est proposée.**
- Consignes : **Voir les consignes**.
- Association : **Associer cette suggestion à cette sortie**, avec confirmation explicite.
- Stockage : texte d’erreur ci-dessus et action **Réessayer**.

Ces textes n’introduisent ni dette, ni échec, ni promesse de progression ou conclusion physiologique.

## Transition V1 / V2

Les suggestions V1 existantes restent lisibles dans le calendrier et les sauvegardes. Elles ne sont jamais converties. Le futur mode public choisira un seul producteur de nouvelle proposition à l’écran : V2. L’activation interne conserve V1 et V2 côte à côte pour les vérifications. Les activités, associations et statistiques ne sont pas modifiées.

## Risques restants avant activation

- L’interrupteur public doit faire l’objet d’une livraison explicite après validation produit ; il reste fermé dans cette phase.
- La preuve de visibilité reste une approximation technique de l’affichage, jamais une preuve d’attention.
- Un essai navigateur ne peut pas reproduire tous les modes de suspension propres à chaque navigateur mobile.
- Les textes et la coexistence des anciens éléments V1 doivent encore être relus sur un jeu représentatif de thèmes avant ouverture publique.
