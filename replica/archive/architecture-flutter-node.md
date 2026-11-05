# Architecture : clone de Chat&Yamo (V1, sans appel vidéo ni proximité)

Contrainte principale : coût bas. Pas de Firebase. Un seul VPS, une seule base.

## Stack

| layer | choix | pourquoi |
| --- | --- | --- |
| mobile | Flutter (iOS + Android) | une seule base de code, même techno que l'original |
| backend | Node.js 22 + TypeScript + Fastify | léger, rapide, WebSocket intégré via `@fastify/websocket` |
| base de données | PostgreSQL 16 sur le VPS | une seule base, pas de service payant par requête |
| accès DB | Drizzle ORM + migrations SQL (`replica/schema.sql` = première migration) | typé, proche du SQL |
| auth | JWT court (15 min) + refresh token en base, mots de passe argon2id | pas de service tiers ; Google/Apple/TikTok ajoutés par OAuth officiel plus tard |
| temps réel | WebSocket sur le même process Node | chat sans service payant |
| jobs | pg-boss (file de jobs dans Postgres) | pas de Redis à gérer |
| fichiers | Cloudflare R2 (upload direct par URL présignée) | pas de frais de sortie, 10 Go gratuits |
| transcodage vidéo | ffmpeg dans un worker sur le VPS, vidéos limitées à 60 s | évite un service de transcodage payant |
| paiements | RevenueCat (abonnements et achats intégrés) + webhooks | exigence des stores, gère Apple et Google |
| push | FCM (Firebase Cloud Messaging) uniquement | gratuit, sans facturation à l'usage |
| email | Resend ou Brevo (offre gratuite) | vérification d'email, réinitialisation |
| reverse proxy / TLS | Caddy | HTTPS automatique |
| déploiement | Docker Compose sur le VPS (app, worker, postgres, caddy) | simple à reproduire |
| sauvegardes | `pg_dump` chaque nuit vers R2, 14 jours de rétention | |
| supervision | Uptime Kuma + logs `pino` | |

VPS de départ : 2 vCPU, 4 Go RAM, 80 Go (Hostinger KVM 2 ou équivalent). Suffit jusqu'à quelques milliers d'utilisateurs actifs. Au-delà : séparer le worker vidéo.

## Schéma

Tables : 14 (`users`, `auth_identities`, `refresh_tokens`, `push_tokens`, `profiles`, `media`, `video_invites`, `conversations`, `messages`, `blocks`, `reports`, `subscriptions`, `purchases`, `webhook_events`).
Accès : contrôles dans la couche données. Chaque requête filtre par `user_id` du jeton. Pas de RLS.
SQL complet : `replica/schema.sql`.

Contraintes durcies :
- 18 ans minimum : `check` sur `profiles.birthdate`.
- Une seule conversation par paire : `check (user_a < user_b)` + index unique.
- Renvoi de message sans doublon : `unique (conversation_id, client_id)`.
- Webhook reçu deux fois : `webhook_events.id` et `unique transaction_id`.
- Crédits jamais négatifs : `check (conversation_credits >= 0)`.

## API

Toutes les routes sont sous `/v1`. Authentification par `Authorization: Bearer <jwt>` sauf mention.

| method path | fait quoi | qui | entrée | sortie | flow |
| --- | --- | --- | --- | --- | --- |
| POST /auth/register | crée le compte | public | email, mot de passe, date de naissance | tokens | F01 |
| POST /auth/login | connexion | public | email, mot de passe | tokens | F01 |
| POST /auth/refresh | renouvelle le jeton | public | refresh token | tokens | F01 |
| POST /auth/logout | révoque le refresh token | user | refresh token | 204 | F01 |
| POST /auth/oauth/:provider | login Google/Apple/TikTok | public | code OAuth | tokens | F01 (should) |
| POST /auth/password/forgot | envoie un lien de réinitialisation | public | email | 204 | F01 |
| POST /auth/password/reset | change le mot de passe | public | jeton, nouveau mot de passe | 204 | F01 |
| GET /me | profil et statut Premium | user | | user, profil, crédits | tous |
| PUT /me/profile | crée ou met à jour le profil | user | nom, genre, pays, intention, bio | profil | F01 |
| PATCH /me/visibility | toggle "Show my profile" | user | is_visible | profil | F08 |
| POST /me/push-token | enregistre le jeton FCM | user | token, plateforme | 204 | F02 |
| DELETE /me | supprime le compte (profil masqué, données purgées par job) | user | | 202 | F07 |
| POST /media/upload-url | URL présignée R2 | user | kind, mime, taille | media_id, URL | F01, F04 |
| POST /media/:id/complete | fin d'upload, lance le traitement | user | | media | F01, F04 |
| DELETE /media/:id | supprime un média | user (propriétaire) | | 204 | F01 |
| GET /discover | profils filtrés, exclut bloqués et masqués | user | origine, pays, intention, âge, curseur | liste paginée | F02 |
| GET /explore | profils vérifiés à swiper | user | curseur | liste paginée | F02 |
| GET /profiles/:id | détail d'un profil | user | | profil + médias | F02 |
| GET /invites | fil des invitations vidéo | user | pays, curseur | liste paginée | F04 |
| POST /invites | publie une invitation | user | titre, activité, ville, date, media_id | invitation | F04 |
| DELETE /invites/:id | retire son invitation | user (propriétaire) | | 204 | F04 |
| POST /conversations | ouvre une conversation (consomme un crédit si non Premium) | user | target_user_id | conversation | F02 |
| GET /conversations | liste des conversations | user | curseur | liste | F02 |
| GET /conversations/:id/messages | historique | user (participant) | curseur | messages | F02 |
| POST /conversations/:id/messages | envoie un message | user (participant) | client_id, body | message | F02 |
| POST /conversations/:id/read | marque comme lu | user (participant) | | 204 | F02 |
| WS /ws | messages, lu, présence en temps réel | user | jeton | événements | F02 |
| POST /blocks | bloque | user | blocked_id | 204 | F06 |
| DELETE /blocks/:id | débloque | user | | 204 | F06 |
| POST /reports | signale (4 motifs) | user | reported_id, reason, details | 201 | F06 |
| GET /subscription | statut Premium | user | | statut | F05 |
| POST /support | message au support | user | texte | 201 | F07 |
| GET /admin/reports | file de modération | admin | statut | liste | F06 |
| PATCH /admin/reports/:id | avertir, suspendre, bannir | admin | outcome | rapport | F06 |
| GET /admin/media/pending | médias à valider | admin | | liste | F01 |
| PATCH /admin/media/:id | approuve ou rejette | admin | status | média | F01 |
| PATCH /admin/profiles/:id/verify | badge vérifié | admin | | profil | F02 |

Routes : 37 (dont 1 WebSocket).

Webhooks en entrée : RevenueCat (`POST /webhooks/revenuecat`, signé par jeton secret, idempotent via `webhook_events`).
Webhooks en sortie : aucun en V1.

Jobs (pg-boss) :
| job | planification | rôle |
| --- | --- | --- |
| `transcode-video` | à l'upload | ffmpeg : compresse en 720p, 60 s max, génère la miniature, passe en `processing` puis `approved` ou `rejected` |
| `expire-invites` | toutes les heures | passe en `expired` les invitations dont la date est passée |
| `purge-deleted-users` | chaque nuit | supprime médias R2 et données des comptes supprimés depuis 30 jours |
| `send-push` | à la demande | nouveau message, nouvelle invitation |
| `sync-subscriptions` | chaque nuit | recoupe l'état RevenueCat |
| `db-backup` | chaque nuit | `pg_dump` vers R2 |

APIs utilisées : uniquement les API publiques officielles avec vos propres clés (RevenueCat, FCM, R2, Resend). Jamais les endpoints privés de l'original.

## The parts that bite

- **Modération (le plus risqué)** : photos et vidéos d'utilisateurs, risque d'arnaques et de contenus illégaux. Tout média commence en `pending_upload`/`processing`, rien n'est public avant `approved`. Prévoir file de revue admin dès la V1, et un bouton de signalement partout.
- **Arnaques aux sentiments** : le motif « demande d'argent » est le signalement le plus important. Prévoir une alerte automatique si un compte reçoit 3 signalements.
- **Âge** : vérification déclarative en V1. Rappel : les stores exigent un contrôle de contenu et la suppression du compte dans l'app.
- **Coûts vidéo** : limiter à 60 s, 50 Mo, 720p, 3 vidéos par profil. Surveiller R2 chaque semaine.
- **Temps réel sur un seul serveur** : un process Node = un point de panne. Acceptable en V1. Si besoin plus tard : ajouter Redis pub/sub pour passer à 2 instances.
- **Idempotence** : webhooks RevenueCat reçus deux fois ; messages renvoyés après coupure réseau (`client_id`).
- **Races** : deux utilisateurs qui s'écrivent en même temps créent une seule conversation (index unique + `insert … on conflict`). Décrément de crédit dans la même transaction que la création de la conversation (`update … where credits > 0`).
- **Fuseaux horaires** : tout en UTC (`timestamptz`), l'heure des invitations est convertie côté app.
- **Achats stores** : Apple et Google imposent leur système de paiement pour les abonnements. Pas de Stripe dans l'app.
- **Vie privée / RGPD** : suppression réelle des données sous 30 jours, export à la demande, politique de confidentialité obligatoire. Le champ d'orientation sexuelle n'est pas collecté en V1 (donnée sensible).
- **Sécurité du VPS** : pare-feu `ufw` (80, 443, SSH par clé uniquement), mises à jour automatiques, secrets dans des variables d'environnement hors dépôt, sauvegarde testée.
- **Limites de débit** : `@fastify/rate-limit` sur login, register, messages et signalements.
- **Recherche** : filtres SQL sur index (pays, origine, intention). Pas de moteur de recherche en V1.

## Build order

1. **Vertical slice** (écrans S01, S02, S03, S04, S05, S08, S11, S12 ; tables `users`, `profiles`, `media`, `conversations`, `messages` ; routes `auth/*`, `me`, `media/*`, `discover`, `profiles/:id`, `conversations/*`, `/ws`). Objectif : créer un compte, voir un profil, envoyer un message à un autre téléphone.
2. **Must-haves** :
   - Sécurité : `blocks`, `reports`, admin (S08, S12, S17, S18).
   - Filtres et recherche par pays/origine/intention (S07).
   - Profil vidéo et transcodage (S04).
   - Premium : RevenueCat, `subscriptions`, `purchases`, crédits (S15, S16).
   - Notifications push, suppression de compte, paramètres (S17, S18).
3. **Should-haves** : Explore (S06), invitations vidéo (S09, S10), badge vérifié, login Google/Apple/TikTok, emails, support (S19).
4. **Plus tard** : appel vidéo (S13), singles à proximité (S14), site web.
5. **Fixes** de replica-entrepreneur, une fois qu'il a tourné.

Jalons suggérés : slice (3 à 4 semaines), must-haves (6 à 8 semaines), should-haves (3 à 4 semaines). À ajuster après le premier jalon.
