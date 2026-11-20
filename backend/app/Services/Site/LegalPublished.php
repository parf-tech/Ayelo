<?php

namespace App\Services\Site;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Textes publiés des mentions légales et état de la bannière provisoire, lus par le rendu public. Un seul instantané dans le
 * cache applicatif (dix minutes au plus) : aucune requête SQL par affichage hors cache froid. `LegalContent` l'invalide à chaque publication.
 */
final class LegalPublished
{
    private const CACHE_KEY = 'site_legal.published';

    /** Filet de sécurité : une lecture à froid qui croiserait une publication pourrait réécrire un ancien instantané ; il expire seul. */
    private const TTL_SECONDS = 600;

    /** @return array<string, array<string, string>> clé => langue => texte (seulement les textes non vides) */
    public function values(): array
    {
        return $this->snapshot()['values'];
    }

    /** Vrai tant que le propriétaire n'a pas retiré la bannière « version provisoire ». */
    public function bannerVisible(): bool
    {
        return $this->snapshot()['banner'];
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** @return array{values: array<string, array<string, string>>, banner: bool} */
    private function snapshot(): array
    {
        return Cache::remember(self::CACHE_KEY, self::TTL_SECONDS, function (): array {
            $values = [];
            $rows = DB::table('site_legal_fields')->whereNotNull('published')->where('published', '<>', '')->orderBy('key')->orderBy('lang')->get(['key', 'lang', 'published']);
            foreach ($rows as $row) {
                $values[$row->key][$row->lang] = $row->published;
            }

            return ['values' => $values, 'banner' => DB::table('site_legal_settings')->where('name', 'banner_visible')->value('value') !== '0'];
        });
    }
}
