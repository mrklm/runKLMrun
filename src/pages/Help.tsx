export function Help() {
  return <div className="help-page">
    <header className="page-heading"><h1>runKLMrun</h1></header>
    <section className="panel settings-panel help-content" aria-label="Utiliser runKLMrun">
      <p>runKLMrun est une application gratuite et open source dédiée à la course à pied.</p>
      <p>Elle vous permet de suivre vos sorties, de visualiser vos progrès et de bénéficier de conseils adaptés à votre pratique, que vous utilisiez une montre connectée ou non.</p>
      <p>Débutant, coureur occasionnel ou régulier, vous restez libre de courir à votre rythme.</p>
      <p className="help-philosophy"><strong>philosophie : runKLMrun s'adapte à vous, pas l'inverse.</strong></p>

      <h2>Votre carnet de course</h2>
      <p>runKLMrun vous permet de conserver l'historique de vos sorties, de comptabiliser les kilomètres parcourus et de suivre le temps consacré à la course à pied.</p>
      <h3>Sans montre connectée</h3>
      <p>Dans l'onglet <a href="#/courses">Courses</a>, ajoutez une activité manuellement en renseignant au minimum sa date et sa durée.</p>
      <p>Vous pouvez également préciser la distance, votre ressenti et un commentaire. Le type d'entraînement réalisé peut être renseigné dans le bilan ou depuis la fiche de la séance.</p>
      <h3>Avec une montre ou une application compatible</h3>
      <p>Importez vos fichiers d'activité, notamment les archives Polar et les fichiers TCX.</p>
      <p>Selon les informations disponibles, runKLMrun récupère la durée, la distance, la fréquence cardiaque, l'altitude et les coordonnées GPS.</p>
      <h3>Suivre votre progression</h3>
      <p>Une fois vos séances enregistrées, l'accueil, les statistiques, le calendrier et l'historique vous permettent de suivre votre pratique.</p>
      <p>La fiche de chaque séance rassemble ses informations, ses éventuelles courbes, son ressenti, son type d'entraînement, ses chaussures associées et son parcours sur carte lorsqu'un tracé GPS est disponible.</p>
      <p>Les détails techniques importés sont conservés pour les séances des 30 derniers jours, selon leur date. Importer une ancienne séance ne renouvelle pas ce délai. Le résumé de vos séances reste disponible ensuite.</p>
      <h3>Le bilan de séance</h3>
      <p>Après une séance, runKLMrun peut vous proposer un bilan facultatif.</p>
      <p>Vous pouvez y indiquer :</p>
      <ul>
        <li>Votre ressenti : facile, modérée, difficile ou très difficile.</li>
        <li>Un commentaire sur votre sortie.</li>
        <li>Le type d'entraînement réellement effectué.</li>
        <li>Une description complémentaire de votre séance.</li>
      </ul>
      <p>Si une recommandation du Coach correspond à votre activité, vous pouvez également préciser si vous l'avez suivie entièrement, partiellement ou si vous avez réalisé un autre entraînement.</p>
      <p>Vous n'êtes jamais obligé de compléter ce bilan immédiatement.</p>
      <p>Vous pouvez choisir « Plus tard », puis retrouver et modifier ces informations depuis la fiche de votre séance.</p>

      <h2>Vos parcours GPS</h2>
      <h3>Visualiser vos sorties sur une carte</h3>
      <p>Lorsqu'une séance contient des coordonnées GPS exploitables, sa fiche affiche automatiquement votre parcours sur une carte, avec des repères de départ et d'arrivée.</p>
      <p>Le fond de carte est fourni par OpenStreetMap et nécessite une connexion Internet.</p>
      <p>Les coordonnées de votre parcours restent enregistrées localement dans l'application, pendant la durée de conservation des détails techniques.</p>

      <h2>Vos chaussures</h2>
      <h3>Suivre leur kilométrage</h3>
      <p>Vous pouvez enregistrer plusieurs paires de chaussures afin de suivre leur utilisation et leur usure.</p>
      <p>Dans <a href="#/parametres">Paramètres</a>, ouvrez la section <em>Mes chaussures</em>.</p>
      <p>Pour chaque paire, renseignez :</p>
      <ul>
        <li>Son nom.</li>
        <li>La date de sa première utilisation.</li>
        <li>Éventuellement, un kilométrage limite pour recevoir une alerte de remplacement.</li>
      </ul>
      <p>En associant vos chaussures à vos séances, runKLMrun comptabilise les kilomètres parcourus avec chaque paire.</p>

      <h2>Votre Coach</h2>
      <h3>Des suggestions adaptées à votre pratique</h3>
      <p>Vous pouvez activer un Coach qui vous propose des entraînements en fonction de votre niveau, de vos objectifs et de vos disponibilités.</p>
      <p>Ouvrez <em>Paramètres</em>, puis la section <em>Configurer le Coach</em>.</p>
      <p>Complétez votre profil en indiquant :</p>
      <ul>
        <li>Votre objectif.</li>
        <li>Votre expérience déclarée.</li>
        <li>Les jours où vous pouvez courir.</li>
        <li>Le temps maximal que vous souhaitez consacrer à une séance.</li>
        <li>Vos éventuelles préférences de terrain.</li>
      </ul>
      <p>Le Coach tient compte de votre historique de course et des informations renseignées pour préparer ses suggestions.</p>
      <p>Plus votre carnet est complet, plus ses recommandations peuvent tenir compte de votre activité réelle.</p>
      <p>Vous restez libre de suivre, d'adapter ou d'ignorer ses propositions.</p>
      <p>Une suggestion du Coach ne signifie jamais qu'une séance a été réellement effectuée.</p>
      <h3>Choisir votre type de Coach</h3>
      <p>Le réglage <em>Type de Coach</em> permet de modifier le ton et l'approche des suggestions, sans supprimer les règles de récupération ni les limites liées à vos disponibilités.</p>
      <dl className="help-coach-types">
        <dt>Pas à Pas</dt><dd>Privilégie une progression prudente et régulière.</dd>
        <dt>Évolution Active</dt><dd>Recherche une progression mesurée lorsque votre historique le permet.</dd>
        <dt>Rentre dedans</dt><dd>Propose une approche plus dynamique, tout en conservant les protections prévues par l'application.</dd>
      </dl>
      <p>Vous pouvez modifier votre profil, vos objectifs et vos disponibilités à tout moment.</p>
      <p>Les suggestions sont révisées en fonction de votre situation actuelle.</p>

      <h2>Plusieurs coureurs, une seule application</h2>
      <h3>Les profils</h3>
      <p>runKLMrun permet de créer plusieurs profils indépendants.</p>
      <p>Chaque coureur dispose de son propre carnet de course, de ses statistiques, de ses chaussures et de ses réglages du Coach.</p>
      <p>Les données des différents profils restent séparées sur l'appareil.</p>
      <p>Vous pouvez ainsi utiliser runKLMrun à plusieurs sur un même navigateur, sans mélanger vos activités.</p>

      <h2>Importer et sauvegarder vos données</h2>
      <h3>Importer des activités</h3>
      <ol>
        <li>Ouvrez l'onglet <em>Courses</em>.</li>
        <li>Dépliez <em>Importer des activités</em>.</li>
        <li>Choisissez vos fichiers Polar ou TCX, puis <em>Importer les séances</em>.</li>
        <li>runKLMrun ajoute les nouvelles séances et détecte les doublons pour éviter les importations répétées.</li>
        <li>Retrouvez les activités enregistrées dans votre historique.</li>
      </ol>
      <p>Après l'importation de 1 à 5 nouvelles activités, un bilan facultatif vous est proposé.</p>
      <p>Lors d'une importation de 6 nouvelles activités ou plus, aucun bilan collectif ne s'affiche. Vous pouvez toujours compléter les informations individuellement depuis les fiches des séances.</p>
      <p>Vous pouvez également créer une séance manuellement sans montre connectée ni fichier d'activité.</p>
      <h3>Exporter une sauvegarde</h3>
      <ol>
        <li>Ouvrez <em>Paramètres</em>.</li>
        <li>Dépliez la section <em>Données et sauvegardes</em>.</li>
        <li>Choisissez <em>Exporter mes données</em>.</li>
        <li>Enregistrez votre fichier de sauvegarde dans un endroit sûr.</li>
      </ol>
      <p>La sauvegarde contient les séances, les réglages, les chaussures et les informations associées du profil actif, selon les données prises en charge par le format de sauvegarde. Exportez séparément les données de chaque profil que vous souhaitez conserver.</p>
      <h3>Restaurer une sauvegarde</h3>
      <ol>
        <li>Ouvrez <em>Paramètres</em>, puis <em>Données et sauvegardes</em>.</li>
        <li>Sélectionnez le fichier à restaurer.</li>
        <li>Vérifiez le résumé présenté par l'application.</li>
        <li>Choisissez <em>Fusionner les séances</em> ou <em>Remplacer les données locales</em> du profil actif.</li>
        <li>Confirmez la restauration.</li>
      </ol>
      <p><strong>Pensez à sauvegarder régulièrement vos données.</strong></p>
      <p>Le stockage local d'un navigateur peut être effacé, notamment lors d'une réinitialisation, d'un nettoyage des données du site ou d'un changement d'appareil.</p>
      <p>Vos fichiers de sauvegarde vous permettent de retrouver vos informations.</p>

      <h2>Vos données et votre vie privée</h2>
      <h3>Une application locale</h3>
      <p>runKLMrun fonctionne principalement sur votre appareil, directement dans votre navigateur.</p>
      <p>Vos séances, vos réglages et vos informations de profil sont conservés localement.</p>
      <p>Vous n'avez pas besoin de créer un compte utilisateur pour utiliser l'application.</p>
      <p>Les suggestions du Coach et les calculs de statistiques sont réalisés localement, sans envoyer vos activités à un service externe de recommandation.</p>
      <p>L'affichage des cartes nécessite toutefois de charger un fond cartographique depuis Internet.</p>
      <p>Une synchronisation entre plusieurs appareils est envisagée pour de futures versions, mais elle n'est pas encore disponible.</p>

      <h2>Gratuit et open source</h2>
      <p>runKLMrun est un logiciel gratuit et open source. Son code propre est placé sous licence GNU GPL v3.0 uniquement (GPL-3.0-only). Les dépendances tierces conservent leurs licences respectives.</p>
      <p>Ce projet s'inscrit dans la philosophie du logiciel libre, notamment défendue par des associations comme <a href="https://www.april.org/">April</a>.</p>
      <p>Le partage des connaissances et des outils contribue à rendre l'informatique plus accessible, transparente et durable.</p>

      <h2>Explications techniques pour les geeks</h2>
      <h3>Les technologies utilisées</h3>
      <p>runKLMrun est une application web développée avec React, TypeScript et Vite.</p>
      <p>React construit l'interface affichée dans le navigateur. TypeScript aide à fiabiliser le code grâce à son système de types. Vite prépare l'application pour le développement et sa publication.</p>
      <h3>Un stockage local avec IndexedDB</h3>
      <p>L'application ne nécessite pas de serveur applicatif ni de compte utilisateur.</p>
      <p>Les séances, les profils, les paramètres du Coach, les disponibilités, les chaussures et les informations associées sont enregistrés localement dans IndexedDB, une base de données intégrée au navigateur.</p>
      <p>Chaque navigateur et chaque appareil dispose donc de son propre espace de stockage.</p>
      <p>Les profils runKLMrun permettent de séparer les données de plusieurs coureurs dans un même navigateur.</p>
      <h3>La navigation</h3>
      <p>La navigation repose sur des routes intégrées à l'URL, comme <code>#/courses</code>, <code>#/entrainement</code> ou <code>#/aide</code>.</p>
      <p>Cette organisation permet de naviguer et d'actualiser directement une page, y compris lorsque l'application est hébergée sur un site statique.</p>
      <h3>Le traitement des activités</h3>
      <p>Les fichiers Polar et TCX sont analysés directement dans le navigateur.</p>
      <p>Les informations utiles sont extraites localement : date, durée, distance, allure, fréquence cardiaque, altitude et coordonnées GPS lorsqu'elles sont présentes.</p>
      <p>Les statistiques, les graphiques, les bilans et les suggestions du Coach sont calculés sur l'appareil.</p>
      <p>Le Coach s'appuie sur les séances enregistrées et sur les informations du profil. Aucune activité ni information personnelle n'est envoyée à un service externe de recommandation.</p>
      <h3>Les cartes GPS</h3>
      <p>Les cartes utilisent Leaflet et React-Leaflet.</p>
      <p>Les coordonnées GPS des séances restent stockées localement et servent à dessiner les parcours dans le navigateur.</p>
      <p>Lors de l'affichage d'une carte, le navigateur charge les tuiles cartographiques nécessaires depuis OpenStreetMap.</p>
      <p>Ces requêtes peuvent révéler au fournisseur l'adresse IP de l'appareil et les zones géographiques consultées, mais elles ne transmettent pas le parcours complet sous la forme d'un fichier d'activité.</p>
      <h3>L'organisation du code</h3>
      <p>Les composants d'interface, les calculs métier et les accès aux données sont séparés.</p>
      <p>Cette organisation facilite les tests, la maintenance et l'évolution de l'application.</p>
      <p>Elle permet notamment de tester les calculs sans dépendre de l'interface graphique.</p>
      <h3>L'hébergement</h3>
      <p>runKLMrun est compilée en fichiers statiques puis publiée sur GitHub Pages.</p>
      <p>Il n'y a donc pas de serveur applicatif runKLMrun à maintenir.</p>
      <p>Le navigateur télécharge les fichiers nécessaires et exécute localement l'essentiel du fonctionnement de l'application.</p>
    </section>
  </div>;
}
