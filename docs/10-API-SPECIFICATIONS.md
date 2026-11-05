# 10 : Spécifications de l'API

API REST JSON sous `/api/v1`. Contrats définis ici, puis formalisés en OpenAPI (`backend/openapi.yaml`) et utilisés pour générer le client TypeScript du mobile. Ce sont **nos** contrats : aucune API privée de l'original n'est connue ni utilisée.

## Conventions

- Authentification : `Authorization: Bearer <token Sanctum>` sauf routes publiques.
- Pagination par curseur : `?cursor=…&limit=20` (max 50). Réponse `{ data: [], next_cursor }`.
- Erreurs : `{ "error": { "code": "string", "message": "string", "fields": {…} } }`. Codes HTTP : 400, 401, 403, 404, 409, 422, 429, 5xx.
- Idempotence : en-tête `Idempotency-Key` sur les `POST` qui créent de l'argent, des messages ou des cadeaux.
- Versions : `/v1` ; une rupture crée `/v2`.
- Limites de débit : par route (voir la colonne « limite »), réponse `429` avec `Retry-After`.
- Horodatages ISO 8601 UTC.

## Limites de débit (toutes les routes)

Limites par **compte** et par **appareil** d'abord, par IP seulement en dernier recours (les réseaux mobiles africains partagent des IP en CGNAT). Valeurs initiales, à calibrer :

| zone | limite |
| --- | --- |
| Inscription | 5/h par appareil, 20/h par IP ; contrôle d'âge avant création du compte ; attestation d'appareil (Play Integrity, App Attest) |
| Connexion | 5 échecs / 15 min par (email, appareil) ; critère unique repris dans 03 FR-A-9 et 11 |
| SMS | 3/h par compte, plafond quotidien par pays, alerte sur pic (fraude au trafic) |
| Découverte | 60 requêtes/min par compte |
| Swipes | 120/min, quota journalier gratuit (`daily_counters`) |
| Messages | 30/min par compte, 10 nouvelles conversations/jour (gratuit) |
| Signalements | 20/jour par compte |
| Upload de médias | 20/h par compte, quotas de poids |
| Autres routes authentifiées | 120/min par compte |

## Authentification et comptes (FR-A)

| méthode chemin | rôle | accès | limite | entrée | sortie |
| --- | --- | --- | --- | --- | --- |
| POST /auth/register | créer un compte | public | 5/h/appareil, 20/h/IP | email, mot de passe, **age_token** (de /auth/age-check), consentements | token, user |
| POST /auth/login | se connecter | public | 5/15 min | email, mot de passe, appareil | token, user |
| POST /auth/oauth/{provider} | Google / Apple / TikTok | public | 10/15 min/appareil | code ou jeton d'identité, **age_token** (exigé seulement si le compte n'existe pas ; sinon connexion directe), consentements | token, user |
| POST /auth/email/verify | valider l'email | public | 10/h | jeton | 204 |
| POST /auth/email/resend | renvoyer le lien | user | 3/h | | 204 |
| POST /auth/phone/send | envoyer un code SMS | user | 3/h | numéro | 204 |
| POST /auth/phone/verify | valider le code | user | 5/10 min | code | 204 |
| POST /auth/password/forgot | demande de réinitialisation | public | 3/h | email | 204 (réponse identique si email inconnu) |
| POST /auth/password/reset | nouveau mot de passe | public | 5/h | jeton, mot de passe | 204 |
| POST /auth/logout | révoque le jeton | user | | | 204 |
| GET /auth/sessions | liste des appareils | user | | | sessions |
| DELETE /auth/sessions/{id} | ferme une session | user | | | 204 |
| DELETE /auth/sessions | ferme **toutes** les sessions | user | | | 204 |
| POST /auth/age-check | contrôle d'âge **avant** création du compte | public | 10/h/appareil | date de naissance | `age_token` signé (10 min, contient la date) ou 403 (refus mémorisé par hash) |
| POST /me/consents | enregistre / retire un consentement | user | 30/h | kind, version, granted | 204 |
| POST /account-deletion-requests | demande de suppression **depuis le web** (page publique exigée par les stores, à vérifier) ; confirmation par lien envoyé à l'e-mail du compte | public | 3/h/IP | email | 202 (réponse identique si inconnu) |
| DELETE /me | demande de suppression | user | 1/jour | ré-authentification : mot de passe, ou jeton frais du fournisseur (Apple / Google / TikTok) pour les comptes sociaux | 202 |
| POST /me/export | demande d'export de données | user | 1/jour | | 202 |
| GET /me/export/{id} | état et URL signée | user | | | export |

## Profil (FR-B)

| méthode chemin | rôle | accès | entrée | sortie |
| --- | --- | --- | --- | --- |
| GET /me | profil, préférences, statut Premium, soldes | user | | me |
| PUT /me/profile | créer / modifier le profil | user | champs profil | profil |
| PUT /me/preferences | préférences de recherche | user | préférences | préférences |
| PATCH /me/privacy | masquer profil / distance / dernière connexion | user | booléens | profil |
| POST /media/upload-url | URL présignée (méthode PUT) | user | kind, mime, taille | media_id, url, en-têtes requis |
| POST /media/{id}/complete | fin d'upload | user (propriétaire) | | média |
| PUT /me/media/order | ordonner les photos | user | ids | 204 |
| DELETE /media/{id} | supprimer | user (propriétaire) | | 204 |
| POST /me/verification | lancer une vérification | user | selfie_media_id | demande |
| GET /me/verification | état | user | | demande |
| GET /profiles/{id} | profil d'un autre utilisateur | user (non bloqué) | | profil public |

## Découverte (FR-C)

| méthode chemin | rôle | accès | entrée | sortie |
| --- | --- | --- | --- | --- |
| GET /discover | lot de profils (20) selon filtres | user | âge, pays, origine, intention, vérifié, curseur | profils |
| POST /swipes | like / dislike / super-like | user | target_id, action | `{ matched: bool, match? }` |
| POST /swipes/undo | annuler le dernier dislike | Premium | | profil |
| GET /matches | liste des matchs | user | curseur | matchs |
| DELETE /matches/{id} | rompre le match | user | | 204 |
| POST /blocks | bloquer | user | blocked_id | 204 |
| DELETE /blocks/{id} | débloquer | user | | 204 |
| GET /blocks | liste | user | | blocages |
| POST /reports | signaler (profil, conversation, appel, story) | user | reported_id, reason, details, contexte | 201 |
| GET /me/sanctions | sanctions en cours et motifs | user | | sanctions |
| POST /appeals | contester une sanction | user | sanction_id, message | 201 |
| POST /support/tickets | contacter le support | user | subject, body | 201 |
| GET /support/tickets | mes demandes | user | | tickets |

## Messagerie (FR-D)

| méthode chemin | rôle | accès | entrée | sortie |
| --- | --- | --- | --- | --- |
| GET /conversations | liste | user | curseur | conversations |
| POST /conversations | ouvrir (non-match : consomme un crédit) | user | target_id | conversation |
| GET /conversations/{id}/messages | historique | participant | curseur | messages |
| POST /conversations/{id}/messages | envoyer | participant | client_id, type, body, media_id | message |
| POST /conversations/{id}/read | marquer comme lu | participant | up_to_message_id | 204 |
| POST /conversations/{id}/delivered | accusé de remise | participant | up_to_message_id | 204 |
| POST /conversations/{id}/hide | masquer la conversation (côté soi) | participant | | 204 |
| POST /conversations/{id}/typing | « écrit… » | participant | | 204 |
| DELETE /messages/{id} | supprimer son message | auteur | | 204 |

## Appels (FR-E, phase D)

| méthode chemin | rôle | accès | entrée | sortie |
| --- | --- | --- | --- | --- |
| POST /calls | démarrer un appel (403 si la conversation n'est pas issue d'un match, règle E2) | participant | conversation_id, kind | call, jeton LiveKit |
| POST /calls/{id}/accept | accepter | appelé | | jeton LiveKit |
| POST /calls/{id}/decline | refuser | appelé | | 204 |
| POST /calls/{id}/end | terminer | participant | | 204 |
| POST /calls/{id}/token | renouveler le jeton | participant | | jeton |

Jeton LiveKit : JWT signé par notre serveur, valable 10 minutes, droits limités à la salle `call:<uuid>`.

## Contenus (FR-F)

| méthode chemin | rôle | accès | entrée | sortie |
| --- | --- | --- | --- | --- |
| GET /stories | stories visibles | user | | groupes par auteur |
| POST /stories | publier | user | media_id, visibility, audience | story |
| POST /stories/{id}/view | marquer vue | user | | 204 |
| POST /stories/{id}/react | réagir | user | emoji | 204 |
| GET /stories/{id}/viewers | spectateurs | auteur | | liste |
| DELETE /stories/{id} | supprimer | auteur | | 204 |
| GET /invites | fil des invitations | user | pays, curseur | invitations |
| POST /invites | publier | user | media_id, titre, activité, ville, date | invitation |
| DELETE /invites/{id} | retirer | auteur | | 204 |

## Monétisation (FR-G)

| méthode chemin | rôle | accès | entrée | sortie |
| --- | --- | --- | --- | --- |
| GET /billing/offers | plans et packs disponibles | user | | offres |
| GET /billing/status | abonnement et soldes | user | | statut |
| POST /billing/sync | forcer la synchro après un achat | user | | statut |
| GET /billing/transactions | historique | user | curseur | transactions |
| GET /gifts | catalogue | user | | cadeaux |
| POST /gifts/send | envoyer un cadeau | participant | conversation_id, gift_id, `Idempotency-Key` | message cadeau, solde |

Webhook entrant : `POST /webhooks/revenuecat` (authentification par secret, idempotent via `webhook_events`).

## Notifications

| méthode chemin | rôle | accès | entrée |
| --- | --- | --- | --- |
| PUT /me/device | enregistrer l'appareil et le jeton push | user | plateforme, jeton, version |
| GET/PUT /me/notifications | préférences | user | bascules |

## Administration

Gérée par Filament (pas d'API publique). Les actions sensibles écrivent dans `audit_logs`.

## Canaux temps réel (Reverb)

| canal | type | événements |
| --- | --- | --- |
| `private-user.{id}` | privé | `match.created`, `call.incoming`, `call.cancelled`, `billing.updated`, `sanction.created`, `notification` |
| `private-conversation.{id}` | privé | `message.created`, `message.delivered`, `message.read`, `typing`, `presence`, `call.state` |

Il n'y a **pas** de canal de présence global : la présence d'un contact est publiée sur le canal de leur conversation, selon le réglage « masquer ma dernière connexion ».

Authentification des canaux : `POST /broadcasting/auth` (jeton Sanctum). Le serveur vérifie que l'utilisateur est participant avant d'accepter l'abonnement ; tests d'autorisation obligatoires.

## Totaux

Routes REST : 77 (75 dans les tableaux : 74 lignes dont `GET/PUT /me/notifications` compté pour deux ; plus le webhook RevenueCat et `POST /broadcasting/auth`). Canaux temps réel : 2. Décompte par commande le 2026-11-05.

## Statut

Spécification de conception. Pas de code, pas de fichier OpenAPI, pas de test de contrat pour l'instant.
