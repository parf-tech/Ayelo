# Tâches 009 : Administration

- [ ] T000 Relire l'état laissé par l'agent interrompu (`git diff backend/composer.json backend/config/auth.php`, `app/Models/StaffUser.php`, `app/Services/Admin/`), lancer la suite de tests complète, décider de garder ou de reprendre
- [ ] T001 [US1] Panneau Filament, garde `staff`, 2FA obligatoire, comptes inactifs refusés, utilisateurs normaux refusés — tests `Admin/`
- [ ] T002 [US1] Commande `staff:create {email} {role}` (mot de passe affiché une seule fois)
- [ ] T003 [US8] Service `Audit` unique ; chaque action d'admin écrit `audit_logs` ; aucune édition possible — tests
- [ ] T004 [US2] Ressource « Médias à modérer » (approuver / rejeter + suppression de l'objet)
- [ ] T005 [US3] Ressource « Signalements » (décisions, sanctions, lever la suspension préventive)
- [ ] T006 [US4] Ressource « Contestations »
- [ ] T007 [US5] Ressource « Vérifications de profil » (selfie par URL signée, consultation journalisée)
- [ ] T008 [US6] Ressource « Utilisateurs » (suspension, score de risque, crédits, Premium offert, rôles)
- [ ] T009 [US7] Ressource « Tickets de support »
- [ ] T010 [US9] Tableau de bord
- [ ] T011 Matrice de droits par rôle testée ; aucune donnée secrète affichée
- [ ] T012 Suite complète verte + `composer audit` + CI verte
- [ ] T013 Essai manuel dans un navigateur (non automatisable ici) — propriétaire ou session ultérieure
