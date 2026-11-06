<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Base des modèles de lecture du back-office. Les écritures passent par les services App\Services\Admin
 * (droits + journal d'audit) ; les modèles ne servent qu'à afficher.
 */
abstract class AdminRecord extends Model
{
    use HasUuids;

    protected $guarded = ['*'];
}
