# ADR 002 : Paiements par les stores, validés par RevenueCat

Statut : accepté (implémenté le 2026-11-05)

## Décision
Abonnements Premium et crédits « Conversation » sont vendus par achat intégré Apple / Google, suivis par RevenueCat. Le serveur ne fait confiance **qu'au webhook** `POST /api/v1/webhooks/revenuecat`, jamais à l'état envoyé par l'application.

## Règles implémentées (`app/Services/RevenueCatProcessor.php`)
- Authentification du webhook par secret partagé (`REVENUECAT_WEBHOOK_SECRET`, comparaison à temps constant). Sans secret configuré : tout est refusé.
- Idempotence à trois niveaux : `webhook_events.id` (événement), `purchases.transaction_id` (achat), `subscriptions.original_transaction_id` (abonnement).
- `app_user_id` RevenueCat = `users.id`. Utilisateur inconnu : événement enregistré et ignoré (200), pas d'erreur.
- Annulation : l'accès Premium reste valide jusqu'à `period_end`. Remboursement (motif support) : accès retiré immédiatement et crédits repris sans jamais passer sous zéro, avec signal de risque si les crédits étaient déjà dépensés.
- Crédits : registre en ajout seulement (`credit_ledger`), jamais de solde modifié.

## À vérifier avant la mise en production
Les **noms exacts** des types d'événements et des champs (`CANCELLATION` + `cancel_reason`, `NON_RENEWING_PURCHASE`, `store`, `price`) et le mode d'authentification du webhook sont écrits d'après la connaissance du produit, **pas** d'après une lecture de la documentation officielle dans ce projet. Ils doivent être comparés à la documentation RevenueCat de la version utilisée, puis testés avec les événements de test du tableau de bord.

## Conséquences
Pas de Stripe pour les biens numériques consommés dans l'app. Les remboursements passent par les stores.
