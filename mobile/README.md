# Ayelo : application mobile

Application Expo (SDK 58, React Native 0.88, TypeScript strict, expo-router). « Ayelo » est un nom de travail.
Elle couvre l'inscription et la connexion, le profil (photos, préférences), la découverte, la messagerie en temps réel,
les paramètres et la vie privée, Premium (achats via RevenueCat), la vérification de profil et l'interface des appels
(docs `04` F00 à F06, `05` S01 à S68, `specs/010-mobile-app`).

**Expo Go suffit** pour tout sauf trois fonctions qui exigent un build de développement (voir « Ce qui exige un build de développement »).

## Prérequis

- Node.js 20 ou plus récent, npm.
- Un backend Laravel qui répond sous `/api/v1` (voir `../backend`).
- Pour tester sur téléphone : l'application Expo Go (version compatible avec le SDK 58).

## Lancer

```bash
cd mobile
npm install
cp .env.example .env.local      # puis renseigner EXPO_PUBLIC_API_URL (et Reverb pour le temps réel)
npm start                       # ou : npm run android / npm run ios
```

## Variables d'environnement

Toutes sont `EXPO_PUBLIC_*` : elles sont **incluses dans l'application**. N'y mettez jamais de secret (voir `.env.example`).

| variable | rôle |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | URL racine du backend **sans** `/api/v1`. Aucune valeur par défaut : si elle manque, les écrans affichent « L'adresse du serveur n'est pas configurée » et aucun appel réseau n'est fait. |
| `EXPO_PUBLIC_REVERB_KEY`, `_HOST`, `_PORT`, `_SCHEME` | Laravel Reverb (protocole Pusher). La clé d'application est publique par conception ; **jamais** le secret. Sans clé et hôte, le temps réel est indisponible et les écrans se rafraîchissent périodiquement. |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `_ANDROID_KEY` | Clés SDK **publiques** RevenueCat. Sans elles (ou dans Expo Go), les achats sont désactivés. |
| `EXPO_PUBLIC_TERMS_URL`, `_PRIVACY_URL`, `_COMMUNITY_RULES_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL` | Mentions légales (S57) et contact. Les textes sont validés par un juriste ; un lien non configuré est indiqué comme tel et désactivé. |

Valeurs usuelles pour `EXPO_PUBLIC_API_URL` : émulateur Android `http://10.0.2.2:8000`, simulateur iOS `http://localhost:8000`, téléphone réel `http://<IP du PC>:8000` ou une URL HTTPS publique. Le fichier `.env.local` est ignoré par git.

## Vérifier

```bash
npm run typecheck   # tsc --noEmit (TypeScript strict)
npm run lint        # ESLint (eslint-config-expo)
npm test            # Jest (jest-expo) + @testing-library/react-native
npx expo export --platform android   # le bundle Metro/Hermes doit compiler (supprimer ensuite le dossier dist)
```

Les tests couvrent : composants UI, parité des clés fr/en, aucune couleur en dur hors `src/theme/tokens.ts`, aucun `AsyncStorage`,
machine d'inscription, garde d'auth, client API (en-têtes, erreurs, tableaux Laravel), tous les écrans listés ci-dessous
(avec un faux serveur `__tests__/helpers/fakeApi.ts` et un faux transport temps réel `__tests__/helpers/shell.tsx`),
la logique de fil de messages, la machine d'états des appels, le choix du `PurchaseProvider` (le SDK RevenueCat n'est jamais chargé par les tests).

## Structure

```
app/                          routes expo-router (fines : elles importent src/features)
  (public)/                   visiteurs : accueil, connexion, inscription, mot de passe oublié
  onboarding/                 S03 e-mail, S04, S05, S06 photos, S07 préférences
  (app)/(tabs)/               Découvrir, Messages, Mon profil
  (app)/...                   filtres, match, détail, signalement, conversation, paramètres, premium, vérification, appel
  verify-email.tsx, reset-password.tsx   liens de l'e-mail (ayelo://verify-email?token=…)
src/
  theme/ ui/ i18n/            design system, composants, fr/en (src/i18n/areas/* par domaine)
  api/                        client fetch typé + endpoints (uniquement les routes réelles du backend)
  auth/ storage/ flow/        session, expo-secure-store, garde d'authentification
  hooks/                      useResource, usePaginated (curseur), usePolling
  media/                      sélection d'image (expo-image-picker) et envoi présigné
  realtime/                   interface RealtimeTransport, Reverb via pusher-js, autorisation des canaux privés
  billing/                    PurchaseProvider (+ implémentation RevenueCat isolée)
  navigation/                 AreaLayout (garde), AppShell (contextes de la zone connectée), MainTabs
  features/                   écrans par domaine
__tests__/                    tests Jest
```

## Parcours et écrans

- **Connexion (F00)** : S01 → S02 → onglets. **Inscription (F01)** : S01 → S63 → S68 → S02 → S03 (e-mail, non bloquant) → S04 (nom, genre, pays de résidence **et d'origine**, ville) → S05 (`PUT /me/profile`) → S06 (photos) → S07 (préférences) → Découvrir.
- **S03 / S61** : lien de l'e-mail ouvert par `ayelo://verify-email?token=…` ou `reset-password?token=…` ; le code peut aussi être collé à la main (le lien envoyé par le backend pointe d'abord vers la page web).
- **S06 / S60** : `expo-image-picker`, `POST /media/upload-url` → `PUT` sur l'URL présignée (sans jeton) → `POST /media/{id}/complete`. Statut « en revue », réordonner (`PUT /me/media/order`), supprimer. Formats JPEG, PNG, WebP.
- **Découvrir (S10)** : pile de cartes avec geste (droite = like, gauche = passer, haut = coup de cœur) **et** boutons / actions d'accessibilité équivalents ; préchargement par curseur ; états vide, chargement, erreur, hors ligne, quota (429) et Premium requis (402) ; annulation (Premium). Filtres S09, match S12, détail S11 avec menu Bloquer / Signaler / Écrire (3 taps).
- **Messages (S13, S14)** : liste avec non-lus ; conversation avec envoi optimiste (`client_id`), renvoi en échec avec le **même** `client_id` (le serveur est idempotent), pagination par curseur, accusés remis / lus, « écrit… », bannière de sécurité quand la réponse porte `safety_hint: money_request`.
- **Profil et paramètres (S50 à S57, S59, S60, S65 à S67)** : confidentialité, notifications, sessions, bloqués, consentements, sanctions et contestation, export, support, mentions légales, suppression de compte avec ré-authentification.
- **Historique des achats (S34)** : Réglages, section Abonnement, puis `settings/purchases`. `GET /billing/transactions` (les 100 derniers, sans curseur : aucune pagination) ; `GET /billing/offers` ne sert qu'à nommer les produits (sinon « Achat »). Lecture seule : remboursement et résiliation restent dans la boutique. Le montant vient de `price_cents` (le serveur écrit prix × 100 quelle que soit la devise) ; prix, devise, date ou statut illisibles sont omis, jamais remplacés par une valeur inventée.
- **Notifications push** : `src/push/registerPush.ts` enregistre le jeton natif (`PUT /me/device`, FCM ou APNs) une fois la session ouverte et l'onboarding terminé ; `src/push/usePushReception.ts` (monté dans `app/_layout.tsx`) traite la réception. Au premier plan, une notification qui vise la conversation déjà ouverte n'affiche rien, et rien ne s'affiche sans session ouverte. Toucher une notification de message ouvre `/conversation/{id}` : le `data` du serveur (`{ type: 'message', conversation_id }`, identifiants seulement) est validé par la liste blanche des liens profonds (P-12) ; un `data` mal formé ou une notification d'appel n'ouvre aucun écran. Le toucher qui lance l'application à froid est relu une fois, après la restauration de la session et le montage du navigateur (un toucher reçu avant est conservé) ; sans session ou en onboarding il est ignoré et n'est pas rejoué à la connexion. Aucune permission supplémentaire, aucun contenu de message, aucune trace.
- **Verrouillage biométrique** (décisions du propriétaire du 2026-11-20) : Réglages, « Confidentialité et sécurité », interrupteur « Verrouiller l'application », désactivé par défaut et proposé seulement si l'appareil a un verrouillage (biométrie, code ou schéma ; `expo-local-authentication`). L'activer, comme le désactiver, demande une confirmation de l'appareil. Activé : l'application démarre verrouillée et se reverrouille après **1 minute** en arrière-plan (`LOCK_DELAY_MS`) ; l'écran de verrouillage la couvre sans la démonter (navigation et écrans conservés, contenu caché au lecteur d'écran). Une seule invite par verrouillage ; si elle est annulée, « Déverrouiller » réessaie et « Se déconnecter » reste possible. Le code de l'appareil sert de repli. Si l'appareil perd son verrouillage, le verrou est levé et désactivé (rien à imposer). La même confirmation précède la **suppression du compte**, l'**export des données** et la **fermeture des sessions** ; elle s'ajoute au mot de passe, que le serveur exige toujours (elle ne le remplace pas, le backend n'ayant pas été modifié). La préférence est dans le stockage sécurisé, de cet appareil, et effacée à la déconnexion. Limites : l'aperçu du sélecteur d'applications peut montrer le dernier écran pendant la minute de grâce (pas de masque d'aperçu) ; écrit et testé par Jest avec un module simulé, **non vérifié sur appareil** (Face ID, empreinte, repli sur le code, comportement d'`AppState` pendant l'invite Android).

## Temps réel (Reverb)

`src/realtime` expose une interface `RealtimeTransport` (connexion, abonnement aux canaux, état). L'implémentation `pusherTransport.ts` utilise **pusher-js** (JavaScript pur, aucun module natif : fonctionne dans Expo Go) et autorise chaque canal privé par `POST /api/v1/broadcasting/auth` avec le jeton. Canaux : `private-user.{id}` (`match.created`, `call.incoming`, `call.cancelled`, `billing.updated`, `sanction.created`) et `private-conversation.{id}` (`message.created`, `message.delivered`, `message.read`, `typing`, `call.state`).
Si la socket n'est pas connectée (ou non configurée), `useFallbackRefresh` rafraîchit les données toutes les 15 s et une fois à la reconnexion.

## Premium (RevenueCat)

`PurchaseProvider` (`src/billing/purchaseProvider.ts`) : `configure(user.id)` (l'`app_user_id` RevenueCat **est** `user.id`), `getProducts`, `purchase`, `restore`, `logOut`.
- `UnavailablePurchaseProvider` : Expo Go ou clé absente. Les offres s'affichent (`GET /billing/offers`, sans prix : les prix viennent du store), l'achat est désactivé avec une explication. **Aucun achat n'est simulé.**
- `revenueCatProvider.ts` : l'implémentation réelle, chargée uniquement par `createPurchaseProvider()` hors Expo Go et avec une clé SDK. Elle n'a **jamais été exécutée** (pas de build de développement ni de compte boutique à ce jour).
- Le succès n'est affiché (S32) qu'après confirmation du **serveur** (`POST /billing/sync` ou événement `billing.updated`), jamais sur la seule réponse du store ; au bout de 10 vérifications, un message honnête propose de revérifier ou de contacter le support.

## Vérification de profil (S40, S41)

`GET /me/verification/pose` (consigne), consentement distinct `verification_biometric` (`POST /me/consents`), selfie par la caméra (`expo-image-picker`), envoi présigné (`verification_selfie`), `POST /me/verification`, puis suivi (`GET /me/verification`, actualisation toutes les 30 s tant que « en attente »).

## Appels : prototype D0 requis

Ce qui existe : l'interface des appels (S15 sortant, S16 entrant, S17 en cours, S18 « appel manqué » dans la conversation) et la **signalisation** réelle par l'API (`POST /calls`, `accept`, `decline`, `end`) et le temps réel (`call.incoming`, `call.cancelled`, `call.state`). Machine d'états pure testée (`features/calls/callMachine.ts`).

Ce qui n'existe **pas** : le média (audio / vidéo). Une interface abstraite `MediaEngine` (`features/calls/mediaEngine.ts`) est branchée avec une seule implémentation, `UnavailableMediaEngine`, dont `connect` échoue explicitement. L'écran d'appel affiche : « L'audio et la vidéo ne sont pas disponibles dans cette version (prototype D0 requis). Seule la sonnerie est transmise. » Les boutons micro, caméra et haut-parleur sont désactivés.

Ne sont **pas implémentés** et exigent un build de développement ainsi que le prototype D0 (`docs/DECISIONS-PROPRIETAIRE.md`, C2) :
- le moteur média LiveKit (`@livekit/react-native`, qui dépend de `@livekit/react-native-webrtc`) ;
- l'appel entrant application fermée : CallKit (iOS, avec push VoIP PushKit) et ConnectionService (Android) ;
- l'ouverture d'un écran d'appel depuis une notification : l'appel entrant passe par la signalisation temps réel, pas par le push (voir « Notifications push »).
- la demande de la permission du micro au moment de l'appel (FR-E-4). `RECORD_AUDIO` (Android) et `NSMicrophoneUsageDescription` (iOS) restent **déclarés** dans `app.json`, par décision du propriétaire du 2026-11-20, pour les appels à venir ; aucun code n'ouvre le micro tant que les appels sont masqués. Risque connu : un store peut demander de justifier une permission que la première version n'utilise pas (cto-1 4.4).

Brancher LiveKit consiste à écrire une classe `LiveKitMediaEngine implements MediaEngine` et à la passer à `<CallProvider mediaEngine={…}>` ; la réponse de `POST /calls` et `/calls/{id}/accept` fournit déjà `livekit: { url, room, token }`.

## Ce qui exige un build de développement

1. Achats RevenueCat (`react-native-purchases`) ;
2. Média des appels (LiveKit, WebRTC) ;
3. CallKit / ConnectionService et notifications poussées à distance (inutilisables dans Expo Go sur Android depuis le SDK 53).

## Client API (`src/api`)

- `createApiClient` : base URL configurable, `X-Device-Id`, `Authorization: Bearer` sur les routes authentifiées, `Accept-Language`, délai de 15 s, erreurs `{ error: { code, message, fields? } }` (`ApiError`, `Retry-After`), tableaux au format Laravel (`countries[]=FR`).
- `createEndpoints` n'expose **que** les routes qui existent dans `backend/routes/api/*.php`. Les types de `types.ts` dérivent du contrat généré (`src/api/openapi.d.ts`, produit par `npm run api:types` depuis `docs/openapi.json`, via les aides de `generated.ts` : `OpRequest`, `OpResponse`, `Refine`) partout où le contrat est exploitable (tâche T090). Une vingtaine de types restent écrits à la main parce que le contrat les décrit comme des objets vides, trop étroitement ou en `string` : la liste et la raison de chacun sont dans `__tests__/apiTypes.test.ts`, qui échoue dès qu'un type devient dérivable ou qu'un type manuscrit s'ajoute. Pas de client généré : `endpoints.ts` reste écrit à la main.
- Le jeton ne passe jamais par `AsyncStorage` (non installé) ; il reste dans `expo-secure-store`.

## Écarts connus avec l'API et limites

- `GET /conversations` accepte un curseur facultatif (`limit`, `cursor`, `meta.next_cursor`) et la liste est paginée côté client (`usePaginated`) ; `GET /discover` et `GET /conversations/{id}/messages` le sont aussi.
- « Rompre le match » : `GET /conversations` renvoie `match_id` (nul hors match) et l'application appelle `DELETE /matches/{match_id}` ; le menu ne propose l'action que si `match_id` est connu. Elle n'utilise pas `GET /matches`, qui reste plafonné aux 100 matchs actifs les plus récents, sans curseur ni `limit` (contrat `docs/openapi.json`, `MatchController`) : un match ancien se rompt comme un autre. Test : `__tests__/unmatch.test.tsx` ; garde-fou de type dans `__tests__/apiTypes.test.ts`. Non vérifié sur appareil.
- `POST /conversations/{id}/typing` ne prend pas de corps côté backend (la consigne mentionnait `up_to_message_id` : seuls `read` et `delivered` le prennent).
- Un message ne porte que `media_id` (pas d'URL) : les messages image / vidéo / voix reçus s'affichent comme « Photo reçue », etc. L'envoi de pièces jointes n'est pas implémenté (le serveur n'accepte un média de message qu'une fois approuvé, et en production l'approbation est humaine). Le propriétaire a décidé le 2026-11-22 de le reporter avec la phase B6 ; le cadrage est dans `docs/reviews/mobile-pieces-jointes-cadrage.md`.
- Suppression de compte S55 : seul le mot de passe est géré. Pour un compte Google / Apple, le serveur exige `provider` + `id_token` ; la connexion sociale n'est pas implémentée, l'écran l'explique et renvoie au support.
- La liste de pays est la liste courte des marchés du lancement, pas la liste ISO complète.
- **Non vérifié** : rendu sur appareil ou émulateur, navigation réelle (`Stack`, `Tabs`, `Redirect`, seulement compilés par l'export Metro), geste de swipe (la décision est testée ; le `PanResponder` ne l'est pas), contre un vrai backend, Reverb réel, RevenueCat réel, caméra réelle. Les tests utilisent un faux serveur et un faux transport.
- Tests de bout en bout (Maestro, gate G4) : non faits. Types générés (T090) : voir ci-dessus ; ce qui reste manuscrit dépend du contrat OpenAPI du backend, pas de l'application.
