<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use App\Services\Site\LegalCatalog;
use App\Services\Site\LegalPublished;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Mentions légales du site de présentation (droit `legal.manage`, administrateur seul). Enregistrer écrit un brouillon ; seule
 * `publish()` met un texte en ligne. Valeurs en texte brut (jamais de HTML), longueur plafonnée par le catalogue.
 * Convention de la table `site_legal_fields` : `draft` null = aucun brouillon, '' = effacement en attente ; `published` null = le
 * marqueur « À COMPLÉTER » reste affiché.
 */
class LegalContent extends AdminService
{
    private const LANGS = ['fr', 'en'];

    public function __construct(Audit $audit, private readonly LegalCatalog $catalog, private readonly LegalPublished $published)
    {
        parent::__construct($audit);
    }

    /**
     * Enregistre des brouillons. Une valeur null laisse le champ intact ; une valeur égale au texte publié supprime le brouillon.
     *
     * @param  array<string, array<string, ?string>>  $values  clé => langue => texte
     * @return int nombre de brouillons modifiés
     *
     * @throws DomainException clé ou langue inconnue, texte trop long, caractère de contrôle (rien n'est écrit)
     */
    public function saveDraft(StaffUser $actor, array $values): int
    {
        Permissions::authorize($actor, Permissions::LEGAL_MANAGE);
        $wanted = $this->validated($values);

        $rows = $this->rows();
        $writes = [];
        $before = [];
        $after = [];
        foreach ($wanted as [$key, $lang, $text]) {
            $row = $rows["{$key}.{$lang}"] ?? null;
            $published = $row->published ?? null;
            $draft = $text === ($published ?? '') ? null : $text;
            if ($draft === ($row->draft ?? null)) {
                continue;
            }
            $writes[] = ['key' => $key, 'lang' => $lang, 'draft' => $draft, 'updated_at' => now()];
            $before["{$key}.{$lang}"] = $row->draft ?? $published;
            $after["{$key}.{$lang}"] = $draft ?? $published;
        }
        if ($writes === []) {
            return 0;
        }

        $this->audited($actor, Permissions::LEGAL_MANAGE, 'legal.draft_saved', 'site_legal_fields', null, function () use ($writes, $before, $after) {
            DB::table('site_legal_fields')->upsert($writes, ['key', 'lang'], ['draft', 'updated_at']);

            return new Change(null, $before, $after);
        });

        return count($writes);
    }

    /**
     * Met en ligne tous les brouillons (un brouillon vide efface le texte publié).
     *
     * @return int nombre de champs publiés (0 : rien à publier, rien n'est écrit ni journalisé)
     */
    public function publish(StaffUser $actor): int
    {
        Permissions::authorize($actor, Permissions::LEGAL_MANAGE);
        if ($this->pending() === []) {
            return 0;
        }

        $count = $this->audited($actor, Permissions::LEGAL_MANAGE, 'legal.published', 'site_legal_fields', null, function () {
            $before = [];
            $after = [];
            foreach (DB::table('site_legal_fields')->whereNotNull('draft')->lockForUpdate()->get() as $row) {
                $text = $row->draft === '' ? null : $row->draft;
                DB::table('site_legal_fields')->where('key', $row->key)->where('lang', $row->lang)
                    ->update(['draft' => null, 'published' => $text, 'published_at' => now(), 'updated_at' => now()]);
                $before["{$row->key}.{$row->lang}"] = $row->published;
                $after["{$row->key}.{$row->lang}"] = $text;
            }

            return new Change(count($after), $before, $after);
        });
        $this->published->forget();

        return (int) $count;
    }

    /**
     * Abandonne tous les brouillons ; le texte publié ne change pas.
     *
     * @return int nombre de brouillons abandonnés (0 : rien n'est écrit ni journalisé)
     */
    public function discard(StaffUser $actor): int
    {
        Permissions::authorize($actor, Permissions::LEGAL_MANAGE);
        if ($this->pending() === []) {
            return 0;
        }

        return (int) $this->audited($actor, Permissions::LEGAL_MANAGE, 'legal.discarded', 'site_legal_fields', null, function () {
            $before = [];
            foreach (DB::table('site_legal_fields')->whereNotNull('draft')->lockForUpdate()->get() as $row) {
                DB::table('site_legal_fields')->where('key', $row->key)->where('lang', $row->lang)->update(['draft' => null, 'updated_at' => now()]);
                $before["{$row->key}.{$row->lang}"] = $row->draft;
            }

            return new Change(count($before), $before, null);
        });
    }

    /** Affiche ou retire la bannière « version provisoire » (immédiat, sans brouillon). */
    public function setBannerVisible(StaffUser $actor, bool $visible): void
    {
        Permissions::authorize($actor, Permissions::LEGAL_MANAGE);
        if ($this->bannerVisibleNow() === $visible) {
            return;
        }

        $this->audited($actor, Permissions::LEGAL_MANAGE, 'legal.banner_changed', 'site_legal_settings', null, function () use ($visible) {
            $current = $this->bannerVisibleNow();
            DB::table('site_legal_settings')->upsert(
                [['name' => 'banner_visible', 'value' => $visible ? '1' : '0', 'updated_at' => now()]],
                ['name'],
                ['value', 'updated_at'],
            );

            return new Change(null, ['banner_visible' => $current], ['banner_visible' => $visible]);
        });
        $this->published->forget();
    }

    /**
     * Brouillon et texte publié de chaque champ qui a une ligne en base. Lecture seule, aucun droit requis.
     *
     * @return array<string, array<string, array{draft: ?string, published: ?string}>> clé => langue => texte
     */
    public function state(): array
    {
        $state = [];
        foreach (DB::table('site_legal_fields')->orderBy('key')->orderBy('lang')->get(['key', 'lang', 'draft', 'published']) as $row) {
            $state[$row->key][$row->lang] = ['draft' => $row->draft, 'published' => $row->published];
        }

        return $state;
    }

    /** @return list<string> champs dont un brouillon attend la publication, au format `clé.langue` */
    public function pending(): array
    {
        return DB::table('site_legal_fields')->whereNotNull('draft')->orderBy('key')->orderBy('lang')->get(['key', 'lang'])
            ->map(fn ($row): string => "{$row->key}.{$row->lang}")->all();
    }

    /**
     * Vérifie tout avant d'écrire quoi que ce soit.
     *
     * @param  array<string, array<string, ?string>>  $values
     * @return list<array{0: string, 1: string, 2: string}> [clé, langue, texte normalisé]
     */
    private function validated(array $values): array
    {
        $wanted = [];
        foreach ($values as $key => $langs) {
            if (! is_string($key) || ! $this->catalog->has($key) || ! is_array($langs)) {
                throw new DomainException('Champ inconnu : '.(is_string($key) ? $key : '?').'.');
            }
            foreach ($langs as $lang => $text) {
                if (! in_array($lang, self::LANGS, true)) {
                    throw new DomainException("Langue inconnue pour « {$key} » : {$lang}.");
                }
                if ($text === null) {
                    continue;
                }
                $wanted[] = [$key, $lang, $this->normalised($key, (string) $text)];
            }
        }

        return $wanted;
    }

    private function normalised(string $key, string $text): string
    {
        $label = $this->catalog->slots()[$key]['label']['fr'];
        if (! mb_check_encoding($text, 'UTF-8')) {
            throw new DomainException("Texte invalide pour « {$label} » (encodage).");
        }
        $text = trim(str_replace(["\r\n", "\r"], "\n", $text));
        if (preg_match('/[\x00-\x09\x0B-\x1F\x7F]/', $text) === 1) {
            throw new DomainException("Texte invalide pour « {$label} » (caractère de contrôle).");
        }
        if (mb_strlen($text) > $this->catalog->max($key)) {
            throw new DomainException("Texte trop long pour « {$label} » (maximum {$this->catalog->max($key)} caractères).");
        }

        return $text;
    }

    /** @return array<string, object> lignes existantes, indexées par `clé.langue` */
    private function rows(): array
    {
        $rows = [];
        foreach (DB::table('site_legal_fields')->get() as $row) {
            $rows["{$row->key}.{$row->lang}"] = $row;
        }

        return $rows;
    }

    /** État réel en base (sans passer par le cache) : sans ligne `banner_visible`, la bannière est affichée. */
    private function bannerVisibleNow(): bool
    {
        return DB::table('site_legal_settings')->where('name', 'banner_visible')->value('value') !== '0';
    }
}
