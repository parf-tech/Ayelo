# 06 : Spécifications UI / UX

Principes. L'interface est conçue à partir des besoins des parcours (`04-USER-FLOWS.md`), pas copiée de l'original. Aucune capture de l'original n'a servi.

## Principes

1. **Une action principale par écran.** La découverte = swiper ; la conversation = écrire.
2. **Confiance visible.** Badge vérifié, signalement accessible à tout moment, explications claires.
3. **Pouce d'abord.** Actions principales dans le tiers inférieur de l'écran.
4. **États complets.** Chaque écran a un état vide, de chargement, d'erreur et hors ligne (voir colonne « états » de `05-SCREEN-INVENTORY.md`).
5. **Accessibilité.** Cibles ≥ 44 pt, contraste AA, textes redimensionnables, libellés pour lecteurs d'écran, pas d'information portée par la couleur seule.
6. **Français d'abord**, i18n prévue dès le départ (clés de traduction, pas de texte en dur).

## Navigation

- Barre d'onglets basse : Découvrir, Messages, Stories (phase C), Invitations (phase C), Profil.
- Navigation par pile à l'intérieur de chaque onglet (Expo Router).
- Les appels entrants s'affichent en plein écran par-dessus la navigation.
- Retour : geste système (iOS) et bouton retour (Android) fonctionnent partout.

## Composants clés et interactions

| composant | comportement |
| --- | --- |
| Pile de cartes (S10) | swipe droite = like, gauche = dislike, haut = super-like (Premium) ; boutons équivalents pour l'accessibilité ; annulation 5 s après un dislike (Premium) ; préchargement des 3 cartes suivantes |
| Carte de profil | photo principale, nom, âge, ville, badge vérifié, intention ; tap = détail ; indicateur de galerie |
| Bulle de message | envoyé / reçu ; états : envoi, envoyé, remis, lu, échec (tap = renvoyer) |
| Champ de saisie | texte, boutons pièce jointe et note vocale ; maintien pour enregistrer, glisser pour annuler |
| Interface d'appel | boutons micro, caméra, haut-parleur, signaler, raccrocher ; bannière « reconnexion » ; aperçu local |
| Visionneuse de story | tap droite/gauche pour avancer/reculer, maintien pour pause, glisser vers le bas pour fermer, barre de progression |
| Feuille d'achat | utilise la feuille native du store ; écran d'attente « validation en cours » en cas de retard du webhook |
| Menu de sécurité | trois points : Bloquer, Signaler ; toujours visible dans profil, conversation et appel |
| Toasts / bannières | succès, erreur, hors ligne ; jamais bloquants |

## Animations

- Transitions de cartes (spring) ; animation de match (confettis légers, désactivable par « réduire les animations »).
- Cadeaux virtuels : animation courte (≤ 2 s) en Lottie, précompilée.
- Respect du réglage système « réduire les animations ».

## Contenu et ton

- Direct, chaleureux, jamais culpabilisant. Pas de jargon.
- Messages de sécurité explicites : « Ne versez jamais d'argent à une personne rencontrée en ligne. »
- Les refus (vérification, médias) expliquent la raison et la marche à suivre.

## Écrans spéciaux

- **Onboarding** : barre de progression, retour possible, reprise après abandon, un champ principal par écran.
- **Permissions** : écran d'explication avant la demande système (caméra, micro, notifications, localisation).
- **Hors ligne** : lecture de l'historique et des cartes en cache ; envoi de messages en file avec indicateur.
- **Erreur réseau** : bouton « Réessayer » ; pas de perte de texte saisi.

## Adaptation aux appareils

- Téléphones d'abord (iOS 15+ / Android 8+, à confirmer) ; tablettes en mise en page centrée.
- Mode sombre dès la V1 (tokens du design system).
- Zones sûres (encoche, barre de gestes) respectées.

## Critères de qualité UI

| critère | seuil |
| --- | --- |
| Défilement des cartes | 60 fps sur un appareil milieu de gamme |
| Temps d'ouverture à froid | < 2,5 s sur un appareil milieu de gamme |
| Contraste texte | ≥ 4,5:1 |
| Cibles tactiles | ≥ 44 × 44 pt |
| Parcours critiques testés | inscription, swipe, message, achat, signalement (Maestro) |

## À valider avec le propriétaire

1. Direction de marque (couleurs, ton, nom) : voir `replica-brand`.
2. ~~Langues de lancement~~ : décidé, français et anglais (voir `DECISIONS-PROPRIETAIRE.md`).
3. Position des offres Premium (bloquantes ou discrètes) : impact conversion contre expérience.
