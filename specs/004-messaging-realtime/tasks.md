# Tâches 004 : Messagerie et temps réel

- [x] T001 [US1] Envoi, idempotence, validation, pagination par curseur — `MessagingTest`
- [x] T002 [US2] Canaux privés autorisés aux participants, fermés après blocage — `MessagingTest`
- [x] T003 [US3] Remis / lu / saisie (événements) — `MessagingTest`
- [x] T004 [US4] Suppression de message, masquage de conversation — `MessagingTest`
- [x] T005 [US5] Ouverture hors match par crédit ou Premium, rejeu sans double dépense — `MessagingTest`
- [x] T006 [US6] Pièces jointes validées — `MessagingTest`
- [x] T007 [US7] Préférences de notification, jeton par appareil réaffecté, push désactivé selon préférences, jeton invalide effacé, conseil « demande d'argent » — `MessagingTest`
- [x] T008 Correctifs trouvés par les tests : ordre des messages d'une même seconde (microsecondes), contrainte SQL sur la suppression de message texte
- [ ] T009 Présence calculée côté serveur (Redis, TTL) — non fait
- [ ] T010 Essai réel : connexion WebSocket Reverb depuis un client, envoi FCM sur un appareil — dépend de l'infrastructure et des clés
- [ ] T011 Filtre de texte fr/en au-delà des mots-clés (FR-I-10) — à spécifier avec le prestataire de modération
