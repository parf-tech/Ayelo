<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Demande de vérification. Le chemin du selfie (storage_key) n'est jamais exposé à l'interface. */
class VerificationRequest extends AdminRecord
{
    protected $table = 'verification_requests';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'user_id');
    }
}
