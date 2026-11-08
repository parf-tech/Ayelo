<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Renseigne `users.last_seen_at` à l'activité réelle (revue CTO 2.1, risque 9) : au plus UNE écriture par heure et par
 * compte. L'horodatage est posé en cache (`Cache::add`, atomique) : tant que la clé existe, la requête ne coûte ni
 * lecture ni écriture en base. L'écriture est conditionnelle (`last_seen_at` nul ou antérieur de plus d'une heure) et
 * ne touche pas `updated_at`. Ne s'applique qu'aux requêtes authentifiées et réussies ; un compte restreint
 * (suspendu, banni) n'est pas marqué actif.
 */
class TouchLastSeen
{
    public const INTERVAL_SECONDS = 3600;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($response->getStatusCode() < 400 && $request->bearerToken()) {
            $user = $request->user('sanctum');
            if ($user !== null && $user->status === 'active'
                && Cache::add('last_seen.'.$user->id, 1, self::INTERVAL_SECONDS)) {
                DB::table('users')->where('id', $user->id)
                    ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<', now()->subSeconds(self::INTERVAL_SECONDS)))
                    ->update(['last_seen_at' => now()]);
            }
        }

        return $response;
    }
}
