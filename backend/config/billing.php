<?php

return [
    /*
     | RevenueCat : le serveur ne fait confiance qu'au webhook authentifié, jamais à l'état envoyé par l'application.
     | Le secret est l'en-tête Authorization configuré dans le tableau de bord RevenueCat (à vérifier dans leur documentation).
     */
    'webhook_secret' => env('REVENUECAT_WEBHOOK_SECRET'),

    // Produits de la boutique (identifiants des stores). Prix et durées réels : fixés dans App Store Connect / Play Console.
    'subscriptions' => [
        'premium_1m' => ['months' => 1],
        'premium_3m' => ['months' => 3],
        'premium_12m' => ['months' => 12],
    ],

    // Achats consommables : crédits accordés.
    'packs' => [
        'conversation_1' => ['type' => 'conversation', 'credits' => 1],
        'conversation_5' => ['type' => 'conversation', 'credits' => 5],
        'conversation_10' => ['type' => 'conversation', 'credits' => 10],
    ],

    // Correspondance store RevenueCat -> store du schéma.
    'stores' => ['APP_STORE' => 'apple', 'MAC_APP_STORE' => 'apple', 'PLAY_STORE' => 'google'],
];
