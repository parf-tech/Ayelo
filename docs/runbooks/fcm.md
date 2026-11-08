# Notifications push : mise en place de FCM

Dernière mise à jour : 2026-11-08. Ce qui est fait dans le dépôt est séparé de ce que le propriétaire doit faire dans la console Firebase. Les intitulés de la console Firebase changent : à vérifier à l'écran au moment de la mise en place.

## Ce qui est déjà en place dans le dépôt

- **Serveur** : `backend/app/Services/Push/FcmPushNotifier.php` envoie par l'API HTTP v1 de FCM, avec un compte de service lu dans l'environnement (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`). Sans ces valeurs, rien n'est envoyé et rien n'est supprimé. Un refus du compte de service (401 ou 403) ou une clé illisible est journalisé en `critical` sans aucun secret, et les jetons des appareils sont conservés. Un jeton inconnu (404) ou invalide (400) est supprimé. Six tests : `backend/tests/Feature/FcmPushNotifierTest.php`.
- **Application Android** : `mobile/app.config.js` ajoute `android.googleServicesFile` quand la variable `GOOGLE_SERVICES_JSON` existe (build EAS) ou quand `mobile/google-services.json` existe (build local). `google-services.json` et `GoogleService-Info.plist` sont ignorés par Git.
- **Enregistrement du jeton** : `mobile/src/push/registerPush.ts` demande la permission seulement après la connexion et la fin de l'onboarding, puis envoie le jeton natif à `PUT /me/device`. Un jeton déjà porté par un autre compte répond 409 et n'est pas réessayé.
- **Identifiant de l'application** : `com.hco.ayelo` (iOS et Android). Le nom de package Android saisi dans Firebase doit être exactement celui-là.

## Configuration du projet Ayelo

- **Firebase** : le projet `ayelo-rencontres` contient l'application Android `com.hco.ayelo`; l'API HTTP v1 de FCM est activée.
- **Compte de service** : `ayelo-fcm-sender@ayelo-rencontres.iam.gserviceaccount.com` a le rôle « Firebase Cloud Messaging API Admin ». Sa clé JSON est conservée hors du dépôt avec des ACL Windows restrictives. Ne jamais la commiter ni la transmettre dans le chat.
- **EAS** : le projet `@kteya96/ayelo` est lié à l'application (`629800d3-0b65-4ce4-a4ca-6c171426d3dd`). `GOOGLE_SERVICES_JSON` est configuré comme fichier secret dans les environnements `preview` et `production`.
- **Développement local** : la configuration privée du backend se trouve dans `backend/.env`, fichier local ignoré par Git. Renseigner `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` et `FCM_PRIVATE_KEY` à partir du compte de service; conserver la clé JSON hors du dépôt et ne jamais ajouter ces valeurs aux fichiers suivis. La clé privée doit avoir ses retours à la ligne encodés en `\n`, que le client FCM du backend convertit avant de signer la requête.
- **Build Android** : EAS reçoit `GOOGLE_SERVICES_JSON` en fichier secret dans `preview` et `production`; les builds locaux utilisent `mobile/google-services.json`, également ignoré par Git. Générer un APK Android avec `eas build --profile preview --platform android`, puis tester sur un vrai téléphone. Une notification réellement envoyée requiert également que le backend tourne avec accès Internet et que l'appareil ait enregistré son jeton.
- **Production VPS** : aucun VPS n'est utilisé pour le moment; les variables FCM du serveur de production restent donc à configurer lorsque le déploiement sera décidé.
- **Rotation** : si la clé fuit, la révoquer dans Google Cloud, en créer une autre et mettre à jour `FCM_PRIVATE_KEY`, puis redémarrer les workers.

## iOS : décision d'architecture encore ouverte

Sur iOS, `getDevicePushTokenAsync` renvoie un jeton APNs, pas un jeton FCM. L'API HTTP v1 de FCM refuse ce jeton. Le serveur ignore donc volontairement les jetons iOS au format APNs (journal `warning`, aucune suppression), et l'application iOS ne reçoit aucune notification tant que ce choix n'est pas fait. Trois options :

1. **Jeton FCM côté application** avec `@react-native-firebase/app` et `@react-native-firebase/messaging` (plugins de configuration Expo, nécessite un build de développement ou de production, pas Expo Go), plus `GoogleService-Info.plist`. Le serveur ne change pas. Il reste à téléverser la clé d'authentification APNs (fichier `.p8`) dans les paramètres Cloud Messaging de Firebase.
2. **Envoyer à APNs directement** depuis le serveur pour les appareils iOS (jeton APNs, clé `.p8`, JWT ES256). Plus de code serveur, aucune dépendance Firebase côté iOS.
3. **Service de push d'Expo** (jetons Expo) pour les deux plateformes. Plus simple, mais un prestataire de plus entre vos utilisateurs et leurs notifications : à ajouter à la politique de confidentialité.

Recommandation : l'option 1 si la bêta fermée cible surtout Android et si l'on veut garder un seul canal serveur. Dans tous les cas il faut un compte Apple Developer et la clé APNs.

## Confidentialité

L'aperçu du message est désactivé par défaut (`PUSH_MESSAGE_PREVIEW=false`) : le texte envoyé à FCM est « Vous avez reçu un nouveau message. ». Google (FCM) et Apple (APNs) doivent figurer dans la liste des prestataires de la politique de confidentialité, à faire valider par un juriste.

## Limites connues

- Jamais exécuté contre un vrai projet Firebase : les tests du serveur utilisent des réponses simulées.
- Les files `realtime` et `push` sont prévues par le compose, mais le code n'envoie encore rien vers la file `push` : tout part sur la file par défaut.
