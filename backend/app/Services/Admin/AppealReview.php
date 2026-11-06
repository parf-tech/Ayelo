<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Contestations de sanctions (une seule par sanction, docs/11).
 * Accepter lève la sanction et réactive le compte si c'était la seule restriction en vigueur.
 */
class AppealReview extends AdminService
{
    public function __construct(Audit $audit, private SanctionLedger $sanctions)
    {
        parent::__construct($audit);
    }

    public function accept(StaffUser $actor, string $appealId, ?string $note = null): void
    {
        $this->audited($actor, Permissions::APPEALS_REVIEW, 'appeal.accepted', 'appeals', $appealId, function () use ($actor, $appealId, $note) {
            $appeal = $this->open($appealId);
            $sanction = DB::table('sanctions')->where('id', $appeal->sanction_id)->first();
            $userBefore = DB::table('users')->where('id', $appeal->user_id)->value('status');

            $lifted = false;
            if ($sanction !== null && in_array($sanction->kind, ['suspension', 'ban'], true)
                && ($sanction->ends_at === null || now()->lessThan($sanction->ends_at))) {
                $this->sanctions->close($sanction);
                $lifted = true;
            }
            $this->sanctions->restoreIfFree($appeal->user_id);

            $this->decide($appealId, 'accepted', $note, $actor);

            return new Change(
                null,
                ['appeal_status' => 'open', 'sanction_kind' => $sanction?->kind, 'user_status' => $userBefore, 'user_id' => $appeal->user_id],
                ['appeal_status' => 'accepted', 'sanction_lifted' => $lifted, 'user_status' => DB::table('users')->where('id', $appeal->user_id)->value('status'), 'note' => $note],
            );
        });
    }

    public function reject(StaffUser $actor, string $appealId, string $note): void
    {
        $note = trim($note);
        if (mb_strlen($note) < 3) {
            throw new DomainException('Une note de décision est obligatoire pour rejeter.');
        }

        $this->audited($actor, Permissions::APPEALS_REVIEW, 'appeal.rejected', 'appeals', $appealId, function () use ($actor, $appealId, $note) {
            $appeal = $this->open($appealId);
            $this->decide($appealId, 'rejected', $note, $actor);

            return new Change(null, ['appeal_status' => 'open', 'user_id' => $appeal->user_id], ['appeal_status' => 'rejected', 'note' => $note]);
        });
    }

    private function open(string $appealId): object
    {
        $appeal = DB::table('appeals')->where('id', $appealId)->lockForUpdate()->first();
        if ($appeal === null || $appeal->status !== 'open') {
            throw new DomainException('Cette contestation a déjà été traitée.');
        }

        return $appeal;
    }

    private function decide(string $appealId, string $status, ?string $note, StaffUser $actor): void
    {
        DB::table('appeals')->where('id', $appealId)->update([
            'status' => $status, 'decision_note' => $note, 'reviewed_by' => $actor->id, 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
    }
}
