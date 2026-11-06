<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sanction extends AdminRecord
{
    protected $table = 'sanctions';

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'created_at' => 'datetime'];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'user_id');
    }
}
