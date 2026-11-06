<?php

namespace App\Filament\Support;

use Closure;
use Illuminate\Http\Request;

/** Le back-office est en français (le personnel modère en fr / en ; l'application garde sa langue par défaut). */
class StaffLocale
{
    public function handle(Request $request, Closure $next): mixed
    {
        app()->setLocale('fr');

        return $next($request);
    }
}
