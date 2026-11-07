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

    /** @var list<array{key: string, mime: string, size: int, ttl: int}> URL de dépôt délivrées (le contrat réel signe le type, pas la taille) */
    public array $presigned = [];

    public function presignedUpload(string $key, string $mime, int $size, int $ttlMinutes): array
    {
        $this->presigned[] = ['key' => $key, 'mime' => $mime, 'size' => $size, 'ttl' => $ttlMinutes];

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
        unset($this->objects[$key], $this->modifiedAt[$key]);
    }

    /** Simule le dépôt réel du fichier par le client. */
    public function simulateUpload(string $key, int $size, string $mime): void
    {
        $this->objects[$key] = ['size' => $size, 'mime' => $mime];
        $this->modifiedAt[$key] = now()->timestamp;
    }

    /** @var array<string, string> */
    public array $contents = [];

    public function get(string $key, ?int $maxBytes = null): string
    {
        $bytes = $this->contents[$key] ?? '';

        return $maxBytes === null ? $bytes : substr($bytes, 0, $maxBytes + 1);
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
        $this->modifiedAt[$key] = now()->timestamp;
    }

    /** @var array<string, int> dernière modification (timestamp Unix), pour le balayage des orphelins */
    public array $modifiedAt = [];

    public function listObjects(string $prefix): iterable
    {
        foreach ($this->objects as $key => $_) {
            if (str_starts_with($key, $prefix)) {
                yield ['key' => $key, 'modified_at' => $this->modifiedAt[$key] ?? now()->timestamp];
            }
        }
    }
}
