# Tâches 006 : Compte, vie privée et données

- [x] T001 [US1] `DELETE /me` : mot de passe ou id_token du fournisseur, masquage, sessions fermées — `AccountLifecycleTest`
- [x] T002 [US1] Anonymisation après 30 jours, suppression des objets, preuves conservées, hash de bannissement — `AccountLifecycleTest`
- [x] T003 [US1] Commande planifiée `accounts:purge` — `AccountLifecycleTest`
- [x] T004 [US2] Demande web + confirmation par lien, réponse identique — `AccountLifecycleTest`
- [x] T005 [US3] Export JSON (une demande par jour, expiration, propriétaire seul) — `AccountLifecycleTest`
- [x] T006 [US4] Consentements historisés, retrait des données sensibles masque le profil — `AccountLifecycleTest`
- [x] T007 [US5] Tickets de support avec quota — `AccountLifecycleTest`
- [ ] T008 Page web publique de demande de suppression (front) — hébergement et domaine à décider
- [ ] T009 Politique de confidentialité, CGU, mentions légales — **juriste**
- [ ] T010 Étude d'impact (AIPD) et registre des traitements — **juriste / propriétaire**
- [~] T011 Révocation des jetons Apple / TikTok à la suppression (exigence Apple, à vérifier) — Apple fait côté serveur le 2026-11-23 (échange du code d'autorisation, jeton chiffré, révocation avant l'anonymisation, `AppleRevocationTest`), jamais essayé contre le vrai service ; reste le code d'autorisation envoyé par le mobile (connexion Apple absente) et la clé .p8 ; TikTok non fait
- [x] T012 Annulation de la suppression pendant le délai de grâce par étape explicite (`deletion_pending`, `cancel_deletion`) — `DeletionCancelTest`, `deletionPending.test.tsx`
