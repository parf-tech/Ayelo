<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use App\Services\Storage\MediaStorage;
use DomainException;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * File de modération des médias (FR-H-4). Les selfies de vérification n'y passent jamais :
 * ils ont leur propre file, à accès restreint et journalisé (VerificationReview).
 */
class MediaModeration extends AdminService
{
    public const REJECT_LABELS = ['nudity', 'violence', 'minor', 'spam', 'illegal', 'other'];

    public function __construct(Audit $audit, private MediaStorage $storage)
    {
        parent::__construct($audit);
    }

    /**
     * Aperçu d'un média de la file : l'URL signée (config media.read_ttl_minutes) n'est produite qu'ici, sur action explicite, et
     * l'ouverture est journalisée (revue N-09, « media.preview »). Dans le journal : propriétaire et type, JAMAIS l'URL.
     * Un selfie de vérification n'est jamais servi par ce chemin (droit et journal propres : VerificationReview::viewSelfie).
     */
    public function preview(StaffUser $actor, string $mediaId): string
    {
        return $this->audited($actor, Permissions::MEDIA_MODERATE, 'media.preview', 'media', $mediaId, function () use ($mediaId) {
            $media = $this->pending($mediaId);

            return new Change(
                $this->storage->temporaryUrl($media->storage_key, (int) config('media.read_ttl_minutes', 10)),
                null,
                ['user_id' => $media->user_id, 'kind' => $media->kind, 'ttl_minutes' => (int) config('media.read_ttl_minutes', 10)],
            );
        });
    }

    public function approve(StaffUser $actor, string $mediaId): void
    {
        $this->audited($actor, Permissions::MEDIA_MODERATE, 'media.approved', 'media', $mediaId, function () use ($actor, $mediaId) {
            $media = $this->pending($mediaId);
            DB::table('media')->where('id', $mediaId)->update(['status' => 'approved', 'moderated_by' => $actor->id, 'updated_at' => now()]);

            return new Change(null, ['status' => 'processing', 'kind' => $media->kind, 'user_id' => $media->user_id], ['status' => 'approved']);
        });
    }

    /** Rejet : statut « rejected » puis suppression de l'objet. */
    public function reject(StaffUser $actor, string $mediaId, string $label): void
    {
        if (! in_array($label, self::REJECT_LABELS, true)) {
            throw new DomainException('Motif de rejet inconnu.');
        }

        $key = $this->audited($actor, Permissions::MEDIA_MODERATE, 'media.rejected', 'media', $mediaId, function () use ($actor, $mediaId, $label) {
            $media = $this->pending($mediaId);
            DB::table('media')->where('id', $mediaId)->update([
                'status' => 'rejected', 'moderation_label' => $label, 'moderated_by' => $actor->id, 'updated_at' => now(),
            ]);

            return new Change($media->storage_key, ['status' => 'processing', 'kind' => $media->kind, 'user_id' => $media->user_id], ['status' => 'rejected', 'label' => $label]);
        });

        // Après validation de la transaction : si le stockage échoue, la décision reste enregistrée et l'incident est signalé.
        try {
            $this->storage->delete($key);
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function pending(string $mediaId): object
    {
        $media = DB::table('media')->where('id', $mediaId)->lockForUpdate()->first();
        if ($media === null || $media->status !== 'processing') {
            throw new DomainException('Ce média n\'est plus en attente de modération.');
        }
        if ($media->kind === 'verification_selfie') {
            throw new DomainException('Les selfies de vérification se traitent dans la file Vérifications.');
        }

        return $media;
    }
}
