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
];
