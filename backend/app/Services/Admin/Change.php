<?php

namespace App\Services\Admin;

/** Résultat d'une mutation d'administration : ce qui doit être écrit dans le journal d'audit. */
final class Change
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function __construct(
        public readonly mixed $result = null,
        public readonly ?array $before = null,
        public readonly ?array $after = null,
        public readonly ?string $subjectId = null,
    ) {}
}
