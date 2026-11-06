<?php

namespace App\Filament\Models;

use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Journal d'audit : LECTURE SEULE. La table est protégée par un déclencheur SQL (ajout seulement) ;
 * ce modèle refuse en plus toute écriture côté application (défense en profondeur).
 */
class AuditEntry extends Model
{
    public $timestamps = false;

    protected $table = 'audit_logs';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array', 'created_at' => 'datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'actor_staff_id');
    }

    public function save(array $options = []): never
    {
        throw new LogicException('Le journal d\'audit est en lecture seule.');
    }

    public function delete(): never
    {
        throw new LogicException('Le journal d\'audit est en lecture seule.');
    }

    public function update(array $attributes = [], array $options = []): never
    {
        throw new LogicException('Le journal d\'audit est en lecture seule.');
    }

    public function forceDelete(): never
    {
        throw new LogicException('Le journal d\'audit est en lecture seule.');
    }

    public static function create(array $attributes = []): never
    {
        throw new LogicException('Le journal d\'audit est en lecture seule.');
    }

    public static function destroy($ids): never
    {
        throw new LogicException('Le journal d\'audit est en lecture seule.');
    }
}
