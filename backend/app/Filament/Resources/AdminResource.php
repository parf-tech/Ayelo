<?php

namespace App\Filament\Resources;

use App\Filament\Support\Staff;
use Closure;
use Filament\Resources\Resource;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/** Base des ressources du back-office : lecture seule côté formulaires, écritures par actions et services audités. */
abstract class AdminResource extends Resource
{
    /** Clé des libellés de la ressource dans lang/{fr,en}/admin.php (`resource.<clé>.one|many|nav`). */
    protected static string $labelKey = '';

    public static function getModelLabel(): string
    {
        return Staff::t('admin.resource.'.static::$labelKey.'.one');
    }

    public static function getPluralModelLabel(): string
    {
        return Staff::t('admin.resource.'.static::$labelKey.'.many');
    }

    public static function getNavigationLabel(): string
    {
        return Staff::t('admin.resource.'.static::$labelKey.'.nav');
    }

    /** Clé de route valide pour ce modèle (uuid par défaut) : une clé mal formée donne 404, jamais une erreur SQL. */
    protected static function isValidRecordKey(int|string $key): bool
    {
        return Str::isUuid((string) $key);
    }

    public static function resolveRecordRouteBinding(int|string $key, ?Closure $modifyQuery = null): ?Model
    {
        return static::isValidRecordKey($key) ? parent::resolveRecordRouteBinding($key, $modifyQuery) : null;
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }
}
