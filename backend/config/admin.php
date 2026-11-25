<?php

return [
    /*
     | Plafonds par administrateur sur 24 heures glissantes (revue N-12, décision Q3-B). Au-delà, l'action est refusée
     | et une ligne d'audit « admin.cap_exceeded » est écrite. Les retraits (delta négatif) et les révocations ne comptent pas
     | et ne libèrent pas le plafond : le calcul lit le journal d'audit, qui est en ajout seulement.
     */
    'daily_credit_cap' => (int) env('ADMIN_DAILY_CREDIT_CAP', 2000),
    'daily_premium_days_cap' => (int) env('ADMIN_DAILY_PREMIUM_DAYS_CAP', 366),

    /*
     | Signalements pris en charge (« Prendre ») : verrou de décision. Un signalement pris par une personne ne peut être décidé que
     | par elle ; au bout de ce délai sans décision, n'importe quel membre du personnel autorisé peut le prendre (personne
     | absente, onglet oublié). L'administrateur peut le reprendre à tout moment.
     */
    'assignment_ttl_minutes' => (int) env('ADMIN_ASSIGNMENT_TTL_MINUTES', 60),

    /*
     | Bandeau d'environnement du panneau : texte affiché en haut de chaque page hors production, pour ne pas confondre préproduction
     | et production. Vide : « Environnement : <APP_ENV> » ; en production, aucun bandeau.
     */
    'environment_label' => env('ADMIN_ENVIRONMENT_LABEL'),
];
