<?php

namespace App\Filament\Support;

use App\Filament\Models\Report;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Délais de traitement des signalements (docs/11 : 24 h en standard, 2 h pour un mineur suspecté ou une priorité critique).
 * Niveaux : « ok », « warning » (75 % du délai écoulé), « overdue » (dépassé). Sans objet une fois le signalement traité.
 */
final class Sla
{
    public const STANDARD_HOURS = 24;

    public const CRITICAL_HOURS = 2;

    public const WARNING_RATIO = 0.75;

    public static function applies(Report $report): bool
    {
        return in_array($report->status, ['open', 'reviewed'], true);
    }

    public static function hours(Report $report): int
    {
        return $report->reason === 'minor_suspected' || (int) $report->priority >= 2 ? self::CRITICAL_HOURS : self::STANDARD_HOURS;
    }

    public static function dueAt(Report $report): Carbon
    {
        return Carbon::instance($report->created_at)->addHours(self::hours($report));
    }

    /** @return 'ok'|'warning'|'overdue'|null */
    public static function level(Report $report, ?CarbonInterface $now = null): ?string
    {
        if (! self::applies($report)) {
            return null;
        }
        $now ??= now();
        if ($now->greaterThanOrEqualTo(self::dueAt($report))) {
            return 'overdue';
        }
        $elapsed = $report->created_at->diffInSeconds($now, true);

        return $elapsed >= self::hours($report) * 3600 * self::WARNING_RATIO ? 'warning' : 'ok';
    }

    public static function color(Report $report): string
    {
        return match (self::level($report)) {
            'overdue' => 'danger',
            'warning' => 'warning',
            'ok' => 'success',
            default => 'gray',
        };
    }

    /** Échéance absolue et relative (« 07/11/2026 14:00 · dans 3 heures »), « — » une fois traité. */
    public static function dueText(Report $report): string
    {
        if (! self::applies($report)) {
            return '—';
        }
        $due = self::dueAt($report)->locale(StaffLocale::resolve());

        return $due->isoFormat('L LT').' · '.$due->diffForHumans();
    }

    /** « dans 3 h » ou « en retard de 5 h » ; « — » une fois traité. */
    public static function text(Report $report): string
    {
        $level = self::level($report);
        if ($level === null) {
            return '—';
        }
        $span = self::dueAt($report)->locale(StaffLocale::resolve())
            ->diffForHumans(now(), ['syntax' => CarbonInterface::DIFF_ABSOLUTE, 'parts' => 1, 'short' => true]);

        return Staff::t($level === 'overdue' ? 'admin.sla.overdue' : 'admin.sla.remaining', ['time' => $span]);
    }
}
