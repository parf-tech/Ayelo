<?php

namespace App\Http\Controllers;

use App\Services\Site\SitePageRenderer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Pages du site de présentation remplies par l'application (mentions légales saisies depuis l'administration).
 * Atteinte seulement par la réécriture `/_site{adresse}` de Caddy (bloc du site) ; sans état : ni session, ni cookie.
 * Si cette route échoue (5xx) ou si l'application est arrêtée, Caddy sert le fichier statique correspondant.
 */
class SiteController extends Controller
{
    public function show(Request $request, SitePageRenderer $renderer, string $page = ''): Response
    {
        $file = $renderer->pageFor($page);
        abort_if($file === null, 404);

        $html = $renderer->render($file);
        $response = response($html, 200, ['Content-Type' => 'text/html; charset=utf-8', 'X-Site-Source' => 'app']);
        $response->setEtag(sha1($html));
        // La page de confirmation de suppression a un jeton dans son adresse : jamais mise en cache (comme le fichier statique).
        $response->headers->set('Cache-Control', str_contains($file, 'confirm-deletion')
            ? 'no-store'
            : 'public, max-age='.(int) config('site.cache_seconds'));
        $response->isNotModified($request);

        return $response;
    }
}
