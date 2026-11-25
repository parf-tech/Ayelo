<?php

namespace App\Services\Media;

use InvalidArgumentException;
use RuntimeException;

/**
 * Canal vers le conteneur `transcode` : un dossier partagé (volume), sans réseau entre les deux.
 *
 *   in/<id>.src   octets reçus                    in/<id>.job  demande {"kind":"audio|video"}, créée EN DERNIER (renommage atomique)
 *   in/<id>.run   demande prise en charge         out/<id>.bin résultat ; out/<id>.json {"mime","duration_ms"}
 *   out/<id>.ok   résultat complet (créé en dernier)  out/<id>.err  fichier refusé (jamais un extrait du contenu)
 *
 * Le script du conteneur (infra/transcode/transcode-loop.sh) applique le même protocole. Les noms de fichiers ne viennent que
 * d'un UUID validé : aucun chemin n'est construit à partir d'une donnée du client.
 */
final class SpoolTranscoder implements Transcoder
{
    public function __construct(private string $spool) {}

    public function submit(string $mediaId, string $kind, string $bytes): void
    {
        $this->assertId($mediaId);
        if (! in_array($kind, self::KINDS, true)) {
            throw new InvalidArgumentException('Type de traitement inconnu.');
        }
        if (! is_dir($this->spool.'/in') || ! is_dir($this->spool.'/out')) {
            throw new RuntimeException('Dossier partagé du traitement introuvable (MEDIA_TRANSCODE_SPOOL).');
        }

        $this->write($this->path('in', $mediaId, 'src'), $bytes);
        $this->write($this->path('in', $mediaId, 'job'), (string) json_encode(['kind' => $kind]));
    }

    public function state(string $mediaId): string
    {
        $this->assertId($mediaId);

        return match (true) {
            is_file($this->path('out', $mediaId, 'ok')) => 'done',
            is_file($this->path('out', $mediaId, 'err')) => 'failed',
            is_file($this->path('in', $mediaId, 'job')), is_file($this->path('in', $mediaId, 'run')) => 'pending',
            default => 'absent',
        };
    }

    public function ageSeconds(string $mediaId): int
    {
        $this->assertId($mediaId);
        clearstatcache();
        $modified = @filemtime($this->path('in', $mediaId, 'src'));

        return $modified === false ? 0 : max(0, time() - $modified);
    }

    public function collect(string $mediaId): array
    {
        $this->assertId($mediaId);
        $bytes = @file_get_contents($this->path('out', $mediaId, 'bin'));
        $meta = json_decode((string) @file_get_contents($this->path('out', $mediaId, 'json')), true);

        if ($bytes === false || ! is_array($meta) || ! is_string($meta['mime'] ?? null) || ! is_int($meta['duration_ms'] ?? null)) {
            throw new RuntimeException('Résultat du traitement illisible.');
        }

        return ['bytes' => $bytes, 'mime' => $meta['mime'], 'duration_ms' => $meta['duration_ms']];
    }

    public function discard(string $mediaId): void
    {
        $this->assertId($mediaId);
        foreach (['in' => ['src', 'job', 'run'], 'out' => ['bin', 'json', 'ok', 'err']] as $dir => $extensions) {
            foreach ($extensions as $extension) {
                @unlink($this->path($dir, $mediaId, $extension));
            }
        }
    }

    private function path(string $dir, string $mediaId, string $extension): string
    {
        return $this->spool.'/'.$dir.'/'.$mediaId.'.'.$extension;
    }

    /** Écriture complète sous un nom temporaire, puis renommage : le conteneur ne voit jamais un fichier à moitié écrit. */
    private function write(string $path, string $contents): void
    {
        $temporary = $path.'.tmp';
        if (file_put_contents($temporary, $contents, LOCK_EX) === false || ! rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('Écriture impossible dans le dossier partagé du traitement.');
        }
    }

    private function assertId(string $mediaId): void
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $mediaId)) {
            throw new InvalidArgumentException('Identifiant de média invalide.');
        }
    }
}
