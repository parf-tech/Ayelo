<?php

// Coût d'un ré-encodage d'image tel que l'application le lance (processus enfant artisan), et du seul démarrage d'artisan.
chdir('/var/www/html');
exec('php /srv/perf/photo.php > /tmp/p.jpg');
$time = function (string $command): int {
    $start = microtime(true);
    exec($command.' 2>&1', $output, $status);
    if ($status !== 0) {
        echo "commande en échec ($status) : $command\n";
    }

    return (int) round((microtime(true) - $start) * 1000);
};
for ($n = 1; $n <= 3; $n++) {
    echo "ré-encodage seul, essai $n : ".$time('php -d memory_limit=256M artisan media:sanitize-stdin image/jpeg < /tmp/p.jpg > /dev/null')." ms\n";
}
echo 'démarrage d’artisan seul : '.$time('php artisan --version > /dev/null')." ms\n";
