# Introduction du fractionné dans le Coach V2

## Règle bloquante corrigée

Le catalogue exigeait `observedSessionTypes.includes('intervals')` avant de créer un candidat de fractionné. Une première séance était donc impossible sans antécédent explicitement typé, même avec une pratique récente régulière. Les activités importées sans type explicite restent de type inconnu.

## Admissibilité expérimentale

Pour l’objectif **améliorer la vitesse**, une séance découverte peut désormais être candidate lorsque toutes les conditions suivantes sont réunies :

- profil déclaré régulier ou expérimenté ;
- au moins six activités réelles dans les 28 derniers jours civils ;
- activités réparties sur au moins trois tranches de sept jours ;
- au moins quatorze jours entre la première et la dernière activité retenue ;
- créneau d’au moins trente minutes ;
- règles temporelles de l’orchestrateur respectées.

Les seuils de 6 activités, 28 jours, 3 tranches et 14 jours sont des paramètres de conception expérimentaux. Ils ne constituent ni une validation scientifique ni une preuve de capacité physiologique. Une suggestion présentée ne compte jamais parmi les six activités.

## Séance découverte

Pour un créneau de trente minutes, le contenu produit est :

- 10 minutes d’échauffement facile ;
- 6 répétitions de 1 minute dynamique contrôlée ;
- 6 récupérations de 1 minute facile ;
- 8 minutes de retour au calme.

Le total est exactement de 30 minutes. L’effort reste contrôlé, sans sprint maximal, sur terrain plat. Pour un créneau supérieur, seule la durée du retour au calme absorbe la différence. Aucun objectif de dénivelé n’est créé.

## Après une réalisation

L’orchestrateur ne reconnaît une réalisation structurée que par un type explicitement documenté ou par une association V2 encore valide entre l’occurrence et une activité réelle. Cette association est un indice déclaré de réalisation ; elle ne prouve pas que chaque intervalle a été exécuté exactement.

Pendant la fenêtre d’espacement structurée existante de quatorze jours, une séance facile est privilégiée. Le délai minimal général après activité reste de deux jours : aucun repos supplémentaire n’est imposé. Une suggestion ignorée conserve seulement l’espacement de présentation et ne devient jamais une preuve d’effort ou une dette.

La priorité douce n’est pas un état persistant. Une activité douce réellement identifiée et l’évolution des dates permettent ensuite le retour aux candidats ordinaires. Aucune alternance fractionné/récupération/fractionné n’est fabriquée.

## Associations et données inconnues

Le pipeline applicatif réutilise le type du contenu V2 uniquement lorsque l’occurrence est associée, que l’activité existe encore, que sa date correspond et que son empreinte sportive est intacte. Une association invalidée, ambiguë ou absente ne fournit aucun type. La durée, la distance, le terrain et la date ne servent jamais à inventer un rôle sportif.

## Résultats des simulations ciblées

Huit scénarios couvrent la pratique régulière, le seuil insuffisant, la suggestion ignorée, la réalisation, la sortie douce suivante, le type inconnu, l’interruption et les consultations répétées. Ils confirment l’introduction du fractionné, l’absence de cycle mécanique, le retour à une variété normale et le caractère pur des consultations.

## Limites

- Une association confirme un rapprochement choisi, pas l’exécution exacte des blocs.
- Les fenêtres temporelles restent expérimentales.
- Une activité au type inconnu ne permet pas de conclure qu’une séance douce ou exigeante a été réalisée.
- Le Coach V2 reste sous activation interne ; aucune suggestion publique n’est ajoutée par cette phase.
