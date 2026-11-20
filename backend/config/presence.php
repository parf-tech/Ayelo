<?php

return [
    /*
     | Présence en ligne (FR-D-4). Une clé de cache par compte, à durée de vie courte (Redis en production, instance LRU du cache :
     | une présence perdue se rétablit à la requête suivante, rien n'est écrit en base).
     */

    // Durée pendant laquelle un compte reste « en ligne » après sa dernière activité authentifiée (secondes).
    'ttl_seconds' => (int) env('PRESENCE_TTL_SECONDS', 120),

    // Intervalle minimal entre deux renouvellements de la clé (secondes) : au plus une écriture de cache par compte et par intervalle,
    // quel que soit le nombre de requêtes. Doit rester bien inférieur à ttl_seconds.
    'touch_interval_seconds' => (int) env('PRESENCE_TOUCH_INTERVAL_SECONDS', 30),
];
