<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaItem extends AdminRecord
{
    protected $table = 'media';

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'user_id');
    }
}
