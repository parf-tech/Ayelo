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

    /*
     | OAuth (revue F-21, pentest P-06). `reauth_max_age_seconds` : âge maximal (claim `iat`) d'un id_token accepté pour une
     | ré-authentification (suppression, export). `require_nonce` : à passer à true quand l'application mobile enverra `nonce` ;
     | tant que c'est false, le nonce n'est contrôlé que s'il est envoyé. `login_max_age_seconds` : quand le nonce est ABSENT et
     | non exigé, la connexion n'accepte qu'un id_token émis depuis moins de N secondes (claim `iat`) : un jeton fuité n'est plus
     | rejouable pendant toute sa durée de vie (1 h chez Google). L'application mobile doit donc demander un jeton neuf à
     | chaque connexion (pas de jeton mis en cache) ; l'envoi du nonce la dispense de cette fenêtre.
     */
    'oauth' => [
        'reauth_max_age_seconds' => (int) env('OAUTH_REAUTH_MAX_AGE', 600),
        'login_max_age_seconds' => (int) env('OAUTH_LOGIN_MAX_AGE', 600),
        'require_nonce' => (bool) env('OAUTH_REQUIRE_NONCE', false),
    ],

    /*
     | Sessions (revue F-18) : un seul jeton actif par appareil (X-Device-Id) ; au plus N sessions par compte
     | (les plus anciennes sont fermées au-delà).
     */
    'max_sessions_per_user' => (int) env('MAX_SESSIONS_PER_USER', 10),

    /*
     | Squat d'e-mail non vérifié (revue F-30, revue pentest P-01) : un compte inscrit par e-mail, jamais vérifié, créé et sans
     | activité depuis plus de N heures est anonymisé SEULEMENT quand l'adresse est prouvée par un fournisseur OAuth ; jamais sur
     | la simple saisie dans le formulaire d'inscription (422 comme avant). Le propriétaire reprend aussi la main par « mot de
     | passe oublié ».
     */
    'unverified_reclaim_hours' => (int) env('UNVERIFIED_RECLAIM_HOURS', 24),

    /*
     | Magasin de cache de l'état de sécurité qui ne doit pas être évincé : jeton d'âge à usage unique (AgeGate), compteur de
     | ré-authentification (AccountController), consigne de pose (VerificationController). Une éviction LRU du cache les
     | réarmerait (rejeu d'un jeton, remise à zéro du compteur). Vide = magasin de cache par défaut (développement, tests).
     | En production : SAFETY_STATE_STORE=state (connexion Redis persistante « default », préfixe distinct, config/cache.php).
     */
    'state_store' => env('SAFETY_STATE_STORE') ?: null,
];
