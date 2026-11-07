<?php

namespace App\Filament\Support;

use Closure;
use Illuminate\Http\Request;

/**
 * Langue du back-office : français par défaut, anglais si `app.admin_locale` vaut « en » (variable ADMIN_LOCALE).
 * Les libellés passent par lang/{fr,en}/admin.php ; l'application garde sa langue par défaut.
 * Pas de négociation par Accept-Language : un navigateur en anglais ne doit pas faire basculer, sans le vouloir, un back-office
 * dont la formation et la documentation sont en français.
 */
class StaffLocale
{
    public const SUPPORTED = ['fr', 'en'];

    /** Langue du personnel : `app.admin_locale` si elle est prise en charge, « fr » sinon. */
    public static function resolve(): string
    {
        $locale = config('app.admin_locale', 'fr');

        return in_array($locale, self::SUPPORTED, true) ? $locale : 'fr';
    }

    public function handle(Request $request, Closure $next): mixed
    {
        app()->setLocale(self::resolve());

        return $next($request);
    }
}
