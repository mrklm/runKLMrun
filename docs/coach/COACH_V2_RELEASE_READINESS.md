# Coach V2 — préparation à l’activation publique

Évaluation du 18 octobre 2026. Le Coach V2 reste sous `runklmrun:coach-v2-internal` et `import.meta.env.DEV`. Aucun comportement V1, schéma ou format n’a été modifié pendant cette validation.

## Couverture réellement exécutée

### Longitudinal

- 140 trajectoires expérimentales : sept objectifs, quatre profils, cinq comportements et douze semaines.
- Six trajectoires supplémentaires utilisent directement le pipeline applicatif `adaptCoachV2Readonly()` pendant douze semaines : débutant, reprise, régulier, irrégulier, progression réelle et réduction volontaire.
- Variantes couvertes : suggestions suivies ou ignorées, activités indépendantes, interruption, disponibilités de deux ou trois jours et plafonds de 30 à 60 minutes.

Résultats mesurés :

- les lectures et suggestions ignorées ne créent aucune activité et aucune dette ;
- la référence suit une progression réelle et une réduction réelle issues d’activités ajoutées explicitement ;
- les suggestions seules ne font pas évoluer la référence ;
- l’espacement des séances structurées et longues reste stable dans les simulations de sensibilité ;
- un débutant sans activité ni présentation persistée reçoit explicitement `missing-temporal-anchor` pendant les douze semaines ; aucune capacité n’est inventée ;
- une pratique régulière historique de 40 minutes produit cependant une proposition minimale observée de **20 minutes** dans le pipeline V2 ;
- un historique cohérent mais sans provenance V2 confirmée reste provisoire. Même avec des rôles documentés, endurance et vitesse restent alors limitées à `easy-endurance`.

Les deux derniers points sont des comportements observés du pipeline applicatif, pas des risques théoriques.

## Parcours, stockage et navigateur

Les tests couvrent : activation absente et présente, calcul sans écriture, première présentation explicite, réaffichage, deux onglets, association manuelle, ambiguïté, modification sportive, suppression, remplacement, sauvegarde/restauration V6 et restauration ancienne.

Garanties confirmées :

- une lecture, un rendu ou une notification ne crée pas de présentation ;
- deux onglets convergent vers une occurrence unique ;
- une association sportive modifiée ou supprimée cesse d’être une preuve fiable sans être transférée ;
- V1 et V2 restent stockés séparément ; aucune conversion silencieuse n’a lieu ;
- les sauvegardes V1 à V5 restent lisibles et V6 préserve identités, dates, états et preuves ;
- le build de production replie la garde de développement à `false`, rendant la clé locale inopérante.

## Interface et accessibilité

L’Accueil expose sous activation la date, le type, la durée, l’intensité, le terrain et des consignes repliables. Le calendrier distingue `●` activité, `○` V1 et `◇` V2 sans inclure les suggestions dans les statistiques. La fiche d’activité demande une confirmation explicite avant association.

Les sélecteurs reposent sur rôles, libellés et `data-testid` ciblés. Le parcours clavier des boutons et `details/summary`, le réaffichage et une largeur mobile de 390 px sont vérifiés. Les états vide, ancre absente et erreur sont présents.

Textes à revoir avant exposition publique, sans modification dans cette phase :

- remplacer « Coach V2 » et « expérimental » par un vocabulaire produit seulement au moment de la bascule ;
- expliquer simplement pourquoi aucune proposition n’est possible pour un nouvel utilisateur ;
- préciser le sens de l’association sans suggérer que les consignes ont été suivies.

## Cohérence sportive

Garanties testées : terrain et intensité restent distincts ; aucun D+ numérique, fatigue ou type sportif importé n’est inventé ; les blocs structurés égalent la durée totale ; les disponibilités plafonnent les séances ; une référence provisoire interdit les séances exigeantes ; une interruption ne crée ni dette ni rattrapage.

Choix expérimentaux : fenêtres de 42 jours, 14 jours entre séances structurées, 10 jours entre sorties longues, deux jours après activité et trois jours après présentation. Ils organisent le produit et ne constituent pas des constantes scientifiques.

Limites scientifiques : aucune mesure de fatigue, de récupération ou de capacité physiologique ; les imports ne fournissent pas de rôle de séance fiable ; la référence décrit une pratique observée et ne prouve pas une capacité actuelle.

## Classement des problèmes

### A. Bloquants avant activation

1. **Durée trop basse sur pratique régulière** : 20 minutes sont proposées à partir d’un historique stable de 40 minutes. La règle V2 doit être confrontée à la politique produit déjà validée avant toute exposition.
2. **Amorçage débutant sans ancre** : un utilisateur sans activité ne reçoit aucune suggestion. Il faut décider si ce comportement est voulu pour l’objectif débuter ou définir une ancre déclarative explicite, sans en inventer silencieusement.
3. **Différenciation longtemps inaccessible** : un historique réel ancien reste provisoire sans provenance V2 confirmée ; les objectifs vitesse et endurance peuvent rester identiques. Le chemin documenté permettant de devenir confirmé doit être validé longitudinalement avec les occurrences et associations réelles.
4. **Présentation publique non définie** : le bouton interne confirme manuellement une présentation. Le déclenchement public, les textes et la transition avec les cartes V1 ne sont pas encore décidés.

### B. Importants mais non bloquants

- test multi-processus en plus des deux onglets d’une même origine ;
- revue manuelle lecteur d’écran et contraste sur les seize thèmes ;
- message d’erreur public plus précis en cas d’échec IndexedDB ;
- politique produit lorsqu’une occurrence V1 et V2 concernent le même jour.

### C. Ultérieur

- purge des occurrences non associées ;
- saisie explicite du rôle des activités historiques ;
- synchronisation entre appareils ;
- retrait éventuel du Coach V1.

## Recommandation

Le Coach V2 **n’est pas prêt pour une activation publique**. Son intégrité transactionnelle, sa compatibilité et ses garde-fous sont satisfaisants. Les trois écarts sportifs et d’amorçage classés A doivent être résolus et rejoués sur le même banc longitudinal avant de définir le parcours public de présentation.
