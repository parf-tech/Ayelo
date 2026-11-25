<?php

namespace Tests\Support;

use App\Services\Media\Transcoder;

/** Traitement audio / vidéo simulé pour les tests : aucun ffmpeg, aucun volume partagé. */
class FakeTranscoder implements Transcoder
{
    /** @var array<string, array{kind: string, bytes: string}> */
    public array $submitted = [];

    /** @var array<string, array{bytes: string, mime: string, duration_ms: int}> résultats prêts, par identifiant de média */
    public array $results = [];

    /** @var list<string> identifiants dont le traitement échoue */
    public array $failures = [];

    /** @var list<string> */
    public array $discarded = [];

    /** @var array<string, int> */
    public array $ages = [];

    public function submit(string $mediaId, string $kind, string $bytes): void
    {
        $this->submitted[$mediaId] = ['kind' => $kind, 'bytes' => $bytes];
    }

    public function state(string $mediaId): string
    {
        return match (true) {
            in_array($mediaId, $this->failures, true) => 'failed',
            isset($this->results[$mediaId]) => 'done',
            isset($this->submitted[$mediaId]) => 'pending',
            default => 'absent',
        };
    }

    public function ageSeconds(string $mediaId): int
    {
        return $this->ages[$mediaId] ?? 0;
    }

    public function collect(string $mediaId): array
    {
        return $this->results[$mediaId];
    }

    public function discard(string $mediaId): void
    {
        $this->discarded[] = $mediaId;
        unset($this->submitted[$mediaId], $this->results[$mediaId]);
    }
}
