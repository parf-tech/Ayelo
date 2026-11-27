<?php

/*
 * Résume les piles échantillonnées par prepend.php (une ligne « a;b;c nombre » par pile, un échantillon = 1 ms).
 * Usage : php resume.php <dossier des .folded> [lignes par tableau]
 * Pour chaque route : part par famille (la pile contient la famille), temps propre et temps inclusif par fonction.
 */
$directory = $argv[1] ?? '/tmp/profils';
$limit = max(1, (int) ($argv[2] ?? 30));
$families = [
    'amorçage Laravel' => '/Foundation\\\\(Application::bootstrapWith|Bootstrap\\\\|Http\\\\Kernel::bootstrap)/',
    'fournisseurs (boot)' => '/Application::(boot|register)\b|BootProviders|RegisterProviders/',
    'chargement de fichiers' => '/Composer\\\\Autoload|ClassLoader/',
    'PostgreSQL (PDO)' => '/^PDO(Statement)?::/',
    'Eloquent' => '/Illuminate\\\\Database\\\\Eloquent/',
    'Redis (Predis)' => '/^Predis\\\\/',
    'SDK AWS (stockage)' => '/^Aws\\\\|GuzzleHttp\\\\Psr7/',
    'validation' => '/Illuminate\\\\Validation/',
    'dates (Carbon)' => '/^Carbon\\\\|Illuminate\\\\Support\\\\Carbon/',
    'diffusion temps réel' => '/Broadcast|Pusher/',
    'Sentry' => '/^Sentry\\\\/',
];

$files = glob(rtrim($directory, '/').'/*.folded') ?: [];
if ($files === []) {
    fwrite(STDERR, "aucun profil dans $directory\n");
    exit(1);
}

foreach ($files as $file) {
    $total = 0;
    $self = [];
    $inclusive = [];
    $perFamily = array_fill_keys(array_keys($families), 0);
    foreach (new SplFileObject($file) as $line) {
        $line = rtrim((string) $line);
        $space = strrpos($line, ' ');
        if ($space === false) {
            continue;
        }
        $samples = (int) substr($line, $space + 1);
        $frames = explode(';', substr($line, 0, $space));
        $total += $samples;
        $leaf = $frames[count($frames) - 1];
        $self[$leaf] = ($self[$leaf] ?? 0) + $samples;
        $unique = array_unique($frames);
        foreach ($unique as $frame) {
            $inclusive[$frame] = ($inclusive[$frame] ?? 0) + $samples;
        }
        foreach ($families as $name => $pattern) {
            if (preg_grep($pattern, $unique) !== []) {
                $perFamily[$name] += $samples;
            }
        }
    }
    if ($total === 0) {
        continue;
    }

    printf("\n===== %s : %d échantillons (environ %d ms cumulées)\n", basename($file, '.folded'), $total, $total);
    echo "-- familles (une pile peut compter dans plusieurs)\n";
    arsort($perFamily);
    foreach ($perFamily as $name => $samples) {
        printf("%6.1f %%  %s\n", 100 * $samples / $total, $name);
    }
    foreach (['temps propre' => $self, 'temps inclusif' => $inclusive] as $title => $table) {
        echo "-- $title\n";
        arsort($table);
        foreach (array_slice($table, 0, $title === 'temps propre' ? $limit : $limit * 2, true) as $frame => $samples) {
            printf("%6.1f %%  %s\n", 100 * $samples / $total, mb_substr((string) $frame, 0, 150));
        }
    }
}
