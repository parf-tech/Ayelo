# Plan 007 : Premium et crédits

- Routes : `routes/api/billing.php` ; contrôleur `BillingController` ; service `RevenueCatProcessor` ; `Premium` ; événement `BillingUpdated` ; `config/billing.php`
- Schéma : `subscriptions`, `purchases`, `credit_ledger`, `webhook_events`
- Décisions : ADR 002. Un abonnement « cancelled » reste actif jusqu'à `period_end`. Pas de modification de `period_end` au remboursement (contrainte `period_end > period_start`).
- Mobile : `PurchaseProvider` abstrait, implémentation RevenueCat isolée (nécessite un build de développement).
- Risques : format des événements supposé ; aucune transaction réelle observée.
