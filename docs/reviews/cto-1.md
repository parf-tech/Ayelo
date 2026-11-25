# Revue CTO n°1 : due diligence technique avant lancement

Date : 2026-11-07. Périmètre : dépôt `chat-yamo-replica` au commit `392550c` plus les modifications non commitées présentes dans l'arbre de travail au moment de la lecture (d'autres agents éditent en parallèle : `MessageController`, `ConversationController`, `infra/.env.prod.example` ont changé pendant la revue). Lecture seule : aucun code modifié, aucune exécution contre un serveur. Commandes exécutées : lectures de fichiers, `git log`, `npm outdated`, `npm audit --omit=dev`, analyse du `composer.lock`, comparaison des variables `env()` du code avec les deux gabarits `.env`.

Les points déjà connus et listés dans `docs/16-STATUS.md` (section « Non vérifié »), `specs/011-launch-readiness/tasks.md` et `docs/DECISIONS-PROPRIETAIRE.md` ne sont pas répétés sauf quand l'état affiché sous-estime le risque. Un constat est marqué **[nouveau]** s'il n'apparaît dans aucun de ces documents.

## 1. Verdict

**NO-GO pour un lancement public. GO conditionnel pour une bêta fermée de quelques centaines d'utilisateurs** après les correctifs de la section 7 (bloquants B1 à B8).

Le backend est sérieux : isolation des modules, verrous consultatifs pour les matchs, idempotence des webhooks et des messages, trigger SQL sur la date de naissance, journaux expurgés, documents juridiques honnêtes sur leur statut. Le dossier de statut est franc sur ce qui n'a jamais tourné. Le problème n'est pas la qualité du code écrit, c'est l'écart entre « code écrit et testé avec des faux » et « système qui fonctionne » :

- l'application mobile ne peut ni recevoir de notification push, ni passer un appel, ni être compilée pour un store en l'état (voir 3.3) ;
- l'infrastructure (Docker, Caddy, sauvegarde, restauration, Redis, Reverb, R2, FCM, RevenueCat, LiveKit) n'a jamais été exécutée une seule fois ;
- aucune supervision n'existe dans le code (ni suivi d'erreurs, ni métriques, ni alerte), alors que la doc la déclare prévue ;
- le plus gros poste de coût et de risque, la modération humaine, n'a ni budget ni personne.

## 2. Architecture et passage à l'échelle

### 2.1 Chemins chauds : requêtes et index

| constat | preuve | impact | correctif |
| --- | --- | --- | --- |
| **[nouveau]** Liste des conversations : une requête « dernier message » par conversation (jusqu'à 100) puis un `count(*)` de non lus qui parcourt tous les messages non lus de chaque conversation. Pas d'index partiel sur `read_at is null`. | `ConversationController.php:41` (boucle), `:36` (agrégat) ; index existant `messages (conversation_id, created_at desc)` seulement (`docs/schema/001_initial.sql:268`) | écran Messages = 100+ requêtes ; coût croissant avec l'historique. Écran le plus ouvert de l'application. | une requête `distinct on (conversation_id)` ou `lateral` pour le dernier message ; index `messages (conversation_id) where read_at is null and deleted_at is null` ; stocker `last_message_preview` et un compteur sur `conversations` |
| **[nouveau]** Présentateur de profil : une requête `media` par profil, plus signature S3 par photo. Une page de découverte (jusqu'à 50) ou de conversations (100) fait 20 à 100 requêtes supplémentaires. | `ProfilePresenter.php:56` appelé en boucle depuis `DiscoveryController.php:62` | N+1 classique, visible dès 1 000 utilisateurs actifs | précharger `media` en une requête groupée (`whereIn user_id`) |
| **[nouveau]** `GET /me` : trois `sum(delta)` sur `credit_ledger` plus un `exists` d'abonnement à chaque démarrage d'application. Le registre croît sans borne. | `ProfilePresenter.php:25` ; `Conversations.php:40` | lent à terme pour les gros acheteurs de crédits | table de soldes (`credit_balances`) tenue dans la même transaction que l'insertion du registre |
| Découverte : tri `profiles.created_at desc, id desc` sans index correspondant ; les index existants sont mono-colonne (`origin_country`, `residence_country`, `intent`, `(is_visible, verification_status)`). Anti-jointures `not exists` sur `swipes` et `blocks` (bien indexées par les clés uniques). | `DiscoveryQuery.php:20-31`, `DiscoveryController.php:49` ; index `001_initial.sql:137-140` | acceptable à 10 000 profils ; à 100 000 avec filtres étroits et un utilisateur qui a déjà beaucoup swipé, le planificateur choisit entre tri de milliers de lignes et balayage séquentiel de l'ordre chronologique. Mesure requise (`EXPLAIN ANALYZE` sur jeu de 200 000 profils). | index partiel `profiles (created_at desc, id desc) where is_visible`, index sur `users (status, birthdate)` ; filtre « actif depuis N jours » |
| **[nouveau, produit]** Découverte triée uniquement par date d'inscription, sans filtre d'activité : les profils inactifs et les derniers inscrits dominent la pile ; aucune notion de distance. Risque de rétention (« personne ne répond ») dès que la base compte des comptes dormants. | `DiscoveryController.php:49` ; `users.last_seen_at` existe mais n'est ni filtré ni indexé et n'est mis à jour qu'à la connexion (`LoginController.php:89`) | qualité perçue du produit | `last_seen_at` mis à jour (limité à 1 écriture par heure) et filtre de fraîcheur |
| Pagination par curseur correcte pour découverte et messages (`(created_at, id) < (?, ?)`, plafonds 50 et 100). La liste des conversations n'est pas paginée (plafond dur à 100, les plus anciennes deviennent inaccessibles). | `DiscoveryController.php:53`, `MessageController.php:index`, `ConversationController.php:31` | limite fonctionnelle | curseur sur `coalesce(last_message_at, created_at)` |
| Swipes : verrou consultatif par paire, `insertOrIgnore`, événement après commit. Conception solide. Le test de concurrence réelle n'existe pas (T006 ouvert). | `SwipeService.php:21-60` | correct sur le papier | test avec deux connexions réelles |
| Bonne pratique à conserver : unicité `(swiper_id, target_id)`, `(conversation_id, sender_id, client_id)`, `(user_a < user_b)` appliquées en base. | schéma | | |

### 2.2 Travail synchrone dans les requêtes web

**[nouveau, élevé]** `POST /media/{id}/complete` télécharge l'objet (jusqu'à 8 Mo) depuis R2, lance un sous-processus PHP pour ré-encoder l'image (délai 10 s) puis réécrit l'objet, le tout dans la requête HTTP (`MediaController.php:117`, `MediaSanitizerProcess.php:23`, `config/media.php:49`). L'image PHP-FPM n'a aucun fichier de pool : `infra/php/Dockerfile` et `infra/php/php.ini` ne règlent ni `pm.max_children` ni `pm.max_requests`. Les valeurs par défaut de l'image officielle (à vérifier au premier démarrage) donnent environ 5 processus. Cinq inscriptions simultanées avec photos peuvent donc saturer toute l'API, et l'inscription exige des photos. Correctifs : fichier de pool dimensionné (RAM / 60 Mo par processus), file dédiée pour le ré-encodage, ou au minimum un second pool FPM pour les routes média.

### 2.3 File d'attente, Redis, temps réel

| constat | preuve | impact |
| --- | --- | --- |
| **[nouveau, élevé]** Redis sert à la fois de file de tâches, de cache, de compteurs de limitation de débit et de session, avec `maxmemory-policy allkeys-lru` et `appendonly no`. Sous pression mémoire, Redis peut évincer des listes de la file (tâches perdues sans trace) ; au redémarrage, toute la file, les compteurs et les états « appareil de confiance » sont perdus. | `infra/docker-compose.prod.yml:95` ; `.env.prod.example` (`QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`) | pushes, diffusions temps réel, exports RGPD (`BuildDataExport`) perdus silencieusement. Correctif : `noeviction` pour la file ou deux instances (file en `noeviction` + AOF, cache en LRU), ou garder la file en base PostgreSQL au lancement (`QUEUE_CONNECTION=database`, déjà supporté). |
| **[nouveau]** Un seul processus `queue:work` pour tout : événements de diffusion (`ShouldBroadcast` passe par la file), pushes FCM (délai 5 s par requête, par appareil), exports. Aucune file séparée. Latence temps réel dépendante du plus lent des travaux. | compose `:61` ; `MessageCreated.php` (`ShouldBroadcast`, pas `ShouldBroadcastNow`) | un FCM lent retarde l'arrivée des messages en direct. Correctif : files `realtime`, `push`, `default` avec workers dédiés ; `ShouldBroadcastNow` pour les messages. |
| **[nouveau]** `SendPush` : pas de `backoff`, pas de `$tries` propre ; les erreurs réseau relancent la tâche entière et renvoient la notification aux appareils déjà servis (doublons). Sur réponse 5xx ou 429 de FCM, `send()` renvoie `true` : la notification est perdue sans réessai. Un `400 INVALID_ARGUMENT` supprime le jeton de l'appareil même si le défaut vient de la charge utile. | `FcmPushNotifier.php:22,35,39`, `SendPush.php` boucle sur les appareils | fiabilité des notifications ; efface des jetons valides |
| `schedule:work` dans un seul conteneur ; `accounts:purge` (03:15) boucle sur tous les comptes dus avec appels à R2 dans le même passage que `calls:expire` et `sanctions:expire` (chaque minute). Un purge long retarde les appels manqués. Acceptable à 10 000, à surveiller à 100 000. | `routes/console.php:12,18` | |
| Reverb : un seul processus, `REVERB_SCALING_ENABLED` absent du gabarit de production, aucune limite de descripteurs de fichiers (`ulimit`) ni `REVERB_APP_MAX_CONNECTIONS`. Un processus Reverb tient typiquement quelques milliers de connexions selon le CPU ; à 10 000 utilisateurs actifs par mois, 300 à 1 000 connexions simultanées en pointe est réaliste et passe. À 100 000, il faut Redis pub/sub activé et au moins deux instances. | `config/reverb.php` (scaling `false` par défaut), compose `reverb:` | à mesurer avec un test de charge WebSocket |
| Cache : `CACHE_STORE=database` dans `backend/.env.example` (utilisé par la CI) contre `redis` en production. Les chemins `Cache::add` atomiques (jeton d'âge à usage unique, `AgeGate.php:156`) et les limiteurs ne sont donc jamais testés sur Redis. | `.env.example`, `.github/workflows/backend.yml` | |
| Pas de pooler de connexions (PgBouncer) ; `max_connections` par défaut 100 avec FPM + workers + Reverb + scheduler. Sans réglage, la saturation arrive avant la CPU. | compose `postgres:` sans paramètres | |
| Presigned GET de 10 minutes pour chaque photo (`media.read_ttl_minutes = 10`) : l'URL change à chaque appel, le cache d'images du téléphone et tout CDN sont contournés. Coût R2 en opérations et latence. | `config/media.php`, `ProfilePresenter.php:78` | voir 4. Correctif : domaine R2 personnalisé avec cache Cloudflare et URL stable ou cookies signés pour les photos approuvées. |

## 3. Fiabilité

### 3.1 Dépendances externes : modes de panne

| service | état dans le code | trou |
| --- | --- | --- |
| R2 / S3 | client AWS sans délai d'attente explicite ni nombre de reprises configuré ; `head()` avale toute `AwsException` et renvoie `null` (une panne R2 ressemble à « objet absent ») ; `delete()` lève l'exception (repris par les balayages) | une panne R2 transforme des uploads valides en rejets. Fixer `http.timeout` / `connect_timeout` et `retries`. Faux stockage en mémoire seul testé. |
| FCM | délai 5 s, jeton OAuth mis en cache 50 min, `INVALID_ARGUMENT` traité comme jeton mort | voir 2.3. Jamais exécuté. Côté mobile, aucun code n'enregistre le jeton (3.3). |
| LiveKit | fermeture de salle protégée (délais 2 s / 3 s, erreur journalisée) ; émission de jetons locale | bonne conception ; média côté mobile absent |
| RevenueCat | webhook idempotent, ordre par `last_event_ms`, sandbox ignoré en production, rejeu des utilisateurs inconnus toutes les 15 min | types d'événements « à confirmer » dans le code même (`RevenueCatProcessor.php`, commentaire d'en-tête). Événements non gérés (`TRANSFER`, etc.) tombent dans `default => true` sans trace. Aucun événement réel jamais reçu. |
| E-mail | SMTP via Laravel, envoi en file | la file perdue ou saturée = pas d'e-mail de vérification, donc pas d'inscription. Pas de procédure de rejeu. Délivrabilité (SPF/DKIM/DMARC) documentée mais non réalisée (`docs/runbooks/email-dns.md`). |
| OAuth Google / Apple | JWKS en cache 1 h, délai 5 s | si l'URL JWKS tombe et que le cache est vide, connexions sociales en échec ; acceptable |

### 3.2 Migrations, sauvegardes, observabilité

- **Migrations.** La migration initiale exécute `docs/schema/001_initial.sql` (`create_initial_schema.php`) : bien pour la parité avec les tests, mais toute correction ultérieure du schéma doit passer par une nouvelle migration, jamais par une édition de ce fichier (les deux migrations de novembre 7 le font correctement). **[nouveau]** Aucune règle ni test CI ne l'impose : un développeur qui édite `001_initial.sql` fera diverger la production sans erreur visible. Ajouter un test qui compare le schéma issu des migrations au fichier, ou geler le fichier. Aucune stratégie de migration sans interruption n'est écrite : qui lance `php artisan migrate --force` au déploiement, avant ou après le basculement des conteneurs, comment créer un index sans verrou (`create index concurrently` hors transaction). Les futurs index recommandés plus haut doivent utiliser `concurrently`. Aucun script de déploiement ni workflow de déploiement n'existe.
- **Sauvegardes** (`infra/scripts/backup.sh`, `restore.sh`) : le contenu est soigné (format custom, vérification de l'archive, SHA-256, garde-fous de restauration). Limites : sauvegarde logique quotidienne uniquement, donc perte potentielle de 24 h (pas d'archivage WAL ni de restauration à un instant donné) ; copie locale sur le même serveur ; sans `BACKUP_GPG_RECIPIENT` les archives (toutes les données personnelles) partent **en clair** dans le bucket et rien n'impose le chiffrement ; la clé publique n'est pas câblée dans le compose (`BACKUP_GPG_PUBLIC_KEY_FILE` absent) donc activer le chiffrement fait échouer la sauvegarde ; le bucket de sauvegarde et les médias R2 ne sont pas versionnés (une suppression accidentelle de médias est définitive) ; aucune alerte. Le gabarit de production évolue (`BACKUP_ALERT_WEBHOOK_URL`, `BACKUP_MONTHLY_RETENTION_MONTHS` apparaissent pendant la revue) : à relire quand le lot sera commité. Le dossier `infra/backup/` obsolète est toujours présent (risque de confusion). **Restauration jamais exécutée : sans preuve de restauration, il n'existe pas de sauvegarde.**
- **Observabilité. [nouveau]** `docs/14-DEPLOYMENT.md:53-57` annonce Sentry, Uptime Kuma et des alertes ; ni `composer.json` ni `mobile/package.json` ne contiennent de client Sentry ou équivalent ; aucune métrique (Prometheus, Pulse, Horizon). Journaux : `LOG_CHANNEL=stack` avec `single` par défaut et `LOG_LEVEL=debug` absents du gabarit de production, donc un fichier `laravel.log` sans rotation et au niveau debug dans le volume `app-storage` (disque plein tôt ou tard). Le seul signal de panne de file est une ligne `critical` dans ce fichier (`QueueDeadLetterServiceProvider`). Santé : `/api/v1/health` vérifie la base seulement (pas Redis, pas la file, pas Reverb, pas R2) ; le healthcheck du conteneur `app` exécute `php-fpm -t` (test de syntaxe de configuration, pas de liveness) ; `worker`, `scheduler`, `reverb` n'ont aucune sonde. Aucun test de panne de scheduler (tout le nettoyage RGPD dépend de ce conteneur).
- **Dérive de configuration entre les gabarits `.env`.** Le script de comparaison `env()` contre `.env.prod.example` signale l'absence de : `LOG_CHANNEL/LOG_STACK/LOG_LEVEL/LOG_DAILY_DAYS`, `REVERB_SCALING_ENABLED`, `REVERB_APP_MAX_CONNECTIONS`, `DISCOVERY_DAILY_LIKES_FREE`, `MAX_SESSIONS_PER_USER`, `MEDIA_PROCESS_*`, `MEDIA_REGION`, `RETENTION_*`, `OAUTH_REQUIRE_NONCE`, `OAUTH_REAUTH_MAX_AGE`, `UNVERIFIED_RECLAIM_HOURS`, `TYPED_EMAIL_REFUSAL_DAYS`, `ADMIN_DAILY_*`, `PUSH_MESSAGE_PREVIEW`. Leurs valeurs par défaut s'appliquent donc sans décision explicite (notamment `RETENTION_*` qui sont des choix juridiques). Inversement `backend/.env.example` ignore les variables de production (domaines, sauvegarde, Reverb). `backend/.env.example` fixe `APP_DEBUG=true` et `APP_ENV=local` : la CI copie ce fichier, ce qui est acceptable, mais aucun test ne garantit qu'une mauvaise recopie en production est détectée (`APP_DEBUG=true` expose les traces).
- **Version PHP.** Poste de développement : PHP 8.5.12 ; CI et image Docker : 8.4 ; `composer.json` : `^8.2`. La CI ne teste pas la version de développement.

### 3.3 Écarts entre ce qui est écrit et ce qui fonctionne (mobile)

**[nouveau, bloquant]** Plusieurs promesses fonctionnelles n'ont aucun code client :

1. **Notifications push.** `registerDevice` est défini dans `mobile/src/api/endpoints.ts:179` mais n'est appelé nulle part ; `expo-notifications` n'est pas une dépendance ; `app.json` n'a ni configuration FCM/APNs. Aucun appareil n'enregistre de jeton, donc le serveur n'enverra jamais de push, y compris pour les appels entrants. Les écrans de préférences de notifications existent mais ne commandent rien. La documentation de statut dit « Notifications : préférences, jeton par appareil, envoi FCM isolé derrière une interface » (côté serveur, exact), sans signaler l'absence de client.
2. **Appels.** `mediaEngine.ts` ne contient que `UnavailableMediaEngine` ; le package LiveKit n'est pas installé ; pas de CallKit ni de ConnectionService. La décision propriétaire D7 / E2 « appels audio et vidéo inclus dès le lancement » n'est donc pas tenue, ce que le statut et l'ADR 004 reconnaissent. Mais `Calls::incoming` annonce « push VoIP + CallKit, voir docs/08 » dans un commentaire alors que le jeton VoIP (`voip_push_token`) n'est qu'un champ de type : ne pas le lire comme livré.
3. **Compilation pour les stores.** `mobile/app.json` ne définit ni `ios.bundleIdentifier`, ni `android.package`, ni `buildNumber/versionCode`, ni `ios.infoPlist` (descriptions d'usage caméra/micro/photos hors plugin), ni `ios.privacyManifests` ; il n'y a pas de `eas.json`, pas de profil de build, pas d'`expo-dev-client` (requis par RevenueCat, signalé dans le README). Aucune configuration de liens universels ou de schéma associé au domaine pour la vérification d'e-mail et le mot de passe oublié (le schéma `ayelo://` est déclaré mais les liens HTTPS ne le sont pas).
4. **Suivi d'erreurs et analytique** : absents du mobile.
5. **Jamais lancé sur appareil.** Le bundle Android compile (CI) ; aucun écran n'a été vu sur un téléphone ; aucun test de bout en bout (Maestro, T005 ouvert).

## 4. Livraison : CI, tests, dépendances, stores

### 4.1 CI (`.github/workflows`)

- Points forts : Pest sur PostgreSQL 16, `composer audit`, contrat OpenAPI vérifié à jour, tests de schéma, `gitleaks` sur tout l'historique, typecheck + lint + 300 tests + bundle Android.
- **[nouveau]** Manques : aucune analyse statique PHP (PHPStan/Larastan), alors que Pint est installé il n'est pas exécuté ; aucune mesure de couverture (`coverage: none`) alors que `docs/13-TEST-STRATEGY.md:65-67` fixe des seuils (85 % services critiques, 70 % global, 60 % mobile) : ces seuils ne sont ni mesurés ni appliqués ; l'image Docker n'est jamais construite en CI (la première construction aura lieu sur le serveur de production) ; aucun `docker compose config`, `caddy validate`, `shellcheck` ni `hadolint` ; l'étape d'audit npm est intitulée « informatif » mais échoue sur toute faille haute (`--audit-level=high`) ; les 22 modérées passent ; pas de Dependabot / Renovate ; pas de workflow de déploiement ni de build mobile (EAS) ; les workflows ne se déclenchent pas sur `infra/**`, donc une modification de l'infrastructure n'exécute rien ; pas de planification nocturne (le Maestro nocturne annoncé en doc 13 n'existe pas).
- Statut : le dossier annonce « trois workflows verts sur le commit `5dce604` » ; le HEAD actuel est `392550c` et l'arbre de travail contient des modifications non commitées. Il faut un statut vert sur le commit réellement publié.

### 4.2 Pyramide de tests

| couche | état | trou |
| --- | --- | --- |
| Unitaire backend | dossier `tests/Unit` vide ; les tests sont tous des tests de fonctionnalité (environ 470 cas `it()/test()` annoncés, 333 selon le statut) | acceptable pour un monolithe Laravel, mais pas de test de propriété sur les services purs |
| Intégration backend | forte pour la sécurité (cinq fichiers de durcissement) et le cycle de vie | aucun test avec vrai Redis, vrai Reverb, vrai R2 (MinIO en service CI), concurrence réelle, charge |
| Mobile | 300 tests Jest avec faux serveur et faux transport | jamais avec le vrai backend ; contrat OpenAPI généré réduit le risque de dérive |
| Bout en bout | néant (`.maestro/` absent) | gate G4 non franchi |
| Charge | néant (k6 prévu en doc 13) | aucune valeur de capacité mesurée |

### 4.3 Dépendances et versions

- `composer.lock` : Laravel 12.71, Filament 4.16.1, Reverb 1.12, Sanctum 4.3.3, Livewire 3.8.11 ; aucun paquet marqué abandonné ; `composer audit` en CI. Filament est épinglé exactement (`4.16.1`) : bien pour la reproductibilité, mais il faut une veille manuelle des correctifs de sécurité.
- `npm outdated` : `eslint` 9 → 10, `typescript` 6.0.3 → 7.0.2, `react` 19.3.0 → 19.3.1 : sans urgence. `npm audit --omit=dev` : 22 vulnérabilités (1 basse, 21 modérées), toutes transitives dans l'outillage de test (`minimatch`), correctif automatique proposé = retour à Expo 52, refusé à juste titre.
- Expo SDK 58 / React Native 0.88 / React 19.3 : versions très récentes. Risque d'écosystème : `react-native-purchases` 11, `pusher-js` dans un client React Native (pas de reconnexion testée), compatibilité Expo Go déclarée mais RevenueCat exige un build de développement. La politique de versions des stores (niveau d'API cible Google Play, Xcode minimal Apple) change chaque année : à vérifier le jour de la soumission.

### 4.4 Préparation aux stores (Apple App Store Review, Google Play)

Ne pas se fier à ma connaissance des règles : relire les politiques officielles le jour de la soumission (la liste `docs/release/01-checklist-stores.md` le dit déjà). Constats d'ingénierie :

| exigence | état | commentaire |
| --- | --- | --- |
| Suppression de compte dans l'app (Apple 5.1.1(v), Google) | API et écran présents ; page web publique à publier ; URL à déclarer chez Google | bon |
| Révocation du jeton « Se connecter avec Apple » à la suppression | non implémentée (l'avoue la liste de contrôle) | **bloquant Apple** si le compte a été créé avec Apple ; n'est pas dans les tâches de la spec 011 |
| UGC (Apple 1.2) : signalement, blocage, filtre de contenu, contact du support, modération sous délai | signalement et blocage présents (API + écrans) ; filtre de texte non fait (T007) ; modération humaine sans personne ; contact support non configuré (`EXPO_PUBLIC_SUPPORT_EMAIL` vide) | à fournir avant soumission |
| Achats intégrés | RevenueCat côté mobile et serveur, écran de gestion d'abonnement ajouté | produits non créés dans les consoles, aucun achat sandbox testé, « Restaurer les achats » à vérifier à l'écran |
| Âge | déclaratif 18+ avec mémorisation du refus | les stores demandent un classement d'âge cohérent avec un service de rencontres ; questionnaire à remplir |
| Étiquettes de confidentialité / sécurité des données | non remplies | exigent une cartographie des données (existante dans `docs/legal/02`) et les SDK tiers (RevenueCat, Firebase) |
| Appels en arrière-plan (VoIP, CallKit) | absents | si l'équipe déclare les capacités sans les utiliser, refus à la revue |
| Test fermé Google (12 testeurs, 14 jours) | non démarré | chemin critique de 14 jours incompressibles |
| Nom et marque | « Ayelo » provisoire, risque de confusion avec AILO (dépôt 2025, rencontres) | décision propriétaire ; changer de nom après le build coûte cher (identifiants, schéma d'URL, domaines) |

## 5. Modèle de coûts à 10 000 et 100 000 utilisateurs actifs par mois

Hypothèses explicites (aucune n'est mesurée) : 3 comptes inscrits par utilisateur actif mensuel ; 30 % d'actifs quotidiens ; 4 photos par profil de 0,5 Mo après ré-encodage ; 150 photos de profil vues par actif quotidien et par jour (aucun cache grâce aux URL présignées) ; 5 % des actifs passent un appel par mois, 16 minutes-participant par appel ; e-mails : 1,5 par inscription plus réinitialisations. Tarifs : ceux relevés dans `docs/14b-COSTS.md` le 2026-11-05 (non revérifiés ; à relire avant achat). Montants en dollars par mois, arrondis.

| poste | 10 000 MAU | 100 000 MAU | commentaire |
| --- | --- | --- | --- |
| R2 stockage | moins de 1 | environ 5 | photos 20 à 200 Go ; images de messages en plus (8 Mo max chacune, 100 par jour) peuvent doubler |
| R2 opérations lecture (URL non cacheables) | environ 1 (13 M ops) | environ 45 (135 M ops) | disparaît avec domaine R2 + cache CDN ; l'échelle réelle dépend du nombre d'images par session |
| LiveKit Cloud | 0 à 50 (8 000 min : au-delà des 5 000 min gratuites, palier Ship probable) | 55 à 150 (80 000 à 240 000 min selon adoption, plus dépassement de bande passante) | non mesuré ; l'adoption réelle des appels vidéo entre inconnus est très incertaine |
| FCM / APNs | 0 | 0 | gratuit, mais non vérifié ici |
| E-mail transactionnel | 20 | 30 à 40 | palier gratuit dépassé dès 3 000 e-mails |
| Calcul et base | 15 à 30 (VPS KVM 4) | 250 à 450 | à 100 000 : base séparée (PostgreSQL 8 à 16 Go, sauvegarde WAL), 2 nœuds applicatifs, Reverb + Redis dédiés |
| Suivi d'erreurs (Sentry) | 29 | 80 | non intégré aujourd'hui |
| Sauvegardes hors site | moins de 1 | environ 5 | |
| Comptes de stores | environ 10 amorti | environ 10 | 99 $/an Apple + frais Google |
| RevenueCat | 0 | environ 240 (1 % de ~24 000 $ de revenu suivi) si 3 % de payeurs à ~8 $ | commissions des stores en plus (15 à 30 %) |
| **Sous-total technique** | **environ 90 à 150** | **environ 700 à 1 000** | dépasse la cible de 30 à 80 € dès 10 000 MAU |
| **Modération humaine** (non budgétée) | 400 à 800 | 4 000 à 8 000 | 12 000 photos / mois à 10 000 MAU, 120 000 à 100 000 ; environ 15 s par photo plus signalements |
| Pré-filtre automatique d'images | 15 | 120 à 200 | de l'ordre de 1 $ pour 1 000 images dans les offres du marché ; indispensable pour que la modération humaine ne porte que les cas douteux |

Conclusions : (1) la ligne dominante est la modération, pas l'infrastructure ; (2) le budget de 30 à 80 € ne tient que pour la bêta (DECISIONS D2) ; (3) un domaine R2 personnalisé avec cache réduit la lecture d'images à presque zéro et rend l'app plus rapide ; (4) LiveKit est le poste le plus volatil, plafonner par la durée et la qualité comme déjà décidé, et mesurer en bêta avant de promettre.

## 6. Conformité et risques juridiques d'ingénierie

Pas d'avis juridique ici (le dossier a raison de le dire). Constats techniques :

| sujet | état | risque |
| --- | --- | --- |
| Conservation RGPD | suppression en 2 temps (30 jours), anonymisation complète des tables listées, purge du texte des signalements et sanctions après 365 jours, export JSON (7 jours) | **[nouveau]** aucune durée de conservation pour les messages d'un compte actif, aucune purge des comptes inactifs, aucune durée pour `audit_logs`, `risk_events` des comptes non supprimés, `webhook_events` : principe de limitation de la conservation non respecté tant que non défini |
| Sauvegardes et effacement | rétention 14 jours, procédure de re-suppression après restauration écrite (non essayée) ; sans chiffrement activé les sauvegardes contiennent toutes les données en clair | l'information fournie aux utilisateurs ne doit pas promettre un chiffrement qui n'existe pas (le brouillon le signale) |
| Données sensibles | le genre et le genre recherché révèlent l'orientation ; origine ; sélfie biométrique de vérification supprimé à la décision | **[nouveau]** vague 2 (Afrique francophone) : certains États pénalisent les relations homosexuelles. Une fuite de la base est alors un danger physique pour des personnes. Recommandation : analyse d'impact (AIPD) avant la vague 2, chiffrement au niveau de la colonne pour ces champs, option de masquage forcé, décision propriétaire sur la restriction par pays |
| Mineurs | contrôle d'âge déclaratif avec refus mémorisé par appareil, IP (30 min), e-mail et identité sociale ; suspension préventive sur signalement de mineur suspecté ; trigger SQL sur la date de naissance | un contrôle déclaratif est contournable ; c'est un choix de risque à documenter, pas à nier. Procédure de signalement aux autorités (CSAM) non écrite (tâche T023 ouverte) |
| Export (droit d'accès) | l'export contient les messages envoyés, pas les messages reçus ; ni les `risk_events`, ni les journaux associés au compte | probablement acceptable pour les messages reçus (données de tiers), à faire valider ; documenter ce qui est exclu |
| DSA | signalement, motifs de sanction et contestation (appel) présents côté produit | **[nouveau]** à confirmer par le juriste : point de contact public, mécanisme de notification et d'action avec accusé de réception au signaleur, exposé des motifs envoyé à la personne sanctionnée, registre de transparence. Je n'ai pas vérifié que l'exposé des motifs est envoyé à l'utilisateur |
| Transferts hors UE | RevenueCat, Firebase, LiveKit, Cloudflare, e-mail, hébergeur à choisir | clauses contractuelles et contrats de sous-traitance à signer ; lieu d'hébergement du VPS à décider (RGPD, lois africaines de localisation) |
| Vérification biométrique | consentement dédié et suppression du sélfie | confirmer la base légale ; le sélfie compare quoi ? (revue manuelle ; pas de reconnaissance automatique). OK si exact. |
| IP et empreinte d'appareil | IPv6 réduite au /64, hash d'identifiants, `user_consents.ip` effacé à l'anonymisation | durée de conservation des IP dans `risk_events` à fixer |

## 7. Ce que les documents affirment mieux que la réalité

| affirmation | réalité constatée |
| --- | --- |
| `16-STATUS.md` : « Notifications : préférences, jeton par appareil, envoi FCM isolé derrière une interface » | vrai pour le serveur ; aucun client mobile n'enregistre de jeton ni ne reçoit de push (3.3). Le lecteur conclut à tort que les notifications sont presque prêtes. |
| `16-STATUS.md` : « Écrans mobiles de la phase 2 livrés côté code (300 tests) » | les écrans d'appel n'ont aucun moteur média, l'enregistrement de l'appareil n'existe pas, `app.json` ne permet pas de produire un build de store. Livré à environ 85 % d'une démonstration, pas d'un produit. |
| `14-DEPLOYMENT.md` : supervision par Sentry, Uptime Kuma, alertes sur longueur de file, disque, sauvegarde, webhook | rien de tout cela dans le code ni dans le compose ; seul un témoin de sauvegarde et une sonde de santé de conteneur existent |
| `011/tasks.md` T003 : `[~]` « écrits, jamais exécutés » | exact, mais aucun contrôle automatique (CI) ne vérifie même la syntaxe de ces fichiers ; « jamais exécutés » est plus risqué que le `[~]` ne le laisse penser |
| `11-SECURITY`/revues : « verrouillage du schéma, durcissement Caddy » | écrits sans `caddy validate` ni `docker compose config` ; le premier démarrage réel sera la première validation |
| Liste de contrôle des stores : « Blocage d'un utilisateur : écrans mobiles à faire » ; « Suppression : écran à faire » | périmé : les écrans existent (`BlockedScreen`, `DeleteAccountScreen`). Le document sous-estime ce qui est fait ; à mettre à jour pour ne pas bloquer une décision. |
| Gate G2 « franchi pour les modules backend » | franchi sans couverture mesurée, alors que les seuils de couverture font partie du critère de gate (doc 13) |
| `14b-COSTS.md` scénario haut à 10 000 actifs : 417 $ | inclut 239 $ de SMS qui ne seront pas envoyés au lancement (SMS hors périmètre) mais ignore la modération, qui pèse bien plus (section 5). Le total technique est donc surestimé et le coût réel total sous-estimé. |

## 8. Dix principaux risques (probabilité x impact, classés)

Échelle : probabilité (1 à 5) x impact (1 à 5).

| rang | risque | P x I | atténuation |
| --- | --- | --- | --- |
| 1 | Modération humaine absente et sans budget : les photos restent en `pending` (inscription bloquée) ou, avec `MEDIA_AUTO_APPROVE=true`, du contenu illicite est publié ; refus des stores sur la règle UGC ; responsabilité de l'éditeur | 5 x 5 = 25 | décider du budget et de la personne ; pré-filtre automatique ; limiter la bêta au volume que le propriétaire peut modérer |
| 2 | Aucune restauration prouvée, sauvegardes locales, parfois en clair, RPO 24 h, aucun archivage WAL | 4 x 5 = 20 | exécuter le runbook sur un serveur jetable ; chiffrer ; archivage WAL ou snapshots VPS ; alerte |
| 3 | Mobile non livrable : pas de push, pas d'appel, pas d'identifiants de build, jamais lancé sur appareil, aucun E2E | 5 x 4 = 20 | enregistrer les jetons (`expo-notifications`), configurer `app.json` et EAS, build de développement, tests Maestro |
| 4 | Infrastructure jamais exécutée : premier démarrage en production = première validation (Docker, Caddy, php-fpm 5 processus par défaut, Redis, Reverb) ; ré-encodage d'images synchrone sature l'API | 4 x 4 = 16 | préproduction identique, `docker compose config`, `caddy validate`, pool FPM dimensionné, test de charge |
| 5 | Aveugle en production : ni Sentry, ni métriques, ni alertes, journaux sans rotation ; une panne de file ou de scheduler ne se voit pas | 4 x 4 = 16 | Sentry (serveur + mobile), Uptime Kuma externe, alerte sur `failed_jobs`, longueur de file, disque, sauvegarde, bascule en `daily` des logs |
| 6 | Redis `allkeys-lru` sans persistance utilisé comme file : pertes silencieuses de pushes, diffusions et exports RGPD | 3 x 4 = 12 | `noeviction` + AOF ou file en base au lancement |
| 7 | Conformité : AIPD, DSA, conservation indéfinie des messages, signalement aux autorités, révocation Apple, textes non validés ; vague 2 avec données d'orientation | 3 x 5 = 15 | juriste avant toute soumission ; restreindre la vague 2 ; définir les durées |
| 8 | Contournement du contrôle d'âge et mineurs sur la plateforme (déclaratif) | 3 x 5 = 15 | accepter et documenter le risque ; vérification d'âge renforcée sur signalement ; procédure documentée |
| 9 | Goulets de performance des chemins chauds (liste de conversations, N+1 des profils, découverte sans index adapté) à l'arrivée du premier pic | 3 x 3 = 9 | correctifs de la section 2.1 avant 1 000 utilisateurs actifs ; test k6 |
| 10 | Intégrations jamais exécutées (R2, FCM, RevenueCat, LiveKit, Google/Apple OAuth) : le format des événements est supposé ; bogue découvert en production avec de l'argent réel | 4 x 3 = 12 | recette bout en bout sandbox sur chaque intégration avant bêta ; compte de test RevenueCat |

Ordre de traitement conseillé : 1, 2, 3, 4, 5, 7, 8, 10, 6, 9 (les risques 6 et 9 sont peu coûteux à corriger et peuvent être traités en parallèle).

## 9. Liste go / no-go de lancement et décisions du propriétaire

Légende : B = bloquant pour la bêta fermée, P = bloquant pour le lancement public.
Colonne « état » mise à jour le 2026-11-25 (code de `main`, CI, serveur en lecture seule). État d'origine de la revue : « non fait » presque partout.

| # | condition | type | responsable | état |
| --- | --- | --- | --- | --- |
| 1 | Premier déploiement réel sur un serveur de préproduction (compose, Caddy, certificats, migrations, scheduler, worker, Reverb) | B | DevOps + propriétaire (achat serveur) | FAIT : production en service, 11 conteneurs sains, TLS et sonde de santé ok (vérifié le 2026-11-25) |
| 2 | Restauration PostgreSQL exécutée, chronométrée, procès-verbal signé ; chiffrement GPG activé et clé hors serveur ; copie hors site ; alerte d'échec | B | DevOps | partiel : restaurée le 2026-11-25 (64 s, base sans membre) ; **procès-verbal à signer**, **pas d'alerte d'échec**, clé sur un seul poste |
| 3 | Pool PHP-FPM dimensionné ; ré-encodage d'images hors du chemin de requête ou pool dédié ; test de charge k6 sur découverte, messages, upload | B | Backend + DevOps | partiel : pool à 24 ; ré-encodage différé fusionné, fermé, non déployé ; **test k6 fait le 2026-11-25, objectifs non atteints** (`charge-2026-11-25.md`) |
| 4 | Redis : politique `noeviction` ou file en base ; files séparées (temps réel / push / défaut) ; correctifs `SendPush` (backoff, pas de doublon, 5xx réessayés) | B | Backend | FAIT : `noeviction` + AOF vérifiés sur le serveur, files séparées, `SendPush` corrigé (jamais essayé contre FCM) |
| 5 | Sentry (serveur + mobile), sonde externe, alertes, rotation des journaux, `LOG_LEVEL=info` en production | B | DevOps | partiel : `LOG_LEVEL=info`, sonde externe active ; **Sentry absent, journaux Docker sans rotation**, pas d'alerte de sauvegarde |
| 6 | Mobile : enregistrement du jeton push, `app.json` complet (identifiants, infoPlist, confidentialité), `eas.json`, build de développement installé sur iPhone et Android réels | B | Mobile | partiel : jeton push, `app.json`, `eas.json` et projet EAS en place ; **aucun build sur appareil réel** |
| 7 | Recette sandbox bout en bout : achat RevenueCat reçu par le webhook, push FCM reçu, upload R2, e-mail délivré (SPF/DKIM/DMARC), Reverb sur téléphone | B | QA | partiel : R2 et e-mail essayés en réel ; RevenueCat, FCM non configurés sur le serveur ; Reverb jamais essayé sur téléphone |
| 8 | Parcours Maestro (inscription, match, message, blocage, signalement, suppression) contre le backend de préproduction | B | QA | non fait : aucun parcours Maestro (recette Playwright web seulement) |
| 9 | Corrections de performance de la section 2.1 (conversations, présentateur, index) | B | Backend | FAIT dans le code (index, compteurs et soldes stockés), non déployé ; **charge non mesurée** (k6, 200 000 profils) |
| 10 | Modération : personne désignée, volume, procédure, délais publiés, pré-filtre automatique choisi | P (B pour taille réduite) | **propriétaire** | non décidé (propriétaire) |
| 11 | Matrice juridique, CGU, confidentialité, AIPD, DSA, procédure CSAM, durées de conservation validées par un juriste ; page de suppression publiée | P | **propriétaire + juriste** | brouillons (propriétaire et juriste) |
| 12 | Révocation du jeton Apple à la suppression ; filtre de texte ; contact support | P | Backend + Mobile | partiel : révocation Apple écrite, jamais essayée contre Apple ; filtre de texte limité aux demandes d'argent ; support présent |
| 13 | Comptes Apple Developer et Google Play ; test fermé 14 jours ; fiches, étiquettes de confidentialité, classement d'âge | P | **propriétaire** | non fait (propriétaire) |
| 14 | Prototype D0 des appels sur appareils réels ; sinon retirer les appels de la promesse de lancement | P | Realtime + Mobile | non décidé (propriétaire) |
| 15 | Statut CI vert sur le commit publié, avec couverture mesurée, analyse statique et construction de l'image Docker | P | DevOps | FAIT sur `main` (7936568) : CI verte, couverture 94,7 %, Larastan, image Docker construite |
| 16 | Recherche d'antériorité professionnelle du nom (AILO) avant tout identifiant de store ou domaine | P | **propriétaire** | non fait (propriétaire) |

### Décisions requises du propriétaire (dans l'ordre de blocage)

1. Budget et personne pour la modération humaine ; accepter ou non un pré-filtre automatique payant ; taille maximale de la bêta compatible avec la modération.
2. Réviser le budget d'infrastructure : 30 à 80 € ne couvre que la bêta ; fixer un plafond à 10 000 utilisateurs actifs.
3. Retirer les appels de la promesse de lancement (repli : notification classique) ou financer le prototype D0 et l'attendre.
4. Lancer la bêta fermée sur un périmètre restreint (France, quelques centaines d'utilisateurs, appels et vague 2 exclus) pour obtenir de vrais chiffres, avant le public.
5. Vague 2 (Afrique francophone) : accepter de la différer tant que l'AIPD et le chiffrement des données d'orientation ne sont pas faits.
6. Conservation : durée des messages, des comptes inactifs, des journaux, des IP ; chiffrement obligatoire des sauvegardes.
7. Nom de marque et entité juridique avant ouverture des comptes de stores.
8. Choix de l'hébergeur et de la région (conséquences RGPD et latence pour l'Afrique).
9. Politique d'ouverture des restrictions : MEDIA_AUTO_APPROVE reste `false` en production ; le confirmer par écrit.

## 10. Points forts à conserver (pour équilibrer)

- Séparation nette des services, un contrôleur par ressource, services testables, contrat OpenAPI généré et vérifié en CI, types TypeScript dérivés.
- Défense en profondeur côté base : contraintes CHECK, clés uniques pour l'idempotence, trigger sur la date de naissance, verrous consultatifs.
- Sécurité traitée sérieusement : cinq séries de tests de durcissement, revues successives avec suivi, admin séparé sur un domaine à liste blanche d'IP en échec fermé, journaux expurgés, politique de secrets avec gitleaks.
- Honnêteté documentaire : le statut sépare « testé », « écrit non exécuté » et « absent ». Cette revue ajoute des points que le statut ne couvre pas, mais ne contredit pas sa franchise.
- Choix de pile boring et cohérent avec un budget modeste (monolithe modulaire, PostgreSQL, un seul VPS), adapté à une bêta.
