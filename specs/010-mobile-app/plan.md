# Plan 010 : Application mobile

- Stack figée par le projet : Expo SDK 58, React Native 0.88, React 19, expo-router, TypeScript strict, Jest + Testing Library (versions exactes dans `mobile/package.json`).
- Structure : `src/theme`, `src/ui`, `src/i18n`, `src/api` (client typé, `endpoints.ts` couvre `docs/10`), `src/storage`, `src/auth`, `src/flow`, `src/features/*`, `app/*` (routes).
- **État du dépôt** : l'agent de la phase 2 a laissé des modifications **non commitées et non vérifiées** (`mobile/src/api/*`, `src/auth/*`, `src/hooks/`, un fichier temporaire `src/api/types.head.tmp`). À relire, nettoyer, tester avant reprise.
- Limites connues : rendu jamais vu sur appareil ni émulateur ; navigation réelle (`Stack`, `Redirect`) seulement validée par la compilation du bundle ; types d'API provisoires pour les routes non encore consommées ; Expo Go ne suffit pas pour RevenueCat, LiveKit, CallKit (build de développement requis).
- Décision : le client n'évalue jamais l'âge ; il envoie toujours la date au serveur.
