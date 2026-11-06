# Plan 004 : Messagerie et temps réel

- Routes : `routes/api/messaging.php`, `routes/api/realtime.php` (`POST /api/v1/broadcasting/auth`), `routes/channels.php`
- Contrôleurs : `ConversationController`, `MessageController`, `DeviceController` ; services `Conversations`, `MessageSafety`, `Push/{PushNotifier,FcmPushNotifier}`, job `SendPush`
- Événements : `MessageCreated`, `ConversationSignal` (delivered / read / typing), `MatchCreated`
- Schéma : `conversations` (statut, masquage par côté), `messages` (unicité `(conversation, expéditeur, client_id)`, microsecondes), `devices`, `notification_prefs`
- Décisions : pas de canal de présence global (énumération des membres) ; présence calculée côté serveur, **non implémentée** (011).
- Risques : Reverb sur un seul process ; FCM et Reverb jamais exercés en réel (voir `docs/16-STATUS.md`).
