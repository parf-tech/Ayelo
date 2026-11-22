<?php

namespace App\Filament\Support;

use Closure;
use Illuminate\Http\Request;

/**
 * Langue du back-office : la préférence enregistrée par la personne connectée (`staff_users.locale`, choisie dans son profil), sinon
 * `app.admin_locale` (variable ADMIN_LOCALE : « fr » par défaut, « en » sur demande).
 * Les libellés passent par lang/{fr,en}/admin.php ; l'application garde sa langue par défaut.
 * Pas de négociation par Accept-Language : un navigateur en anglais ne doit pas faire basculer, sans le vouloir, un back-office
 * dont la formation et la documentation sont en français. Une préférence enregistrée est un choix explicite, pas une déduction.
 */
class StaffLocale
{
    public const SUPPORTED = ['fr', 'en'];

    /** Langue du personnel : préférence de la personne connectée si elle est prise en charge, sinon `app.admin_locale` (« fr » si inconnue). */
    public static function resolve(): string
    {
        $preferred = auth('staff')->user()?->locale;
        if (is_string($preferred) && in_array($preferred, self::SUPPORTED, true)) {
            return $preferred;
        }

        $locale = config('app.admin_locale', 'fr');

        return in_array($locale, self::SUPPORTED, true) ? $locale : 'fr';
    }

    public function handle(Request $request, Closure $next): mixed
    {
        app()->setLocale(self::resolve());

        return $next($request);
    }
}
