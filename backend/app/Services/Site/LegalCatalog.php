<?php

namespace App\Services\Site;

use RuntimeException;

/**
 * Catalogue des textes à fournir pour le site de présentation : `<web_root>/tools/legal-slots.json`, écrit par web/tools/build.py
 * à chaque génération des pages. Le générateur est la source unique des clés : le formulaire d'administration et le rendu public
 * lisent ce fichier, donc ne peuvent pas diverger des emplacements réellement présents dans les pages.
 */
final class LegalCatalog
{
    private const VERSION = 1;

    /** @var array{version: int, pages: list<string>, groups: array<string, list<string>>, slots: array<string, array<string, mixed>>}|null */
    private ?array $data = null;

    /**
     * Pour chaque clé : group, kind (`line` ou `block`), multiline (champ ligne saisi sur plusieurs lignes), max, label et hint
     * (`fr`/`en`), pages (clés de page, informatif).
     *
     * @return array<string, array{group: string, kind: string, multiline?: bool, max: int, label: array{fr: string, en: string}, hint: array{fr: string, en: string}, pages: list<string>}>
     */
    public function slots(): array
    {
        return $this->load()['slots'];
    }

    /** @return array<string, list<string>> groupe => clés, dans l'ordre d'affichage */
    public function groups(): array
    {
        return $this->load()['groups'];
    }

    /** @return list<string> chemins relatifs des pages HTML à rendre (français et anglais), sans 404.html */
    public function pages(): array
    {
        return $this->load()['pages'];
    }

    public function has(string $key): bool
    {
        return isset($this->load()['slots'][$key]);
    }

    /** @return 'line'|'block' */
    public function kind(string $key): string
    {
        return $this->slot($key)['kind'];
    }

    /**
     * Champ « ligne » saisi sur plusieurs lignes (une adresse) : chaque saut de ligne devient un retour à la ligne sur la page.
     * Un catalogue plus ancien, sans cet indicateur, se lit comme une seule ligne.
     */
    public function multiline(string $key): bool
    {
        return ($this->slot($key)['multiline'] ?? false) === true;
    }

    /** Longueur maximale d'un texte, en caractères. */
    public function max(string $key): int
    {
        return (int) $this->slot($key)['max'];
    }

    /** @return array<string, mixed> */
    private function slot(string $key): array
    {
        return $this->load()['slots'][$key] ?? throw new \InvalidArgumentException("Emplacement inconnu : {$key}.");
    }

    /** @return array{version: int, pages: list<string>, groups: array<string, list<string>>, slots: array<string, array<string, mixed>>} */
    private function load(): array
    {
        if ($this->data !== null) {
            return $this->data;
        }

        $path = rtrim((string) config('site.web_root'), '/\\').'/tools/legal-slots.json';
        $raw = is_file($path) ? file_get_contents($path) : false;
        if ($raw === false) {
            throw new RuntimeException("Catalogue des mentions légales introuvable : {$path} (générer le site avec python web/tools/build.py).");
        }
        try {
            $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new RuntimeException("Catalogue des mentions légales illisible (legal-slots.json) : {$e->getMessage()}", 0, $e);
        }
        if (! is_array($data) || ($data['version'] ?? null) !== self::VERSION
            || ! is_array($data['pages'] ?? null) || ! is_array($data['groups'] ?? null) || ! is_array($data['slots'] ?? null)) {
            throw new RuntimeException('Catalogue des mentions légales : version ou structure inattendue (legal-slots.json, version '.self::VERSION.' attendue).');
        }

        return $this->data = $data;
    }
}
