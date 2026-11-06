<?php

namespace App\Filament\Widgets;

use App\Filament\Support\Staff;
use App\Services\Admin\DashboardStats;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Tableau de bord (FR-H-1) : chaque rôle ne voit que les indicateurs de ses files (DashboardStats). */
class AdminStatsWidget extends StatsOverviewWidget
{
    protected ?string $pollingInterval = '60s';

    protected function getStats(): array
    {
        $data = app(DashboardStats::class)->for(Staff::current());
        $stats = [];

        if (isset($data['signups_7d'])) {
            $stats[] = Stat::make('Inscriptions (7 jours)', $data['signups_7d'])->chart($data['signups_series']);
            $stats[] = Stat::make('Utilisateurs actifs (24 h)', $data['active_24h'])->description($data['active_7d'].' sur 7 jours');
        }
        if (isset($data['reports_open'])) {
            foreach ([2 => ['Signalements critiques', 'danger'], 1 => ['Signalements prioritaires', 'warning'], 0 => ['Signalements normaux', 'gray']] as $priority => [$label, $color]) {
                $stats[] = Stat::make($label, $data['reports_open'][$priority])->color($color);
            }
        }
        if (isset($data['media_pending'])) {
            $stats[] = Stat::make('Médias en attente', $data['media_pending']);
        }
        if (isset($data['verifications_pending'])) {
            $stats[] = Stat::make('Vérifications en attente', $data['verifications_pending']);
        }
        if (isset($data['appeals_open'])) {
            $stats[] = Stat::make('Contestations ouvertes', $data['appeals_open']);
        }
        if (isset($data['tickets_open'])) {
            $stats[] = Stat::make('Tickets à traiter', $data['tickets_open']);
        }

        return $stats;
    }
}
