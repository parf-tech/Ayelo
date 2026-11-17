# Tests de bout en bout (Playwright)

Navigateur réel (Chrome installé sur le poste), application servie par Expo web, **vrai backend Laravel** et PostgreSQL jetable. Plan et résultats : `replica/test-plan.md`. Bogues : `replica/bugs.md`.

## Lancer

1. Backend et données de démonstration : `powershell -ExecutionPolicy Bypass -File scripts/dev-preview.ps1` (voir `docs/runbooks/apercu-local.md`).
2. Application web : `cd mobile` puis `$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:8000'; $env:CI='1'; npx expo start --web --port 8089`. Avec `CI=1` Expo **ne surveille pas les fichiers** : après une modification du code de l'application, arrêter et relancer Expo (`--clear`), sinon les tests voient l'ancien code.
3. `cd e2e`, `npm install`, `npx playwright test`.

Le mot de passe du membre d'aperçu est lu dans `%TEMP%\ayelo-preview\preview-password.txt` (ou `PREVIEW_PASSWORD`). Il n'est jamais écrit dans le dépôt ni affiché. Autres variables : `E2E_BASE_URL`, `E2E_API_URL`.

Le navigateur est le Chrome du poste (`channel: 'chrome'`) : le Chromium téléchargé par Playwright n'a pas pu être extrait sur ce poste (le contrôle d'application de Windows l'a bloqué ; il n'a pas été contourné).

## Règles de la suite

- Un seul worker : le serveur PHP intégré traite une requête à la fois et les limites de débit de l'API restent actives. La suite complète dure environ 14 à 25 minutes ; une lenteur du serveur peut faire échouer un test isolément (écran « Vous êtes hors ligne » après un délai dépassé, vu une fois sur `F06-H3`, qui réussit seul).
- `global-setup.ts` échauffe l'API avant la suite (une connexion et les routes des écrans, session refermée). Sans cela, la toute première connexion sur un serveur PHP à froid a pris 19 s, au-delà du délai de requête du client (15 s) : « Connexion impossible » et échec du premier test connecté (constaté sur la 2e passe complète, 2026-11-17). Le comportement du client face à un délai dépassé reste couvert par `F01-E10`.
- Chaque test échoue sur une erreur de console inattendue ou une réponse 5xx de l'API (`helpers.ts`). Le bruit connu du web (notifications push, animations natives) est filtré.
- **Ordre** : `zz-f01-refus-age.spec.ts` s'exécute en dernier. Un refus d'âge verrouille l'appareil (90 jours) et l'adresse IP (30 minutes) : toute inscription d'un majeur depuis 127.0.0.1 est ensuite refusée. Pour rejouer la suite, recréer la base jetable (`scripts/dev-preview.ps1 -Stop`, puis démarrage) et vérifier que le script affiche « Apercu arrete, base jetable supprimee » : avec l'ancienne base, les inscriptions sont refusées (403, verrou d'âge) et les cartes déjà vues ou bloquées manquent (10 échecs constatés à tort sur une base réutilisée).
- Les comptes créés pour les suppressions ou les inscriptions sont jetables (`e2e-...@example.test`).

## Limites connues de l'aperçu

Pas de stockage de photos, de temps réel, de notifications, d'achats ni d'appels. L'export de données (`POST /me/export`) répond 500 dans l'aperçu (file synchrone et stockage objet absent) : le test `F07-H2` est donc en `fixme`.
