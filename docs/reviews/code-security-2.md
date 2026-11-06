# Seconde revue de sécurité indépendante du code backend (après correction)

Relecteur : Security Engineer / Independent Reviewer. Je n'ai écrit aucun de ces fichiers. Date : 2026-11-06. Lecture seule : aucun fichier du dépôt modifié, hors ce rapport.

## 0. Périmètre, méthode, limites

- Relu : `backend/app/**` (y compris `app/Filament/**`, `app/Services/Admin/**`, `app/Models/StaffUser.php`, `app/Providers/AdminPanelProvider.php`), `routes/**`, `bootstrap/app.php`, `config/**`, `tests/Feature/SecurityHardeningTest.php`, titres et extraits de `tests/Feature/Admin/**`, `infra/caddy/Caddyfile`, `infra/.env.prod.example`, `infra/docker-compose.prod.yml`, `infra/php/*`, et les parties de `vendor/filament/filament` qui décident du 2FA, de la limitation de tentatives et des middlewares persistants.
- **VÉRIFIÉ (lu dans le code)** = lu dans un fichier cité (fichier:ligne), ou obtenu par une commande en lecture seule (`php artisan route:list`, et un script qui affiche l'ordre réel des middlewares d'une route sans toucher la base). **SUPPOSÉ** = déduit du comportement habituel de Laravel, PostgreSQL, Caddy ou d'un déploiement absent du dépôt.
- **Rien n'a été exécuté côté tests.** Je n'ai pas lancé Pest (base partagée), ni `composer audit` (`composer` absent de mon shell), ni `gitleaks`, ni `npm audit`. Les « 158 tests, 0 échec » du suivi sont une affirmation du CTO que je n'ai pas rejouée ; conformément à la constitution (principe II) je ne déclare donc « satisfaite » aucune exigence qui repose sur une exécution.
- Versions lues dans `composer.lock` : Laravel 12.71.0, Filament 4.16.1, Livewire 3.8.11, Sanctum 4.3.3, AWS SDK 3.403.0. Je ne peux pas dire si elles ont des avis de sécurité en cours (pas d'`audit`).
- Les numéros de ligne sont ceux du dépôt à la date de lecture.

## 1. Résumé

Verdict G3 (sécurité) : **NON** (section 8).

Constats de cette seconde revue (nouveaux défauts et risques résiduels des correctifs) :

| Gravité | Nombre |
|---|---|
| Critique | 0 |
| Haute | 2 |
| Moyenne | 8 |
| Basse | 12 |

Constats de la première revue encore ouverts (non traités par le correctif, section 5) : 5 moyens, 11 bas, dont un seul a changé de gravité (F-17, Moyenne vers Basse).

Les trois plus graves :
1. **N-01 (Haute)** : le panneau `/admin` est servi sur le domaine de l'API ; la restriction par IP de l'administration ne protège donc rien.
2. **N-02 (Haute, conformité)** : toute sanction posée par le personnel révoque les jetons et la connexion est ensuite refusée ; l'utilisateur sanctionné ne peut plus ni lire sa sanction ni la contester.
3. **N-03 / N-04 (Moyenne, régressions)** : les nouvelles limites par IP et le refus d'âge par IP bloquent des utilisateurs légitimes derrière un même partage d'adresse (réseaux mobiles), et permettent un déni de service ciblé de l'inscription.

Aucune faille critique : pas de contournement du 2FA trouvé, pas de XSS stockée dans le panneau, pas d'IDOR dans les ressources Filament, pas d'injection. Les neuf constats hauts de la première revue sont tous réellement traités dans le code (sept corrigés, deux atténués avec un risque résiduel moyen).

## 2. Vérification des correctifs annoncés

Légende : **Confirmé** = la correction existe et couvre le scénario ; **Confirmé avec réserve** = existe, un contournement ou un effet de bord subsiste ; **Partiel** = couvre une partie du scénario.

| id | annoncé | verdict | réserve (voir détail) |
|---|---|---|---|
| F-01 | corrigé | Confirmé avec réserve | clés non contrôlables par le client, mais régressions N-03 et N-06 |
| F-02 | atténué | Confirmé, risque résiduel Moyenne | IP changeante, pas de refus par identité sociale |
| F-03 | corrigé | Confirmé avec réserve | allowlist saine, mais N-02 casse la contestation |
| F-04 | corrigé (code) | Confirmé | déploiement : voir N-03 et N-01 |
| F-05 | corrigé (images) | Confirmé avec réserve | résiduels bas (N-14) |
| F-06 | corrigé | Confirmé avec réserve | résiduels bas |
| F-07 | corrigé | Confirmé | |
| F-08 | corrigé | Partiel | événement d'utilisateur inconnu jamais rejoué (F-08 résiduel) |
| F-09 | atténué | Confirmé, risque résiduel Moyenne | contournable avec deux comptes |
| F-10 | corrigé | Partiel | profil masqué par retrait de consentement encore visible (F-10 résiduel) |
| F-12 | corrigé en partie | Confirmé en partie | moissonnage de la découverte ouvert |
| F-15 | corrigé | Confirmé | le contenu est conservé ; aucune interface ne le montre encore |
| F-16 | corrigé | Confirmé avec réserve | alias d'e-mail, appareil non couvert |
| F-22 | corrigé | Partiel | purge des dépôts ; quotas par type toujours absents |
| F-23 | corrigé | **Non corrigé** pour le scénario décrit | un message texte accepte toujours `media_id` |

### F-01 : limiteurs (VÉRIFIÉ, `AppServiceProvider.php:31-78`)
- `login` : e-mail minuscule + trim (5 par 15 min), appareil (10), IP (30). `age-check`, `register`, `oauth` combinent appareil et IP. `device()` (`:73-78`) n'accepte qu'un uuid valide, sinon retombe sur `ip:<IP>` : un en-tête libre ne crée plus de compteur neuf. Les routes authentifiées sont limitées par identifiant de compte (`:31`, `:59-68`).
- Ordre réel des middlewares sur `POST /api/v1/swipes` (affiché par le script en lecture seule) : `Authenticate:sanctum`, `ThrottleRequests:api`, `ThrottleRequests:swipes`, `SubstituteBindings`, `EnsureAccountActive`. La priorité Laravel place l'authentification avant la limitation, donc `$r->user()` est bien rempli dans les limiteurs `api` et `swipes`. Sur `login` : `api` puis `login`, sans compte.
- Contournement cherché : changer `X-Device-Id` (compté par e-mail et IP), jouer sur la casse (corrigé par `strtolower`), envoyer `email` en tableau. Ce dernier cas fait lever « Array to string conversion » dans la fonction du limiteur (`:44`, `:56`) avant la validation : une réponse 500 gratuite, sans incidence sur la sécurité (basse, à ignorer ou à normaliser avec `is_string`).
- Réserves : voir N-03 (limites par IP trop basses pour un partage d'adresse) et N-06 (déni de connexion ciblé par le compteur d'e-mail).

### F-02 : refus d'âge (VÉRIFIÉ, `AgeGate.php:29-50`, `AgeCheckController.php:19-23`, `RegisterController.php:23`, `OAuthController.php:55`)
- Refus mémorisé par appareil (90 jours) et par IP (2 h), vérifié à l'inscription par e-mail et à la création de compte social. L'ordre est correct : le contrôle de refus passe avant la lecture du jeton d'âge.
- Autres contournements cherchés : (1) changer d'IP (données mobiles / Wi-Fi) ou, en IPv6, d'adresse dans le même /64 : l'IP complète est la clé ; (2) refus non mémorisé par identité sociale ni par e-mail, alors que docs/11 complément 6 le demande ; (3) un mineur qui ment dès le premier essai n'est jamais détecté (limite du déclaratif, déjà documentée). Course : un mineur qui envoie en parallèle une date mineure et une date majeure peut obtenir un jeton d'âge, mais `register` revérifie le refus avant d'accepter le jeton (`RegisterController.php:23`), donc pas d'inscription.
- **Risque résiduel : Moyenne** (au lieu de Haute). Correction : normaliser l'IPv6 en /64 pour la clé ; mémoriser le refus pour l'identifiant social et l'e-mail dès qu'ils sont connus ; attestation d'appareil (spec 001 T012). Régression induite par la mesure : N-04.

### F-03 : middleware `EnsureAccountActive` (VÉRIFIÉ, `EnsureAccountActive.php:17-52`, `bootstrap/app.php:28-29`)
- Appliqué à tout le groupe `api` (preuve : liste de routes, toutes les routes `api/v1/*` portent `api`, dont le webhook et la santé). L'ordre est indépendant de l'authentification : le middleware relit lui-même `user('sanctum')`.
- Contournements cherchés, aucun trouvé : méthode HTTP (`HEAD /me` est refusé car seules GET et DELETE sont permises ; une surcharge `_method` produit la même méthode effective côté routage et côté middleware) ; casse du chemin (le routage Symfony est sensible à la casse) ; barres obliques doublées (`api/v1//me` ne correspond pas à l'allowlist, donc refusé) ; jeton absent ou invalide (passe le middleware mais est rejeté par `auth:sanctum`) ; statut `deleting` (traité comme restreint, comme voulu) ; `fnmatch('me/export/*')` accepte des sous-chemins, mais seule la route `me/export/{id}` existe. `broadcasting/auth` (API) est bloqué pour un compte restreint : un nouvel abonnement temps réel est donc refusé.
- Effet de bord grave : N-02. Un détail : le middleware lit `bearerToken()` pour tous les appels, y compris le webhook RevenueCat qui envoie `Authorization: Bearer <secret>` : une requête Sanctum inutile (recherche d'un jeton inexistant) par webhook ; sans conséquence de sécurité.

### F-04 : proxys de confiance (VÉRIFIÉ, `bootstrap/app.php:22-25`, `infra/.env.prod.example:12`, `infra/docker-compose.prod.yml:25-26`)
- Seuls les CIDR de `TRUSTED_PROXIES` sont crus, en-têtes `X-Forwarded-For` et `X-Forwarded-Proto` seulement. Vide = aucun proxy cru. L'exemple de production renseigne `172.16.0.0/12` (réseau Docker) et seul Caddy publie des ports (80, 443) : le port applicatif n'est pas exposé. Le test `F-04` prouve deux IP distinctes selon l'origine du proxy.
- Réserve : si Cloudflare ou un autre CDN est un jour placé devant Caddy, il faudra ajouter ses plages, sinon tout le trafic partage l'IP du CDN. SUPPOSÉ (non présent dans le dépôt).

### F-05 : médias (VÉRIFIÉ, `MediaSanitizer.php:19-60`, `MediaController.php:79-127`, `config/media.php:27-31`)
- La signature réelle est lue par `getimagesizefromstring`, comparée au type déclaré (strict), les dimensions sont plafonnées avant décodage, l'image est ré-encodée par GD (EXIF, GPS, profils et données ajoutées disparaissent), écrite sous une **nouvelle clé**, l'ancienne est supprimée. Un fichier qui n'est pas décodable par `imagecreatefromstring` est refusé (échec fermé). La sortie est produite par GD : un polyglotte (image valide + HTML ou script en fin de fichier) ne survit pas au ré-encodage.
- Le scénario « remplacer l'objet approuvé par l'URL de dépôt encore valide » est fermé : la ligne `media` pointe vers la nouvelle clé, que l'URL de dépôt ne connaît pas. Vidéo et audio sont fermés (types absents de `kinds`). Les dépôts abandonnés sont purgés (`routes/console.php`).
- Résiduels (Basse) : voir N-14.

### F-06 : effacement (VÉRIFIÉ, `AccountDeletion.php:44-92`, `routes/console.php`)
- Supprimés : objets d'export et de médias, `data_exports`, `support_tickets`, `appeals`, `call_sessions`, `story_*`, `gift_sends`, IP des consentements (mise à null), charges RevenueCat de l'utilisateur (mises à `{}`), `risk_events` si le compte n'est pas sanctionné ; exports expirés purgés chaque jour.
- Résiduels (Basse) : `users.birthdate` est conservée sur la ligne anonymisée ; `reports.details` (texte libre d'un tiers) et `sanctions.reason` restent sans durée écrite ; la suppression des objets (`:144-148`) précède la transaction et n'est pas protégée par un `try` : une panne du stockage interrompt la purge de tous les comptes suivants du lot.

### F-07 : jeton d'appel (VÉRIFIÉ, `CallController.php:123-141`)
L'appelé reçoit 409 `call_not_accepted` tant que l'appel sonne ; il obtient son jeton à `accept`. L'appelant garde son jeton (il est dans la salle dès la sonnerie, comme prévu). Confirmé. F-14 (verrou, salle non fermée) reste ouvert.

### F-08 : webhook RevenueCat (VÉRIFIÉ, `RevenueCatProcessor.php:28-65`)
- Le marquage `processed_at` se fait dans la transaction des effets ; un échec laisse la ligne sans `processed_at` et le rejeu est retraité. Rejeu concurrent du même événement : les deux requêtes entrent dans la transaction, mais `purchases.transaction_id` (insertOrIgnore sur clé unique, la seconde attend la première) et `credit_ledger.idempotency_key` empêchent le double crédit ; pour un remboursement, la clé `refund:<tx>` fait échouer la seconde transaction (500, annulée, le rejeu suivant reçoit `duplicate`). Pas de corruption trouvée.
- **Partiel** : pour un utilisateur inconnu, `handle()` répond `ignored` (`:44-47`) et le contrôleur renvoie 200. RevenueCat ne réessaie pas après un 200 : l'événement « conservé pour être rejoué » ne le sera jamais, et aucune tâche ne relit les lignes `error = 'utilisateur inconnu'`. Le test (`SecurityHardeningTest.php:279-290`) rejoue l'événement à la main. Voir F-08 résiduel.

### F-09 : signalement « mineur suspecté » (VÉRIFIÉ, `ReportController.php:46-60`)
- Quota de 3 par jour et par compte ; suspension automatique seulement s'il existe une conversation entre signaleur et cible, ou un second signaleur distinct en 7 jours.
- Contournement : **deux comptes jetables suffisent** (le second remplit la condition « autre signaleur »). Le coût d'un compte reste faible : inscription 20 par heure et par IP (`register`), e-mail non vérifié accepté (F-30). Avec 2 comptes, 3 victimes par jour et par paire. Ma propre recommandation de la première revue (« second signaleur distinct ») était trop faible : elle aurait dû exiger de l'ancienneté et un e-mail vérifié.
- **Risque résiduel : Moyenne**, décision produit à confirmer par le propriétaire. Correction peu coûteuse : ne compter comme « signaleur distinct » qu'un compte de plus de 7 jours, e-mail vérifié, avec au moins une interaction ; alerte sur le ratio signalements/suspensions par signaleur ; la file prioritaire existe maintenant (ReportResource) mais aucun budget de modération n'est écrit (T009 ouvert).

### F-10 : matchs (VÉRIFIÉ, `MatchController.php:25`)
Le filtre ne teste que `users.status = 'active'`. Un utilisateur qui retire son consentement « données sensibles » voit son profil passer à `is_visible = false` (`AccountController.php:139-141`) mais **reste affiché, photos comprises, dans la liste des matchs** de ses correspondants. Voir F-10 résiduel.

### F-12 (VÉRIFIÉ) : limite générale `api` 120/min par compte ou IP (`AppServiceProvider.php:31`). Le moissonnage de la découverte reste ouvert : 60 requêtes/min x 50 profils (`discover`), inchangé. Réserve de régression : le test n'ajoute pas les autres limites (voir N-03).

### F-15 (VÉRIFIÉ, `MessageController.php:128-138`) : le contenu est conservé, masqué par l'API (`present()` renvoie `deleted`). Réserve : aucune interface du panneau n'affiche un message ou une conversation, donc la preuve conservée n'est consultable par personne ; et `context_id` du signalement n'est toujours pas validé (`ReportController.php:26-27`). La consultation de conversation « journalisée » (docs/11 complément 8) n'existe pas : rien à contrôler, fonction absente.

### F-16 (VÉRIFIÉ, `RegisterController.php:42`, `OAuthController.php:63`, `AccountDeletion.php:53-58`) : e-mail et téléphone d'un compte sanctionné puis supprimé sont refusés à la réinscription. Résiduel (Basse) : le hash porte sur l'adresse exacte (alias `+tag`, points Gmail, relais Apple) ; l'appareil n'est jamais banni ; l'interdiction n'est écrite qu'à l'anonymisation (30 jours), mais pendant le délai l'adresse reste prise par la ligne `users`, donc pas de trou.

### F-22 : purge des dépôts abandonnés confirmée. Quotas par type absents : `message_image` et `verification_selfie` n'ont aucun plafond hors la limite de 20 dépôts par heure (jusqu'à 480 dépôts par jour et par compte, environ 3,8 Go si 8 Mio chacun, stockés indéfiniment en `processing`). Basse.

### F-23 : **non corrigé pour le scénario décrit** (VÉRIFIÉ, `MessageController.php:88`). La restriction des types à texte et image ne change rien : un message `type: text` enregistre toujours `media_id` sans contrôle (`'media_id' => $data['media_id'] ?? null`) et le renvoie dans la réponse (`present()`), avec une erreur de clé étrangère (500) pour un uuid inexistant, donc un oracle d'existence. Toujours latent (aucune route ne sert les médias de message). Correction : `media_id` forcé à null hors `image`.

## 3. Panneau d'administration (Filament) : constats nouveaux

### N-01 (Haute) Le panneau `/admin` est joignable sur le domaine de l'API ; la restriction par IP est contournée
- **Preuve (VÉRIFIÉ)** : `AdminPanelProvider.php:70-107` ne contient aucun `->domain()` (la liste de routes affiche `domain = NULL` pour `admin` et `admin/login`). `infra/caddy/Caddyfile:7-22` (bloc `{$API_DOMAIN}`) et `:30-43` (bloc `{$ADMIN_DOMAIN}`) font tous deux `php_fastcgi app:9000` vers la même application. La liste d'IP autorisées (`:39`, `@blocked not remote_ip {$ADMIN_ALLOWED_IPS:0.0.0.0/0}`) ne s'applique qu'au bloc d'administration.
- **Scénario** : un attaquant ouvre `https://<API_DOMAIN>/admin/login`. Il obtient la page de connexion du personnel, sans passer par le filtre d'IP, et peut attaquer les mots de passe et le 2FA à partir de n'importe où, ainsi que `/livewire/update`. Inversement, l'API est servie aussi sur le domaine d'administration. Docs/11 Autorisation 5 (« Filament isolé sur un sous-domaine, accès restreint par rôle, IP optionnelle ») n'est pas tenu.
- **Aggravants** : la valeur par défaut `0.0.0.0/0` n'autorise que l'IPv4 (un client IPv6 serait refusé), et `ADMIN_ALLOWED_IPS=` vide dans `.env.prod.example:7` : que Caddy applique le défaut sur une variable vide n'est pas vérifié (SUPPOSÉ). Dans tous les cas, aucune IP n'est exigée.
- **Correction** : (1) `->domain(env('ADMIN_DOMAIN'))` dans le panneau ; (2) dans Caddy, sur le bloc API : `@admin path /admin* /livewire* /filament*` puis `respond @admin 404`, et sur le bloc admin : `@api path /api/* /up` puis `respond @api 404` ; (3) refuser le démarrage en production si `ADMIN_ALLOWED_IPS` est vide, et accepter `::/0` explicitement si voulu ; (4) test Pest : `GET /admin/login` avec l'hôte de l'API doit répondre 404. Le 2FA reste la barrière principale d'ici là.

### N-02 (Haute, conformité) Un utilisateur sanctionné par le personnel ne peut plus contester
- **Preuve (VÉRIFIÉ)** : `SanctionLedger.php:67-70` appelle `revokeSessions()` (`:129-134`) à toute suspension ou tout bannissement posé par le personnel ; `DeviceSessions::revokeAll` supprime tous les jetons. `LoginController.php:42-44` et `OAuthController.php:50-52` refusent ensuite toute nouvelle connexion avec 403 `account_restricted` et **sans jeton**. Le test `ModerationTest.php:116-128` affirme d'ailleurs que le nombre de jetons tombe à zéro.
- **Scénario** : un modérateur suspend ou bannit un compte. L'utilisateur est déconnecté, ne peut pas se reconnecter, et n'a donc aucun jeton pour `GET /me/sanctions` ni `POST /appeals`, que `EnsureAccountActive` laissait pourtant ouverts exprès (F-03). La contestation de docs/11 (Contenu et modération 6, complément 5) est impossible pour toute sanction posée depuis le panneau. Seule la suspension préventive de l'API (`ReportController.php:64-88`, qui ne révoque rien) laisse le canal ouvert. Pour l'Union européenne, c'est une exigence légale de traitement interne des réclamations, que je signale sans en faire un avis juridique.
- **Correction** : ne pas révoquer les jetons à la sanction (le middleware les restreint déjà), ou faire émettre par la connexion un jeton limité à l'allowlist pour un compte restreint (en gardant la comparaison de mot de passe). Test : suspendre via le panneau, puis `GET /me/sanctions` et `POST /appeals` avec le jeton existant ou après reconnexion, attendu 200 et 201.

### N-05 (Moyenne) L'enrôlement du 2FA est protégé par le seul mot de passe
- **Preuve (VÉRIFIÉ)** : `StaffCreateCommand.php:26-27,40` affiche le mot de passe généré une fois ; `vendor/filament/filament/src/Auth/Pages/Login.php` (autour des lignes 119-165) connecte l'utilisateur sans défi quand aucun fournisseur 2FA n'est actif, puis `EnsureMultiFactorAuthenticationIsEnabled` le redirige vers l'écran de configuration. Idem après `staff:reset-2fa` (`StaffAccounts.php:45-51`).
- **Scénario** : quiconque connaît le mot de passe initial (journaux de la console, historique du terminal, ticket de transmission) avant le premier usage légitime enrôle **son propre** authentificateur et prend le compte, y compris un compte administrateur. Même fenêtre après une réinitialisation du 2FA. L'exigence « 2FA obligatoire » est tenue pour l'affichage des pages (test `AccessTest.php:40-48`), mais pas pour la liaison de l'appareil.
- **Secondaire (Basse)** : `EnsureMultiFactorAuthenticationIsEnabled` n'est pas dans les middlewares persistants de Livewire (`FilamentServiceProvider.php:147-157`, `AdminPanelProvider.php:94-106`) : après `staff:reset-2fa`, ou après la désactivation du 2FA depuis le profil (permise avec mot de passe + code), une page déjà ouverte continue d'agir par Livewire jusqu'au prochain chargement complet. Pas d'exploitation sans session déjà valide.
- **Correction** : générer le secret TOTP dans `staff:create` et l'afficher (code QR ou chaîne) au lieu d'un enrôlement web, ou un jeton d'enrôlement à usage unique de 15 minutes envoyé par un autre canal ; invalider les sessions de l'intéressé lors d'une réinitialisation (changer le mot de passe suffit : `AuthenticateSession`).

### N-07 (Basse) Session et cookies du panneau
- **Preuve (VÉRIFIÉ)** : `config/session.php:172` `secure` vient de `SESSION_SECURE_COOKIE`, absent de `infra/.env.prod.example` : le cookie de session du panneau n'a pas l'attribut `Secure` (le HSTS de `Caddyfile:34` atténue, après une première visite). `same_site` vaut `lax` (`:202`), correct avec les jetons CSRF de Livewire. `AdminStatsWidget.php:13` interroge le serveur toutes les 60 s : la durée de vie de session de Laravel est glissante (120 min, `session.php:35`), donc **un onglet du tableau de bord ouvert maintient la session indéfiniment** (SUPPOSÉ pour l'effet exact, comportement standard). `AdminPanelProvider.php:41-46` force le pilote `file` quand `SESSION_DRIVER=array` (valeur de `.env.prod.example:17`) : sessions stockées dans le conteneur, perdues à chaque déploiement, et incompatibles avec plusieurs répliques. Aucune politique de contenu (CSP) sur le bloc admin ; `Referrer-Policy` absent (`Caddyfile:33-38`).
- **Sans défaut** : le panneau désactive l'inscription, la réinitialisation par e-mail et le « se souvenir de moi » (`StaffLogin.php`, `StaffUser.php:66-69`) ; la session est régénérée à la connexion (`Login.php:181`), donc pas de fixation ; `VerifyCsrfToken` est dans la pile (`AdminPanelProvider.php:100`, et `web` sur `livewire/update`).
- **Correction** : `SESSION_SECURE_COOKIE=true`, `SESSION_DRIVER=redis` pour le panneau, supprimer le sondage (`$pollingInterval = null`) ou imposer un délai absolu, `Referrer-Policy: no-referrer` et une CSP sur le bloc admin.

### N-08 (Basse) Le journal d'audit append-only accepte des écritures d'un anonyme
- **Preuve (VÉRIFIÉ)** : `StaffAuthAudit.php:41` écrit `staff.login_failed` avec l'adresse saisie, non bornée, à chaque échec de connexion, sans authentification. Filament limite à 5 tentatives par minute et par IP (`Login.php:74`), pas davantage.
- **Scénario** : un attaquant remplit `audit_logs` (table que les déclencheurs empêchent de purger) et noie les vraies lignes. Si un membre du personnel colle son mot de passe dans le champ e-mail et que celui-ci passe la validation de forme, il est conservé à vie dans un journal immuable. Le test `AccessTest.php:81-93` vérifie seulement que le mot de passe d'un échec normal n'est pas écrit.
- **Correction** : tronquer à 254 caractères et ne journaliser que l'adresse correspondant à un compte existant (sinon l'IP seule), ou regrouper les échecs d'une même IP (un compteur par minute).

### N-09 (Basse) Minimisation des données dans le panneau
- **Preuves (VÉRIFIÉ)** : `MediaItemResource.php:49` affiche `owner.email` à un modérateur ; le modèle `Member` est chargé sans restriction de colonnes par les relations `owner`, `member`, `reporter`, `reported` (seule `MemberResource::getEloquentQuery` restreint, `:45-46` ; le test `SecretsTest.php:47` couvre la ressource Membre) ; `MemberResource` montre e-mail, téléphone, score de risque, sanctions et registre de crédits au rôle support (`Permissions.php` : support a `USERS_VIEW`), sans masquage ; chaque modérateur peut ouvrir un selfie (docs/11 complément 2 : « pas de visionnage par tous les modérateurs ») ; toute image de message privé passe par la file humaine avec un aperçu signé de 10 minutes, non journalisé (`MediaItemResource.php:57-58`, génération à chaque affichage de ligne) ; les `RelationManager` surchargent `canViewForRecord` à `true` (sans effet aujourd'hui car la page exige déjà `USERS_VIEW`, mais contourne la politique si une autre page les réutilise).
- **Correction** : masquer l'e-mail au modérateur (nom d'affichage suffit), restreindre le support (pas de téléphone ni de score), ajouter un droit « selfie » séparé, journaliser l'aperçu des images de message, retirer les surcharges `true`.

### N-10 (Basse) Mot de passe du personnel
- **Preuve (VÉRIFIÉ)** : la commande impose 12 caractères (`StaffAccounts.php:31`), mais `EditStaffProfile.php:19-21` utilise la règle par défaut de Filament (8 caractères) et aucun contrôle de mot de passe compromis ; aucun changement n'est forcé après le mot de passe initial affiché en clair dans la console (`StaffCreateCommand.php:40`, risque : journaux d'exécution conteneur). Limitation de tentatives de connexion : 5 par minute et par IP seulement (Filament), aucun verrouillage par compte ; le 2FA compense.
- **Correction** : `Password::defaults(fn () => Password::min(12)->uncompromised())` pour le personnel, changement forcé à la première connexion, limiteur par adresse.

### N-12 (Basse) Pas de double contrôle sur les actions sensibles
`UserAdmin.php:77-130` : un administrateur seul peut ajouter 1 000 crédits par action sans plafond cumulé, offrir 366 jours de Premium autant de fois qu'il veut, réactiver un compte banni (y compris pour mineur suspecté). Tout est audité et motivé (docs/11 Paiements 3 satisfait), mais rien n'alerte sur un volume anormal. Correction : plafond quotidien par acteur, seconde validation au-delà d'un seuil.

### N-13 (Basse) Traces incomplètes
- `sanctions:expire` (réactivation automatique, `SanctionLedger.php:102-113`) ne laisse aucune ligne d'audit ; `staff:create` et `staff:reset-2fa` écrivent `actor = null` et `ip = null` (`Audit.php:64-69`) : on ne sait pas quel opérateur a lancé la commande.
- `VerificationReview.php:62-80` : l'objet du selfie est supprimé (par `ProfileVerification::decide`) à l'intérieur de la transaction externe, avant son commit ; si le commit échoue après, le selfie a disparu alors que la demande reste « en attente ». Le commentaire de la classe affirme l'inverse. Faible probabilité.
- Un approbateur peut approuver une vérification sans avoir ouvert le selfie : rien ne l'exige. Correction : enregistrer l'identité de l'opérateur de la console (variable d'environnement obligatoire), journaliser l'expiration.

## 4. Régressions introduites par les correctifs

### N-03 (Moyenne) Limites par IP trop basses derrière un partage d'adresse
- **Preuve (VÉRIFIÉ)** : `AppServiceProvider.php:31-69` : `api` anonyme 120/min par IP ; `login` 30 par 15 min par IP ; `oauth` 30 par 15 min ; `register` 20/h ; `age-check` 30/h ; `email-verify` 10/h ; `password-reset` 5/h (partagée avec la confirmation de suppression web, `routes/api/account.php`) ; `password-forgot` 20/h ; `deletion-request` 3/h. Avant F-04, ces compteurs étaient fusionnés derrière Caddy ; maintenant que l'IP est correcte, ils s'appliquent à l'IP réelle.
- **Scénario** : les réseaux mobiles (partage d'adresse CGNAT, très répandu sur le marché cible) font passer des centaines d'utilisateurs par la même IPv4. Dès 30 connexions en 15 minutes ou 10 vérifications d'e-mail par heure, des utilisateurs légitimes reçoivent 429. Le lancement dans un pays à fort partage d'IP rendra l'inscription et la vérification d'e-mail intermittentes.
- **Correction** : IP à ×10 ou plus et plafond principal sur l'e-mail visé et l'appareil ; clé IPv6 en /64 ; mesurer avant le lancement.

### N-04 (Moyenne) Le refus d'âge par IP bloque tout un partage d'adresse
- **Preuve (VÉRIFIÉ)** : `AgeGate.php:35,48` (refus par IP pendant 2 h) vérifié à `age-check`, `register`, `oauth` (nouveaux comptes).
- **Scénario 1** : un mineur, ou un adulte qui se trompe de date, refusé depuis une IP de réseau mobile bloque l'inscription de tous les adultes de cette IP pendant 2 h. **Scénario 2** : un attaquant sur la même IP (un campus, un bureau, un point d'accès, le même CGNAT) envoie une date mineure toutes les 2 heures et interdit l'inscription à tout le groupe (10 appels/h par appareil suffisent) ; il ne touche pas les comptes existants. Le message neutre `age_not_eligible` ne permet à personne de comprendre.
- **Correction** : ne pas refuser sur l'IP seule ; la compter comme signal (au-delà de N refus par heure sur la même IP, imposer une étape supplémentaire), ou la combiner à un deuxième facteur (appareil + IP).

### N-06 (Moyenne) Déni de connexion ciblé par le compteur d'e-mail
- **Preuve (VÉRIFIÉ)** : `AppServiceProvider.php:44` limite à 5 requêtes par 15 minutes **par e-mail, quelle que soit l'IP**, et compte les requêtes, pas les échecs ; le contrôleur n'efface jamais le compteur après un succès (`LoginController.php`).
- **Scénario** : un attaquant envoie 5 requêtes par 15 minutes avec l'adresse de la victime : la victime reçoit 429 en continu et ne peut plus se connecter. Combiné à N-02, elle n'a aucun autre recours. Un utilisateur légitime qui se connecte plus de 5 fois en 15 minutes (plusieurs appareils, réinstallation) se bloque aussi.
- **Correction** : ne compter que les échecs, avec une clé (e-mail + IP) plus une clé (e-mail seul) plus haute ; verrouillage progressif avec notification ; effacer le compteur après un succès.

### Autres effets relevés
- La limite générale `api` (120/min) est partagée par les routes déjà limitées : `swipes` autorise 120/min mais la découverte et les autres appels comptent aussi dans les 120, donc un utilisateur qui glisse vite (2 balayages par seconde + chargement de pages) atteint 429. Basse ; relever `api` à 300/min ou exclure `swipes` et `messages` du compteur général.
- N-11 (Basse) **Route dupliquée** : `GET|POST|HEAD /broadcasting/auth` (groupe `web`, sans `auth:sanctum`, sans `EnsureAccountActive` ni limite) coexiste avec `/api/v1/broadcasting/auth` (VÉRIFIÉ par `route:list`). Elle refuse tout faute de session, donc sans impact connu, mais c'est une surface inutile ; `GET /` renvoie encore la vue `welcome` (`routes/web.php:6`). Correction : retirer le doublon de l'enregistrement, supprimer la route `/`.

## 5. Constats de la première revue encore ouverts

| id | gravité 1re revue | gravité maintenant | relu dans le code | remarque |
|---|---|---|---|---|
| F-11 énumération de comptes | Moyenne | Moyenne | oui | `RegisterController.php:28` (règle `unique`), envois synchrones (`PasswordController.php:21-24`, `AccountController.php:60-66`) : inchangés |
| F-12 moissonnage | Moyenne | Moyenne | oui | limite générale ajoutée ; plafond de découverte toujours absent |
| F-13 webhook sandbox/ordre | Moyenne | Moyenne | oui | aucun test de `environment` ; un remboursement reçu avant son achat est perdu (`refundPack` rend `purchase === null` et l'événement est marqué traité) |
| F-14 appels | Moyenne | Moyenne | oui | `CallController.php:43-49` sans verrou, salle LiveKit non fermée |
| F-17 valeurs par défaut | Moyenne | **Basse** | oui | `infra/.env.prod.example` corrige debug, mailer, hachage, proxys ; restent : `config/hashing.php:18` défaut `bcrypt`, Reverb `allowed_origins ['*']`, événements client acceptés, limite de débit Reverb désactivée (`config/reverb.php:85-97`), `.env.example` orienté dev |
| F-18 mots de passe/sessions | Moyenne | Moyenne (réduite) | oui | `uncompromised()` toujours absent (`RegisterController.php:29`, `PasswordController.php:33`) ; verrouillage non progressif ; pas de rotation par appareil (`DeviceSessions.php:16-33`) |
| F-19 consentements OAuth | Basse | Basse | oui | `OAuthController.php:75` : `! empty($consents['terms'])` accepte la chaîne `"false"` |
| F-20 export sans ré-authentification | Basse | Basse | oui | `AccountController.php:86-100` |
| F-21 OAuth sans nonce | Basse | Basse | oui | aucun `nonce`/`iat` dans `JwtOAuthVerifier` |
| F-24 entrées mal formées (500) | Basse | Basse | oui | `routes/api/auth.php:28` sans `whereUuid`, regex pays avec `$` (`ProfileController.php:40-41`) |
| F-25 courses (500) | Basse | Basse | oui | inchangé |
| F-26 oracle 403/404 médias | Basse | Basse | oui | `MediaController.php:81-82, 131-132` |
| F-27 temps réel non revérifié | Basse | Basse (réduite) | oui | un compte restreint ne peut plus ouvrir de nouvel abonnement ; abonnés déjà connectés et `read`/`delivered` sans `canWrite` inchangés |
| F-28 divers | Basse | Basse | oui | aperçu push (`MessageController.php:100`), jeton push réaffectable (`DeviceController.php:24-26`) |
| F-29 jeton d'âge réutilisable | Basse | Basse | oui | `AgeGate.php:52-59` sans identifiant à usage unique |
| F-30 e-mail non vérifié accepté | Basse | Basse | oui | |

## 6. Constats résiduels des correctifs (récapitulés)

| id | gravité | sujet |
|---|---|---|
| F-02 (résiduel) | Moyenne | refus d'âge contournable par changement d'IP, pas de refus par identité sociale ou e-mail (section 2) |
| F-08 (résiduel) | Moyenne | événement d'utilisateur inconnu jamais rejoué : RevenueCat reçoit 200 (`RevenueCatProcessor.php:44-47`). Correction : traiter les lignes `processed_at is null` à la création du compte et à `POST /billing/sync`, ou répondre 5xx pour provoquer le rejeu |
| F-09 (résiduel) | Moyenne | deux comptes suffisent à suspendre un tiers (section 2) |
| F-10 (résiduel) | Moyenne | `MatchController.php:25` ne teste pas `is_visible` : retrait du consentement données sensibles non respecté pour les matchs. Correction : `->filter(fn ($p) => $p->user->status === 'active' && $p->is_visible)` et un test |
| N-14 (F-05 résiduel) | Basse | `MediaController.php:106` lit tout l'objet après le HEAD : un client peut remplacer l'objet entre les deux (l'URL de dépôt vaut 5 minutes) par un fichier de plusieurs centaines de Mio et épuiser la mémoire PHP (256 Mo, `infra/php/php.ini`) ; `MAX_PIXELS = 40_000_000` (`MediaSanitizer.php:14`) autorise un décodage GD d'environ 160 Mo, et `imagerotate` en double l'occupation (fatal si l'orientation EXIF n'est pas 1) ; l'ancienne clé peut être réécrite avec l'URL de dépôt après `complete` et n'est jamais purgée (l'objet orphelin n'est référencé nulle part) ; taille non liée à la présignature (`S3MediaStorage.php:29-31`) ; décodage de fichiers hostiles par `libwebp` dans le processus web (famille de failles CVE-2023-4863, SUPPOSÉ pour l'exposition, la bibliothèque est installée dans `infra/php/Dockerfile`). Correction : lire avec une borne (`Range`, vérifier `ContentLength` de la réponse), plafond à environ 20 Mpx, balayage des clés orphelines, mise à jour des bibliothèques, traitement hors processus web à terme |
| F-06 (résiduel) | Basse | `birthdate` conservée, durées de conservation des signalements non écrites, une panne de stockage interrompt la purge |
| F-16 (résiduel) | Basse | alias d'e-mail, appareil non banni |
| F-22 (résiduel) | Basse | quotas par type absents |
| F-23 | Basse | texte avec `media_id` non contrôlé (non corrigé) |

## 7. Ce que j'ai vérifié comme correct (pour borner l'audit)

- **2FA obligatoire** : le mot de passe seul ne donne pas de session si un 2FA existe ; le défi est limité à 5 essais par utilisateur (`MultiFactorChallenge.php:20`, `Login.php:127`), les codes ne sont pas rejouables (`AppAuthentication.php:196-206`, `verifyKeyNewer`), un compte désactivé est refusé avant le défi (pas d'oracle) et pendant la session (`StaffUser::canAccessPanel` plus `Permissions::can`). Les pages sont inaccessibles sans 2FA configuré (test `AccessTest.php:40-48`). Aucun contournement trouvé, hors la fenêtre d'enrôlement N-05.
- **Séparation des rôles** : une seule matrice (`Permissions.php:27-44`) lue par les politiques ET par les services (`AdminService::audited` appelle `Permissions::authorize` avant toute écriture). Aucune route Filament ne permet l'écriture générique : `AdminPolicy` refuse `create/update/delete`, `AdminResource` désactive les formes. Un modérateur n'a pas `USERS_*`, `CREDITS_*`, `PREMIUM_*`, `AUDIT_VIEW`, `TICKETS_*` ; le support n'a aucun droit de modération ni de sanction ; les tests `PermissionsTest.php` couvrent ces cas. Je n'ai pas trouvé d'élévation entre rôles.
- **IDOR** : les clés d'enregistrement passent par un uuid vérifié (`AdminResource.php:14-22`, 404 pour un format invalide) ; les actions de table prennent la clé côté client, mais la requête de la ressource fixe le périmètre (file de médias : `status = processing` et pas de selfie, `MediaItemResource.php:36`) et les services revérifient l'état (`pending()`, `open()`). Pas d'IDOR trouvé.
- **XSS** : toutes les valeurs d'origine utilisateur (nom d'affichage, détails d'un signalement, sujet et message de ticket, message de contestation, adresse saisie dans un échec de connexion) sont rendues par `TextEntry`, `TextColumn` ou `KeyValueEntry` sans `->html()` ni `HtmlString`. Seul `VerificationRequestResource.php:75-77` utilise `->html()`, avec `e()` sur l'URL, et `$selfieUrl` est une propriété `#[Locked]` (`ViewVerificationRequest.php:20-21`) : pas modifiable par le client. Aucune notification n'affiche un contenu utilisateur.
- **Journal d'audit** : écriture dans la même transaction que l'action (`AdminService.php:23-31`, test `AuditTest.php:112`), secrets retirés (`Audit.php:18-62`), déclencheurs `update/delete/truncate` (`docs/schema/001_initial.sql:543-546`, test `tests/schema/schema.test.mjs:83-86`), modèle en lecture seule (`AuditEntry.php`). Limite : l'immuabilité repose sur les déclencheurs ; le rôle de base utilisé par l'application, s'il est propriétaire de la table, peut les supprimer. À séparer (rôle d'application sans droit `ALTER`, `DROP`, `TRIGGER`). SUPPOSÉ (rôles non visibles dans le dépôt).
- **URL signée de selfie** : 2 minutes (`VerificationReview.php:19`), générée seulement sur action explicite, journalisée dans la même transaction avant retour, l'URL n'est jamais écrite dans le journal (test `Admin/ModerationTest.php:260`), le selfie est supprimé à la décision, la file média exclut les selfies.
- **`staff:create`** : mot de passe jamais en argument, jamais dans le journal (`StaffAccounts.php:39`), généré à 20 caractères alphanumériques (`Str::password`), saisie masquée avec `--prompt`. Seuls les points de N-05 et N-10 s'appliquent.
- **Sessions et CSRF du panneau** : régénération à la connexion, `AuthenticateSession` invalide les autres sessions au changement de mot de passe, CSRF actif. Voir N-07 pour les cookies.
- **Webhook** : secret comparé en temps constant, refus si vide (`BillingController.php:17-21`), idempotence par id d'événement et par transaction.

## 8. Exigences S1 à S9 et verdict G3

| # | Critère (docs/11) | Statut | Preuve et réserve |
|---|---|---|---|
| S1 | Aucun accès à la donnée d'autrui, suite Pest verte | **Partielle** | Isolation par ressource relue (conversations, messages, appels, exports, médias, sanctions, panneau). Tests présents (`SecurityHardeningTest`, `Admin/PermissionsTest`), mais **non rejoués par moi**. Réserves : F-10 résiduel, N-09 |
| S2 | Limites de débit actives, tests 429 | **Partielle** | 429 testés pour connexion, limite générale, mineur par jour. Aucun test pour `age-check`, `register`, `password-forgot`, `media-upload`. Limites incorrectement calibrées pour un partage d'IP (N-03, N-06) |
| S3 | Pas de secret dans le dépôt, rapport `gitleaks` | **Non vérifiée** | Je n'ai pas rejoué `gitleaks` ni lu son journal ; aucun secret rencontré dans les fichiers lus (`.env.example`, `.env.prod.example` vides) |
| S4 | Dépendances sans vulnérabilité critique | **Non vérifiée** | `composer` absent de mon shell ; `npm audit` mobile non examiné |
| S5 | Médias non approuvés invisibles, test d'API | **Satisfaite pour les routes existantes** (lecture) | `config/media.php` : tout média passe en `processing` ; modération dans le panneau (`MediaModeration`) ; test non rejoué |
| S6 | Mineur suspecté traité en priorité, test du flux + procédure écrite | **Partielle** | File prioritaire et décisions faites dans le panneau (`ReportResource`), flux testé (`ModerationTest`). Procédure écrite aux autorités absente (T008 ouvert), organisation et budget de la modération absents (T009 ouvert), N-02 bloque la contestation, F-09 résiduel |
| S7 | Journal d'audit immuable, test de refus de modification | **Satisfaite en lecture** | Déclencheurs et tests de refus (schéma + `AuditTest.php:35`), écriture transactionnelle. Non rejoué. Réserve : rôle de base de données (section 7) ; N-08, N-13 |
| S8 | Sauvegarde restaurée, procès-verbal | **Non satisfaite** | `docs/runbooks/restauration.md:3` : « jamais exécutée » ; aucun procès-verbal |
| S9 | Revue indépendante sans point bloquant | **Non satisfaite** | Cette revue ouvre deux constats hauts (N-01, N-02) |

### Verdict G3 (Sécurité) : **NON**

Il manque :
1. Corriger **N-01** (isolation du panneau par domaine et dans Caddy, liste d'IP obligatoire) et **N-02** (contestation après sanction du personnel), avec les tests proposés.
2. Traiter ou accepter par écrit (décision du propriétaire) les risques résiduels moyens : F-02, F-09, F-08 (événement inconnu), F-10 (`is_visible`), et décider des régressions N-03, N-04, N-06 avant tout lancement sur des réseaux à adresses partagées.
3. Fermer N-05 (enrôlement du 2FA) au moins pour les comptes administrateur.
4. Preuves d'exécution : rejouer Pest sur PostgreSQL (journal joint), `composer audit`, `npm audit` du mobile, `gitleaks` sur l'historique complet du commit final ; procès-verbal de restauration réel (S8).
5. Conditions non techniques déjà connues : procédure aux autorités (T008), organisation et budget de la modération (T009), matrice juridique par marché, attestation d'appareil.
6. Une dernière relecture ciblée sur les correctifs de N-01 et N-02 pour prononcer S9.

## 9. Récapitulatif trié par gravité (constats de cette seconde revue)

| ID | Gravité | Sujet | Fichier:ligne principal | Statut de preuve |
|---|---|---|---|---|
| N-01 | Haute | Panneau `/admin` joignable sur le domaine API, liste d'IP contournée | `AdminPanelProvider.php:70-107`, `infra/caddy/Caddyfile:7-22,30-43` | VÉRIFIÉ (lu dans le code) |
| N-02 | Haute | Contestation impossible après sanction du personnel (jetons révoqués, connexion refusée) | `SanctionLedger.php:67-70,129`, `LoginController.php:42-44`, `OAuthController.php:50-52` | VÉRIFIÉ (lu dans le code) |
| N-03 | Moyenne | Limites par IP trop basses derrière un partage d'adresse | `AppServiceProvider.php:31-69` | VÉRIFIÉ ; ampleur SUPPOSÉE |
| N-04 | Moyenne | Refus d'âge par IP : blocage collectif et déni ciblé | `AgeGate.php:35,48` | VÉRIFIÉ |
| N-05 | Moyenne | Enrôlement du 2FA par le seul mot de passe | `StaffCreateCommand.php:26-40`, `vendor/filament/.../Login.php:119-165` | VÉRIFIÉ |
| N-06 | Moyenne | Déni de connexion ciblé par le compteur d'e-mail | `AppServiceProvider.php:44` | VÉRIFIÉ |
| F-02 résiduel | Moyenne | Refus d'âge contournable par changement d'IP | `AgeGate.php:29-50` | VÉRIFIÉ |
| F-08 résiduel | Moyenne | Événement d'utilisateur inconnu jamais rejoué | `RevenueCatProcessor.php:44-47` | VÉRIFIÉ |
| F-09 résiduel | Moyenne | Suspension par deux comptes jetables | `ReportController.php:58-60` | VÉRIFIÉ |
| F-10 résiduel | Moyenne | `is_visible` ignoré dans la liste des matchs | `MatchController.php:25` | VÉRIFIÉ |
| N-07 | Basse | Cookie sans `Secure`, session maintenue par le sondage, session `file` | `session.php:172`, `AdminStatsWidget.php:13`, `AdminPanelProvider.php:41-46` | VÉRIFIÉ ; effet SUPPOSÉ |
| N-08 | Basse | Journal d'audit rempli par un anonyme, saisie non bornée | `StaffAuthAudit.php:41` | VÉRIFIÉ |
| N-09 | Basse | Minimisation : e-mail au modérateur, support très informé, aperçus non journalisés | `MediaItemResource.php:49,56-58`, `MemberResource.php:45-46` | VÉRIFIÉ |
| N-10 | Basse | Mot de passe du personnel (8 caractères via le profil, initial en clair) | `EditStaffProfile.php:19-21`, `StaffCreateCommand.php:40` | VÉRIFIÉ |
| N-11 | Basse | Route `broadcasting/auth` dupliquée hors middlewares, `GET /` | `route:list`, `routes/web.php:6` | VÉRIFIÉ |
| N-12 | Basse | Pas de double contrôle des actions administrateur | `UserAdmin.php:77-146` | VÉRIFIÉ |
| N-13 | Basse | Traces incomplètes (expiration, console, ordre de suppression du selfie) | `SanctionLedger.php:102`, `Audit.php:64`, `VerificationReview.php:62` | VÉRIFIÉ |
| N-14 | Basse | Médias : lecture non bornée, 40 Mpx, orphelins, bibliothèques d'images | `MediaController.php:106`, `MediaSanitizer.php:14` | VÉRIFIÉ ; exposition libwebp SUPPOSÉE |
| F-06 résiduel | Basse | Date de naissance conservée, purge fragile | `AccountDeletion.php:46-50,88-91` | VÉRIFIÉ |
| F-16 résiduel | Basse | Alias d'e-mail, appareil non banni | `BannedIdentifiers.php:11-14` | VÉRIFIÉ |
| F-22 résiduel | Basse | Quotas par type absents | `MediaController.php:48-60` | VÉRIFIÉ |
| F-23 | Basse | `media_id` accepté sur un message texte (non corrigé) | `MessageController.php:88` | VÉRIFIÉ |

## 10. Lacunes de tests à combler pour la troisième passe

Tests Pest utiles et absents : staff suspendu depuis le panneau, puis `GET /me/sanctions` et `POST /appeals` (N-02) ; `GET /admin/login` avec l'hôte de l'API attendu 404 (N-01) ; 31 connexions en 15 minutes depuis 2 IP distinctes derrière le même proxy, attendu qu'elles ne se limitent pas (N-03) ; une date mineure refusée puis un adulte sur la même IP attendu autorisé selon la règle choisie (N-04) ; compteur d'e-mail qui ne bloque pas un utilisateur qui se connecte avec succès (N-06) ; retrait du consentement sensible puis `GET /matches` (F-10) ; événement d'utilisateur inconnu puis création du compte (F-08) ; deux comptes jetables qui signalent (F-09) ; un message texte avec `media_id` d'autrui (F-23) ; saisie de `<script>` dans `display_name` et `details`, rendu de la fiche attendu échappé (XSS, non testé aujourd'hui) ; `age-check`, `register`, `password-forgot` et `media-upload` jusqu'au 429 (S2).
