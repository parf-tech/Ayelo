<?php

return [
    'verify' => [
        'subject' => 'Confirm your email address',
        'body' => 'Welcome! Confirm your email address by opening this link:',
        'expires' => 'This link is valid for 24 hours.',
    ],
    'reset' => [
        'subject' => 'Reset your password',
        'body' => 'To choose a new password, open this link:',
        'expires' => 'This link is valid for 1 hour.',
        'ignore' => 'If you did not request this, ignore this message: your password will not change.',
    ],
];
