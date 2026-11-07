<?php

return [
    /*
     | Signaleur crédible pour la suspension préventive « mineur suspecté » (revue F-09, décision Q2-B) :
     | compte d'au moins N jours, e-mail vérifié, et au moins une interaction (conversation ou match) avec la personne visée.
     */
    'reporter_min_age_days' => 7,

    /*
     | Alerte sur un signaleur au ratio anormal : au moins `reporter_alert_min_reports` signalements tranchés
     | (classés ou rejetés) sur `reporter_alert_window_days` jours, dont aucun confirmé. Journal d'alerte + ligne d'audit,
     | au plus une par signaleur et par jour ; la décision reste humaine.
     */
    'reporter_alert_min_reports' => 5,
    'reporter_alert_window_days' => 30,
];
