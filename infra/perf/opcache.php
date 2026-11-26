<?php

// Diagnostic du banc de charge : état d'OPcache vu par PHP-FPM (interrogé par FastCGI, jamais exposé en HTTP).
$status = opcache_get_status(false);
if ($status === false) {
    echo "opcache inactif\n";
    exit;
}
$memory = $status['memory_usage'];
$stats = $status['opcache_statistics'];
printf(
    "opcache : plein=%s scripts=%d/%d cles=%d succes=%.1f%% echecs=%d redemarrages_memoire=%d memoire=%.0f/%.0f Mo\n",
    $status['cache_full'] ? 'OUI' : 'non', $stats['num_cached_scripts'], (int) ini_get('opcache.max_accelerated_files'), $stats['num_cached_keys'],
    $stats['opcache_hit_rate'], $stats['misses'], $stats['oom_restarts'], $memory['used_memory'] / 1048576,
    ($memory['used_memory'] + $memory['free_memory'] + $memory['wasted_memory']) / 1048576,
);
