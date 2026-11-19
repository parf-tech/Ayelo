# Procédure : e-mail transactionnel et DNS (SPF, DKIM, DMARC)

**État au 2026-11-19 :** Resend est choisi ; `ayelo.fr` est ajouté au compte en région Irlande (`eu-west-1`). Les nameservers du domaine pointent vers Cloudflare et les trois enregistrements Resend ont été ajoutés en DNS uniquement. Le DNS public les résout, mais Resend affiche encore le domaine en attente : `send` est vérifié, DKIM et `rsend` restent en attente. La réception reste chez Hostinger (MX conservés, réception Resend désactivée). `infra/.env.prod` n'existe pas dans ce workspace : il faut vérifier/configurer la clé SMTP côté serveur. Aucun envoi réel n'a été vérifié depuis l'application.

Ce que l'application envoie (code lu : `backend/app/Services/AccountMail.php`, `AccountController`) : vérification d'adresse, réinitialisation de mot de passe, confirmation de suppression de compte. Uniquement des e-mails transactionnels, en français et en anglais, sans marketing.

## 1. Prestataire retenu

L'application utilise le transport SMTP natif de Laravel 12 ; aucun SDK supplémentaire n'est requis. Paramètres officiels Resend : `smtp.resend.com`, port `587` (STARTTLS) ou `465` (TLS implicite), utilisateur `resend`, mot de passe égal à une clé API Resend. La documentation du tableau de bord reste la référence si ces paramètres changent.

Créer une clé API limitée à l'envoi dans Resend et la conserver comme secret dans l'environnement de production. Elle va dans `MAIL_PASSWORD`, jamais dans Git, une image Docker ou les journaux. La région configurée et l'accord de traitement doivent être validés avant la mise en production (`docs/legal/02-politique-confidentialite.md`).

## 2. Domaine d'envoi

Le domaine ajouté chez Resend est `ayelo.fr` (domaine racine) ; l'adresse d'expédition configurée est `no-reply@ayelo.fr`. C'est le choix actuellement appliqué, même si un sous-domaine dédié isolerait davantage la réputation d'envoi.

La messagerie humaine continue chez Hostinger : conserver ses MX, SPF, DKIM, autoconfig et autodiscover. Ne pas activer la réception Resend ni remplacer les MX Hostinger.

## 3. Variables SMTP

Dans `infra/.env.prod` (hors dépôt, droits 600), recopier le bloc de `infra/.env.prod.example` et ajouter la clé API Resend comme `MAIL_PASSWORD`. Le gabarit local `backend/.env.example` garde `MAIL_MAILER=log` afin que le développement n'envoie pas de vrais e-mails.

| variable | valeur | remarque |
| --- | --- | --- |
| `MAIL_MAILER` | `smtp` | |
| `MAIL_HOST` | `smtp.resend.com` | |
| `MAIL_PORT` | `587` | STARTTLS ; `465` est aussi accepté pour TLS implicite |
| `MAIL_SCHEME` | vide | Laravel/Symfony négocie STARTTLS sur le port 587 |
| `MAIL_USERNAME` | `resend` | |
| `MAIL_PASSWORD` | clé API Resend | secret ; créer une clé limitée à l'envoi |
| `MAIL_FROM_ADDRESS` | `no-reply@ayelo.fr` | domaine d'envoi vérifié requis |
| `MAIL_FROM_NAME` | `Ayelo` | |
| `MAIL_EHLO_DOMAIN` | `ayelo.fr` | facultatif |

Après modification : redémarrer `app`, `worker` et `scheduler` (le `worker` envoie les e-mails mis en file). Aucun secret dans le dépôt, dans l'image ni dans les journaux.

## 4. Enregistrements DNS

Les noms et valeurs ci-dessous viennent du tableau de bord Resend pour `ayelo.fr`. Tous sont en DNS uniquement dans Cloudflare.

### 4.1 Chemin de retour / SPF

Ne pas ajouter de deuxième SPF au domaine racine : l'enregistrement Hostinger existant `v=spf1 include:_spf.mail.hostinger.com ~all` est conservé. Resend fournit ici des CNAME pour son chemin de retour :

| nom | type | cible | état Resend |
| --- | --- | --- | --- |
| `rsend.ayelo.fr` | CNAME | `rsend-euw1.forge.rmta.net` | en attente |
| `send.ayelo.fr` | CNAME | `send.forge.rmta.net` | vérifié |

Les cibles sont propres au compte/région : ne pas les remplacer par des valeurs trouvées dans un ancien guide.

### 4.2 DKIM

| nom | type | contenu | état Resend |
| --- | --- | --- | --- |
| `resend._domainkey.ayelo.fr` | TXT | clé publique `p=...` générée par Resend | en attente |

La valeur complète est dans les tableaux de bord Resend et Cloudflare. C'est une clé publique ; ne jamais publier ni générer une clé privée.

### 4.3 DMARC (TXT)

L'enregistrement existant `_dmarc.ayelo.fr` est conservé avec `v=DMARC1; p=none`. Ne pas le remplacer pendant le démarrage de Resend.

Durcir la politique seulement après au moins deux semaines de rapports propres :
1. `p=none` (observation, aucun message rejeté) ;
2. `p=quarantine; pct=25`, puis `pct=100` ;
3. `p=reject`.

Pour que DMARC passe, au moins un alignement doit réussir : DKIM (`d=`) ou domaine du chemin de retour SPF avec celui du From (en alignement relaxé, un sous-domaine est permis).

### 4.4 Facultatifs recommandés
- **MTA-STS** et **TLS-RPT** : à étudier plus tard, non nécessaires au lancement.
- **BIMI** : inutile pour du transactionnel.
- Enregistrement MX et boîte pour `dmarc@` et `support@` : à créer chez le fournisseur de messagerie humaine, indépendamment du prestataire transactionnel.

## 5. Liste de vérification

- [x] Domaine `ayelo.fr` ajouté dans Resend, région Irlande (`eu-west-1`), envoi activé et réception désactivée.
- [x] Nameservers Cloudflare et trois enregistrements Resend configurés ; les réponses DNS publiques sont visibles.
- [x] Vérification Resend : un envoi depuis `no-reply@ayelo.fr` est accepté par Resend le 2026-11-19 (domaine utilisable pour l'envoi). Confirmer dans le tableau de bord que DKIM et `rsend` sont « Verified ».
- [x] Clé Resend limitée à l'envoi en place comme `MAIL_PASSWORD` dans `infra/.env.prod` (2026-11-19, hors dépôt) ; `MAIL_MAILER=smtp` ; essai vers `delivered@resend.dev` accepté. Reste : webhooks de rebond et de plainte (section suivante), DMARC `p=none` à durcir.
- [ ] Après vérification du domaine, tester un e-mail de vérification vers une boîte contrôlée.
- [ ] **En-têtes** : `Authentication-Results` indique `spf=pass`, `dkim=pass` et `dmarc=pass`, avec `header.from=ayelo.fr`. Tester Gmail et Outlook.
- [ ] Vérifier la réception en boîte principale, les rebonds/plaintes et le webhook de la section 5 bis.
- [ ] Le lien reçu pointe vers `APP_WEB_URL` (HTTPS), pas vers `localhost` ni `example.invalid`.
- [ ] Faire valider par un juriste l'accord de traitement, la région et la politique de confidentialité avant la mise en production.

## 5 bis. Rebonds et plaintes (webhook)

Une adresse en rebond définitif ou en plainte pour courrier indésirable ne doit plus recevoir d'e-mail : l'insister abîme la réputation du domaine d'envoi. L'application tient la table `email_suppressions` (adresse, motif `hard_bounce` ou `complaint`, prestataire, date) ; `AccountMail` (vérification d'adresse, réinitialisation du mot de passe, confirmation de suppression de compte) ignore en silence ces adresses : aucun jeton créé, aucune erreur, réponse HTTP identique à celle d'une adresse normale (pas d'énumération).

1. Générer un secret : `openssl rand -hex 32`, le mettre dans `MAIL_WEBHOOK_SECRET` (`infra/.env.prod`), redémarrer. Vide : la route répond 401 à tout (aucune suppression).
2. Chez le prestataire, créer un webhook `POST https://<API>/api/v1/webhooks/mail` avec l'en-tête `X-Mail-Webhook-Secret: <secret>` (ou `Authorization: Bearer <secret>`).
   - **Postmark** : événements « Bounce » et « Spam complaint » ; en-tête personnalisé disponible dans la configuration du webhook. Sont retenus : `RecordType` `Bounce` avec `Type` `HardBounce` ou `SpamComplaint`, et `RecordType` `SpamComplaint` (champ `Email`). Les rebonds temporaires sont ignorés.
   - **Resend** : événements `email.bounced` et `email.complained` (adresses dans `data.to[]`). Un `data.bounce.type` autre que `Permanent` est ignoré. **Réserve** : Resend signe ses webhooks (Svix) et ne permet pas, à notre connaissance, un en-tête secret personnalisé ; à vérifier dans la documentation au moment de la mise en place. Sans en-tête possible, il faut soit un relais qui ajoute l'en-tête, soit ajouter la vérification de la signature Svix au contrôleur (non fait).
3. Le webhook est idempotent (un doublon est sans effet) et répond 200 même pour un événement ignoré. Les journaux n'enregistrent aucune adresse.
4. Lever une suppression (adresse corrigée par la personne, faux positif) : `delete from email_suppressions where email = '<adresse>';` après vérification auprès du prestataire que l'adresse n'est plus en liste de blocage de son côté.
5. Contrôle : envoyer un rebond d'essai (Postmark propose des événements de test) puis `select reason, provider, created_at from email_suppressions order by created_at desc limit 5;`.

## 6. En cas de problème
- Courrier indésirable : vérifier d'abord l'alignement DMARC et la présence de DKIM, puis la réputation de l'IP partagée (demander une IP dédiée seulement si le volume le justifie).
- `550` ou `535` à l'envoi : identifiants `MAIL_USERNAME` / `MAIL_PASSWORD` ou adresse « From » hors du domaine vérifié.
- File qui grossit : le `worker` ne tourne pas ou le port SMTP sortant est bloqué par l'hébergeur du VPS (vérifier le port 587 ou 465 sortant ; certains hébergeurs bloquent le 25).
