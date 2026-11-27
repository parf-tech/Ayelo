<?php

/*
 * Profil par échantillonnage (banc jetable seulement, auto_prepend_file) : actif pour les requêtes portant l'en-tête
 * X-Profil. Temps réel (attentes de base, de Redis et de réseau comprises), un échantillon par milliseconde ; les piles
 * sont ajoutées à /tmp/profils/<route>.folded, relu par resume.php.
 */
(static function (): void {
    $route = $_SERVER['HTTP_X_PROFIL'] ?? null;
    if (! is_string($route) || preg_match('/^[a-z]+$/', $route) !== 1 || ! extension_loaded('excimer')) {
        return;
    }

    $profiler = new ExcimerProfiler;
    $profiler->setEventType(EXCIMER_REAL);
    $profiler->setPeriod(0.001);
    $profiler->setMaxDepth(250);
    $profiler->start();

    register_shutdown_function(static function () use ($profiler, $route): void {
        $profiler->stop();
        if (! is_dir('/tmp/profils')) {
            @mkdir('/tmp/profils', 0700, true);
        }
        file_put_contents('/tmp/profils/'.$route.'.folded', $profiler->getLog()->formatCollapsed(), FILE_APPEND | LOCK_EX);
    });
})();
