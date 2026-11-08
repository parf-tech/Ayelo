<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AgeGate;
use App\Services\BannedIdentifiers;
use App\Services\DeviceSessions;
use App\Services\EmailSquatReclaim;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\OAuthVerifier;
use App\Services\Registrar;
use App\Support\DeviceId;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OAuthController extends Controller
{
    public function __invoke(
        Request $request,
        string $provider,
        OAuthVerifier $verifier,
        AgeGate $gate,
        Registrar $registrar,
        DeviceSessions $sessions,
        EmailSquatReclaim $squat,
    ): JsonResponse {
        $device = DeviceId::from($request);

        // La règle `accepted` de Laravel est « implicite » (elle ignore nullable et refuse une clé absente) : une absence doit rester
        // possible ici (409 : inscription à finaliser), mais toute valeur présente doit être un vrai consentement.
        $strict = function (string $attribute, mixed $value, \Closure $fail) {
            if ($value !== null && ! in_array($value, [true, 1, '1', 'true', 'yes', 'on'], true)) {
                $fail('Le consentement doit être explicitement accepté.');
            }
        };

        $data = $request->validate([
            'id_token' => ['required', 'string', 'max:5000'],
            'platform' => ['required', Rule::in(['ios', 'android'])],
            'app_version' => ['nullable', 'string', 'max:32'],
            'age_token' => ['nullable', 'string'],
            'locale' => ['nullable', Rule::in(['fr', 'en'])],
            // Même rigueur que l'inscription par e-mail (revue F-19) : "false", [1], 0 sont refusés ; absent = inscription à finaliser (409).
            'consents' => ['nullable', 'array'],
            'consents.terms' => ['nullable', $strict],
            'consents.privacy' => ['nullable', $strict],
            'consents.sensitive_data' => ['nullable', $strict],
            'consents.marketing' => ['nullable', 'boolean'],
            // Nonce (revue F-21) : lié à la demande de connexion côté application ; contrôlé quand il est envoyé, exigé si
            // safety.oauth.require_nonce est actif. L'application mobile doit l'envoyer dès que le SDK du fournisseur le permet.
            'nonce' => ['nullable', 'string', 'max:200'],
        ]);

        try {
            $identity = $verifier->verify($provider, $data['id_token']);
        } catch (InvalidOAuthToken) {
            return response()->json(['error' => ['code' => 'invalid_oauth_token', 'message' => 'Connexion impossible.']], 401);
        }

        $nonce = $data['nonce'] ?? null;
        if ($nonce !== null ? ! $identity->matchesNonce($nonce) : (bool) config('safety.oauth.require_nonce')) {
            return response()->json(['error' => ['code' => 'invalid_oauth_token', 'message' => 'Connexion impossible.']], 401);
        }

        // Sans nonce (revue pentest P-06), rien ne lie le jeton à cette demande : on n'accepte qu'un jeton récent (claim `iat`), pour
        // qu'un jeton fuité ne soit pas rejouable pendant toute sa durée de vie. Un `iat` inconnu (vérificateur simulé) passe ;
        // JwtOAuthVerifier refuse tout jeton réel sans `iat`.
        if ($nonce === null && ! $identity->isFresh((int) config('safety.oauth.login_max_age_seconds', 600))) {
            return response()->json(['error' => ['code' => 'invalid_oauth_token', 'message' => 'Connexion impossible.']], 401);
        }

        $linked = DB::table('auth_identities')->where('provider', $provider)->where('provider_user_id', $identity->subject)->first();

        if ($linked !== null) {
            $user = User::findOrFail($linked->user_id);
            if (! in_array($user->status, ['active', 'suspended', 'banned'], true)) {
                return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
            }
        } else {
            // Nouveau compte : contrôle d'âge et consentements obligatoires (FR-I-12, FR-I-14).
            // Refus d'âge déjà mémorisé pour cet appareil/IP : on l'étend à l'identité sociale et à son e-mail (décision Q1-B) ;
            // inversement, une identité déjà refusée l'est depuis n'importe quel appareil.
            if ($gate->isRefused($device, $request->ip())) {
                $gate->rememberIdentity($identity->emailVerified ? $identity->email : null, $provider, $identity->subject);

                return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
            }

            if ($gate->isSocialRefused($provider, $identity->subject) || ($identity->email !== null && $gate->isEmailRefused($identity->email))) {
                return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
            }

            if ($identity->email === null || ! $identity->emailVerified) {
                return response()->json(['error' => ['code' => 'email_not_verified', 'message' => 'Adresse e-mail non vérifiée par le fournisseur.']], 422);
            }

            if (BannedIdentifiers::has('email', $identity->email)) {
                return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
            }

            // Le fournisseur prouve la possession de l'adresse : un compte jamais vérifié et inactif qui la squatte est libéré (revue F-30).
            $squat->release($identity->email);

            // Pas de rattachement automatique à un compte existant (risque de prise de contrôle).
            if (User::where('email', $identity->email)->exists()) {
                return $this->accountExists();
            }

            $birthdate = $gate->readToken($data['age_token'] ?? null, $device);
            $consents = $data['consents'] ?? [];
            $complete = $birthdate !== null
                && ! empty($consents['terms']) && ! empty($consents['privacy']) && ! empty($consents['sensitive_data']);

            if (! $complete) {
                // L'application doit passer par les consentements et le contrôle d'âge, puis réessayer.
                return response()->json(['error' => ['code' => 'registration_required', 'message' => 'Inscription à finaliser.']], 409);
            }

            // Jeton d'âge à usage unique (revue F-29), rendu si la création échoue.
            if (! $gate->claimToken($data['age_token'] ?? null)) {
                return response()->json(['error' => ['code' => 'registration_required', 'message' => 'Inscription à finaliser.']], 409);
            }

            try {
                $user = DB::transaction(function () use ($registrar, $identity, $birthdate, $data, $consents, $request, $provider) {
                    $user = $registrar->create([
                        'email' => $identity->email,
                        'password' => null,
                        'birthdate' => $birthdate,
                        'locale' => $data['locale'] ?? 'fr',
                        'email_verified' => true,
                    ], $consents, $request);

                    DB::table('auth_identities')->insert([
                        'id' => (string) Str::uuid(),
                        'user_id' => $user->id,
                        'provider' => $provider,
                        'provider_user_id' => $identity->subject,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    return $user;
                });
            } catch (UniqueConstraintViolationException) {
                // Course : adresse ou identité sociale créée entre-temps (revue F-25) -> 409, pas 500.
                $gate->releaseToken($data['age_token'] ?? null);

                return $this->accountExists();
            } catch (\Throwable $e) {
                $gate->releaseToken($data['age_token'] ?? null);

                throw $e;
            }
        }

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $user->forceFill(['last_seen_at' => now()])->save();

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ], $linked !== null ? 200 : 201);
    }

    private function accountExists(): JsonResponse
    {
        return response()->json(['error' => ['code' => 'account_exists', 'message' => 'Un compte existe déjà avec cette adresse. Connectez-vous avec votre e-mail.']], 409);
    }
}
