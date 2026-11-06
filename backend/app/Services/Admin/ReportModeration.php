<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Décisions sur les signalements (FR-H-5). Règles reprises de ReportController :
 * - « minor_suspected » : le compte signalé est suspendu à titre préventif dès le signalement (sanction
 *   « preventive_minor_suspected »). La revue ne peut alors que confirmer (suspension, bannissement) ou lever.
 * - la sanction écrite ici est ce que l'utilisateur voit dans l'API (liste des sanctions) et peut contester.
 */
class ReportModeration extends AdminService
{
    public const WARNING = 'warning';
    public const SUSPENSION = 'suspension';
    public const BAN = 'ban';
    public const DISMISS = 'dismiss';
    public const LIFT_PREVENTIVE = 'lift_preventive';

    public const DECISIONS = [self::WARNING, self::SUSPENSION, self::BAN, self::DISMISS, self::LIFT_PREVENTIVE];

    public const PREVENTIVE_REASON = 'preventive_minor_suspected';

    public function __construct(Audit $audit, private SanctionLedger $sanctions)
    {
        parent::__construct($audit);
    }

    /**
     * @param  string  $note  motif communiqué à l'utilisateur (avertissement, suspension, bannissement) ou note interne (classement)
     * @param  int|null  $days  durée de la suspension
     */
    public function decide(StaffUser $actor, string $reportId, string $decision, string $note, ?int $days = null): void
    {
        if (! in_array($decision, self::DECISIONS, true)) {
            throw new DomainException('Décision inconnue.');
        }
        $note = trim($note);
        if (mb_strlen($note) < 3) {
            throw new DomainException('Un motif est obligatoire.');
        }
        if ($decision === self::SUSPENSION && ($days === null || $days < 1 || $days > 365)) {
            throw new DomainException('La durée de suspension doit être comprise entre 1 et 365 jours.');
        }

        $this->audited($actor, Permissions::REPORTS_REVIEW, 'report.'.$decision, 'reports', $reportId, function () use ($actor, $reportId, $decision, $note, $days) {
            $report = DB::table('reports')->where('id', $reportId)->lockForUpdate()->first();
            if ($report === null || ! in_array($report->status, ['open', 'reviewed'], true)) {
                throw new DomainException('Ce signalement a déjà été traité.');
            }

            $userId = $report->reported_id;
            $userBefore = DB::table('users')->where('id', $userId)->value('status');
            $preventive = $this->preventiveSuspension($report);

            if ($preventive && in_array($decision, [self::WARNING, self::DISMISS], true)) {
                throw new DomainException('Mineur suspecté : confirmez la suspension (suspension ou bannissement) ou levez-la explicitement.');
            }
            if ($decision === self::LIFT_PREVENTIVE && ! $preventive) {
                throw new DomainException('Aucune suspension préventive à lever pour ce signalement.');
            }

            $sanctionId = null;
            $outcome = 'none';
            $status = 'dismissed';

            switch ($decision) {
                case self::WARNING:
                    $sanctionId = $this->sanctions->issue($userId, 'warning', $note, $reportId, null, $actor->id);
                    [$outcome, $status] = ['warning', 'actioned'];
                    break;
                case self::SUSPENSION:
                    $sanctionId = $this->sanctions->issue($userId, 'suspension', $note, $reportId, now()->addDays($days), $actor->id);
                    [$outcome, $status] = ['suspension', 'actioned'];
                    break;
                case self::BAN:
                    // Déjà banni (autre signalement) : le signalement est tout de même clos comme « actioned ».
                    $sanctionId = $userBefore === 'banned' ? null : $this->sanctions->issue($userId, 'ban', $note, $reportId, null, $actor->id);
                    [$outcome, $status] = ['ban', 'actioned'];
                    break;
                case self::LIFT_PREVENTIVE:
                    $this->sanctions->close($preventive);
                    $this->sanctions->restoreIfFree($userId);
                    break;
                case self::DISMISS:
                    break;
            }

            DB::table('reports')->where('id', $reportId)->update([
                'status' => $status, 'outcome' => $outcome, 'reviewed_by' => $actor->id, 'reviewed_at' => now(), 'updated_at' => now(),
            ]);

            return new Change(
                null,
                ['report_status' => $report->status, 'user_status' => $userBefore, 'reported_id' => $userId, 'reason' => $report->reason],
                [
                    'report_status' => $status, 'outcome' => $outcome, 'user_status' => DB::table('users')->where('id', $userId)->value('status'),
                    'sanction_id' => $sanctionId, 'note' => $note, 'days' => $decision === self::SUSPENSION ? $days : null,
                ],
            );
        });
    }

    /** Suspension préventive encore en vigueur liée à ce signalement « mineur suspecté ». */
    private function preventiveSuspension(object $report): ?object
    {
        if ($report->reason !== 'minor_suspected') {
            return null;
        }

        return DB::table('sanctions')->where('report_id', $report->id)->where('kind', 'suspension')->where('reason', self::PREVENTIVE_REASON)
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', SanctionLedger::ts()))->first();
    }
}
