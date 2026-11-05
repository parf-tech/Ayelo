# 08 : Architecture logicielle

Dépend de `adr/001-stack-evaluation.md` (statut : accepté le 2026-11-05).

## Vue d'ensemble

```
 App Expo (iOS/Android)
   │  HTTPS REST (/api/v1)           WebSocket (Reverb)         WebRTC (LiveKit)
   ▼                                    ▼                           ▼
 Caddy (TLS) ─► Laravel 12 (php-fpm/Octane)    Reverb              LiveKit (hébergé à part)
                   │   │                          │                    ▲
                   │   └── Redis (cache, files, rate limit, présence)   │ jeton éphémère
                   ▼                                                    │
              PostgreSQL ◄── Horizon workers (jobs) ───────────────────┘
                   │
                   └── Cloudflare R2 (photos, vidéos, vocaux) via URL présignées
 Filament (admin) : même application Laravel, sous-domaine séparé + 2FA
 Services externes : RevenueCat, FCM/APNs, fournisseur email, SMS, modération d'images
```

## Structure du dépôt (monorepo)

```
chat-yamo-replica/
  docs/                 documentation (ce dossier)
  replica/              recon, matrice de fonctions, archive
  backend/              Laravel 12 (API, Reverb, Filament, jobs)
  mobile/               Expo + TypeScript
  infra/                Docker Compose, Caddyfile, scripts de sauvegarde
  .github/workflows/    CI/CD
```

Propriété des dossiers (un agent = un périmètre, pas d'édition concurrente d'un même fichier) :

| dossier | agent propriétaire |
| --- | --- |
| `docs/` | REA Analyst, Architect (par fichier, voir 15) |
| `backend/app`, `backend/database`, `backend/routes` | Backend Engineer |
| `backend/app/Realtime`, `backend/config/reverb.php`, livekit | Realtime Engineer |
| `backend/app/Filament` | Backend Engineer |
| `backend/app/Security`, politiques, rate limits | Security Engineer |
| `mobile/src/ui`, `mobile/src/theme` | UI/UX Architect |
| `mobile/src/features`, `mobile/app` | Mobile Engineer |
| `backend/tests`, `mobile/__tests__`, `.maestro/` | QA Engineer |
| `infra/`, `.github/` | DevOps Engineer |
| `docs/adr/` | Architect, relu par Independent Reviewer |

## Modules du backend (monolithe modulaire)

Les noms de tables sont ceux de `schema/001_initial.sql` (source de vérité, 36 tables). Ce tableau est dérivé du schéma.

| module | rôle | tables principales |
| --- | --- | --- |
| Auth | inscription, connexion, sessions, consentements, vérifications | users, user_consents, auth_identities, devices, verification_codes, banned_identifiers, notification_prefs |
| Profiles | profils, préférences, médias, vérification | profiles, preferences, media, verification_requests |
| Discovery | candidats, swipes, matchs, quotas | swipes, matches, daily_counters |
| Messaging | conversations, messages, accusés | conversations, messages (pièces jointes via `media_id`) |
| Calls | sessions d'appel, jetons LiveKit | call_sessions |
| Stories | stories, vues, réactions | stories, story_audience, story_views (réaction dans `story_views.reaction`) |
| Invites | invitations vidéo | video_invites |
| Billing | abonnements, crédits, cadeaux, webhooks | subscriptions, credit_ledger, gifts, gift_sends, purchases, webhook_events |
| Safety | blocages, signalements, scores de risque, sanctions, contestations | blocks, reports, risk_events, sanctions, appeals |
| Support | tickets, exports de données | support_tickets, data_exports |
| Admin | Filament, personnel, journal d'audit | staff_users, audit_logs |

Règle : un module n'accède pas directement aux tables d'un autre module pour **écrire** ; il passe par ses services. Les **lectures** transversales (découverte, Filament) passent par des requêtes ou vues en lecture dédiées et documentées.

## Autorisation

- **Politiques Laravel** (Policy) sur chaque modèle ; aucune route sans middleware d'authentification sauf inscription, connexion, contrôle d'âge et webhooks (authentifiés par secret).
- Toute requête filtre par l'identité du jeton, jamais par un identifiant fourni par le client.
- Les canaux Reverb privés vérifient l'appartenance à la conversation.
- Filament : rôles (modérateur, support, admin), 2FA, journal d'audit.

## Temps réel

| usage | technologie |
| --- | --- |
| Messages, accusés, « écrit… », présence | Reverb (canaux privés par conversation ; présence calculée côté serveur) |
| Signalisation d'appel, app ouverte | Reverb (`call.incoming`, `call.state`) |
| Appel entrant, app fermée | **iOS** : push VoIP (PushKit) qui déclenche CallKit ; il faut envoyer ce push directement à APNs (jeton `devices.voip_push_token`), FCM et Expo Notifications ne le font pas. **Android** : push FCM à priorité haute + `ConnectionService` / notification d'appel plein écran. Module natif via config plugin Expo. À valider par le prototype D0 |
| Média audio/vidéo | LiveKit (jeton JWT éphémère, 10 min, par salle `call:<uuid>`) ; limites : 20 min, 480p par défaut |
| Notifications hors app (messages, matchs) | FCM (Android), APNs via FCM (iOS) |
| Présence | calculée côté serveur (clé Redis avec TTL), exposée uniquement aux contacts autorisés (matchs non bloqués). Pas de canal de présence global : il permettrait d'énumérer les membres |
| Authentification des canaux | `POST /broadcasting/auth` (Sanctum) ; le serveur vérifie la participation à la conversation |

## Médias

1. L'app demande une URL présignée (`POST /media/upload-url`).
2. L'app envoie directement le fichier vers R2.
3. L'app confirme (`POST /media/{id}/complete`).
4. Un job vérifie par `HEAD` la taille réelle, le type MIME réel et la durée, puis transcode (ffmpeg) vers 2 à 3 qualités (240p, 360p, 480p), génère la miniature, appelle la modération, puis passe le média en `approved` ou `rejected`.
5. Les URL de lecture sont signées et courtes.

Règles de sûreté (relecture indépendante, MAJ-25) :
- Utiliser des **PUT présignés** courts (5 min) avec la taille attendue ; R2 ne permet pas de politique de formulaire POST (à vérifier dans la documentation Cloudflare).
- Règle de cycle de vie R2 : supprimer les objets `pending_upload` de plus de 24 h.
- Quotas par utilisateur (nombre et poids total de médias).
- `ffmpeg` s'exécute dans un conteneur sans accès réseau, avec limites CPU, mémoire et durée, car il traite des fichiers non fiables.
- Mode économie de données dans l'app (qualité 240p/360p par défaut sur réseau mobile lent).

## Observabilité

Journaux structurés (JSON), Sentry (app + backend), métriques (Prometheus ou Netdata), alertes sur taux d'erreur, longueur des files, échecs de webhooks, espace disque, sauvegardes.

## Déploiement

Voir `14-DEPLOYMENT.md`.

## Authentification et sessions (décision en attente d'ADR 006)

Implémenté (2026-11-05) : jetons Sanctum d'expiration **fixe** de 30 jours (`SANCTUM_EXPIRATION=43200` minutes), un jeton par appareil ; l'expiration glissante n'est pas implémentée (décision de l'ADR 006), lié à `devices.token_id`. Pas de paire access/refresh écrite à la main en V1. Routes : liste des sessions, fermeture d'une session, fermeture de **toutes** les sessions. La compromission d'un jeton est limitée par la révocation et la détection d'usage anormal.

## Décisions à consigner en ADR

| ADR | sujet | statut |
| --- | --- | --- |
| 001 | Évaluation de la stack | accepté (2026-11-05) |
| 002 | Paiements via stores et RevenueCat | à écrire |
| 003 | Monolithe modulaire Laravel | à écrire |
| 004 | Hébergement séparé de LiveKit | à écrire |
| 005 | Modération des médias (prestataire ou modèle) | à écrire |
| 006 | Authentification (Sanctum, jetons, appareils) | à écrire |

## Risques techniques

1. Reverb sur un seul serveur : point de défaillance unique en V1.
2. Compilation iOS : dépend d'EAS Build et des certificats Apple.
3. Les appels mobiles en arrière-plan (CallKit / ConnectionService) sont complexes avec Expo : prévoir un prototype dédié avant de s'engager sur la phase D.
4. Modération d'images : choisir un fournisseur et vérifier son coût et la conformité des données.
