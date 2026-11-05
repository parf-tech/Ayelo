<?php

return [
    // Quota journalier de likes pour un compte gratuit (FR-C-9). Valeur initiale à calibrer.
    'daily_likes_free' => (int) env('DISCOVERY_DAILY_LIKES_FREE', 50),
    'daily_super_likes_premium' => 5,
    'page_size' => 20,
    'max_page_size' => 50,
];
