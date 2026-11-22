<?php

namespace App\Filament\Models;

use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends AdminRecord
{
    protected $table = 'reports';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'reviewed_at' => 'datetime', 'assigned_at' => 'datetime', 'priority' => 'integer'];
    }

    /** Membre du personnel qui a pris le signalement (verrou : voir ReportAssignment::lockedByOther). */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'assigned_to');
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
