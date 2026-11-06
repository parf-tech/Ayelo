<?php

namespace App\Filament\Models;

use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportTicket extends AdminRecord
{
    protected $table = 'support_tickets';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'updated_at' => 'datetime'];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'assigned_to');
    }
}
