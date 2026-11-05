# Ayelo : application mobile

Application Expo (SDK 58, React Native 0.88, TypeScript strict, expo-router). « Ayelo » est un nom de travail.
Cette étape couvre l'accueil, les consentements, le contrôle d'âge, la connexion, l'inscription et le début de l'onboarding (docs `04` F00, F01, F17 ; `05` S01, S02, S04, S05, S63, S64, S68).

Aucun module natif personnalisé : **Expo Go suffit** pour cette étape.

## Prérequis

- Node.js 20 ou plus récent, npm.
- Un backend Laravel qui répond sous `/api/v1` (voir `../backend`).
- Pour tester sur téléphone : l'application Expo Go (version compatible avec le SDK 58).

## Lancer

```bash
cd mobile
npm install
cp .env.example .env.local      # puis renseigner EXPO_PUBLIC_API_URL
npm start                       # ou : npm run android / npm run ios
```

Flasher le QR code avec Expo Go, ou appuyer sur `a` (émulateur Android) / `i` (simulateur iOS, macOS).

## Variables d'environnement

| variable | rôle |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | URL racine du backend **sans** `/api/v1` (le client ajoute le préfixe). Aucune valeur par défaut n'est codée en dur : si elle manque, les écrans affichent « L'adresse du serveur n'est pas configurée » et aucun appel réseau n'est fait. |

Valeurs usuelles en développement :

- émulateur Android : `http://10.0.2.2:8000`
- simulateur iOS : `http://localhost:8000`
- téléphone réel : `http://<IP de votre PC>:8000` (même réseau Wi-Fi) ou une URL HTTPS publique.

Les variables `EXPO_PUBLIC_*` sont **incluses dans l'application** : n'y mettez jamais de secret. Le fichier `.env.local` est ignoré par git ; `.env.example` ne contient aucune valeur.

## Vérifier

```bash
npm run typecheck   # tsc --noEmit (TypeScript strict)
npm run lint        # ESLint (eslint-config-expo)
npm test            # Jest (jest-expo) + @testing-library/react-native
```

Les tests couvrent : composants UI (états default, pressed, disabled, loading, erreur), parité des clés fr/en, machine d'états de l'inscription, garde d'authentification, client API (mock de `fetch` : `X-Device-Id`, `Authorization`, erreurs 422/403/429), écrans S01, S02, S04, S63, S64, S68, restauration de session et déconnexion. Deux tests de conformité interdisent les couleurs en dur hors `src/theme/tokens.ts` et l'usage d'`AsyncStorage`.

## Structure

```
app/                      routes expo-router (fines : elles importent src/features)
  (public)/               visiteurs : accueil, connexion, parcours d'inscription
  onboarding/             S04, S05 (compte neuf)
  (app)/                  accueil connecté provisoire
src/
  theme/                  tokens clair/sombre (docs/07), ThemeProvider
  ui/                     Button, TextField, ChoiceCard, CheckboxField, Banner, Toast, Skeleton,
                          EmptyState, ScreenContainer, ProgressBar, DateSelector, Text
  i18n/                   fr.ts, en.ts, translate.ts, I18nProvider (t('clé'))
  api/                    client fetch typé, erreurs, types, endpoints (toute la spec docs/10)
  storage/                expo-secure-store : jeton, identifiant d'appareil, préférences
  auth/                   AuthProvider, état de session
  flow/                   machine d'inscription (signupMachine), garde d'authentification (authGuard)
  features/               écrans par domaine (welcome, signup, auth, onboarding, home, demo)
  navigation/             AreaLayout : applique la garde à chaque zone
__tests__/                tests Jest
```

## Parcours et navigation

- **Connexion (F00)** : S01 → S02 (mode connexion) → accueil connecté. Ni S63 ni S68. Elle fonctionne même après un refus d'âge.
- **Inscription (F01, F17)** : S01 → S63 → S68 → S02 (mode inscription) → S04 → S05 → accueil connecté.
  - S63 : trois cases obligatoires distinctes (`terms`, `privacy`, `sensitive_data`) et une facultative (`marketing`).
  - S68 : le client envoie la date au serveur (`POST /auth/age-check`) **sans juger l'âge lui-même**, pour que le refus soit mémorisé côté serveur. `403 age_not_eligible` mène à S64 (message neutre, aucun retour possible vers la saisie).
  - S02 (inscription) exige le jeton d'âge (10 minutes) et les consentements ; s'ils manquent, l'écran redirige vers S63 ou S68.
- La garde d'authentification (`src/flow/authGuard.ts`, appliquée par `src/navigation/AreaLayout.tsx`) répartit les écrans en trois zones : public (visiteurs), onboarding (compte neuf) et app (connecté).
- Au lancement, le jeton est relu dans `expo-secure-store` et validé par `GET /me` ; un 401 efface la session, une panne réseau la conserve.

## Client API (`src/api`)

- `createApiClient` : base URL configurable, en-tête `X-Device-Id` (uuid généré une fois, stocké dans `expo-secure-store`), `Authorization: Bearer` sur les routes authentifiées, `Accept-Language`, délai maximal de 15 s, lecture du format d'erreur `{ error: { code, message, fields? } }` (`ApiError`, `Retry-After` pour les 429).
- `createEndpoints` expose **toutes** les routes de `docs/10-API-SPECIFICATIONS.md`. Seules cinq existent aujourd'hui côté backend et sont utilisées par les écrans : `auth.ageCheck`, `auth.register`, `auth.login`, `auth.logout`, `auth.me`. Les types des autres réponses sont **provisoires** jusqu'à `backend/openapi.yaml`.
- Le jeton ne passe jamais par `AsyncStorage` (non installé).

## Internationalisation

Français (langue de base) et anglais. La langue du téléphone est le point de départ ; le bouton de langue (accueil et écran connecté) la change et mémorise le choix. Toute chaîne passe par `t('clé')`. Un test échoue si `fr.ts` et `en.ts` n'ont pas exactement les mêmes clés ou les mêmes paramètres `{nom}`.

## Design system

Tokens dans `src/theme/tokens.ts` (palette provisoire de `docs/07`, plus quelques tokens techniques : `disabledBg`, `disabledText`, `skeleton`, `overlay`). Aucune couleur en dur ailleurs (test automatique). Cibles tactiles de 44 pt minimum, rôles et libellés d'accessibilité, mode sombre suivant le réglage système. En développement, S01 propose un lien « Voir les composants » vers une page de démonstration (`app/(public)/components-demo.tsx`).

## Limites connues de cette étape

- Connexion Google / Apple / TikTok, vérification de l'e-mail (S03), mot de passe oublié (S61), liens vers les textes légaux (S57) : non faits (routes ou écrans absents).
- S04 et S05 conservent le brouillon **en mémoire** : `PUT /me/profile` n'existe pas encore, rien n'est envoyé. Le profil sera à renvoyer quand la route existera. S04 collecte le pays de **résidence** ; le pays d'origine sera ajouté avec le profil complet.
- La liste de pays de S04 est une liste courte (marchés du lancement), pas la liste ISO complète.
- Pas d'appels audio/vidéo (phase D) : le client contient seulement les fonctions d'API correspondantes.
- Rendu non vérifié sur un appareil ou un émulateur à ce jour : les vérifications faites sont le typage, le lint, les tests Jest et un export Metro/Hermes Android.
