<?php

/*
 | Site de présentation (web/) et mentions légales saisies depuis le panneau d'administration.
 */
return [
    // Dossier du site (pages HTML et tools/legal-slots.json). En production : monté en lecture seule dans le conteneur `app`
    // (SITE_WEB_ROOT=/srv/web, infra/docker-compose.prod.yml). En développement et en test : le dossier web/ du dépôt.
    'web_root' => env('SITE_WEB_ROOT', base_path('../web')),

    // Durée de cache public des pages remplies par l'application (Cache-Control: public, max-age=...).
    'cache_seconds' => 300,
];
