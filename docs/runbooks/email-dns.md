# Procédure : e-mail transactionnel et DNS (SPF, DKIM, DMARC)

**Statut : écrite, rien n'a été fait ni envoyé.** Aucun prestataire n'est choisi, aucun domaine n'est acheté, aucun enregistrement DNS n'existe, aucun e-mail réel n'est parti du code. Les valeurs de prestataire citées ci-dessous viennent de la mémoire de l'auteur et **doivent être relues dans la documentation et le tableau de bord du prestataire** le jour de la mise en place : en cas d'écart, le tableau de bord fait foi.

Ce que l'application envoie (code lu : `backend/app/Services/AccountMail.php`, `AccountController`) : vérification d'adresse, réinitialisation de mot de passe, confirmation de suppression de compte. Uniquement des e-mails transactionnels, en français et en anglais, sans marketing.

## 1. Choisir le prestataire

Le code n'a besoin d'aucun nouveau paquet PHP : Laravel 12 parle SMTP nativement (`backend/config/mail.php`, transport `smtp`, variables `MAIL_*`). Resend et Postmark offrent tous deux un relais SMTP. (`config/mail.php` et `config/services.php` prévoient aussi des transports par API, `RESEND_API_KEY` et `POSTMARK_API_KEY`, mais ils demanderaient un paquet supplémentaire : on reste en SMTP.)

| critère | Resend | Postmark |
| --- | --- | --- |
| Raccordement | SMTP (`smtp.resend.com`), utilisateur `resend`, mot de passe = clé d'API | SMTP (`smtp.postmarkapp.com`), utilisateur et mot de passe = jeton du serveur |
| Orientation | e-mail développeur, tableau de bord simple | e-mail transactionnel uniquement, flux (« streams ») séparés transactionnel / diffusion |
| Région des données | à vérifier (une région UE est proposée selon l'offre) | à vérifier (hébergement aux États-Unis, à confirmer) |
| Tarif | **non vérifié** : lire la grille officielle le jour de l'achat | **non vérifié** : idem |
| Rebonds et plaintes | suppression automatique des adresses en échec, webhooks | idem, avec historique détaillé |

Points à trancher par le propriétaire (aucun n'est tranché ici) :
1. **Région et sous-traitance** : le prestataire reçoit l'adresse e-mail et le contenu du message (lien de vérification, lien de réinitialisation) de chaque utilisateur. Il doit figurer dans la politique de confidentialité (`docs/legal/02-politique-confidentialite.md`) et faire l'objet d'un accord de traitement ; transferts hors UE : à valider par un juriste.
2. **Volume et prix** : le volume prévu (inscriptions + réinitialisations) est faible au lancement ; comparer les paliers gratuits **au moment de l'achat**.
3. **Marchés visés** : vague 1 France, Belgique, Suisse, Canada francophone. Tester la réception chez Gmail, Outlook et les fournisseurs locaux (Orange, Free, Proximus, Bell/Videotron) avant le lancement.

Recommandation de travail, sans engagement : les deux conviennent techniquement ; choisir sur la région des données, l'accord de traitement et le prix du jour. Ne pas dépendre d'un seul prestataire sans en avoir testé un second sur un domaine d'essai.

## 2. Domaine d'envoi

Utiliser un **sous-domaine dédié à l'e-mail transactionnel**, par exemple `mail.<DOMAINE>`, plutôt que le domaine racine : la réputation d'envoi est isolée du site et des boîtes e-mail humaines (qui, elles, restent sur `<DOMAINE>`). Adresse d'expédition : `no-reply@mail.<DOMAINE>` ; prévoir une adresse de réponse lisible (`support@<DOMAINE>`) dans le contenu des messages, et une adresse `dmarc@<DOMAINE>` (ou un service de rapports) pour les rapports DMARC.

`<DOMAINE>` n'existe pas encore (choix du nom en attente, voir `docs/DECISIONS-PROPRIETAIRE.md`). Tant qu'il n'y a pas de domaine, ne rien envoyer d'autre qu'en test (MAILER `log`).

## 3. Variables SMTP à renseigner

Dans `infra/.env.prod` (hors dépôt, droits 600). Le gabarit est dans `infra/.env.prod.example`, bloc `MAIL_*`.

| variable | valeur | remarque |
| --- | --- | --- |
| `MAIL_MAILER` | `smtp` | |
| `MAIL_HOST` | `smtp.resend.com` ou `smtp.postmarkapp.com` | selon le prestataire |
| `MAIL_PORT` | `587` (ou `465`) | avec 465, Laravel passe tout seul en TLS implicite (`smtps`) |
| `MAIL_SCHEME` | vide | n'y toucher que si le prestataire l'impose |
| `MAIL_USERNAME` | Resend : `resend` ; Postmark : jeton du serveur | **secret pour Postmark** |
| `MAIL_PASSWORD` | Resend : clé d'API ; Postmark : le même jeton | **secret** |
| `MAIL_FROM_ADDRESS` | `no-reply@mail.<DOMAINE>` | doit appartenir au domaine vérifié chez le prestataire |
| `MAIL_FROM_NAME` | nom du produit | |
| `MAIL_EHLO_DOMAIN` | nom d'hôte du serveur d'API | facultatif |

Après modification : redémarrer `app`, `worker` et `scheduler` (le `worker` envoie les e-mails mis en file). Aucun secret dans le dépôt, dans l'image ni dans les journaux.

## 4. Enregistrements DNS à créer

Les noms et valeurs **exacts** (sélecteur DKIM, cibles CNAME, valeur de la clé publique) sont générés par le prestataire quand on ajoute le domaine dans son tableau de bord : les copier tels quels. Le modèle ci-dessous donne la forme attendue ; les valeurs entre chevrons sont des emplacements à remplacer.

### 4.1 SPF (TXT)

Un domaine ne peut avoir **qu'un seul** enregistrement SPF (deux enregistrements = SPF invalide). Il doit exister pour le domaine qui apparaît dans le chemin de retour (Return-Path, ou « MAIL FROM ») que le prestataire utilise.

| prestataire | nom | type | valeur (forme attendue, à confirmer dans le tableau de bord) |
| --- | --- | --- | --- |
| Resend | `send.mail.<DOMAINE>` (ou `send.<DOMAINE>` selon ce que propose le tableau de bord) | TXT | `v=spf1 include:amazonses.com ~all` |
| Resend | même nom | MX | `feedback-smtp.<région>.amazonses.com`, priorité 10 (rebonds) |
| Postmark | `pm-bounces.mail.<DOMAINE>` | CNAME | `pm.mtasv.net` (chemin de retour, ce qui rend l'alignement SPF possible) |
| Postmark | `mail.<DOMAINE>` (facultatif) | TXT | `v=spf1 include:spf.mtasv.net ~all` |

Si le sous-domaine porte déjà un SPF, **fusionner** les `include:` dans un seul enregistrement. Terminer par `~all` au départ, puis `-all` quand tout est validé.

### 4.2 DKIM (TXT ou CNAME)

| prestataire | nom | type | valeur |
| --- | --- | --- | --- |
| Resend | `resend._domainkey.mail.<DOMAINE>` | TXT | `p=<CLÉ_PUBLIQUE_FOURNIE_PAR_RESEND>` |
| Postmark | `<SÉLECTEUR_FOURNI>._domainkey.mail.<DOMAINE>` | TXT | `k=rsa; p=<CLÉ_PUBLIQUE_FOURNIE_PAR_POSTMARK>` |

Le sélecteur et la clé viennent du tableau de bord. Si le fournisseur DNS limite la longueur d'une chaîne TXT, découper la clé en morceaux de 255 caractères au plus (le fournisseur DNS le fait souvent seul). Ne jamais générer ni publier soi-même une clé privée : seule la clé publique figure dans le DNS.

### 4.3 DMARC (TXT)

Un seul enregistrement, sur `_dmarc.<DOMAINE>` (la politique du domaine racine couvre aussi `mail.<DOMAINE>` par défaut) :

| nom | type | valeur |
| --- | --- | --- |
| `_dmarc.<DOMAINE>` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@<DOMAINE>; fo=1; adkim=r; aspf=r` |

Montée en charge de la politique, chaque étape après au moins deux semaines de rapports propres :
1. `p=none` (observation, aucun message rejeté) ;
2. `p=quarantine; pct=25`, puis `pct=100` ;
3. `p=reject`.

Pour que DMARC passe, **au moins un** des deux alignements doit réussir : le domaine du DKIM (`d=`) ou le domaine du chemin de retour SPF doit être le même domaine que celui de l'adresse « From » (ou un sous-domaine, en alignement relaxé `r`). C'est la raison d'être du sous-domaine dédié et du chemin de retour personnalisé. Si les rapports DMARC sont envoyés à une adresse hors de `<DOMAINE>`, le domaine destinataire doit publier une autorisation : rester sur `<DOMAINE>` évite cela.

### 4.4 Facultatifs recommandés
- **MTA-STS** et **TLS-RPT** : à étudier plus tard, non nécessaires au lancement.
- **BIMI** : inutile pour du transactionnel.
- Enregistrement MX et boîte pour `dmarc@` et `support@` : à créer chez le fournisseur de messagerie humaine, indépendamment du prestataire transactionnel.

## 5. Liste de vérification

À cocher dans l'ordre, avec la date, qui l'a fait, et la preuve (capture ou copie de l'en-tête sans donnée personnelle). **Rien n'est coché aujourd'hui.**

- [ ] Domaine acheté ; compte chez le prestataire créé par le propriétaire (aucune clé créée par un agent).
- [ ] Domaine d'envoi ajouté chez le prestataire ; son tableau de bord affiche SPF et DKIM « vérifiés ».
- [ ] Vérification directe dans le DNS (remplacer les valeurs) :
  `dig +short TXT <SÉLECTEUR>._domainkey.mail.<DOMAINE>`, `dig +short TXT send.mail.<DOMAINE>` (ou le nom SPF du tableau de bord), `dig +short TXT _dmarc.<DOMAINE>`.
- [ ] Un seul enregistrement SPF par nom (`dig +short TXT <nom> | grep -c spf1` donne 1).
- [ ] `infra/.env.prod` renseigné ; services redémarrés.
- [ ] Envoi d'un vrai message de vérification d'adresse depuis l'application (compte de test) vers une boîte Gmail personnelle.
- [ ] **En-têtes** (Gmail : menu « Afficher l'original ») : `Authentication-Results` contient `spf=pass`, `dkim=pass` et `dmarc=pass`, et le domaine après `header.from=` est bien le domaine d'envoi. Faire de même vers une boîte Outlook.
- [ ] **mail-tester.com** : envoyer un message de réinitialisation vers l'adresse jetable que le site fournit ; viser **9/10 ou plus** ; lire le détail (SPF, DKIM, DMARC, liste noire, contenu).
- [ ] Le message arrive en boîte de réception, pas en courrier indésirable, chez Gmail, Outlook et au moins un fournisseur local d'un marché de la vague 1.
- [ ] Le lien du message pointe vers `APP_WEB_URL` (HTTPS), pas vers `localhost` ni `example.invalid`.
- [ ] Rebonds et plaintes : le tableau de bord du prestataire reçoit bien les rebonds (envoi vers une adresse inexistante sur un domaine d'essai), et le webhook de la section 5 bis est branché (une ligne apparaît dans `email_suppressions`).
- [ ] Rapports DMARC agrégés reçus pendant deux semaines avant de durcir `p=`.
- [ ] Réputation : inscrire le domaine d'envoi à Google Postmaster Tools.
- [ ] Mettre à jour `replica/backend.md` (ligne « Expéditeur sur le domaine du produit, SPF/DKIM/DMARC ») et `docs/legal/02-politique-confidentialite.md` (nom du prestataire).

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
