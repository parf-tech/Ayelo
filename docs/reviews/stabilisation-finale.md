# Stabilisation finale : rapport (2026-11-07)

## Ce qui a été corrigé

### Contrat OpenAPI (corrigé à la source, côté backend)

| problème | cause | correction |
| --- | --- | --- |
| `DELETE /me` et `POST /me/export` décrivaient une réponse 200 de type `null` | `reauthenticate()` renvoyait `?Response` ; Scramble prenait le `null` pour une réponse | `reauthenticate()` lève `ReauthenticationRefused` (403) ou `ReauthenticationThrottled` (429) et ne renvoie rien. Rendu HTTP identique. `dontReport` dans `bootstrap/app.php` : ces refus ne sont pas journalisés comme incidents. Extension Scramble `ReauthenticationExceptionResponses` : 403 / 429 documentés au format `{error:{code,message}}` |
| Ces deux routes n'avaient aucun corps de requête décrit (le mobile utilisait un type écrit à la main) | la validation est dans une méthode privée que Scramble ne lit pas ; pour un DELETE Scramble place les paramètres dans l'URL | transformeur `ReauthenticationRequestBody` : corps JSON `anyOf` (mot de passe, ou `provider` + `id_token` + `nonce`) |
| `/broadcasting/auth` : route GET sans corps, réponse `{type: object}` vide | contrôleur du framework (`Broadcast::routes`) | `BroadcastAuthController` : POST seulement, corps `socket_id` + `channel_name` validés, réponse `{auth, channel_data?}` |
| Suppression web (`/account-deletion-requests`, `/confirm`) : 202 sans description ; vérification de selfie : codes 422 `invalid_selfie`, `pose_expired`, `selfie_before_pose` absents | Scramble ne garde qu'une réponse par code HTTP | descriptions ajoutées ; les trois codes 422 sont écrits dans la description de l'opération |

Contrat régénéré (`php artisan scramble:export`), types mobiles régénérés par `npm run api:types` (aucune édition manuelle de `openapi.d.ts` ; la régénération est reproductible, même empreinte). Types écrits à la main supprimés : `ExportRequest` et `DeleteAccountRequest` dérivent maintenant de `OpRequest<...>` ; la surcharge `& { nonce?: string }` de `auth.oauth` est retirée (le contrat porte `nonce`).

### Autre correction de revue
- Garde de production (revue CTO n°1) : `AppServiceProvider` refuse de démarrer si `APP_ENV=production` avec `APP_DEBUG=true`.

## Fichiers modifiés (cette passe)
`backend/app/Http/Controllers/AccountController.php`, `BroadcastAuthController.php` (nouveau), `VerificationController.php`, `backend/app/Exceptions/Reauthentication{Refused,Throttled}.php` (nouveaux), `backend/app/OpenApi/Reauthentication{ExceptionResponses,RequestBody}.php` (nouveaux), `backend/app/Providers/AppServiceProvider.php`, `backend/bootstrap/app.php`, `backend/config/scramble.php`, `backend/routes/api/realtime.php`, `backend/tests/Unit/OpenApiContractTest.php` (nouveau), `docs/openapi.json`, `mobile/src/api/openapi.d.ts` (généré), `mobile/src/api/types.ts`, `mobile/src/api/endpoints.ts`.

## Tests exécutés et résultats (mesurés le 2026-11-07)

| contrôle | résultat |
| --- | --- |
| `tsc --noEmit` (mobile) | 0 erreur |
| `eslint .` (mobile) | 0 erreur |
| Jest (mobile) | 390 tests réussis, 20 suites |
| Pest `tests/Unit` (nouveau : garde-fous du contrat) | 5 tests, 24 assertions, réussis ; vérifié rouge sur un contrat volontairement dégradé, puis vert |
| `php -l` sur tous les fichiers PHP suivis | 0 erreur |
| Rendu des exceptions (403, 429 + `Retry-After`) | vérifié par `artisan tinker` |
| Garde `APP_DEBUG` | vérifié : refuse avec `APP_ENV=production APP_DEBUG=true`, démarre avec `APP_DEBUG=false` |
| Export du contrat | 67 opérations, aucune réponse 2xx nulle ou vide, `reauthenticate` documenté (403 / 429 / corps) |
| `npm audit --omit=dev` | 22 vulnérabilités (1 basse, 21 modérées), aucune haute ou critique (transitives, outils de build) |

## NON vérifié : à ne pas considérer comme terminé

- **Suite Pest complète : exécutée le 2026-11-13 (mise à jour de ce rapport).** Sur PostgreSQL 16 embarqué (port 54330) avec le PHP 8.5.12 de WinGet (`pdo_pgsql`) et un `php.ini` local hors dépôt activant `intl`, `gd` et `exif` : **519 tests réussis, 2 ignorés, 0 échec, 3393 assertions.** Sans `intl` et `gd`, 46 tests échouent (administration Filament et ré-encodage d'images) : c'est une limite du poste, pas du code ; la CI les a. Les changements de ré-authentification, de `/broadcasting/auth` et la garde `APP_DEBUG` sont donc couverts par les tests existants rejoués.
- Écart connu du contrat généré hors PostgreSQL : l'export local (SQLite vide) rend `user.email` non nullable ; la nullabilité PostgreSQL de la réponse d'inscription est rétablie à la main dans `docs/openapi.json` pour rester identique à la sortie de la CI. La CI (`scramble:export` puis `git diff --exit-code`) tranche : si elle signale un écart, relancer l'export sur PostgreSQL.
- `composer audit` : `composer` absent du poste, non rejoué (dernier résultat connu : propre, 2026-11-06).
- gitleaks : exécuté seulement par la CI.
- `expo export --platform android` : non rejoué.
- Tout ce qui touche un service externe ou un appareil reste non testé (voir `16-STATUS.md`, « Non vérifié ») : Reverb réel, R2, FCM, RevenueCat, Google / Apple, LiveKit, applications sur appareil ou émulateur, VoiceOver / TalkBack, Docker / Caddy. Le mobile n'a été testé qu'avec des simulations (Jest) : aucune fonctionnalité mobile n'est déclarée terminée sur cette base.

## Limites et points restants
Les revues listent d'autres points ouverts, **non traités ici** : P-09 à P-14, `last_seen_at`, pagination des conversations, curseur de découverte (F-24), `SendPush` (réessais), webhooks de rebond d'e-mail, décisions du propriétaire. Liste complète et à jour : `reviews/restant.md`. Un 422 propre à une route reste masqué par le 422 de validation dans le contrat (limite de Scramble, une réponse par code) : les codes sont alors dans la description.
