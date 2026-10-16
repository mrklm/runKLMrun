# Diagnostic et comparaisons expérimentales

Ce module indépendant ne modifie pas le Conseiller. Aucune écriture, migration,
lecture des détails/GPS ou transmission des résumés. Aucun nettoyage déclenché.
La page n’est pas une entrée du build de production.

## Exécution locale

1. Fermez les autres onglets runKLMrun : leur entretien automatique reste indépendant.
2. Dans le projet, lancez `npm run dev`.
3. Ouvrez directement `http://localhost:5173/runKLMrun/diagnostic.html`, sans ouvrir
   l’accueil. Adaptez hôte et port à ceux du serveur et de votre historique.
4. Cliquez sur « Lire les résumés et produire le rapport ».
5. Sélectionnez le contenu du rapport, puis copiez-le.
6. Facultatif : cochez les comparaisons, ajustez les paramètres et relancez.

IndexedDB dépend exactement du navigateur, du profil, du protocole, de l’hôte et
 du port. Une base hébergée sur GitHub Pages n’est pas accessible depuis localhost.
Une base absente provoque une erreur et n’est pas créée. Ne restaurez pas de
sauvegarde pour contourner ce point dans le cadre de ce diagnostic.
L’outil fonctionne hors Internet avec le serveur local déjà installé.
Les identifiants du rapport comparatif sont remplacés par S00001… ; dates,
titres et identifiants Polar ne sont pas exportés. Ce masquage n’est pas une
 garantie d’anonymisation : ne partagez le rapport que volontairement.

## Couverture et unités

Distance et D+ en mètres ; fréquence cardiaque moyenne en bpm.
Exploitable numériquement : fini et strictement positif pour distance/FC,
positif ou nul pour D+. Cela ne garantit pas la qualité du capteur.
Les compteurs estimé, partiel et zéro se recoupent. Un D+ partiel reste recensé
mais est exclu des comparaisons strictes. Les métadonnées incohérentes le sont aussi.
L’absence de métadonnées d’estimation ne prouve pas une mesure instrumentale.
La provenance distingue TCX explicite, présence d’un identifiant Polar et inconnue.

## Trois méthodes et résultats fictifs

Paramètres initiaux uniquement exploratoires, inclusifs aux frontières :

- Fixe : écart de distance ≤ 300 m ET écart de D+ ≤ 15 m.
- Relative : écart divisé par la plus grande des deux valeurs ≤ 4 % pour
  la distance ET ≤ 20 % pour le D+. Deux zéros valent un écart relatif nul.
- Proximité : distance euclidienne des écarts normalisés par 300 m et 15 m,
  avec un rayon maximal de 1. Ces échelles sont réglables.

Sur les 15 résumés fictifs de `fixtures.ts` :

| Méthode | Paires | Séances rapprochées | Limites observées |
| --- | ---: | ---: | --- |
| Fixe | 13 | 11 | Simple, mais même tolérance pour 5 et 30 km ; accepte le coin 300 m / 15 m |
| Relative | 12 | 10 | Adapte la distance, mais rejette 0 contre 2 m D+ même sur du plat |
| Proximité | 12 | 10 | Rejette le coin 300 m / 15 m ; le compromis et les échelles demandent une explication |

Les trois méthodes rapprochent 8,0 km/79 m, 8,1 km/75 m et 8,2 km/72 m.
Elles isolent 8,1 km/250 m et 30 km/75 m. La sortie 8,4 km/90 m est
acceptée avec 8,1 km/75 m en fixe et relatif, mais pas en proximité.
Le relatif la rapproche aussi de 8,2 km/72 m, contrairement au fixe.
Ces écarts illustrent les frontières, sans établir la vérité des rapprochements.
Un D+ absent et un D+ partiel sont exclus, jamais remplacés par zéro.
Les avertissements de provenance/méthode de mesure signalent une incertitude,
non une preuve de rapprochement faux (ici toutes les paires sont signalées).

Les voisinages sont des paires directes : A proche de B et B proche de C
n’implique jamais A proche de C. Aucun regroupement transitif ni itinéraire déduit.
Tri déterministe, indépendant de l’ordre d’importation. Ni allure, durée, FC,
date ou GPS ne sélectionnent les paires. Les résumés anciens restent utilisables.

## Limites et recommandation

Lecture de tous les résumés en mémoire, jamais des millions de mesures.
Le tri par distance réduit les comparaisons ; un historique très dense reste
quadratique. Les exemples sont plafonnés (200 par défaut, maximum 10 000),
mais les nombres de paires et séances restent complets. La page peut patienter
sur un historique exceptionnellement dense : aucun worker ajouté à ce stade.
Les identifiants dupliqués sont refusés. Le diagnostic suppose le modèle
RunningSession valide, sans prétendre réparer un stockage corrompu.

Recommandation : garder les tolérances fixes comme référence explicable,
confronter les trois rapports avant de choisir des seuils. Ne pas adopter le
relatif seul sur les parcours plats. Les avertissements doivent rester visibles.
Pas de comparaison distance seule activée ; son éventuel ajout devra passer
par une politique d’éligibilité explicite distincte.

À décider avant intégration : seuils selon la couverture réelle, traitement
 des D+ partiels, mélange des provenances, nombre minimal de voisins pour
observer une tendance et présentation des incertitudes. Aucune interprétation
chronologique des performances ni validation sur données réelles effectuée.

## Tests fonctionnels et mesure de charge

`npm test` conserve les contrôles fonctionnels du module, notamment les comptes
exacts et la troncature des exemples sur 40 résumés synthétiques. Ils restent
bloquants dans GitHub Actions.

`npm run test:performance` exécute séparément le scénario historique de
3 000 résumés identiques (`analysis.performance.ts`), conserve toutes ses
assertions et affiche la durée de comparaison. Ce test de charge fait
4 498 500 comparaisons par méthode, soit 13 495 500 pour les trois méthodes.
La borne de distance ne permet aucun raccourci dans ce cas défavorable ; limiter
les exemples ne limite pas les comparaisons nécessaires aux comptes exacts.

Le scénario initial mélangeait vérification fonctionnelle et charge quadratique,
sans assertion sur une performance cible. Le délai par défaut de 5 secondes
mesurait l'exécution du test, pas un engagement de performance produit.
La durée dépend du processeur, du moteur JavaScript et de la charge concurrente.
Le lancement dédié n'a pas de seuil de temps artificiel (`testTimeout: 0`) ;
les assertions restent bloquantes pour cette commande et Ctrl+C l'interrompt.
Aucun algorithme n'a été modifié. Cette mesure expérimentale n'est pas appelée
par le workflow de publication et n'entre pas dans le build applicatif.
