<?php

namespace App\Filament\Resources\AppealResource\Pages;

use App\Filament\Resources\AppealResource;
use App\Filament\Resources\AppealResource\AppealActions;
use Filament\Resources\Pages\ViewRecord;

class ViewAppeal extends ViewRecord
{
    protected static string $resource = AppealResource::class;

    protected function getHeaderActions(): array
    {
        return AppealActions::make(fn () => $this->redirect(AppealResource::getUrl('index')));
    }
}
