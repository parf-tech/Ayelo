# BROUILLON : Politique de confidentialité (non validée juridiquement)

> Brouillon technique à faire valider par un juriste. Les durées de conservation sont celles du **code actuel** ; elles ne sont pas des choix juridiques validés.

## 1. Responsable du traitement
[Identité, adresse, délégué à la protection des données, représentant dans l'UE/UK si nécessaire.]

## 2. Données que nous traitons et pourquoi

| donnée | finalité | base légale (à valider) | conservation actuelle du code |
| --- | --- | --- | --- |
| e-mail, mot de passe (haché), date de naissance | créer et sécuriser le compte, vérifier l'âge | contrat, obligation légale | jusqu'à anonymisation (30 jours après la demande de suppression) ; à l'anonymisation la date de naissance est **réduite à l'année** (`AccountDeletion`), elle n'est pas effacée : à valider |
| nom d'affichage, genre, genre recherché, pays d'origine et de résidence, ville, intention, bio | profil et mise en relation | contrat ; **consentement explicite** pour les données sensibles | idem |
| photos | profil, après examen | contrat | supprimées à l'anonymisation |
| messages | échanges entre membres | contrat | contenu effacé à l'anonymisation du compte de l'expéditeur |
| selfie de vérification | vérifier le profil | **consentement explicite** | supprimé dès la décision |
| signalements, sanctions, journal d'audit | sécurité, modération, obligations légales | intérêt légitime, obligation légale | signalements et preuves : 1 an ; sanctions et hash d'e-mail d'un compte sanctionné : [durée à fixer] |
| appareil (empreinte), adresse IP | limites de débit, sécurité, mémoire d'un refus d'âge | intérêt légitime | IP : non stockée durablement, sauf refus d'âge (**30 minutes**, `AgeGate::IP_REFUSAL_MINUTES` ; le brouillon disait 2 h, écart corrigé) ; appareil, e-mail (empreinte HMAC) et identifiant de connexion sociale : 90 jours pour un refus d'âge (`AgeGate::REFUSAL_DAYS`) |
| jeton de notification (appareil), plateforme | envoyer des notifications | contrat ou consentement (**à valider par un juriste**) | jusqu'à déconnexion, suppression ou jeton invalide (table `devices`) |
| archive d'export de vos données | vous remettre une copie de vos données | obligation légale (droit d'accès) | **7 jours** puis suppression de l'objet et de la ligne (`exports:purge`) |
| codes à usage unique (vérification d'e-mail, réinitialisation) | sécuriser le compte | contrat | 24 h (vérification), 60 min (réinitialisation) |
| envois de médias non finalisés ou orphelins | hygiène du stockage | intérêt légitime | 24 h (non finalisés), 48 h (objets sans ligne en base) |
| journaux techniques du serveur (`laravel.log`) | exploitation, sécurité | intérêt légitime | **non défini** : fichier unique, sans rotation configurée, niveau `debug` par défaut ; contenu non audité (à décider et à documenter) |
| achats | fournir l'accès Premium, comptabilité | contrat, obligation légale | [durée comptable — juriste] |
| position approximative (phase ultérieure) | rencontres à proximité | **consentement** | non applicable pour le lancement |

## 3. Données sensibles
Le genre et le genre recherché peuvent révéler une orientation sexuelle ; l'origine peut révéler une origine ethnique ; l'usage d'un service de rencontres peut révéler la vie sentimentale. Nous les traitons **uniquement avec votre consentement explicite**, que vous pouvez retirer (le profil est alors masqué).

## 4. Destinataires et sous-traitants
Les autres membres voient votre profil public (nom d'affichage, âge, pays, ville, bio, intention, photos approuvées, badge). Sous-traitants : [hébergeur], Cloudflare (stockage), RevenueCat, Apple, Google (paiements et notifications), LiveKit (appels), [fournisseur d'e-mail], [prestataire de modération]. [Transferts hors UE, garanties, accords de traitement : juriste.]

### 4 bis. Prestataires réels relevés dans le code et l'infrastructure (ajout du 2026-11-07, **à valider par un juriste**)

> **[À VALIDER PAR UN JURISTE]** Ce tableau a été établi en lisant `backend/config`, `backend/app/Services`, `mobile/package.json` et `infra/`. Il décrit ce que le **code prévoit**, pas ce qui a été contractualisé : aucun compte, contrat ni accord de traitement n'existe à ce jour, et aucun de ces flux n'a été exécuté contre un vrai service (voir `replica/backend.md`). Il n'affirme aucune conformité.

| prestataire | rôle | données qui lui parviennent (selon le code) | état |
| --- | --- | --- | --- |
| **Hébergeur du serveur** : VPS Hostinger envisagé (`docs/14b-COSTS.md`) | exécute l'API, la base PostgreSQL, Redis, Reverb, les journaux et les sauvegardes locales | **toutes** les données de la base (comptes, profils, messages en clair, signalements, achats, journal d'audit), journaux techniques | choix et lieu d'hébergement non confirmés ; rien n'est déployé |
| **Cloudflare R2** (stockage S3, `backend/config/media.php`) | photos de profil, images de messages, selfies de vérification, archives d'export, éventuellement sauvegardes (bucket distinct prévu) | fichiers image (EXIF retiré, ré-encodés), archives d'export de données (7 jours) ; accès par URL présignées (envoi 5 min, lecture 10 min) | code écrit, jamais exécuté contre un vrai bucket |
| **Serveur WebSocket Reverb** | temps réel (messages, présence d'appels) | auto-hébergé sur le VPS : **aucun tiers** ; la bibliothèque cliente `pusher-js` n'est qu'un client de protocole, aucun service Pusher n'est utilisé | |
| **RevenueCat** (`react-native-purchases`, webhook) | achats intégrés, abonnement Premium, packs | côté application : identifiant d'utilisateur interne (`user.id`, pas l'e-mail) et reçus d'achat via les stores ; côté serveur : événements reçus par webhook, stockés tels quels dans `webhook_events` (vidés (`{}`) à l'anonymisation du compte) ; **autres données collectées directement par le SDK RevenueCat : à relever dans leur documentation** | format des événements supposé, aucun événement réel reçu |
| **Apple App Store, Google Play** | paiement, distribution | transactions gérées par les stores (nous ne recevons pas les moyens de paiement) | |
| **Firebase Cloud Messaging (Google) et service de notifications Apple (APNs, via FCM)** (`FcmPushNotifier`) | notifications | jeton de l'appareil, plateforme ; **contenu de la notification : pour un message, les 80 premiers caractères du texte du message en clair, ou « Média reçu » ; pour un appel, le nom d'affichage de l'appelant et « Appel audio/vidéo entrant »** | côté serveur écrit, jamais exécuté ; côté application : aucun paquet de notifications dans `mobile/package.json` à ce jour |
| **LiveKit Cloud** (`LiveKitTokens`, `docs/DECISIONS-PROPRIETAIRE.md` E2) | appels audio et vidéo | jeton de 10 minutes contenant l'identifiant d'utilisateur, le nom d'affichage et le nom de salle ; **les flux audio et vidéo des appels transitent par ses serveurs** (région non choisie) | jetons testés, aucun appel établi |
| **Fournisseur d'e-mail transactionnel (SMTP)** : Resend ou Postmark, non choisi (`docs/runbooks/email-dns.md`) | e-mails de vérification, réinitialisation, confirmation de suppression | adresse e-mail, langue, et le lien contenant un jeton à usage unique | non choisi, aucun e-mail réel envoyé |
| **Google et Apple (connexion sociale)** (`JwtOAuthVerifier`, `config/services.php`) | connexion avec Google ou Apple | le serveur télécharge **leurs clés publiques** (`googleapis.com/oauth2/v3/certs`, `appleid.apple.com/auth/keys`) et vérifie le jeton reçu de l'application ; il ne leur envoie aucune donnée de l'utilisateur. Il reçoit l'identifiant du compte social et l'e-mail (et s'il est vérifié). Portée limitée à l'identité de base | aucun paquet de connexion sociale dans `mobile/package.json` à ce jour ; vérification réelle jamais faite |
| Outil d'analyse d'usage (analytics) | | **aucun** trouvé dans le code, dans `mobile/package.json` ni dans l'infrastructure | si l'un est ajouté, mettre ce document à jour avant la mise en ligne |
| Outil de suivi des plantages / erreurs | | **aucun intégré** ; Sentry est prévu dans `docs/14-DEPLOYMENT.md` mais absent du code. S'il est ajouté, il recevra des traces techniques pouvant contenir des identifiants | à décider ; mettre à jour ici le cas échéant |
| SMS | | **aucun** (prévu dans la liste des coûts, absent du code) | |
| Modération automatique d'images | | **aucune** dans le code ; modération humaine par le personnel (`MEDIA_AUTO_APPROVE=false`). Un prestataire serait un sous-traitant de plus | non choisi |
| Caddy / Let's Encrypt | certificats TLS | nom de domaine et adresse `ACME_EMAIL` (contact technique) ; pas de donnée d'utilisateur | |

Points d'attention relevés par la comparaison, **à arbitrer par un juriste et par le propriétaire** :
1. **Contenu des notifications** : extraits de messages privés transmis à Google (FCM) et, pour iOS, à Apple. Le brouillon d'origine ne le disait pas. Une option technique est de n'envoyer qu'un texte générique (« Nouveau message ») : décision produit, non prise.
2. **Messages non chiffrés de bout en bout** : ils sont stockés en clair en base (protégés par le transport TLS et le contrôle d'accès). La section 7 ne doit pas laisser croire à un chiffrement de bout en bout.
3. **Appels** : le contenu audio et vidéo passe par LiveKit ; le brouillon ne mentionnait que « LiveKit (appels) » sans dire que les flux eux-mêmes y transitent.
4. **Transferts hors UE** : Google, Apple, RevenueCat, LiveKit Cloud, Cloudflare et le prestataire d'e-mail peuvent traiter des données hors de l'UE. Mécanismes (clauses contractuelles types, cadre de protection des données UE-États-Unis, etc.), régions et accords de traitement : non traités ici.
5. **Journaux techniques** : durée et contenu non définis (voir tableau de la section 2).
6. **Bases légales et marchés** (Canada, Suisse, Royaume-Uni, États-Unis, Afrique) : voir `docs/legal/04-matrice-marches.md`, questions ouvertes.

## 5. Vos droits
Accès et export (dans l'application), rectification, suppression (dans l'application ou sur [page web]), opposition, limitation, retrait du consentement, réclamation auprès de l'autorité de contrôle. [Adresse de contact.]

## 6. Mineurs
Le service est réservé aux personnes de 18 ans et plus. Un compte soupçonné d'appartenir à un mineur est suspendu et examiné.

## 7. Sécurité
Chiffrement des communications, mots de passe hachés, accès restreints, journalisation des actions d'administration. Aucune mesure n'est infaillible.

## 8. Sauvegardes
Des sauvegardes chiffrées sont conservées [14 jours + 3 mois] ; une donnée supprimée peut y subsister jusqu'à leur rotation, sans être restaurée en production. [À valider.]

> **[À VALIDER PAR UN JURISTE]** État réel (2026-11-07) : le script `infra/scripts/backup.sh` conserve **14 jours** par défaut (`BACKUP_RETENTION_DAYS`) sur le volume du serveur ; la règle « 3 mensuelles » n'est **pas implémentée** et la rétention du bucket distant n'est pas configurée. Le chiffrement GPG est **facultatif et non activé** par défaut : sans lui, les archives, qui contiennent toutes les données personnelles, sont en clair sur le volume et dans le bucket. Rien de tout cela n'a été exécuté (`docs/runbooks/restauration.md`). Ne pas écrire « chiffrées » dans la version publiée tant que ce n'est pas vrai. Procédure de re-suppression après restauration : étape 7 de la procédure de restauration.

Version : brouillon 0.2 (2026-11-07) : ajout de la section 4 bis (prestataires réels), corrections de durées (IP, âge), nouvelles lignes de conservation. Toujours non validé juridiquement ; aucune conformité n'est affirmée.
