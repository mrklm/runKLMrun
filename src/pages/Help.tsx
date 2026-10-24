export function Help() {
  return <>
    <header className="page-heading"><h1>Aide</h1></header>
    <section className="panel settings-panel help-content" aria-label="Utiliser runKLMrun">
      <p>runKLMrun est votre carnet de course local : vos séances restent sur cet appareil, dans votre navigateur.</p>

      <p>Pour utiliser l’application sans le Coach, il suffit d’enregistrer vos courses. Vous pouvez le faire de deux façons :</p>
      <ul>
        <li><strong>Sans montre connectée</strong> : dans <em>Courses</em>, ajoutez une activité manuellement avec au minimum la date et la durée. Vous pouvez compléter la distance, l’allure, le ressenti, un commentaire et le type d’entraînement.</li>
        <li><strong>Avec une montre ou une application compatible</strong> : importez vos fichiers d’activité, notamment Polar ou TCX. Les informations présentes dans le fichier sont conservées : durée, distance, fréquence cardiaque, altitude et tracé GPS lorsque disponibles.</li>
      </ul>

      <p>Une fois vos séances enregistrées, l’accueil, les statistiques, le calendrier et l’historique permettent de suivre votre pratique. La fiche d’une séance rassemble ses informations, ses courbes éventuelles, son ressenti, son type d’entraînement, ses chaussures associées et, lorsqu’un tracé GPS est disponible, son parcours sur carte.</p>
      <p>Les détails techniques importés sont conservés pendant 30 jours. Le résumé de vos séances reste disponible ensuite.</p>

      <h2>Importer et sauvegarder vos données</h2>
      <h3>Importer des activités</h3>
      <ol>
        <li>Ouvrez l’onglet <em>Courses</em>.</li>
        <li>Sélectionnez l’importation d’activités.</li>
        <li>Choisissez vos fichiers Polar ou TCX.</li>
        <li>runKLMrun ajoute les nouvelles séances et détecte les doublons pour éviter de les importer deux fois.</li>
        <li>Vérifiez les séances importées dans l’historique et ouvrez leur fiche pour consulter les informations disponibles.</li>
      </ol>
      <p>Vous pouvez aussi ajouter une course manuellement si vous ne possédez pas de montre connectée ou de fichier d’activité.</p>

      <h3>Exporter une sauvegarde</h3>
      <ol>
        <li>Ouvrez <em>Paramètres</em>.</li>
        <li>Dépliez la section <em>Données et sauvegardes</em>.</li>
        <li>Choisissez l’exportation des données.</li>
        <li>Enregistrez le fichier de sauvegarde dans un endroit sûr.</li>
      </ol>
      <p>La sauvegarde contient vos séances, vos réglages, vos chaussures et les informations associées.</p>

      <h3>Restaurer une sauvegarde</h3>
      <ol>
        <li>Ouvrez <em>Paramètres</em>, puis <em>Données et sauvegardes</em>.</li>
        <li>Sélectionnez le fichier de sauvegarde à restaurer.</li>
        <li>Vérifiez le résumé proposé par l’application.</li>
        <li>Choisissez d’ajouter les données à celles déjà présentes ou de les remplacer.</li>
        <li>Confirmez la restauration.</li>
      </ol>
      <p>Conservez vos fichiers de sauvegarde : ils permettent de retrouver vos données après un changement de navigateur ou d’appareil.</p>

      <h2>Utiliser le Coach</h2>
      <p>Le Coach s’appuie uniquement sur les séances enregistrées et sur les informations que vous choisissez de renseigner. Il propose des séances : il ne remplace ni votre jugement, ni un avis médical, ni l’adaptation nécessaire à votre état de forme.</p>
      <p>Pour commencer, ouvrez l’onglet <em>Coach</em> et complétez votre profil :</p>
      <ul>
        <li>votre objectif ;</li>
        <li>votre niveau ou votre expérience ;</li>
        <li>vos disponibilités, avec les jours où vous pouvez courir ;</li>
        <li>le temps maximal que vous souhaitez consacrer à une séance ;</li>
        <li>vos préférences éventuelles de terrain.</li>
      </ul>
      <p>Le Coach tient compte de votre historique réel, de vos disponibilités et de votre profil pour préparer des suggestions. Plus vos séances sont renseignées, plus son repère sur votre pratique devient utile.</p>
      <p>Après une course, ajoutez si vous le souhaitez votre ressenti et son type d’entraînement. Ces informations aident à garder une lecture fidèle de votre pratique.</p>

      <h2>Les réglages du Coach</h2>
      <p>Le réglage <strong>Type de Coach</strong> modifie le ton des propositions, sans supprimer les règles de récupération ni les limites liées à vos disponibilités.</p>
      <ul>
        <li><strong>Pas à Pas</strong> : privilégie une progression prudente et régulière.</li>
        <li><strong>Évolution Active</strong> : recherche une progression mesurée lorsque votre historique le permet.</li>
        <li><strong>Rentre dedans</strong> : propose une approche plus dynamique, tout en conservant les protections prévues par l’application.</li>
      </ul>
      <p>Vous pouvez modifier votre profil et vos disponibilités à tout moment. Les suggestions sont révisées à partir de votre situation actuelle : une proposition n’est pas une séance réalisée.</p>

      <h2>Carte des parcours GPS</h2>
      <p>Lorsqu’une séance contient des coordonnées GPS exploitables, sa fiche affiche automatiquement son parcours sur OpenStreetMap, avec un repère de départ et d’arrivée.</p>
      <p>Les coordonnées du parcours restent dans le stockage local de l’application. Le fond de carte nécessite une connexion Internet et est fourni par OpenStreetMap.</p>

      <h2>Pour les geeks</h2>
      <p>runKLMrun est une application web construite avec React, TypeScript et Vite. React construit l’interface affichée dans le navigateur, TypeScript aide à fiabiliser le code grâce à des types, et Vite prépare l’application pour le développement et la publication.</p>
      <p>L’application ne nécessite pas de serveur applicatif ni de compte utilisateur. Les séances, le profil du Coach, les disponibilités, les réglages, les chaussures et les informations associées sont conservés localement dans IndexedDB, la base de données intégrée au navigateur. Chaque navigateur et chaque appareil possède donc son propre espace runKLMrun.</p>
      <p>La navigation repose sur des routes simples dans l’URL, comme <code>#/courses</code>, <code>#/entrainement</code> ou <code>#/aide</code>. Cela permet de naviguer et de rafraîchir une page directement, y compris lorsque l’application est hébergée comme un site statique.</p>
      <p>Les fichiers Polar et TCX sont analysés directement dans le navigateur. Les données utiles sont extraites localement : date, durée, distance, allure, fréquence cardiaque, altitude et coordonnées GPS lorsqu’elles sont présentes. Les calculs de statistiques, les graphiques, les bilans et les suggestions du Coach sont eux aussi réalisés sur l’appareil.</p>
      <p>Le Coach s’appuie sur les séances réellement enregistrées et sur le profil renseigné dans l’application. Ses propositions sont calculées localement : aucune activité ni information de profil n’est envoyée à un service de recommandation externe.</p>
      <p>La carte des parcours utilise Leaflet et React-Leaflet. Les coordonnées GPS restent locales et servent uniquement à dessiner le tracé dans le navigateur. Lors de l’affichage d’une carte, le navigateur demande uniquement les tuiles du fond cartographique à OpenStreetMap ; ces requêtes permettent au fournisseur de connaître l’adresse IP et la zone de carte demandée, mais ne lui transmettent pas le parcours complet sous forme de fichier ou d’API.</p>
      <p>Les composants de l’interface, les calculs métier et l’accès aux données sont séparés dans le code. Cette organisation permet de tester les calculs sans dépendre de l’écran, et de faire évoluer l’interface sans modifier le stockage des séances.</p>
      <p>L’application est compilée en fichiers statiques puis publiée sur GitHub Pages. Elle fonctionne donc sans serveur runKLMrun à maintenir : le navigateur télécharge les fichiers de l’application et exécute l’essentiel du travail localement.</p>
    </section>
  </>;
}
