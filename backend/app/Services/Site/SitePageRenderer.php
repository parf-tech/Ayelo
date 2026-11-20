<?php

namespace App\Services\Site;

use RuntimeException;

/**
 * Remplit les emplacements des pages HTML du site de présentation avec les textes publiés des mentions légales.
 *
 * Les pages sont les fichiers générés par web/tools/build.py (balisage `data-legal`) ; sans texte publié, un emplacement garde
 * son marqueur « À COMPLÉTER ». Les valeurs sont du texte brut : échappées intégralement, jamais interprétées comme du HTML,
 * et insérées par fonction de rappel (aucune référence `$1` ou `\1` d'un texte ne peut être exécutée par le remplacement).
 */
final class SitePageRenderer
{
    private const LINE = '~<mark class="todo" data-legal="([a-z0-9_]+)">.*?</mark>~s';

    private const BLOCK = '~<div data-legal-block="([a-z0-9_]+)"><p><mark class="todo">.*?</mark></p></div>~s';

    private const BANNER = '~<div class="banner"[^>]*data-legal-banner[^>]*><div class="wrap"><p>.*?</p></div></div>\R?~s';

    public function __construct(private readonly LegalCatalog $catalog, private readonly LegalPublished $published) {}

    /**
     * Fichier du catalogue qui correspond à une adresse du site, avec les règles de Caddy (`{path}`, `{path}.html`,
     * `{path}/index.html`). Seule une page listée dans le catalogue est renvoyée : aucun chemin n'est jamais construit depuis l'entrée.
     */
    public function pageFor(string $urlPath): ?string
    {
        if (str_contains($urlPath, "\0") || str_contains($urlPath, '\\') || str_contains($urlPath, '..')) {
            return null;
        }
        $path = str_starts_with($urlPath, '/') ? substr($urlPath, 1) : $urlPath; // une seule barre initiale est admise
        if (str_contains($path, '//') || str_starts_with($path, '/')) {
            return null;
        }
        if ($path === '' || str_ends_with($path, '/')) {
            $candidates = [$path.'index.html'];
        } else {
            $candidates = [$path, $path.'.html', $path.'/index.html'];
        }

        $pages = $this->catalog->pages();
        foreach ($candidates as $candidate) {
            if (in_array($candidate, $pages, true)) {
                return $candidate;
            }
        }

        return null;
    }

    /** @param  string  $page  valeur renvoyée par `pageFor()` */
    public function render(string $page): string
    {
        if (! in_array($page, $this->catalog->pages(), true)) {
            throw new RuntimeException("Page absente du catalogue : {$page}.");
        }
        $file = rtrim((string) config('site.web_root'), '/\\').'/'.$page;
        $html = is_file($file) ? file_get_contents($file) : false;
        if ($html === false) {
            throw new RuntimeException("Page du site illisible : {$file}.");
        }

        $lang = str_starts_with($page, 'en/') ? 'en' : 'fr';
        $values = $this->published->values();
        $text = fn (string $key): ?string => $this->catalog->has($key) ? ($values[$key][$lang] ?? null) : null;

        $html = preg_replace_callback(self::BLOCK, function (array $m) use ($text): string {
            $value = $text($m[1]);

            return $value === null ? $m[0] : $this->paragraphs($value);
        }, $html) ?? $html;
        $html = preg_replace_callback(self::LINE, function (array $m) use ($text): string {
            $value = $text($m[1]);

            return $value === null ? $m[0] : $this->inline($value);
        }, $html) ?? $html;

        if (! $this->published->bannerVisible()) {
            $html = preg_replace(self::BANNER, '', $html) ?? $html;
        }

        return $html;
    }

    private function inline(string $value): string
    {
        return nl2br(e($value));
    }

    private function paragraphs(string $value): string
    {
        $paragraphs = preg_split('/\n{2,}/', $value) ?: [$value];

        return implode("\n", array_map(fn (string $p): string => '<p>'.$this->inline($p).'</p>', $paragraphs));
    }
}
