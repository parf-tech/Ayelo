<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applique la suspension et le bannissement aux jetons déjà émis (revue de sécurité F-03).
 * Un compte qui n'est pas « active » ne peut appeler que les routes nécessaires pour comprendre sa situation,
 * contester une sanction, exporter ses données, supprimer son compte ou se déconnecter.
 */
class EnsureAccountActive
{
    /** Chemins (sans le préfixe api/v1) restant accessibles à un compte restreint. */
    private const ALLOWED = [
        'auth/logout',
        'me',
        'me/sanctions',
        'appeals',
        'me/export',
        'me/export/*',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->bearerToken() ? $request->user('sanctum') : null;

        if ($user !== null && $user->status !== 'active' && ! $this->allowed($request)) {
            return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
        }

        return $next($request);
    }

    private function allowed(Request $request): bool
    {
        $path = preg_replace('#^api/v1/#', '', $request->path());

        if ($path === 'me' && ! in_array($request->method(), ['GET', 'DELETE'], true)) {
            return false;
        }

        foreach (self::ALLOWED as $pattern) {
            if ($request->is('api/v1/'.$pattern) || fnmatch($pattern, $path)) {
                return true;
            }
        }

        return false;
    }
}
