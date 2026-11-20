# Suivi du risque 3 de cto-1 (mobile) : fait, reste à faire, impossible ici

Date : 2026-11-07. Portée : `mobile/app.json`, `mobile/eas.json`, `mobile/locales/`, `mobile/src/push/`, `mobile/__tests__/push.test.tsx`.

## Fait (code et configuration, vérifié par typecheck, lint et Jest)

- **Client push** (`mobile/src/push/registerPush.ts`, `PushRegistration.tsx`, une ligne dans `mobile/app/_layout.tsx`).
  - Demande la permission, lit le jeton natif d'appareil (`getDevicePushTokenAsync` : FCM sur Android, APNs sur iOS) et appelle `api.notifications.registerDevice` (`PUT /me/device`).
  - Déclenché seulement quand `status === 'signedIn'` et `onboardingPending === false` : la majorité et les consentements de l'inscription sont acquis. Aucune invite pour un visiteur, ni pendant la restauration de session, ni pendant l'onboarding.
  - Une seule tentative par session ; jeton renvoyé si le système le fait tourner ; simulateur ignoré ; aucune exception ne remonte ; permission refusée de façon définitive (`canAskAgain` faux) : pas de nouvelle invite.
  - `409 push_token_in_use` : non fatal, pas de nouvelle tentative, aucun message à l'utilisateur, trace `console.warn` en développement seulement (testé).
  - Déconnexion : le serveur met `push_token` et `voip_push_token` à null (`LogoutController`) et supprime le jeton d'accès. Il n'y a pas d'endpoint de désenregistrement dédié, et `PUT /me/device` ignore un `push_token` nul : le client n'a rien d'autre à appeler. Une session expirée (401) ne passe pas par `POST /auth/logout` : le jeton push reste alors côté serveur jusqu'au balayage de l'appareil (à vérifier côté backend).
- **Dépendances** : `expo-notifications ~58.1.8` et `expo-device ~58.0.5` installées avec `npx expo install` (versions du SDK 58), `package-lock.json` mis à jour par npm. `expo-notifications` ajouté aux plugins (couleur seulement, pas d'icône de notification).
- **`app.json`** : `ios.bundleIdentifier` et `android.package` = `com.hco.ayelo` (identifiant fourni par le propriétaire le 2026-11-07 ; **définitif une fois publié sur un store** ; recherche d'antériorité du nom « Ayelo » toujours non faite) ; `buildNumber` 1, `versionCode` 1 ; textes d'usage caméra, photos, micro en français par défaut plus traductions fr/en dans `mobile/locales/` (champ `locales`) ; `runtimeVersion` politique `appVersion` ; `extra.eas.projectId` = `REPLACE_WITH_EAS_PROJECT_ID` ; schéma `ayelo` conservé ; permissions Android : `CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, avec `READ/WRITE_EXTERNAL_STORAGE` et `SYSTEM_ALERT_WINDOW` bloquées ; `expo-image-picker` ne demande plus le micro ; `privacyManifests` (API à raison requise : UserDefaults, horodatage de fichiers, heure de démarrage, espace disque, valeurs recommandées pour Expo, à confirmer à la compilation).
- **`ITSAppUsesNonExemptEncryption: false`** : justifié parce que l'application n'utilise que HTTPS et WSS (TLS fourni par le système) et des API système (Secure Store, UUID) ; aucune cryptographie propriétaire. À reconfirmer par le propriétaire avant la déclaration d'export.
- **`mobile/eas.json`** : profils `development` (client de développement, interne, simulateur iOS, APK), `preview` (interne, APK), `production` (AAB, numéro de build automatique). Aucun secret ni valeur : les `EXPO_PUBLIC_*` viennent des variables d'environnement EAS rattachées à chaque profil (`environment`).
- **Tests** : `mobile/__tests__/push.test.tsx` avec `expo-notifications` et `expo-device` simulés (permission, refus, simulateur, 409, rotation du jeton, absence d'invite avant onboarding).

## Reste à faire par le propriétaire (non faisable ici)

1. Identifiant `com.hco.ayelo` posé dans `app.json` (fait) ; reste : créer le projet EAS (`eas init`) et renseigner `extra.eas.projectId`. Le nom « Ayelo » est conservé (décision du propriétaire, 2026-11-08) ; recherche d'antériorité toujours à faire (voir cto-1, 4.4).
2. **Android** : créer le projet Firebase, déposer `google-services.json` (fichier EAS secret, `android.googleServicesFile`) et la clé de compte de service FCM côté serveur. Sans cela `getDevicePushTokenAsync` échoue sur Android.
3. **iOS** : le serveur envoie via FCM HTTP v1, mais le jeton d'appareil iOS est un jeton APNs, que FCM n'accepte pas. Il faut soit ajouter le SDK Firebase Messaging côté client iOS (jeton FCM), soit envoyer les iOS directement via APNs depuis le serveur. Décision d'architecture ouverte. Clé APNs (.p8) à fournir via EAS, jamais dans le dépôt. Capacité Push Notifications à activer sur l'identifiant d'application Apple.
4. **Liens universels** : non configurés (`associatedDomains` iOS, `intentFilters` Android avec `autoVerify`, fichiers `apple-app-site-association` et `assetlinks.json` sur le domaine). Dépend du domaine final. Les liens `ayelo://` fonctionnent, pas les liens HTTPS des e-mails. Liens profonds du schéma `ayelo://` désormais filtrés par liste blanche (pentest P-12) ; les hôtes HTTPS à autoriser iront dans `ALLOWED_HTTPS_HOSTS` (`mobile/src/navigation/deepLinks.ts`).
5. Installer `expo-dev-client` (requis par le profil `development` et par RevenueCat) : hors de la portée de cette tâche. Définir les variables EAS (`EXPO_PUBLIC_API_URL`, Reverb, RevenueCat, URL légales, e-mail de support) pour les trois environnements.
6. **Mises à jour OTA** : `runtimeVersion` est posé mais `expo-updates` n'est pas installé et aucune URL de mise à jour n'est configurée : aucune OTA aujourd'hui, choix volontaire.
7. **Permissions déclarées sans usage** : DÉCIDÉ par le propriétaire le 2026-11-20 : `RECORD_AUDIO` et `NSMicrophoneUsageDescription` restent déclarés dans `mobile/app.json` pour les appels à venir, même si aucun code n'ouvre le micro tant que les appels sont masqués (un retrait avait été fait puis annulé le même jour). Risque assumé : un store peut demander de justifier la permission à la première soumission (cto-1 4.4). Le plugin `expo-image-picker` garde `microphonePermission: false`. Tests : `buildConfig.test.ts` (permissions et descriptions d'usage). La demande à l'utilisateur se fera à l'appel (FR-E-4). Aucune capacité VoIP, CallKit ni mode d'arrière-plan n'est déclarée.
8. Il n'existe pas d'usage iOS pour les notifications : l'invite système n'a pas de texte personnalisable. Prévoir un écran d'explication avant l'invite si le produit le souhaite (aujourd'hui l'invite apparaît à la fin de l'onboarding).
9. Appels reçus en arrière-plan, suivi d'erreurs (Sentry), analytique, tests sur appareil réel, Maestro : non traités (cto-1, 3.3 points 2, 4, 5).
10. Étiquettes de confidentialité des stores, questionnaire d'âge, compte Apple/Google, test fermé Google de 14 jours : décisions et démarches du propriétaire.

## Impossible dans cet environnement

Compiler un build natif (EAS ou prebuild), tester une notification sur appareil réel, vérifier le jeton FCM/APNs, valider les manifestes de confidentialité Apple. Le code est donc testé avec des faux uniquement.


## Complément du 2026-11-07

- `expo-splash-screen ~58.0.13` ajouté (plugin dans `app.json`, fond clair #FFFFFF et sombre #121110, sans image : TODO logo). `package.json` : scripts `check:env` et `eas-build-pre-install` (échec du build `production` si `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_TERMS_URL` ou `EXPO_PUBLIC_PRIVACY_URL` manque). À confirmer au premier build EAS réel.