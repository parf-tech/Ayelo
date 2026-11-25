<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\DeviceSessions;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

class LoginController extends Controller
{
    use ChecksAccountStatus;

    public function __invoke(Request $request, DeviceSessions $sessions, AccountDeletion $deletion): JsonResponse
    {
        $device = DeviceId::from($request);

        $data = $request->validate([
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
            'platform' => ['required', Rule::in(['ios', 'android'])],
            'app_version' => ['nullable', 'string', 'max:32'],
            // Annule la suppression de compte en cours (délai de grâce) : sans lui, la connexion répond 403 `deletion_pending`.
            'cancel_deletion' => ['nullable', 'boolean'],
        ]);

        $email = strtolower(trim($data['email']));
        // Tentatives comptées par (e-mail, IP) : 5 par 15 min ; et par e-mail seul : 30 par 15 min (bourrage d'identifiants distribué).
        // Le compteur est incrémenté AVANT la vérification du mot de passe (hit atomique, puis comparaison avec la limite) :
        // une rafale parallèle ne peut pas dépasser la limite en passant toutes le contrôle avant la première mise à jour.
        // Une tentative réussie est « remboursée » plus bas.
        //
        // Appareil de confiance : un appareil (X-Device-Id valide) déjà connecté avec succès à ce compte depuis moins de 30 jours
        // n'est PAS soumis aux compteurs partagés (sinon un tiers remplit le compteur d'e-mail depuis beaucoup d'IP et verrouille le
        // propriétaire). Il a son propre compteur, plus serré (10 échecs / 15 min). L'identifiant d'appareil est un uuid secret côté client.
        $trustId = hash_hmac('sha256', $email.'|'.$device, (string) config('app.key'));
        $trustKey = 'login-trusted:'.$trustId;
        $keyTrusted = 'login-fail-trusted:'.$trustId;
        $trusted = Cache::has($trustKey);

        $keyPair = 'login-fail:'.$email.'|'.$request->ip();
        $keyEmail = 'login-fail-email:'.$email;
        $limited = $trusted
            ? RateLimiter::hit($keyTrusted, 900) > 10
            : (RateLimiter::hit($keyPair, 900) > 5 || RateLimiter::hit($keyEmail, 900) > 30);
        if ($limited) {
            $retry = $trusted ? RateLimiter::availableIn($keyTrusted) : max(RateLimiter::availableIn($keyPair), RateLimiter::availableIn($keyEmail));

            return response()->json(['error' => ['code' => 'rate_limited', 'message' => 'Trop de tentatives. Réessayez plus tard.']], 429)
                ->header('Retry-After', (string) $retry);
        }

        $user = User::where('email', $email)->first();

        // Même réponse pour « e-mail inconnu » et « mot de passe faux » ; on hache dans les deux cas
        // pour ne pas révéler l'existence du compte par le temps de réponse.
        if ($user !== null && $user->password !== null) {
            $valid = Hash::check($data['password'], $user->password);
        } else {
            Hash::make($data['password']);
            $valid = false;
        }

        if (! $valid) {
            // Le compteur a déjà été incrémenté avant la comparaison.
            return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'Identifiants invalides.']], 401);
        }

        // Mot de passe correct : la tentative ne compte pas (remboursement), et l'appareil devient (ou reste) de confiance 30 jours.
        if ($trusted) {
            RateLimiter::clear($keyTrusted);
        } else {
            RateLimiter::clear($keyPair);
            if (RateLimiter::attempts($keyEmail) > 0) {
                RateLimiter::decrement($keyEmail, 900);
            }
        }
        Cache::put($trustKey, 1, now()->addDays(30));

        $decision = $this->signInDecision($user, (bool) ($data['cancel_deletion'] ?? false), $deletion);
        if ($decision === 'deletion_pending') {
            // Suppression en cours : renvoyer la requête avec `cancel_deletion: true` l'annule (aucun jeton n'est émis ici).
            return response()->json(['error' => ['code' => 'deletion_pending', 'message' => 'Suppression du compte en cours.', 'purge_at' => $deletion->purgeAt($user)->toIso8601String()]], 403);
        }
        if ($decision === 'account_restricted') {
            return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
        }

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $user->forceFill(['last_seen_at' => now()])->save();

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ]);
    }
}
