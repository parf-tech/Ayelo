<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends AdminRecord
{
    protected $table = 'reports';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'reviewed_at' => 'datetime', 'priority' => 'integer'];
    }

    public function reported(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'reported_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'reporter_id');
    }
}
