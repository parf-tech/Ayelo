<?php

namespace App\Http\Controllers;

use App\Exceptions\ReauthenticationRefused;
use App\Exceptions\ReauthenticationThrottled;
use App\Jobs\BuildDataExport;
use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\AccountMail;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\MailSuppression;
use App\Services\OAuth\OAuthVerifier;
use App\Services\OneTimeCodes;
use App\Services\Registrar;
use App\Services\Storage\MediaStorage;
use App\Support\SafetyState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class AccountController extends Controller
{
    /**
     * Suppression depuis l'application. Ré-authentification adaptée au mode de connexion :
     * mot de passe, ou id_token frais du fournisseur pour un compte social (FR-A-11).
     */
    public function destroy(Request $request, AccountDeletion $deletion, OAuthVerifier $verifier): Response
    {
        $user = $request->user();

        $this->reauthenticate($request, $user, $verifier);

        $deletion->request($user);

        /**
         * Suppression programmée (délai de grâce avant la purge).
         *
         * @status 202
         *
         * @body array{status: 'scheduled', purge_after_days: int}
         */
        return response()->json(['status' => 'scheduled', 'purge_after_days' => AccountDeletion::GRACE_DAYS], 202);
    }

    /**
     * Ré-authentification explicite (suppression, export - revues F-20 et F-21) : mot de passe pour un compte avec mot de passe ;
     * sinon id_token du fournisseur, émis depuis moins de `safety.oauth.reauth_max_age_seconds` secondes (claim `iat`), lié au
     * compte, et au `nonce` si le client en envoie un. Les échecs sont comptés dans le magasin d'état non évincé
     * (`safety.state_store`) : 5 par 15 minutes pour un couple compte + IP, 20 par compte toutes IP confondues. Une
     * ré-authentification réussie remet les compteurs à zéro.
     *
     * Un refus interrompt la requête (403 `invalid_credentials` / `invalid_oauth_token`, 429 `rate_limited`) : la méthode ne
     * renvoie rien, donc le contrat OpenAPI n'en tire pas de réponse 200 vide.
     *
     * @throws ReauthenticationRefused
     * @throws ReauthenticationThrottled
     */
    private function reauthenticate(Request $request, User $user, OAuthVerifier $verifier): void
    {
        $limiter = SafetyState::limiter();
        $key = 'reauth-fail:'.$user->id.'|'.$request->ip();
        $accountKey = 'reauth-fail-account:'.$user->id;
        foreach ([[$key, 5], [$accountKey, 20]] as [$k, $max]) {
            if ($limiter->tooManyAttempts($k, $max)) {
                throw new ReauthenticationThrottled($limiter->availableIn($k));
            }
        }
        $fail = function () use ($limiter, $key, $accountKey): void {
            $limiter->hit($key, 900);
            $limiter->hit($accountKey, 900);
        };
        $succeed = function () use ($limiter, $key, $accountKey): void {
            $limiter->clear($key);
            $limiter->clear($accountKey);
        };

        if ($user->password !== null) {
            $data = $request->validate(['password' => ['required', 'string', 'max:200']]);
            if (! Hash::check($data['password'], $user->password)) {
                $fail();

                throw ReauthenticationRefused::wrongPassword();
            }
            $succeed();

            return;
        }

        $data = $request->validate([
            'provider' => ['required', Rule::in(['google', 'apple'])],
            'id_token' => ['required', 'string', 'max:5000'],
            'nonce' => ['nullable', 'string', 'max:200'],
        ]);
        $refuse = function () use ($fail): never {
            $fail();

            throw ReauthenticationRefused::wrongToken();
        };

        try {
            $identity = $verifier->verify($data['provider'], $data['id_token']);
        } catch (InvalidOAuthToken) {
            $refuse();
        }

        if (! $identity->isFresh((int) config('safety.oauth.reauth_max_age_seconds', 600))) {
            $refuse();
        }

        $nonce = $data['nonce'] ?? null;
        if ($nonce !== null ? ! $identity->matchesNonce($nonce) : (bool) config('safety.oauth.require_nonce')) {
            $refuse();
        }

        $owns = DB::table('auth_identities')->where(['user_id' => $user->id, 'provider' => $data['provider'], 'provider_user_id' => $identity->subject])->exists();

        if (! $owns) {
            $refuse();
        }
        $succeed();
    }

    /** Demande publique de suppression (page web exigée par les stores) : lien de confirmation envoyé par e-mail. */
    public function requestWebDeletion(Request $request, OneTimeCodes $codes): Response
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:254']]);
        $user = User::where('email', strtolower($data['email']))->where('status', 'active')->first();

        if ($user !== null) {
            // Après la réponse : même durée de requête que le compte existe ou non (revue F-11).
            $done = false;
            app()->terminating(function () use ($codes, $user, &$done) {
                if ($done) {
                    return;
                }
                $done = true;

                try {
                    // Adresse en rebond ou signalée en spam : ni jeton ni e-mail, même réponse HTTP.
                    if (app(MailSuppression::class)->isSuppressed($user->email)) {
                        return;
                    }
                    $token = $codes->issue($user->id, 'account_deletion', 60);
                    $link = rtrim((string) config('app.web_url'), '/').'/confirm-deletion?token='.urlencode($token);
                    app(AccountMail::class)->sendAccountDeletion($user, $link);
                } catch (\Throwable $e) {
                    report($e);
                }
            });
        }

        // Réponse identique que le compte existe ou non.
        /**
         * Demande enregistrée, sans corps. Réponse identique que l'adresse corresponde à un compte ou non.
         *
         * @status 202
         */
        return response()->noContent(202);
    }

    public function confirmWebDeletion(Request $request, OneTimeCodes $codes, AccountDeletion $deletion): Response
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:200']]);

        $userId = $codes->consume('account_deletion', $data['token']);
        if ($userId === null) {
            return response()->json(['error' => ['code' => 'invalid_token', 'message' => 'Lien invalide ou expiré.']], 422);
        }

        $deletion->request(User::findOrFail($userId));

        /**
         * Suppression programmée, sans corps (délai de grâce avant la purge).
         *
         * @status 202
         */
        return response()->noContent(202);
    }

    /**
     * Export des données : ré-authentification obligatoire comme la suppression (revue F-20), car le fichier contient e-mail,
     * date de naissance et messages envoyés. Un jeton volé ne suffit donc pas à les exfiltrer.
     */
    public function requestExport(Request $request, OAuthVerifier $verifier): JsonResponse|Response
    {
        $me = $request->user()->id;

        $this->reauthenticate($request, $request->user(), $verifier);

        // Une demande par jour.
        if (DB::table('data_exports')->where('user_id', $me)->where('created_at', '>=', now()->subDay())->exists()) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Une seule demande d\'export par jour.']], 429);
        }

        $id = (string) Str::uuid();
        DB::table('data_exports')->insert(['id' => $id, 'user_id' => $me, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        BuildDataExport::dispatch($id);

        /**
         * Export demandé : il sera préparé en arrière-plan.
         *
         * @status 202
         *
         * @body array{id: string, status: 'pending'}
         */
        return response()->json(['id' => $id, 'status' => 'pending'], 202);
    }

    public function export(Request $request, string $id, MediaStorage $storage): JsonResponse
    {
        // Identifiant mal formé : 404 (la requête SQL sur une colonne uuid échouerait en 500 - revue F-24).
        abort_unless(Str::isUuid($id), 404);
        $export = DB::table('data_exports')->where('id', $id)->where('user_id', $request->user()->id)->first();
        abort_if($export === null, 404);

        if ($export->status === 'ready' && $export->expires_at && now()->gt($export->expires_at)) {
            return response()->json(['id' => $export->id, 'status' => 'expired']);
        }

        return response()->json([
            'id' => $export->id,
            'status' => $export->status,
            'url' => $export->status === 'ready' ? $storage->temporaryUrl($export->storage_key, 10) : null,
            'expires_at' => $export->expires_at,
        ]);
    }

    /** Enregistre ou retire un consentement (historique conservé : une ligne par décision). */
    public function consent(Request $request): Response
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['terms', 'privacy', 'sensitive_data', 'location', 'marketing', 'verification_biometric'])],
            'version' => ['nullable', 'string', 'max:20'],
            'granted' => ['required', 'boolean'],
        ]);
        $me = $request->user()->id;

        // Microsecondes : l'historique est trié par date, deux décisions rapprochées doivent rester ordonnées.
        $at = now()->toDateTimeString('microsecond');

        DB::transaction(function () use ($data, $me, $request, $at) {
            DB::table('user_consents')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $me, 'kind' => $data['kind'], 'version' => $data['version'] ?? Registrar::CONSENT_VERSION,
                'granted' => $data['granted'], 'ip' => $request->ip(), 'created_at' => $at, 'updated_at' => $at,
            ]);

            // Retrait du consentement aux données sensibles : sans base légale, le profil n'est plus exposé.
            if ($data['kind'] === 'sensitive_data' && ! $data['granted']) {
                DB::table('profiles')->where('user_id', $me)->update(['is_visible' => false, 'updated_at' => now()]);
            }
        });

        return response()->noContent();
    }

    /**
     * État courant par type de consentement : un objet indexé par type, présent seulement pour les types déjà décidés.
     * `since` est la date de la dernière décision.
     *
     * @response array{data: array{terms?: array{granted: bool, version: string, since: string}, privacy?: array{granted: bool, version: string, since: string}, sensitive_data?: array{granted: bool, version: string, since: string}, location?: array{granted: bool, version: string, since: string}, marketing?: array{granted: bool, version: string, since: string}, verification_biometric?: array{granted: bool, version: string, since: string}}}
     */
    public function consents(Request $request): JsonResponse
    {
        $rows = DB::table('user_consents')->where('user_id', $request->user()->id)->orderByDesc('created_at')->get(['kind', 'version', 'granted', 'created_at']);

        $current = $rows->groupBy('kind')->map(fn ($g) => ['granted' => (bool) $g->first()->granted, 'version' => $g->first()->version, 'since' => $g->first()->created_at]);

        return response()->json(['data' => $current]);
    }
}
