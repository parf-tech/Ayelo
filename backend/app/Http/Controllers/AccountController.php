<?php

namespace App\Http\Controllers;

use App\Jobs\BuildDataExport;
use App\Mail\AccountDeletionMail;
use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\OAuthVerifier;
use App\Services\OneTimeCodes;
use App\Services\Registrar;
use App\Services\Storage\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
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

        if ($user->password !== null) {
            $data = $request->validate(['password' => ['required', 'string']]);
            if (! Hash::check($data['password'], $user->password)) {
                return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'Mot de passe incorrect.']], 403);
            }
        } else {
            $data = $request->validate(['provider' => ['required', Rule::in(['google', 'apple'])], 'id_token' => ['required', 'string', 'max:5000']]);
            try {
                $identity = $verifier->verify($data['provider'], $data['id_token']);
            } catch (InvalidOAuthToken) {
                return response()->json(['error' => ['code' => 'invalid_oauth_token', 'message' => 'Ré-authentification refusée.']], 403);
            }
            $owns = DB::table('auth_identities')->where(['user_id' => $user->id, 'provider' => $data['provider'], 'provider_user_id' => $identity->subject])->exists();
            if (! $owns) {
                return response()->json(['error' => ['code' => 'invalid_oauth_token', 'message' => 'Ré-authentification refusée.']], 403);
            }
        }

        $deletion->request($user);

        return response()->json(['status' => 'scheduled', 'purge_after_days' => AccountDeletion::GRACE_DAYS], 202);
    }

    /** Demande publique de suppression (page web exigée par les stores) : lien de confirmation envoyé par e-mail. */
    public function requestWebDeletion(Request $request, OneTimeCodes $codes): Response
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:254']]);
        $user = User::where('email', strtolower($data['email']))->where('status', 'active')->first();

        if ($user !== null) {
            $token = $codes->issue($user->id, 'account_deletion', 60);
            $link = rtrim((string) config('app.web_url'), '/').'/confirm-deletion?token='.urlencode($token);
            Mail::to($user->email)->locale($user->locale)->send(new AccountDeletionMail($link));
        }

        // Réponse identique que le compte existe ou non.
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

        return response()->noContent(202);
    }

    public function requestExport(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        // Une demande par jour.
        if (DB::table('data_exports')->where('user_id', $me)->where('created_at', '>=', now()->subDay())->exists()) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Une seule demande d\'export par jour.']], 429);
        }

        $id = (string) Str::uuid();
        DB::table('data_exports')->insert(['id' => $id, 'user_id' => $me, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        BuildDataExport::dispatch($id);

        return response()->json(['id' => $id, 'status' => 'pending'], 202);
    }

    public function export(Request $request, string $id, MediaStorage $storage): JsonResponse
    {
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
