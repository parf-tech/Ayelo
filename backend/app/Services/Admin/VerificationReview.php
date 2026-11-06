<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use App\Services\ProfileVerification;
use App\Services\Storage\MediaStorage;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Vérification de profil (FR-B-6) : la décision est humaine. Le selfie est une donnée biométrique :
 * - URL signée très courte, générée seulement sur action explicite ;
 * - chaque consultation est journalisée (l'URL elle-même n'est JAMAIS écrite dans le journal) ;
 * - la décision passe par ProfileVerification, qui supprime le selfie.
 */
class VerificationReview extends AdminService
{
    public const SELFIE_TTL_MINUTES = 2;

    public function __construct(Audit $audit, private ProfileVerification $verification, private MediaStorage $storage)
    {
        parent::__construct($audit);
    }

    /** @return string URL signée de lecture, valable SELFIE_TTL_MINUTES minutes */
    public function viewSelfie(StaffUser $actor, string $requestId): string
    {
        return $this->audited($actor, Permissions::SELFIE_VIEW, 'verification.selfie_viewed', 'verification_requests', $requestId, function () use ($requestId) {
            $request = $this->pending($requestId);
            $media = DB::table('media')->where('id', $request->selfie_media_id)->first();
            if ($media === null || ! in_array($media->status, ['processing', 'approved'], true)) {
                throw new DomainException('Le selfie n\'est plus disponible.');
            }

            return new Change(
                $this->storage->temporaryUrl($media->storage_key, self::SELFIE_TTL_MINUTES),
                null,
                ['user_id' => $request->user_id, 'media_id' => $media->id, 'ttl_minutes' => self::SELFIE_TTL_MINUTES],
            );
        });
    }

    public function approve(StaffUser $actor, string $requestId): void
    {
        $this->decide($actor, $requestId, 'approved', null);
    }

    public function reject(StaffUser $actor, string $requestId, string $reason): void
    {
        $reason = trim($reason);
        if (mb_strlen($reason) < 3) {
            throw new DomainException('Un motif de rejet est obligatoire.');
        }
        $this->decide($actor, $requestId, 'rejected', $reason);
    }

    /**
     * La ligne d'audit est écrite AVANT l'appel à ProfileVerification (qui supprime l'objet dans le stockage) :
     * si le journal échoue, rien n'est supprimé ; si la suppression échoue, tout est annulé et la demande reste en attente.
     */
    private function decide(StaffUser $actor, string $requestId, string $decision, ?string $reason): void
    {
        Permissions::authorize($actor, Permissions::VERIFICATIONS_REVIEW);

        DB::transaction(function () use ($actor, $requestId, $decision, $reason) {
            $request = $this->pending($requestId);
            $this->audit->record(
                $actor, 'verification.'.$decision, 'verification_requests', $requestId,
                ['status' => 'pending', 'user_id' => $request->user_id],
                ['status' => $decision, 'reason' => $reason],
            );

            if ($decision === 'approved') {
                $this->verification->approve($requestId, $actor->id);
            } else {
                $this->verification->reject($requestId, (string) $reason, $actor->id);
            }
        });
    }

    private function pending(string $requestId): object
    {
        $request = DB::table('verification_requests')->where('id', $requestId)->lockForUpdate()->first();
        if ($request === null || $request->status !== 'pending') {
            throw new DomainException('Cette demande de vérification a déjà été traitée.');
        }

        return $request;
    }
}
