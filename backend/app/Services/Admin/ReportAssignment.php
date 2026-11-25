<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Attribution des signalements : « Prendre », « Libérer », reprise par l'administrateur. Un signalement pris par une personne ne
 * peut être décidé que par elle (ReportModeration::decide) tant que le verrou n'a pas expiré. Chaque changement est tracé.
 */
class ReportAssignment extends AdminService
{
    public static function ttlMinutes(): int
    {
        return max(1, (int) config('admin.assignment_ttl_minutes', 60));
    }

    /** Verrou en vigueur : le signalement est pris par une autre personne que $staffId, et le verrou n'a pas expiré. */
    public static function lockedByOther(object $report, string $staffId): bool
    {
        return $report->assigned_to !== null && $report->assigned_to !== $staffId && $report->assigned_at !== null
            && CarbonImmutable::parse($report->assigned_at)->addMinutes(self::ttlMinutes())->isFuture();
    }

    /**
     * Prend un signalement ouvert (ou renouvelle son propre verrou). Pris par une autre personne : refusé tant que son verrou n'a pas
     * expiré, sauf reprise (`$force`, réservée à l'administrateur).
     */
    public function claim(StaffUser $actor, string $reportId, bool $force = false): void
    {
        if ($force) {
            Permissions::authorize($actor, Permissions::USERS_MANAGE);
        }

        $this->audited($actor, Permissions::REPORTS_REVIEW, $force ? 'report.takeover' : 'report.claim', 'reports', $reportId, function () use ($actor, $reportId, $force) {
            $report = $this->open($reportId);
            if (! $force && self::lockedByOther($report, $actor->id)) {
                $holder = DB::table('staff_users')->where('id', $report->assigned_to)->value('email');
                throw new DomainException('Ce signalement est pris en charge par '.($holder ?? 'un autre membre du personnel').'.');
            }

            DB::table('reports')->where('id', $reportId)->update(['assigned_to' => $actor->id, 'assigned_at' => now(), 'updated_at' => now()]);

            return new Change(null, ['assigned_to' => $report->assigned_to], ['assigned_to' => $actor->id]);
        });
    }

    /** Libère un signalement : la personne qui l'a pris ou l'administrateur. */
    public function release(StaffUser $actor, string $reportId): void
    {
        $this->audited($actor, Permissions::REPORTS_REVIEW, 'report.release', 'reports', $reportId, function () use ($actor, $reportId) {
            $report = $this->open($reportId);
            if ($report->assigned_to === null) {
                throw new DomainException("Ce signalement n'est pas pris en charge.");
            }
            if ($report->assigned_to !== $actor->id && ! Permissions::can($actor, Permissions::USERS_MANAGE)) {
                throw new DomainException("Seule la personne qui l'a pris ou un administrateur peut le libérer.");
            }

            DB::table('reports')->where('id', $reportId)->update(['assigned_to' => null, 'assigned_at' => null, 'updated_at' => now()]);

            return new Change(null, ['assigned_to' => $report->assigned_to], ['assigned_to' => null]);
        });
    }

    /** Signalement verrouillé en base, encore à traiter. */
    private function open(string $reportId): object
    {
        $report = DB::table('reports')->where('id', $reportId)->lockForUpdate()->first();
        if ($report === null || ! in_array($report->status, ['open', 'reviewed'], true)) {
            throw new DomainException('Ce signalement a déjà été traité.');
        }

        return $report;
    }
}
