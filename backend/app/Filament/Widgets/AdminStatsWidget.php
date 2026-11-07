<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\AppealResource;
use App\Filament\Resources\MediaItemResource;
use App\Filament\Resources\ReportResource;
use App\Filament\Resources\SupportTicketResource;
use App\Filament\Resources\VerificationRequestResource;
use App\Filament\Support\Staff;
use App\Services\Admin\DashboardStats;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Tableau de bord (FR-H-1) : chaque rôle ne voit que les indicateurs de ses files (DashboardStats) ; chaque tuile ouvre la file filtrée. */
class AdminStatsWidget extends StatsOverviewWidget
{
    protected ?string $pollingInterval = '60s';

    protected function getStats(): array
    {
        $data = app(DashboardStats::class)->for(Staff::current());
        $stats = [];

        if (isset($data['signups_7d'])) {
            $stats[] = Stat::make(Staff::t('admin.stats.signups'), $data['signups_7d'])->chart($data['signups_series']);
            $stats[] = Stat::make(Staff::t('admin.stats.active_24h'), $data['active_24h'])->description(Staff::t('admin.stats.active_7d', ['count' => $data['active_7d']]));
        }
        if (isset($data['reports_open'])) {
            foreach ([2 => ['admin.stats.reports_critical', 'danger'], 1 => ['admin.stats.reports_priority', 'warning'], 0 => ['admin.stats.reports_normal', 'gray']] as $priority => [$label, $color]) {
                $stats[] = Stat::make(Staff::t($label), $data['reports_open'][$priority])->color($color)
                    ->url(ReportResource::getUrl('index', ['filters' => ['status' => ['value' => 'open'], 'priority' => ['value' => $priority]]]));
            }
        }
        if (isset($data['media_pending'])) {
            $stats[] = Stat::make(Staff::t('admin.stats.media'), $data['media_pending'])->url(MediaItemResource::getUrl('index'));
        }
        if (isset($data['verifications_pending'])) {
            $stats[] = Stat::make(Staff::t('admin.stats.verifications'), $data['verifications_pending'])
                ->url(VerificationRequestResource::getUrl('index', ['filters' => ['status' => ['value' => 'pending']]]));
        }
        if (isset($data['appeals_open'])) {
            $stats[] = Stat::make(Staff::t('admin.stats.appeals'), $data['appeals_open'])
                ->url(AppealResource::getUrl('index', ['filters' => ['status' => ['value' => 'open']]]));
        }
        if (isset($data['tickets_open'])) {
            $stats[] = Stat::make(Staff::t('admin.stats.tickets'), $data['tickets_open'])
                ->url(SupportTicketResource::getUrl('index', ['filters' => ['status' => ['value' => 'open']]]));
        }

        return $stats;
    }
}
