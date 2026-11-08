# Notifications push : mise en place de FCM

Dernière mise à jour : 2026-11-08. Ce qui est fait dans le dépôt est séparé de ce que le propriétaire doit faire dans la console Firebase. Les intitulés de la console Firebase changent : à vérifier à l'écran au moment de la mise en place.

## Ce qui est déjà en place dans le dépôt

- **Serveur** : `backend/app/Services/Push/FcmPushNotifier.php` envoie par l'API HTTP v1 de FCM, avec un compte de service lu dans l'environnement (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`). Sans ces valeurs, rien n'est envoyé et rien n'est supprimé. Un refus du compte de service (401 ou 403) ou une clé illisible est journalisé en `critical` sans aucun secret, et les jetons des appareils sont conservés. Un jeton inconnu (404) ou invalide (400) est supprimé. Six tests : `backend/tests/Feature/FcmPushNotifierTest.php`.
- **Application Android** : `mobile/app.config.js` ajoute `android.googleServicesFile` quand la variable `GOOGLE_SERVICES_JSON` existe (build EAS) ou quand `mobile/google-services.json` existe (build local). `google-services.json` et `GoogleService-Info.plist` sont ignorés par Git.
- **Enregistrement du jeton** : `mobile/src/push/registerPush.ts` demande la permission seulement après la connexion et la fin de l'onboarding, puis envoie le jeton natif à `PUT /me/device`. Un jeton déjà porté par un autre compte répond 409 et n'est pas réessayé.
- **Identifiant de l'application** : `com.hco.ayelo` (iOS et Android). Le nom de package Android saisi dans Firebase doit être exactement celui-là.

## À faire par le propriétaire (je ne crée ni compte, ni clé)

1. **Créer le projet Firebase** dans la console Firebase, avec le compte Google du propriétaire. Noter l'identifiant du projet : c'est `FCM_PROJECT_ID`.
2. **Ajouter l'application Android** au projet, avec le nom de package `com.hco.ayelo`. Télécharger `google-services.json`.
3. **Fournir `google-services.json` à EAS** sans le commiter : `eas env:create --name GOOGLE_SERVICES_JSON --type file --visibility secret --environment production --environment preview` (puis le chemin du fichier). La syntaxe exacte de la commande est à vérifier avec `eas env:create --help`. Pour un build local, poser le fichier dans `mobile/google-services.json`.
4. **Créer le compte de service d'envoi** : dans Google Cloud (même projet), vérifier que l'API « Firebase Cloud Messaging API » est activée, créer un compte de service avec le rôle « Firebase Cloud Messaging API Admin » (ou un rôle personnalisé qui n'a que la permission `cloudmessaging.messages.create`), puis créer une clé JSON. Cette clé donne le droit d'envoyer à tous vos utilisateurs : la traiter comme un mot de passe.
5. **Renseigner le serveur** dans `infra/.env.prod`, hors du dépôt, droits 600 :
   - `FCM_PROJECT_ID` : identifiant du projet ;
   - `FCM_CLIENT_EMAIL` : champ `client_email` du fichier JSON ;
   - `FCM_PRIVATE_KEY` : champ `private_key`, sur une seule ligne, avec les retours à la ligne écrits `\n` (le code les convertit).
   Supprimer ensuite le fichier JSON de la machine locale.
6. **Tester sur un vrai téléphone Android** avec un build de préproduction (`eas build --profile preview --platform android`) : ouvrir une session, accepter la permission, envoyer un message depuis un second compte, application en arrière-plan. Surveiller les journaux du serveur : une ligne `push FCM refusé` ou `push FCM impossible` en `critical` indique un problème de compte de service.
7. **Rotation** : si la clé fuite, la révoquer dans Google Cloud, en créer une autre et mettre à jour `FCM_PRIVATE_KEY`, puis redémarrer les workers.

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
