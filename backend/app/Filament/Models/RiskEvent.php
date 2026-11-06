<?php

namespace App\Filament\Models;

class RiskEvent extends AdminRecord
{
    protected $table = 'risk_events';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'details' => 'array'];
    }
}
