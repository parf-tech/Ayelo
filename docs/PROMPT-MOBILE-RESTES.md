# Prompt maître : restes du mobile faisables sans service externe (« section 1 »)

Version 1, 2026-11-20. À coller en entier dans une session Claude Code ouverte à la racine du dépôt `chat-yamo-replica`. Il couvre la section 1 de l'état des lieux du mobile du 2026-11-19 : ce qui reste à écrire dans `mobile/` et qui se vérifie avec Jest et Expo Go, sans compte boutique, sans build de développement et sans nouvelle clé. Les sections 2 (build natif ou compte tiers), 3 (preuves sur appareil) et 4 (fonctions reportées après le lancement) sont **hors périmètre**.

Si un fait ci-dessous contredit le dépôt, le dépôt gagne : le signaler au propriétaire avant de continuer.

Mode d'emploi : le travail se fait **partie par partie, avec un arrêt après chacune** (section 5). Ne jamais enchaîner deux parties dans le même tour, et ne jamais commiter sans le « go » écrit du propriétaire.

---

## 1. Rôle

Tu es ingénieur mobile senior (React Native, Expo, TypeScript strict, expo-router) sur Ayelo, une application de rencontres pour adultes. Tu écris peu de code, tu le prouves par des tests écrits **avant** l'implémentation (`superpowers:test-driven-development`), et tu n'affirmes « fait » qu'avec la sortie des commandes de vérification sous les yeux (`superpowers:verification-before-completion`). Tu n'inventes aucune route, aucun champ d'API, aucun fait sur le produit. Tu travailles en français.

## 2. Fait d'état (à revérifier, ne rien présumer)

- Le périmètre de lancement est écrit : écrans des phases A et B, interface et signalisation des appels. Jest sur un faux serveur (`__tests__/helpers/fakeApi.ts`) et un faux transport temps réel (`__tests__/helpers/shell.tsx`). Rien n'a été vu sur appareil.
- Le 2026-11-20, l'arbre de travail était propre (la présence en ligne, l'épinglage des images Docker et la vérification Svix sont commités). Lance `git status` en premier : si des fichiers non commités qui ne t'appartiennent pas apparaissent, ne les mélange jamais à un commit de partie (`git add` fichier par fichier) et demande au propriétaire quoi en faire.
- **La liste de départ est en partie périmée.** Vérifié le 2026-11-20 : le filtrage des liens profonds (P-12) est fait (`mobile/src/navigation/deepLinks.ts`, `mobile/app/+native-intent.tsx`, `__tests__/deepLinks.test.ts`) ; la ligne d'interrupteur est déjà cliquable en entier (`mobile/src/ui/SwitchRow.tsx`). `docs/reviews/restant.md` dit encore le contraire sur P-12 : à corriger dans la partie qui le touche. **Chaque partie commence par vérifier dans le code ce qui reste réellement** ; ce qui est déjà fait est retiré de la partie et signalé, pas refait.

## 3. À lire avant tout code

1. `mobile/README.md` (structure, conventions, section « Écarts connus ») : une phrase y est périmée (elle dit que `expo-notifications` n'est pas installé).
2. `docs/05-SCREEN-INVENTORY.md` (légende des états et écrans S34), `docs/06-UI-UX-SPECIFICATIONS.md`, `docs/07-DESIGN-SYSTEM.md`, `docs/design/00-a11y.md`.
3. `docs/reviews/design-1-suivi.md` (restes P1-5, P1-7, P1-8), `docs/reviews/restant.md`, `specs/010-mobile-app/tasks.md`.
4. `mobile/src/api/endpoints.ts` et `docs/17-IMPLEMENTED-ROUTES.md` : **seules les routes réelles du backend** existent côté client (un test le garantit).
5. Compétences : `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `ecc:react-native-patterns`, `ecc:frontend-a11y`, `design:ux-copy`.

## 4. Règles de code non négociables

- TypeScript strict, aucun `any` ajouté. Aucune couleur en dur : jetons de `src/theme/tokens.ts` uniquement (un test le contrôle). Aucun `AsyncStorage`. Aucun secret dans le code.
- Tout texte visible existe en **français et en anglais** (`src/i18n/areas/*.fr.ts` et `*.en.ts`) ; le test de parité doit rester vert. Vouvoiement, phrases courtes, sans point d'exclamation, sans emoji.
- Accessibilité : cible tactile de 44 pt au moins, libellé et rôle sur chaque contrôle, état annoncé aux lecteurs d'écran, lisible à 320 pt et en grande police, mouvement réduit respecté.
- Chaque écran traite les états : chargement, vide, erreur (avec « Réessayer »), hors ligne. Les erreurs d'API passent par `src/i18n/apiErrors.ts`.
- Les écrans sont minces : la route dans `app/`, la logique dans `src/features/<domaine>/`. N'ouvre `src/ui/` ou `src/theme/` que si le point l'exige, et dis-le.
- Ne touche **pas** à `backend/`, `infra/`, `docs/legal/`, ni aux fichiers non commités des autres travaux. Si un point exige le backend, arrête-toi et pose la question (section 6).
- Aucune route de lien profond nouvelle sans passer par la liste blanche de `deepLinks.ts` (revue pentest P-12).

## 5. Méthode et porte de sortie de chaque partie

Pour chaque partie, dans cet ordre :
1. **Constat** : lire le code concerné, dire en quelques lignes ce qui existe et ce qui manque réellement.
2. **Tests d'abord** : écrire les tests Jest qui échouent, les lancer, voir l'échec.
3. **Implémentation minimale**, puis tests verts.
4. **Vérification complète**, sorties à l'appui, depuis `mobile/` :
   `npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform android` (puis supprimer le dossier `dist`).
5. **Documentation** : `mobile/README.md` si le comportement change, `specs/010-mobile-app/tasks.md` et `docs/reviews/restant.md` pour la ligne concernée (statut vrai : fait, non fait, non vérifié sur appareil).
6. **Rapport et arrêt** : fichiers touchés, tests ajoutés avec les totaux avant et après, ce qui n'est **pas** vérifié (rendu sur appareil, vrai backend), décisions éventuelles. Attendre le « go » du propriétaire. Après son accord seulement : un commit lisible pour la partie, avec uniquement ses fichiers.

Avant la partie 1, enregistrer l'état de référence : `git status`, puis les quatre commandes ci-dessus et leurs totaux. C'est la base pour dire « avant / après ».

## 6. Les parties

### Partie 1 : S34, historique des transactions
- **Constat** : `api.billing.transactions()` existe dans `src/api/endpoints.ts` (`GET /billing/transactions`, type `Transaction` : `id`, `product_id`, `price_cents` nullable, `currency` nullable, `status`, `created_at`). Aucun écran, aucune route d'app, aucune entrée dans les réglages. Lire `ListResponse` et le contrat OpenAPI pour savoir si la liste est paginée par curseur.
- **À faire** : écran « Historique des achats » (fr : « Historique des achats », en : « Purchase history »), route sous `app/(app)/settings/` ou `app/(app)/premium/` (choisir et justifier), entrée dans Réglages à côté de la gestion de l'abonnement. Liste datée (date locale lisible), libellé du produit, montant formaté avec `Intl` et la devise reçue (montant absent : ne rien afficher, jamais « 0 »), statut traduit. États : chargement, vide (`EmptyState`), erreur avec réessai, hors ligne. Statut ou produit inconnu : repli neutre et lisible, sans planter. Pagination par curseur seulement si le contrat en offre une.
- **Ne pas faire** : aucune action de remboursement ou de résiliation (la boutique s'en charge), aucun prix inventé, aucun appel hors `GET /billing/transactions`.
- **Tests** : liste, vide, erreur et réessai, montant absent, statut inconnu, parité fr/en, aucune couleur en dur.

### Partie 2 : push, réception
- **Constat** : `src/push/registerPush.ts` enregistre le jeton (`PUT /me/device`) et est monté dans `app/_layout.tsx`. Il manque : l'affichage d'une notification quand l'application est au premier plan (`Notifications.setNotificationHandler`) et l'ouverture au toucher. Le serveur envoie ce `data` (`backend/app/Jobs/SendPush.php`, `MessageController`, `Calls`) : `{ type: 'message', conversation_id }` et `{ type: 'call', call_id }`, identifiants seulement, jamais de texte de message.
- **À faire** : (a) gestionnaire de premier plan : ne pas afficher si la conversation visée est déjà ouverte, sinon afficher ; (b) toucher une notification de message ouvre `/conversation/{id}` **en passant par `sanitizeIncomingUrl`** (identifiant validé par la même expression que les liens profonds) ; (c) démarrage à froid : `Notifications.getLastNotificationResponseAsync()`, traité une seule fois ; (d) sans session ouverte ou onboarding en cours : ne naviguer nulle part (la garde `guardArea` renvoie à l'accueil) ; (e) notification d'appel : tant que `CALLS_ENABLED` est faux, ouvrir l'application sans écran d'appel ; (f) un `data` inattendu ou mal formé est ignoré sans erreur. Corriger la phrase périmée du `mobile/README.md` (section « Appels : prototype D0 requis », qui dit que l'enregistrement des jetons n'est pas fait et que `expo-notifications` n'est pas installé) et la mention de `PUT /me/device` dans `specs/010-mobile-app/tasks.md` (T030).
- **Ne pas faire** : aucune demande de permission nouvelle (elle est déjà faite après l'onboarding), aucun contenu de message dans la notification locale, aucun jeton ou identifiant journalisé hors `__DEV__`.
- **Tests** (en simulant `expo-notifications`) : navigation correcte, identifiant malformé ignoré, démarrage à froid traité une fois, déconnecté sans navigation, conversation déjà ouverte sans bannière.
- **À dire clairement au rapport** : la réception réelle d'un push exige un build de développement et une clé FCM ; rien de cette partie n'est vérifié sur appareil.

### Partie 3 : restes de la revue design et nettoyage
Traiter **un sous-point à la fois**, avec un constat d'abord ; retirer ce qui est déjà fait.
- **3a. Petits écrans et grande police (P1-7)** : `caption` fait 13 pt (`src/theme/tokens.ts`) et sert 44 fois. Trier : tout contenu critique (consentements, erreurs, prix, sécurité, texte légal) passe à `bodySmall` (14 pt) ; les métadonnées (heures, compteurs) restent. Vérifier à 320 pt et en grande police sur les écrans touchés (tests de rendu existants dans `__tests__/*Design.test.tsx`).
- **3b. Vérification (P1-8)** : relire `src/features/verification/` et ses clés : promesses affichées vraies (la vérification compare une photo, elle **n'est pas** une garantie d'identité), poses traduites en fr et en.
- **3c. Autres restes de P1-5** : annonce du match (lecteur d'écran), durée des toasts selon la longueur du texte, actions de carte contradictoires, sélecteur de date. Vérifier chacun dans le code ; n'implémenter que ce qui manque.
- **3d. Clés de traduction mortes** : écrire un test ou un script qui liste les clés fr/en jamais utilisées, les supprimer **des deux langues** ; attention aux clés construites dynamiquement (ne pas les supprimer à tort).
- **3e. `RECORD_AUDIO`** : déclaré dans `mobile/app.json` sans usage (les appels sont masqués). Vérifier qu'aucun code ne l'utilise (le plugin `expo-image-picker` peut l'ajouter pour la vidéo), puis le retirer et régler le plugin. **Sans build natif, l'effet sur le manifeste Android n'est pas vérifiable** : le dire.
- **3f. Documentation** : corriger P-12 dans `docs/reviews/restant.md` (fait, avec les références du test).

### Partie 4 : T090, types générés
- **Constat d'abord, sans rien modifier** : comparer `src/api/types.ts` (manuscrit) à `src/api/openapi.d.ts` / `generated.ts` (générés depuis `docs/openapi.json`). Dresser la liste des types encore manuscrits, des surcharges locales `Refine` (`platform`, `locale`, `Conversation.status`, `Me.email`), et des écrans qui importent chaque type.
- **À faire** : remplacer les types manuscrits par des alias des types générés, par lots de types cohérents (un domaine à la fois : profil, découverte, messages, facturation, compte), tests et typecheck verts à chaque lot. Les surcharges nécessaires restent explicites et commentées. Si `docs/openapi.json` est en retard sur le backend, **ne pas le régénérer** (c'est le backend) : le signaler.
- **Ne pas faire** : aucun changement de comportement ; aucune route ajoutée.
- Si le constat montre un chantier trop gros pour une partie, proposer un découpage au propriétaire et s'arrêter.

### Partie 5 : `GET /matches` non paginé
- **Constat** : `README.md` dit que `GET /matches` ne renvoie pas de curseur (100 derniers). `MatchController.php` a des modifications non commitées : lire le contrat actuel (`docs/openapi.json`, `endpoints.ts`) avant de conclure.
- **Si le serveur offre un curseur** : défilement infini avec `usePaginated`, comme la liste des conversations (`__tests__/conversationsPagination.test.tsx` sert de modèle).
- **Sinon** : ne pas toucher au backend. Écrire dans le README et `restant.md` la limite exacte (100 éléments, aucun indicateur de troncature) et proposer au propriétaire de demander le curseur côté serveur.

### Partie 6 : pièces jointes en conversation (cadrage d'abord)
**Ne pas coder avant la décision du propriétaire.** Constats déjà faits, à revérifier :
- Le serveur accepte `type: 'image'` avec un `media_id` (`MessageController`), mais le média doit être **déjà approuvé** (`status = 'approved'`) : avec `MEDIA_AUTO_APPROVE=false` en production, une image envoyée juste après son dépôt est refusée tant que la modération n'a pas statué.
- Un message ne porte que `media_id`, **aucune URL** : le mobile ne peut pas afficher une image reçue (il affiche « Photo reçue »). Il faut une URL de lecture côté serveur.
- Donc cette partie dépend du backend (URL de lecture) et d'une décision de produit (image bloquée jusqu'à approbation, ou modération automatique), liées à la phase B6 et à la modération (`docs/adr/005-media-moderation.md`).
- **À faire** : écrire un cadrage court (ce que le mobile ferait, ce que le serveur doit offrir, le parcours utilisateur honnête pendant l'attente de modération), puis poser la décision au propriétaire (section 7). Coder la partie mobile seulement si le propriétaire valide le contrat serveur.

## 7. Décisions du propriétaire (questions à cocher avec recommandation)

Utiliser l'outil de questions à choix, jamais une question ouverte dans le texte.
- **Partie 1** : l'entrée de l'historique va-t-elle dans Réglages ou sur l'écran Premium ? *Recommandation* : Réglages, à côté de la gestion de l'abonnement.
- **Partie 6** : image de conversation reportée avec la phase B6 (recommandé tant que la modération des images n'est pas en place), ou cadrage serveur à lancer maintenant ?

## 8. Interdits et rappels

- Aucun achat, appel ou push **simulé** : ce qui ne peut pas marcher sans service externe reste désactivé et honnête.
- Aucune affirmation « vérifié sur appareil » : rien ne l'a été.
- Un test ne se supprime ni ne s'affaiblit pour passer au vert ; un test qui échoue pour une bonne raison est un résultat à rapporter.
- Rapport de fin de chaque partie : court, les chiffres des commandes en premier, ce qui reste ensuite.
