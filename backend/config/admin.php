<?php

return [
    /*
     | Plafonds par administrateur sur 24 heures glissantes (revue N-12, décision Q3-B). Au-delà, l'action est refusée
     | et une ligne d'audit « admin.cap_exceeded » est écrite. Les retraits (delta négatif) et les révocations ne comptent pas
     | et ne libèrent pas le plafond : le calcul lit le journal d'audit, qui est en ajout seulement.
     */
    'daily_credit_cap' => (int) env('ADMIN_DAILY_CREDIT_CAP', 2000),
    'daily_premium_days_cap' => (int) env('ADMIN_DAILY_PREMIUM_DAYS_CAP', 366),
];
