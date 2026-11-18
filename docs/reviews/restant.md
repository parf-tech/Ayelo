# Reste à faire : liste unique après les lots 6 à 9, le pentest n°1 et les revues CTO / design

Date : 2026-11-07. Cette liste regroupe tout ce qui reste ouvert, avec le fichier source de chaque point. Elle ne remplace pas les fichiers de suivi : en cas d'écart, le fichier source fait foi. Rien ici n'a été revérifié dans le code sauf mention contraire ; les statuts P-09 à P-14 sont ceux de `pentest-1-suivi.md`.

Légende : B = bloquant pour la bêta fermée, P = bloquant pour le lancement public (classement de `cto-1.md`, section 9). Verdict CTO : NO-GO public, GO conditionnel pour la bêta fermée après les neuf bloquants B (`cto-1.md`, section 9).

## 1. Décision du propriétaire requise

| point | ce qui manque | source |
| --- | --- | --- |
| F-02 attestation d'appareil | l'option B est en place (IPv6 au /64, refus étendu aux identités prouvées) ; l'option C (Play Integrity, App Attest) n'est ni décidée ni faite, risque accepté pour la bêta fermée à confirmer par écrit | `code-security-2-suivi.md` (F-02 résiduel, Q1-B) ; `DECISIONS-PROPRIETAIRE.md` (Q1) ; `specs/001-account-auth/tasks.md` T012 |
| N-12 double contrôle des actions administrateur | seuls les plafonds de 24 h (Q3-B) existent ; le double contrôle des bannissements est à décider dès qu'une deuxième personne a accès au panneau | `code-security-2-suivi.md` (N-12, Q3-B) ; `DECISIONS-PROPRIETAIRE.md` (Q3) ; `pentest-1-suivi.md` (P-15, insiders) |
| F-09 suspension par deux comptes jetables | règle Q2-B conservée ; masquer le profil plutôt que suspendre, ou exiger deux signaleurs crédibles : décision produit | `code-security-2-suivi.md` (F-09 résiduel) ; `pentest-1-suivi.md` (P-02) |
| Budget et organisation de la modération humaine (T009 / T024) | personne désignée, volume, délais publiés, pré-filtre automatique payant ou non, taille maximale de la bêta | `specs/005-safety-moderation/tasks.md` T009 ; `specs/011-launch-readiness/tasks.md` T024 ; `cto-1.md` §9 (n° 10, P / B pour taille réduite) |
| Procédure de signalement aux autorités (T008) | procédure écrite par pays et circuit des preuves, validée par un juriste | `specs/005-safety-moderation/tasks.md` T008 ; `cto-1.md` §9 (n° 11) |
| Matrice juridique par marché | validation RGPD / DSA / Loi 25 / PIPEDA / CCPA / lois africaines ; durées de conservation (365 jours des rapports et motifs de sanction, messages, comptes inactifs, journaux, IP) ; AIPD | `docs/legal/` ; `cto-1.md` §9 (n° 11) ; `code-security-2-suivi.md` (F-06 résiduel) |
| Identifiants d'application définitifs | identifiant `com.hco.ayelo` posé dans `app.json` (fait le 2026-11-07, définitif à la première publication) ; reste : projet EAS (`extra.eas.projectId`) ; nom « Ayelo » conservé (décision du 2026-11-08) ; reste la recherche d'antériorité (AILO) avant publication, achat de domaine ou dépôt de marque | `cto-1-suivi-mobile.md` (reste 1) ; `DECISIONS-PROPRIETAIRE.md` (nom) ; `cto-1.md` §9 (n° 16) |
| Architecture des notifications iOS (APNs / FCM) | le serveur envoie via FCM HTTP v1 mais le jeton iOS est un jeton APNs : soit SDK Firebase Messaging côté client iOS, soit envoi APNs direct depuis le serveur | `cto-1-suivi-mobile.md` (reste 3) |
| Appels dans la promesse de lancement | retirer les appels ou financer le prototype D0 sur appareils réels | `cto-1.md` §9 (n° 14) ; `specs/011-launch-readiness/tasks.md` T026 |
| Valeurs à confirmer | quotas de médias par type (F-22), minimum de mot de passe 10 ou 12 (F-18), `MEDIA_AUTO_APPROVE=false` en production, budget d'infrastructure à 10 000 actifs, hébergeur et région | `code-security-2-suivi.md` (F-22, F-18) ; `cto-1.md` §9 (décisions 2, 8, 9) |
| Comptes de boutiques | Apple Developer, Google Play, test fermé de 14 jours, fiches et étiquettes de confidentialité, classement d'âge | `cto-1.md` §9 (n° 13) ; `DECISIONS-PROPRIETAIRE.md` (D5) |

## 2. Service externe, serveur ou appareil réel requis

| point | ce qui manque | source |
| --- | --- | --- |
| Reverb sur appareil | connexion WebSocket réelle jamais établie ; en-tête `Origin` envoyé par iOS (SocketRocket) non vérifié ; `REVERB_ALLOWED_ORIGINS` doit contenir `REVERB_HOST` | `code-security-2-suivi.md` (Lot 10, F-17) ; `cto-1.md` §9 (n° 7) |
| R2 (stockage objet) | jamais exécuté ; `media.sign_upload_headers` à essayer sur le vrai bucket avant activation ; `MediaStorage::listObjects` (balayage des orphelins) non exercé ; plafond de taille (R2 n'en offre pas par bucket : seule la présignature liée le borne) ; **pas de règle de cycle de vie sur `u/`** (dépôts en attente et médias approuvés y partagent le préfixe : elle effacerait les photos des membres ; seulement sur `exports/`, après 8 jours : `runbooks/deploiement.md`) ; `head()` corrigé le 2026-11-18 (404 seulement), délais et nouvelles tentatives du client S3 posés (passe du 2026-11-18, `backend.md`) | `pentest-1-suivi.md` (P-07) ; `code-security-2-suivi.md` (N-14) ; `cto-1-suivi.md` (3.1) |
| FCM | envoi réel jamais exécuté ; `google-services.json` et clé de compte de service ; clé APNs | `cto-1-suivi-mobile.md` (restes 2, 3) |
| LiveKit | `DeleteRoom` (Twirp, URL `wss://` convertie en `https://`) non testé contre un serveur ; aucun appel établi ; moteur média non installé côté mobile | `code-security-2-suivi.md` (Lot 7, F-14) ; `cto-1-suivi-mobile.md` (reste 7) |
| RevenueCat | format des événements supposé (ADR 002), aucun événement réel reçu ; recette d'achat en bac à sable | `docs/16-STATUS.md` ; `cto-1.md` §9 (n° 7) |
| Google / Apple OAuth | vérification testée avec des clés locales, pas avec les vrais JWKS ; envoi du `nonce` par le mobile puis `OAUTH_REQUIRE_NONCE=true` ; jeton d'identité neuf à chaque connexion | `code-security-2-suivi.md` (F-21) ; `pentest-1-suivi.md` (P-06) |
| E-mail délivré | SPF / DKIM / DMARC, mail-tester, boîte de réception chez Gmail et Outlook | `docs/runbooks/email-dns.md` ; `cto-1.md` §9 (n° 7) |
| Restauration PostgreSQL | exercice chronométré avec procès-verbal signé, clé GPG hors serveur, copie hors site, alerte d'échec | `docs/runbooks/restauration.md` ; `cto-1.md` §9 (n° 2) ; `cto-1-suivi.md` (3.2) |
| Caddy et Docker | `docker compose config`, `caddy validate`, construction de l'image, `php-fpm -tt`, healthchecks `pgrep`, deux Redis, CSP dans un navigateur, liste d'IP du panneau, `ADMIN_DOMAIN` renseigné ; `reverb` avec sa liste explicite de variables (P-08) ; premier déploiement de préproduction ; première exécution de `ci.yml` | `cto-1-suivi.md` ; `pentest-1-suivi-infra.md` ; `cto-1.md` §9 (n° 1) |
| gitleaks | exécuté seulement par la CI (workflow `schema`) ; à rejouer sur l'historique du commit final | `code-security-2-suivi.md` (Preuves d'exécution) |
| Appareil réel et recette | build natif (EAS), notification push reçue, VoiceOver / TalkBack / Dynamic Type, parcours Maestro, liens universels, `expo-dev-client` | `cto-1-suivi-mobile.md` ; `design-1-suivi.md` ; `cto-1.md` §9 (n° 6, 8) |
| Charge et supervision | test k6 (découverte, messages, upload), `EXPLAIN ANALYZE` sur 200 000 profils, Sentry (serveur et mobile), sonde externe, alertes | `cto-1-suivi-perf.md` ; `cto-1-suivi.md` ; `docs/runbooks/observabilite.md` |
| Suite Pest complète | la suite tourne maintenant sur ce poste (PostgreSQL local, port 54330) : voir le dernier total dans `code-security-2-suivi.md` (Lot 11) ; à rejouer aussi en CI | `docs/16-STATUS.md` |
| Épinglage des images Docker | `caddy`, `postgres`, `redis`, `composer`, `php`, `gitleaks`, `hadolint` non épinglés par condensat ; `.github/dependabot.yml` (écosystème `github-actions`, `docker`) absent | `pentest-1-suivi-infra.md` |

## 3. Code encore à écrire

| point | détail | source |
| --- | --- | --- |
| P-09 | FAIT (Lot 12) : suspension et bannissement affichent « Ce motif est communiqué à l'utilisateur » (aide du champ, clés `admin.field.reason_visible_hint` fr/en). Aucun champ de note interne séparé n'existe (la table `sanctions` n'a qu'un `reason`) : seul le libellé a été ajouté ; un second champ reste possible. Test `Lot12ConversationsTest` | `pentest-1-suivi.md` ; `pentest-1.md` P-09 (`ViewMember.php`, `SanctionController.php`) |
| P-10 | rattacher `context_id` du signalement au couple signaleur / cible | `pentest-1-suivi.md` ; `ReportController` |
| P-11 | relire le JWKS une seule fois sur `kid` inconnu | `pentest-1-suivi.md` ; `JwtOAuthVerifier` |
| P-12 | liens profonds mobiles permissifs (schéma `ayelo://`) | `pentest-1-suivi.md` ; `mobile/` |
| P-13 | environnement minimal pour l'enfant `MediaSanitizerProcess` (il hérite des secrets de PHP-FPM) | `pentest-1-suivi.md` ; `code-security-2-suivi.md` (Lot 8, reste 1) |
| P-14 | `LOG_CHANNEL` / `LOG_LEVEL` en production (reste) ; identifiants plutôt que textes dans les tâches de file : fait pour `SendPush` (Lot 12, la tâche d'un message porte `messageId`, le corps est construit à l'envoi) | `pentest-1-suivi.md` ; `infra/` |
| Mise à jour de `last_seen_at` | écrite seulement à la connexion ; ajouter une écriture limitée à une par heure (middleware), faute de quoi le filtre de fraîcheur de la découverte (`DISCOVERY_ACTIVE_WITHIN_DAYS`, désactivé par défaut) exclut à tort | `cto-1-suivi-perf.md` (Reste à faire) ; `DiscoveryQuery.php` |
| Liste des conversations | FAIT (Lot 12) : pagination par curseur (`limit` 1-100, défaut 100 ; `cursor` opaque `horodatage|uuid`, 422 si invalide ; `meta.next_cursor`), mobile en défilement infini. Reste : `last_message_preview` et compteur stockés sur `conversations` ; table de soldes `credit_balances` | `cto-1-suivi-perf.md` ; `ConversationController::index` |
| Régénération de `docs/openapi.json` | documenter : 409 `media_retained` sur `DELETE /media/{id}` (P-04), `active_within_days` sur `GET /discover`, mot de passe (ou `provider`, `id_token`, `nonce`) sur `POST /me/export` (F-20), 409 `push_token_in_use`, 422 `pose_expired` / `selfie_before_pose`, 403 `conversation_closed`, 429 `call_limit` ; puis régénérer les types du mobile et retirer le type écrit à la main `ExportRequest` | `pentest-1-suivi.md` (P-04) ; `cto-1-suivi-perf.md` ; `code-security-2-suivi.md` (F-20, F-28, F-14) ; `design-1-suivi.md` | (Lot 11 : `docs/openapi.json` régénéré, formes de `GET /conversations`, `POST /conversations`, `GET /discover`, `GET /matches`, `DELETE /me` et `POST /me/export` restaurées par des annotations `@body` ; à rejouer après toute réécriture de contrôleur)
| Mot de passe de l'export côté contrat | voir ligne précédente ; le mobile envoie déjà le mot de passe | `design-1-suivi.md` (Ajout hors revue) |
| Webhooks de rebond d'e-mail | code fait (Lot 12) : table `email_suppressions`, `POST /api/v1/webhooks/mail` (Postmark, Resend), `AccountMail` ignore les adresses supprimées ; reste : définir `MAIL_WEBHOOK_SECRET`, brancher le webhook chez le prestataire et le tester (Resend ne permet probablement pas d'en-tête secret : relais ou vérification Svix à ajouter) ; `AccountController::requestWebDeletion` envoie encore `AccountDeletionMail` directement : le faire passer par `AccountMail::sendAccountDeletion` | `docs/runbooks/email-dns.md` (section 5 bis) |
| Archivage WAL / restauration à un instant donné | la sauvegarde logique couvre 24 h seulement, copie locale sur le même serveur, médias R2 non versionnés | `cto-1-suivi.md` (3.2) |
| `onQueue('realtime')` / `onQueue('push')` | fait pour la fermeture des salles LiveKit (`CloseCallRoom`, file `realtime`, Lot 11) et pour `SendPush` (file `push`, Lot 12) ; reste : `ShouldBroadcastNow` pour les messages, ; le worker `push` de `docker-compose.prod.yml` existe déjà (`--tries=3 --backoff=10` y sont écrasés par `$tries` et `backoff()` de la tâche) | `cto-1-suivi.md` (2.3) |
| `SendPush` | fait (Lot 12) : 5 essais, délais 10 s / 1 min / 5 min / 15 min, réessai sur 5xx / 429 / délai dépassé (`RetryablePushException`), `ShouldBeUnique` + mémoire des appareils déjà notifiés, jeton effacé sur 404 / `INVALID_ARGUMENT` ; jamais exécuté contre le vrai FCM | `cto-1-suivi.md` (2.3) ; `cto-1.md` §9 (n° 4) |
| Ré-encodage d'images | toujours dans la requête (ou en processus enfant) ; file dédiée ou second pool | `cto-1-suivi.md` (2.2) |
| Curseur de découverte | `DiscoveryController::decode` accepte tout ce que `strtotime` comprend ; durcir comme le curseur des messages (F-24) | `code-security-2-suivi.md` (F-24) |
| Inscription par formulaire squattée | un compte jamais vérifié bloque l'inscription par formulaire de l'adresse ; purge après N jours sans activité | `pentest-1-suivi.md` (P-01) ; `code-security-2-suivi.md` (F-30) |
| Mobile : consentements et suppression | date de naissance avant les consentements (machine d'états d'inscription) ; annulation de suppression par reconnexion non implémentée côté backend (le texte renvoie au support) ; révocation du jeton Apple à la suppression ; filtre de texte | `design-1-suivi.md` (P1-2, P1-3) ; `cto-1.md` §9 (n° 12) |
| Mobile : paywall et accessibilité | montant par mois des offres de 3 et 12 mois ; interrupteur cliquable en entier ; P1-5, P1-7, P1-8 non traités ; clés de traduction mortes ; `RECORD_AUDIO` déclaré sans usage | `design-1-suivi.md` ; `cto-1-suivi-mobile.md` (reste 7) |
| Back-office | attribution des signalements (colonne `assigned_to`), regroupement des doublons, bandeau d'environnement, `Accept-Language`, extrait de conversation (volontairement absent) | `design-1-suivi-admin.md` (Reporté) |
| Divers infra / CI | stratégie de migration sans interruption et script de déploiement ; (garde `APP_DEBUG=true` en production : faite, voir `reviews/stabilisation-finale.md`) ; PgBouncer ; seuil de couverture ; Larastan permanent ; audit npm bloquant sur « high » ; schéma `docs/schema/001_initial.sql` à aligner sur la migration de la date de naissance (F-06) | `cto-1-suivi.md` ; `code-security-2-suivi.md` (F-06) |

## 4. Troisième relecture

Troisième relecture ciblée de N-01 / N-02 (S9) : non faite (`code-security-2-suivi.md`, Preuves d'exécution).

## 5. Lot 11 (relectures) : points restants

Voir `code-security-2-suivi.md`, section « Lot 11 (relectures) ».

- En production, `SAFETY_STATE_STORE=state` doit être défini (`infra/.env.prod.example`) : sans lui, le jeton d'âge à usage unique, le compteur de ré-authentification et la consigne de pose restent dans le cache évincable. Vérifier en préproduction que la connexion Redis `default` (noeviction) répond (la sonde `/health` la contrôle quand le magasin est sur Redis).
- Un worker `realtime` doit tourner (`--queue=realtime,default`, déjà dans `docker-compose.prod.yml`) : sans lui, la fermeture des salles LiveKit attend dans la file.
- Conversation : la collision d'idempotence du crédit sans conversation renvoie 409 `conversation_conflict` ; si elle se reproduit en production (ligne `credit_ledger` orpheline), enquêter plutôt que rejouer.
- Mobile : `POST /conversations` peut maintenant répondre 403 `conversation_closed` (conversation existante bloquée, archivée ou compte suspendu) et 409 `conversation_conflict` ; le contrat ne documente pas le 403 (levé par exception), l'écran doit traiter toute erreur.
