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
            $this->childEnvironment(),
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

    /**
     * Variables d'environnement qui traversent vers l'enfant : le strict nécessaire à PHP et à l'amorçage d'artisan
     * (revue P-13). Le décodage d'une image n'a besoin ni de la base, ni de la clé d'application, ni du stockage objet,
     * ni des secrets FCM, LiveKit, Stripe… : un défaut de libwebp/libpng exploité dans l'enfant n'y trouve rien à lire.
     */
    private const ALLOWED_ENV = [
        'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR',
        'APP_ENV', 'PHPRC', 'PHP_INI_SCAN_DIR', 'LANG', 'LC_ALL',
    ];

    /**
     * Environnement minimal de l'enfant. Symfony Process hérite de tout l'environnement parent par défaut : chaque
     * variable non autorisée est donc retirée (false). Laravel recharge ensuite les fichiers .env (Dotenv ne
     * remplace pas une variable déjà définie) : les noms qu'ils déclarent sont fixés à vide pour que les valeurs
     * du fichier ne soient pas relues. Une clé d'application jetable aléatoire suffit à amorcer le noyau ; elle ne
     * chiffre ni ne signe rien de réel.
     *
     * @return array<string, string|false>
     */
    private function childEnvironment(): array
    {
        $names = array_merge(array_keys(getenv()), array_keys($_ENV), array_keys($_SERVER));
        foreach ($this->dotenvNames() as $name) {
            $names[] = $name;
        }

        $env = [];
        foreach (array_unique($names) as $name) {
            if (! is_string($name) || in_array(strtoupper($name), self::ALLOWED_ENV, true)) {
                continue;
            }
            $env[$name] = in_array($name, $this->dotenvNames(), true) ? '' : false;
        }

        // Pilotes neutres : le noyau en résout certains à l'amorçage (cache, session, file, diffusion, courrier).
        $env = array_merge($env, ['CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync',
            'BROADCAST_CONNECTION' => 'null', 'MAIL_MAILER' => 'array', 'LOG_CHANNEL' => 'stderr']);
        $env['APP_KEY'] = 'base64:'.base64_encode(random_bytes(32));

        return $env;
    }

    /** @return list<string> noms (jamais les valeurs) déclarés dans .env et .env.<APP_ENV>, hors variables autorisées */
    private function dotenvNames(): array
    {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }

        $files = [base_path('.env')];
        $appEnv = (string) (getenv('APP_ENV') ?: '');
        if ($appEnv !== '') {
            $files[] = base_path('.env.'.preg_replace('/[^A-Za-z0-9_.-]/', '', $appEnv));
        }

        $names = [];
        foreach ($files as $file) {
            $lines = is_file($file) ? @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : false;
            foreach ($lines ?: [] as $line) {
                if (preg_match('/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/', $line, $m) && ! in_array(strtoupper($m[1]), self::ALLOWED_ENV, true)) {
                    $names[] = $m[1];
                }
            }
        }

        return $cache = array_values(array_unique($names));
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
