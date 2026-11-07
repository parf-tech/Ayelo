<?php

namespace App\Console\Commands;

use App\Services\MediaSanitizer;
use Illuminate\Console\Command;

/**
 * Processus enfant du nettoyage d'images (revue N-14) : lit l'image sur l'entrée standard, la décode et la ré-encode
 * hors du processus web, sous un plafond de mémoire et de temps imposé par l'appelant (MediaSanitizerProcess).
 * Sortie : une ligne « OK <mime> <ext> » puis les octets nettoyés ; code 3 = fichier refusé, rien sur la sortie.
 */
class MediaSanitizeStdinCommand extends Command
{
    public const EXIT_REFUSED = 3;

    protected $signature = 'media:sanitize-stdin {mime : Type MIME déclaré}';

    protected $description = 'Nettoie une image lue sur l\'entrée standard (usage interne, processus isolé)';

    protected $hidden = true;

    public function handle(MediaSanitizer $sanitizer): int
    {
        $bytes = (string) stream_get_contents(STDIN);
        $clean = $sanitizer->cleanInProcess($bytes, (string) $this->argument('mime'));
        if ($clean === null) {
            return self::EXIT_REFUSED;
        }

        fwrite(STDOUT, "OK {$clean['mime']} {$clean['ext']}\n".$clean['bytes']);

        return self::SUCCESS;
    }
}
