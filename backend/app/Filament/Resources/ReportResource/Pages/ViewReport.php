<?php

namespace App\Filament\Resources\ReportResource\Pages;

use App\Filament\Models\Report;
use App\Filament\Resources\ReportResource;
use App\Filament\Resources\ReportResource\ReportActions;
use App\Filament\Support\Staff;
use Filament\Actions\Action;
use Filament\Resources\Pages\ViewRecord;

class ViewReport extends ViewRecord
{
    protected static string $resource = ReportResource::class;

    protected function getHeaderActions(): array
    {
        // Décider puis enchaîner : après une décision, on ouvre le plus ancien signalement ouvert du même niveau de priorité.
        return [
            ...ReportActions::make(fn (Report $record) => $this->redirect(ReportResource::nextUrl($record) ?? ReportResource::getUrl('index'))),
            Action::make('next')->label(Staff::t('admin.action.next'))->icon('heroicon-o-arrow-right')->color('gray')
                ->visible(fn (Report $record): bool => ReportResource::nextUrl($record) !== null)
                ->url(fn (Report $record): ?string => ReportResource::nextUrl($record)),
        ];
    }
}
