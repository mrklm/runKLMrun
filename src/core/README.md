# Moteur métier

Ce dossier ne dépend ni de React, ni du DOM, ni d'IndexedDB.
Les futurs traitements recevront des données typées en entrée et retourneront
leurs résultats sans accéder directement au stockage. L'interface orchestrera
les appels au moteur et aux dépôts de données définis dans `../storage/contracts.ts`.

Les analyses descriptives des résumés et séries sont implémentées dans `analysis`.
Aucun planificateur ni moteur de recommandations sportives n’est implémenté.
