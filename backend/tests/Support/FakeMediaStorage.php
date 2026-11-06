<?php

namespace Tests\Support;

use App\Services\Storage\MediaStorage;

/** Stockage en mémoire pour les tests : aucun appel réseau. */
class FakeMediaStorage implements MediaStorage
{
    /** @var array<string, array{size: int, mime: string}> */
    public array $objects = [];

    /** @var list<string> */
    public array $deleted = [];

    public function presignedUpload(string $key, string $mime, int $size, int $ttlMinutes): array
    {
        return ['url' => 'https://storage.test/put/'.$key, 'headers' => ['Content-Type' => $mime]];
    }

    public function temporaryUrl(string $key, int $ttlMinutes): string
    {
        return 'https://storage.test/get/'.$key.'?ttl='.$ttlMinutes;
    }

    public function head(string $key): ?array
    {
        return $this->objects[$key] ?? null;
    }

    public function delete(string $key): void
    {
        $this->deleted[] = $key;
        unset($this->objects[$key]);
    }

    /** Simule le dépôt réel du fichier par le client. */
    public function simulateUpload(string $key, int $size, string $mime): void
    {
        $this->objects[$key] = ['size' => $size, 'mime' => $mime];
    }

    /** @var array<string, string> */
    public array $contents = [];

    public function get(string $key): string
    {
        return $this->contents[$key] ?? '';
    }

    /** Simule le dépôt d'un fichier réel par le client. */
    public function upload(string $key, string $bytes, string $mime): void
    {
        $this->put($key, $bytes, $mime);
    }

    public function put(string $key, string $contents, string $mime): void
    {
        $this->contents[$key] = $contents;
        $this->objects[$key] = ['size' => strlen($contents), 'mime' => $mime];
    }
}
