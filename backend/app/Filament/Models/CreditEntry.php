<?php

namespace App\Filament\Models;

class CreditEntry extends AdminRecord
{
    protected $table = 'credit_ledger';

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
