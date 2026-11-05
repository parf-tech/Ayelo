<?php

return [
    'verify' => [
        'subject' => 'Confirmez votre adresse e-mail',
        'body' => 'Bienvenue ! Confirmez votre adresse e-mail en ouvrant ce lien :',
        'expires' => 'Ce lien est valable 24 heures.',
    ],
    'reset' => [
        'subject' => 'Réinitialisation de votre mot de passe',
        'body' => 'Pour choisir un nouveau mot de passe, ouvrez ce lien :',
        'expires' => 'Ce lien est valable 1 heure.',
        'ignore' => 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message : votre mot de passe ne change pas.',
    ],
    'deletion' => [
        'subject' => 'Confirmez la suppression de votre compte',
        'body' => 'Vous avez demandé la suppression de votre compte. Pour la confirmer, ouvrez ce lien :',
        'expires' => 'Ce lien est valable 1 heure. Vos données seront effacées après un délai de 30 jours.',
        'ignore' => "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre compte reste actif.",
    ],
];
