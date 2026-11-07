<?php

return [
    /*
     | Aperçu du texte d'un message dans la notification push (revue F-28). Faux par défaut : le contenu transite par
     | Google (FCM) et Apple (APNs) et s'affiche sur l'écran verrouillé ; la notification dit seulement « Nouveau
     | message ». PUSH_MESSAGE_PREVIEW=true rétablit les 80 premiers caractères (décision produit, à reporter dans la
     | politique de confidentialité : docs/legal/02).
     */
    'message_preview' => (bool) env('PUSH_MESSAGE_PREVIEW', false),
    'message_preview_chars' => 80,
];
