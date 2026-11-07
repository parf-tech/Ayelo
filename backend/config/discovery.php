<?php

return [
    // Quota journalier de likes pour un compte gratuit (FR-C-9). Valeur initiale à calibrer.
    'daily_likes_free' => (int) env('DISCOVERY_DAILY_LIKES_FREE', 50),
    'daily_super_likes_premium' => 5,
    'page_size' => 20,
    'max_page_size' => 50,
    // Fraîcheur par défaut de la découverte en jours (comptes vus depuis N jours). Vide = pas de filtre.
    'active_within_days' => env('DISCOVERY_ACTIVE_WITHIN_DAYS') !== null && env('DISCOVERY_ACTIVE_WITHIN_DAYS') !== '' ? (int) env('DISCOVERY_ACTIVE_WITHIN_DAYS') : null,
];
