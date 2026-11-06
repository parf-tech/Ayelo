# Tâches 009 : Administration

- [x] T000 Relire l'état laissé par l'agent interrompu (`git diff backend/composer.json backend/config/auth.php`, `app/Models/StaffUser.php`, `app/Services/Admin/`), lancer la suite de tests complète, décider de garder ou de reprendre
  Preuve : état relu (composer.json épinglé à 4.16.1, config/auth.php, StaffUser, Services/Admin repris et complétés) ; suite complète verte, voir T012.
- [x] T001 [US1] Panneau Filament, garde `staff`, 2FA obligatoire, comptes inactifs refusés, utilisateurs normaux refusés — tests `Admin/`
  Preuve : `tests/Feature/Admin/AccessTest.php` (14 tests : anonyme, utilisateur web/Sanctum refusés, sans 2FA = écran de configuration seulement, inactif refusé, mot de passe seul ne connecte pas, TOTP, secret chiffré).
- [x] T002 [US1] Commande `staff:create {email} {role}` (mot de passe affiché une seule fois)
  Preuve : `tests/Feature/Admin/StaffCommandTest.php` (mot de passe généré affiché une fois, haché, absent du journal ; `--prompt` ; doublon / rôle invalide ; `staff:reset-2fa` ; `sanctions:expire`).
- [x] T003 [US8] Service `Audit` unique ; chaque action d'admin écrit `audit_logs` ; aucune édition possible — tests
  Preuve : `tests/Feature/Admin/AuditTest.php` (déclencheur SQL, modèle et interface en lecture seule, journal en panne = action annulée pour 10 actions des 6 services, droits refusés = aucune trace, masquage des secrets).
- [x] T004 [US2] Ressource « Médias à modérer » (approuver / rejeter + suppression de l'objet)
  Preuve : `ModerationTest.php` (liste sans selfies, approuver, rejeter + objet supprimé + moderated_by, aperçu signé, double traitement refusé).
- [x] T005 [US3] Ressource « Signalements » (décisions, sanctions, lever la suspension préventive)
  Preuve : `ModerationTest.php` (tri priorité puis date, avertir / suspendre / bannir / classer, sanction visible via GET /api/v1/me/sanctions, mineur suspecté : lever / confirmer / refus avertir).
- [x] T006 [US4] Ressource « Contestations »
  Preuve : `ModerationTest.php` (accepter lève la sanction et réactive le compte seulement s'il ne reste aucune restriction ; rejeter exige une note).
- [x] T007 [US5] Ressource « Vérifications de profil » (selfie par URL signée, consultation journalisée)
  Preuve : `ModerationTest.php` (URL signée 2 min, consultation journalisée sans l'URL, selfie absent de la liste, approuver / rejeter via ProfileVerification, selfie supprimé).
- [~] T008 [US6] Ressource « Utilisateurs » (suspension, score de risque, crédits, Premium offert, rôles)
  Preuve : `UserAdminTest.php` (recherche e-mail / id / nom, suspendre / bannir / réactiver avec motif, crédits admin_adjust + idempotence, Premium offert promotional + granted_by, rôles). Reste : pas d'écran de gestion des comptes du personnel (création par `staff:create` seulement).
- [x] T009 [US7] Ressource « Tickets de support »
  Preuve : `UserAdminTest.php` (statut, attribution, audit ; attribution à un modérateur refusée).
- [x] T010 [US9] Tableau de bord
  Preuve : `PermissionsTest.php` (indicateurs calculés, filtrés par rôle ; widget rendu pour les 3 rôles). Rendu visuel non vérifié.
- [x] T011 Matrice de droits par rôle testée ; aucune donnée secrète affichée
  Preuve : `PermissionsTest.php` (matrice pages + fiches + services, 404 sur clé invalide) et `SecretsTest.php` (aucun hash, secret TOTP, jeton, clé de stockage dans 15 pages).
- [x] T012 Suite complète verte + `composer audit` + CI verte
  Preuve : suite rejouée par le CTO le 2026-11-06 : 242 tests, 1602 assertions, 0 échec ; `composer audit` sans faille ; CI GitHub : voir le commit de livraison.
- [ ] T013 Essai manuel dans un navigateur (non automatisable ici) — propriétaire ou session ultérieure
