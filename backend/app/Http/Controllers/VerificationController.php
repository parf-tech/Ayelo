<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\ProfileVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VerificationController extends Controller
{
    /** Consignes : le selfie doit reproduire la pose demandée (évite la réutilisation d'une photo existante). */
    public function pose(Request $request): JsonResponse
    {
        return response()->json(['pose' => $this->poseFor($request->user()->id)]);
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

        $id = (string) Str::uuid();
        DB::transaction(function () use ($id, $me, $data) {
            DB::table('verification_requests')->insert([
                'id' => $id, 'user_id' => $me->id, 'selfie_media_id' => $data['selfie_media_id'], 'pose_code' => $this->poseFor($me->id),
                'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('profiles')->where('user_id', $me->id)->update(['verification_status' => 'pending', 'updated_at' => now()]);
        });

        return response()->json(['id' => $id, 'status' => 'pending'], 201);
    }

    public function show(Request $request): JsonResponse
    {
        $row = DB::table('verification_requests')->where('user_id', $request->user()->id)->orderByDesc('created_at')->first(['id', 'status', 'reject_reason', 'created_at', 'reviewed_at']);
        $status = DB::table('profiles')->where('user_id', $request->user()->id)->value('verification_status') ?? 'none';

        return response()->json(['verification_status' => $status, 'last_request' => $row]);
    }

    private function poseFor(string $userId): string
    {
        // Pose déterministe par utilisateur et par jour : stable pendant la session, différente d'un jour à l'autre.
        $index = hexdec(substr(hash('sha256', $userId.now()->toDateString()), 0, 6)) % count(ProfileVerification::POSES);

        return ProfileVerification::POSES[$index];
    }
}
