<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\ProfileVerification;
use App\Support\SafetyState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VerificationController extends Controller
{
    /** Durée de validité d'une consigne de pose (minutes) entre son affichage et l'envoi du selfie. */
    private const POSE_TTL_MINUTES = 60;

    /**
     * Consigne : le selfie doit reproduire la pose demandée (évite la réutilisation d'une photo existante).
     * La pose est tirée au hasard pour ce compte, valable une heure ou jusqu'à l'envoi de la demande (revue F-28) : elle
     * n'est plus déterministe par jour, donc non prévisible à l'avance, et elle est consommée par la demande qui l'enregistre.
     */
    public function pose(Request $request): JsonResponse
    {
        return response()->json(['pose' => $this->challenge($request->user()->id)['pose']]);
    }

    public function store(Request $request): JsonResponse
    {
        $me = $request->user();
        abort_unless(Profile::where('user_id', $me->id)->exists(), 403, 'Profil à compléter.');

        $data = $request->validate(['selfie_media_id' => ['required', 'uuid']]);

        // Consentement spécifique à la donnée biométrique potentielle (docs/11).
        $consent = DB::table('user_consents')->where('user_id', $me->id)->where('kind', 'verification_biometric')->orderByDesc('created_at')->first();
        if ($consent === null || ! $consent->granted) {
            return response()->json(['error' => ['code' => 'consent_required', 'message' => 'Consentement à la vérification requis.']], 403);
        }

        $media = DB::table('media')->where('id', $data['selfie_media_id'])->first();
        if ($media === null || $media->user_id !== $me->id || $media->kind !== 'verification_selfie' || ! in_array($media->status, ['processing', 'approved'], true)) {
            return response()->json(['error' => ['code' => 'invalid_selfie', 'message' => 'Selfie invalide.']], 422);
        }

        if (DB::table('verification_requests')->where('user_id', $me->id)->where('status', 'pending')->exists()) {
            return response()->json(['error' => ['code' => 'already_pending', 'message' => 'Une vérification est déjà en cours.']], 409);
        }
        if (DB::table('verification_requests')->where('user_id', $me->id)->where('created_at', '>=', now()->subDay())->count() >= 3) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Trop de tentatives. Réessayez demain.']], 429);
        }

        // La demande enregistre la pose émise : le selfie doit avoir été déposé APRÈS l'émission de la consigne, sinon une
        // photo préexistante pourrait être présentée avec la pose du jour (revue F-28). Pas de colonne en plus : la pose émise
        // est conservée dans `pose_code` de la demande, la fraîcheur se vérifie sur `media.created_at`.
        $challenge = SafetyState::store()->get($this->challengeKey($me->id));
        if (! is_array($challenge)) {
            return response()->json(['error' => ['code' => 'pose_expired', 'message' => 'Consigne expirée : rechargez la consigne puis reprenez le selfie.']], 422);
        }
        if (Carbon::parse($media->created_at)->getTimestamp() < (int) $challenge['issued_at']) {
            return response()->json(['error' => ['code' => 'selfie_before_pose', 'message' => 'Le selfie doit être pris après avoir reçu la consigne.']], 422);
        }

        // La consigne n'est consommée qu'APRÈS l'écriture en base : un échec de l'insertion ne la brûle pas. Le verrou sur le profil
        // sérialise deux envois simultanés : le second voit la demande en attente et n'insère rien (une consigne = une demande).
        $id = (string) Str::uuid();
        $created = DB::transaction(function () use ($id, $me, $data, $challenge) {
            DB::table('profiles')->where('user_id', $me->id)->lockForUpdate()->first();
            if (DB::table('verification_requests')->where('user_id', $me->id)->where('status', 'pending')->exists()) {
                return false;
            }
            DB::table('verification_requests')->insert([
                'id' => $id, 'user_id' => $me->id, 'selfie_media_id' => $data['selfie_media_id'], 'pose_code' => $challenge['pose'],
                'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('profiles')->where('user_id', $me->id)->update(['verification_status' => 'pending', 'updated_at' => now()]);

            return true;
        });
        if (! $created) {
            return response()->json(['error' => ['code' => 'already_pending', 'message' => 'Une vérification est déjà en cours.']], 409);
        }
        SafetyState::store()->forget($this->challengeKey($me->id));

        return response()->json(['id' => $id, 'status' => 'pending'], 201);
    }

    public function show(Request $request): JsonResponse
    {
        $row = DB::table('verification_requests')->where('user_id', $request->user()->id)->orderByDesc('created_at')->first(['id', 'status', 'reject_reason', 'created_at', 'reviewed_at']);
        $status = DB::table('profiles')->where('user_id', $request->user()->id)->value('verification_status') ?? 'none';

        return response()->json(['verification_status' => $status, 'last_request' => $row]);
    }

    private function challengeKey(string $userId): string
    {
        return 'verification-pose:'.$userId;
    }

    /** @return array{pose: string, issued_at: int} */
    private function challenge(string $userId): array
    {
        $existing = SafetyState::store()->get($this->challengeKey($userId));
        if (is_array($existing) && isset($existing['pose'], $existing['issued_at'])) {
            return $existing;
        }

        $challenge = ['pose' => ProfileVerification::POSES[random_int(0, count(ProfileVerification::POSES) - 1)], 'issued_at' => now()->getTimestamp()];
        SafetyState::store()->put($this->challengeKey($userId), $challenge, now()->addMinutes(self::POSE_TTL_MINUTES));

        return $challenge;
    }
}
