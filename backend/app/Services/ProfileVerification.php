<?php

namespace App\Services;

use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;

/**
 * Vérification de profil par selfie guidé (FR-B-6). La décision est humaine (aucune comparaison automatique de visages,
 * donnée biométrique : docs/11). Le selfie est supprimé dès la décision ; seul le résultat est conservé.
 */
class ProfileVerification
{
    public const POSES = ['pouce levé', 'main ouverte près du visage', 'deux doigts levés', 'regard à gauche avec le sourire'];

    public function __construct(private MediaStorage $storage) {}

    public function approve(string $requestId, ?string $staffId = null): void
    {
        $this->decide($requestId, 'approved', null, $staffId);
    }

    public function reject(string $requestId, string $reason, ?string $staffId = null): void
    {
        $this->decide($requestId, 'rejected', $reason, $staffId);
    }

    private function decide(string $requestId, string $decision, ?string $reason, ?string $staffId): void
    {
        $request = DB::table('verification_requests')->where('id', $requestId)->where('status', 'pending')->first();
        if ($request === null) {
            return;
        }

        $media = DB::table('media')->where('id', $request->selfie_media_id)->first();

        DB::transaction(function () use ($request, $decision, $reason, $staffId, $media) {
            DB::table('verification_requests')->where('id', $request->id)->update([
                'status' => $decision, 'reject_reason' => $reason, 'reviewed_by' => $staffId, 'reviewed_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('profiles')->where('user_id', $request->user_id)->update([
                'verification_status' => $decision === 'approved' ? 'verified' : 'rejected', 'updated_at' => now(),
            ]);
            // On conserve la ligne media (la demande la référence) mais le fichier disparaît : statut « purged ».
            if ($media) {
                DB::table('media')->where('id', $media->id)->update(['status' => 'purged', 'updated_at' => now()]);
            }
        });

        if ($media) {
            $this->storage->delete($media->storage_key);
        }
    }
}
