<?php

namespace App\Services;

use Symfony\Component\Process\PhpExecutableFinder;
use Symfony\Component\Process\Process;

/**
 * Exécute le nettoyage d'une image dans un processus PHP séparé (revue N-14) : un fichier hostile qui épuise la mémoire,
 * boucle ou fait planter une bibliothèque d'images (libwebp, libpng, libjpeg) ne touche que ce processus jetable,
 * jamais le processus web. Échec fermé : tout incident (délai dépassé, mémoire, plantage, sortie illisible) = refus.
 */
class MediaSanitizerProcess
{
    /** @return array{bytes: string, mime: string, ext: string}|null null = refusé ou incident */
    public function run(string $bytes, string $declaredMime): ?array
    {
        $php = (new PhpExecutableFinder)->find(false);
        if ($php === false) {
            return null;
        }

        $timeout = max(1, (int) config('media.process_timeout_seconds', 10));
        $process = new Process(
            [
                $php,
                '-d', 'memory_limit='.config('media.process_memory_limit', '256M'),
                '-d', 'max_execution_time='.$timeout,
                '-d', 'display_errors=0',
                base_path('artisan'),
                'media:sanitize-stdin',
                $declaredMime,
            ],
            base_path(),
            null,
            $bytes,
            $timeout,
        );

        try {
            $process->run();
        } catch (\Throwable $e) {
            report($e);

            return null;
        }

        if (! $process->isSuccessful()) {
            return null;
        }

        return $this->parse($process->getOutput(), $declaredMime);
    }

    /** @return array{bytes: string, mime: string, ext: string}|null */
    private function parse(string $output, string $declaredMime): ?array
    {
        $newline = strpos($output, "\n");
        if ($newline === false || $newline > 40) {
            return null;
        }

        if (! preg_match('/^OK (image\/(?:jpeg|png|webp)) (jpg|png|webp)$/', substr($output, 0, $newline), $m)) {
            return null;
        }

        $body = substr($output, $newline + 1);
        if ($m[1] !== $declaredMime || $body === '' || @getimagesizefromstring($body) === false) {
            return null;
        }

        return ['bytes' => $body, 'mime' => $m[1], 'ext' => $m[2]];
    }
}
