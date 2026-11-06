<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appeal extends AdminRecord
{
    protected $table = 'appeals';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function sanction(): BelongsTo
    {
        return $this->belongsTo(Sanction::class, 'sanction_id');
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'user_id');
    }
}
