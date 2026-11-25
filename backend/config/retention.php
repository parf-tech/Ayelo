<?php

/*
 | Durées de conservation du texte libre (revue de sécurité F-06). Valeurs initiales, à confirmer par le propriétaire
 | (matrice juridique par marché). Appliquées par AccountDeletion::purgeRetainedText (accounts:purge, quotidien).
 */
return [
    // Texte libre d'un signalement (reports.details), conservé tant que le dossier est utile puis effacé, une fois le compte
    // d'une des parties anonymisé. Un signalement sous conservation probatoire (evidence_retain_until dans le futur) est épargné.
    'report_details_days' => (int) env('RETENTION_REPORT_DETAILS_DAYS', 365),

    // Motif d'une sanction (sanctions.reason, colonne obligatoire : remplacé par un marqueur) une fois le compte sanctionné anonymisé.
    'sanction_reason_days' => (int) env('RETENTION_SANCTION_REASON_DAYS', 365),

    // Compte créé par e-mail dont l'adresse n'a jamais été vérifiée et qui n'a aucune activité depuis ce délai : anonymisé par
    // accounts:purge-unverified (AccountDeletion::purgeUnverified). Valeur initiale, à confirmer avec la matrice juridique.
    'unverified_account_days' => (int) env('RETENTION_UNVERIFIED_ACCOUNT_DAYS', 30),
];
