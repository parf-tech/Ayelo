<?php

namespace App\Filament\Models;

use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Les migrations sont en SQL brut : les colonnes sont déclarées ici pour l'analyse statique.
 *
 * @property string $id
 * @property string $status
 * @property string $reason
 * @property string $reported_id
 * @property string|null $assigned_to
 * @property Carbon|null $assigned_at
 * @property-read StaffUser|null $assignee
 */
class Report extends AdminRecord
{
    protected $table = 'reports';

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'reviewed_at' => 'datetime', 'assigned_at' => 'datetime', 'priority' => 'integer'];
    }

    /**
     * Membre du personnel qui a pris le signalement (verrou : voir ReportAssignment::lockedByOther).
     *
     * @return BelongsTo<StaffUser, $this>
     */
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
