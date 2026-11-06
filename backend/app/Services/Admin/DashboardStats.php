<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use Illuminate\Support\Facades\DB;

/** Indicateurs du tableau de bord (FR-H-1), filtrés par droits : chaque rôle ne voit que ses files. */
class DashboardStats
{
    /**
     * @return array<string, mixed>
     */
    public function for(StaffUser $staff): array
    {
        $stats = [];

        if (Permissions::can($staff, Permissions::USERS_VIEW)) {
            $stats['signups_7d'] = (int) DB::table('users')->where('created_at', '>=', now()->subDays(7))->count();
            $stats['signups_series'] = $this->signupSeries();
            $stats['active_24h'] = (int) DB::table('users')->where('status', 'active')->where('last_seen_at', '>=', now()->subDay())->count();
            $stats['active_7d'] = (int) DB::table('users')->where('status', 'active')->where('last_seen_at', '>=', now()->subDays(7))->count();
        }
        if (Permissions::can($staff, Permissions::REPORTS_REVIEW)) {
            $byPriority = DB::table('reports')->where('status', 'open')->selectRaw('priority, count(*) as n')->groupBy('priority')->pluck('n', 'priority');
            $stats['reports_open'] = [0 => (int) ($byPriority[0] ?? 0), 1 => (int) ($byPriority[1] ?? 0), 2 => (int) ($byPriority[2] ?? 0)];
        }
        if (Permissions::can($staff, Permissions::MEDIA_MODERATE)) {
            $stats['media_pending'] = (int) DB::table('media')->where('status', 'processing')->where('kind', '<>', 'verification_selfie')->count();
        }
        if (Permissions::can($staff, Permissions::VERIFICATIONS_REVIEW)) {
            $stats['verifications_pending'] = (int) DB::table('verification_requests')->where('status', 'pending')->count();
        }
        if (Permissions::can($staff, Permissions::APPEALS_REVIEW)) {
            $stats['appeals_open'] = (int) DB::table('appeals')->where('status', 'open')->count();
        }
        if (Permissions::can($staff, Permissions::TICKETS_MANAGE)) {
            $stats['tickets_open'] = (int) DB::table('support_tickets')->whereIn('status', ['open', 'pending'])->count();
        }

        return $stats;
    }

    /** @return list<int> inscriptions par jour, du plus ancien (J-6) à aujourd'hui */
    private function signupSeries(): array
    {
        $days = DB::table('users')->where('created_at', '>=', now()->subDays(6)->startOfDay())
            ->selectRaw("to_char(created_at, 'YYYY-MM-DD') as d, count(*) as n")->groupBy('d')->pluck('n', 'd');

        $series = [];
        for ($i = 6; $i >= 0; $i--) {
            $series[] = (int) ($days[now()->subDays($i)->format('Y-m-d')] ?? 0);
        }

        return $series;
    }
}
