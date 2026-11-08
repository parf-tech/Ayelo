# Décisions de conception d'Ayelo (phase 0)

Date : 2026-11-08. Décisions prises par délégation du propriétaire (« prends les bonnes décisions en tant qu'expérimentée »), sur la base des quatre rapports de la phase 0 (`00-audit.md` et ses annexes). Elles sont révisables. Celles qui touchent au droit, à des comptes de développeur ou à des prestataires sont marquées : la décision fixe le comportement de l'application d'ici là, elle ne remplace pas l'avis d'un juriste.

## Décisions

| # | Sujet | Décision | Raison | Statut |
|---|---|---|---|---|
| 1 | Boutons d'appel | **Masqués** tant que le moteur média n'existe pas | On ne montre pas ce qui ne fonctionne pas ; évite de dire « prototype » aux utilisateurs | À appliquer maintenant |
| 2 | Connexion Google et Apple | **Hors bêta fermée** (e-mail et mot de passe seulement). À livrer avant l'ouverture publique, **les deux ensemble** | Apple (règle 4.8) impose « Se connecter avec Apple » dès qu'une autre connexion tierce existe ; il faut deux comptes développeur et des SDK natifs absents. La friction de l'inscription se réduit d'abord par d'autres moyens (décision 4, parcours plus court) | Planifié |
| 3 | Genre, orientation, consentement sensible | **Statu quo** : Homme / Femme / Autre, consentement aux données sensibles obligatoire. Aucune modification d'interface sur ce point avant l'avis du juriste | Sujet à risque légal selon le marché (vague 2) ; ne se tranche pas côté design. Si une valeur « Préfère ne pas dire » est ajoutée, elle ne sert jamais de filtre | **Question au juriste**, bloquant pour la vague 2 |
| 4 | Date de naissance | **Trois champs numériques** JJ / MM / AAAA, avec validation et message d'erreur précis | Le sélecteur actuel coûte 125 à 145 arrêts au lecteur d'écran, sans valeur sélectionnée visible ; aucune dépendance | À appliquer maintenant |
| 5 | Paywall | **Conserver** le plan de 12 mois présélectionné, à condition que le prix total, la durée, la date de reconduction et l'option mensuelle restent visibles avec le même poids. Aucun faux compte à rebours, aucune pression | Honnête et conforme aux stores ; la tarification honnête est un avantage face à des concurrents critiqués | Déjà en place, à contrôler |
| 6 | Anti-arnaque | **Bandeau fixe** à la première conversation, refermable après lecture, puis **alerte contextuelle** quand le serveur détecte une demande d'argent | C'est le risque principal de la cible ; le message doit précéder le problème, pas seulement le suivre | Phase 4 |
| 7 | Vérification | **Selfie seul** en bêta, avec la phrase « Ce badge confirme que votre selfie correspond à vos photos. Ce n'est pas une garantie d'identité. » Option « pièce d'identité facultative avec badge distinct » reportée après avis du juriste sur les données biométriques | Corrige la promesse excessive actuelle ; évite de bloquer l'inscription en vague 2 | À appliquer maintenant (texte) |
| 8 | Mobile Money | **Hors V1** : achats intégrés des stores uniquement. À rouvrir avec les données de revenu de la bêta | Les abonnements numériques dans l'application doivent passer par les achats intégrés ; un paiement externe expose au rejet | Décidé pour V1 |
| 9 | Orientation | **Portrait seul** pour la V1, exception documentée ; paysage et tablette traités avec la phase 5 | La pile de cartes et la conversation sont conçues pour le portrait ; l'accessibilité est assurée par l'agrandissement du texte et les tailles | Écart accepté |
| 10 | Menus et confirmations | **`Modal` natif** (feuille du bas) pour les menus de conversation, de détail et les confirmations | Piège le focus pour le lecteur d'écran sur les deux plateformes ; aucune dépendance | Phase 3 |
| 11 | Icônes | **Adopter `react-native-svg` et un jeu Lucide** (`lucide-react-native`), en remplacement des 12 glyphes Unicode | Rendu identique sur tous les téléphones, accessible, poids faible ; prérequis de plusieurs critères WCAG | À installer en phase 3, pas avant |
| 12 | Autres bibliothèques | **Aucune pour l'instant** (`reanimated`, `gesture-handler`, `expo-haptics`, `expo-font`). `expo-image` est la première à envisager (mise en cache et tailles d'images) | Chaque dépendance coûte en poids et en maintenance ; la phase 5 (mouvement) en fera la démonstration | Reporté |
| 13 | Refus d'âge | **Aucun lien d'aide** ; message neutre sans « pour le moment » | Neutralité et absence de fuite d'information ; un lien d'aide seulement si le juriste le valide | Déjà en place, retirer « pour le moment » |
| 14 | Direction de marque et logo | **Phase 1 lancée** avec trois directions comparées, aucune ne devient définitive avant la recherche d'antériorité du nom. Le logo reste provisoire | Évite de payer un logo pour un nom potentiellement contesté (AILO, Aylo) | Phase 1 |
| 15 | Parcours : valeurs par défaut | Notification demandée **après** un écran d'explication, jamais au premier lancement ; un crédit dépensé à l'écriture à un non-match demande **confirmation** ; annulation de suppression par **page web publique** sans connexion (demande au support avec l'adresse e-mail) | Respect de l'utilisateur et des règles des stores ; à implémenter en phase 4 avec le backend si nécessaire | Phase 4 |

## À corriger tout de suite (lot 1)

Dix P0 de `00-audit.md`, dans l'ordre : lien « composants » masqué hors développement ; couleurs `like` `#137538` et `dislike` `#C81E1E` ; `EmptyState` sans conteneur accessible ; boutons d'appel masqués ; texte du badge vérifié et badge sur le jeton `verified` ; interrupteur de pleine ligne cliquable ; sélecteur de date en trois champs ; en-tête de conversation qui ne déborde pas à 320 pt ; pieds de page qui ne coupent plus les boutons en grande police ; liens légaux : écran de repli explicite jusqu'à la publication des pages `web/`.

## Ce qui reste décidé par le propriétaire seul

Direction de marque finale et logo, nom définitif (recherche d'antériorité), ouverture de la connexion Google et Apple (comptes développeur), avis du juriste (genre et orientation, données biométriques, textes légaux, matrice des marchés), budget de modération, choix APNs ou FCM pour iOS.

## Direction de marque retenue (phase 1, 2026-11-08)

Décision prise par délégation du propriétaire : **direction B « Lagune »** (vert-bleu profond `#0B6468` en clair et `#4FC9C4` en sombre, papier chaud `#FBFAF6`, accent ocre `#E3A92B`, tracés fins sans ombre, boutons en pilule, polices du système). Elle a obtenu 30 points sur 35, contre 29 pour C « Encre et safran » et 24 pour A « Terre cuite » (la couleur actuelle). Elle se démarque des codes de Tinder, Bumble et Hinge sans reprendre le cliché terre cuite et crème, et ses contrastes de texte sont à au moins 4,5:1 en clair et en sombre (calculés dans `01-direction.md`). Détail, jetons et aperçu : [`01-direction.md`](01-direction.md) et `previews/directions.html`.

Cette décision est **provisoire** sur deux points :
- **Test de préférence** : 5 à 8 personnes de la cible voient les directions B et C (aperçu hors ligne) avant d'abandonner définitivement l'actuelle. Si le test contredit B, C est la solution de repli.
- **Aucun logo ni mot-symbole** avant la recherche d'antériorité du nom. L'application garde un « Ayelo » en police du système, sans dessin de marque.

Points repris du rapport de phase 1 : bouton « Passer » neutre (ni rouge ni vert) car rouge et vert se confondent pour les daltoniens ; polices du système en V1 ; couleur du jeton `verified` à revalider avec le nouveau primaire ; l'accent ocre est à valider par le test culturel.

Mise en œuvre : phase 2 (fichier unique de jetons `design/tokens.json` qui génère `mobile/src/theme/tokens.ts` et `web/assets/tokens.css`), à lancer quand les deux lots de corrections en cours sont terminés.
