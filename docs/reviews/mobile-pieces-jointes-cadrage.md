# Cadrage : images dans les conversations (application mobile)

Date : 2026-11-22. Statut : **implémenté le 2026-11-22, parcours B** (voir la section 6). Les sections 1 à 5 décrivent l'état avant l'implémentation.

Ce document répond à la partie 6 de `docs/PROMPT-MOBILE-RESTES.md`. Il relie le besoin à la phase B6 du backlog (`docs/15-BACKLOG.md` : « Vidéo de profil, images dans le chat ») et à l'exigence FR-D-6 (« Images dans la conversation (modérées) », `docs/15b-TRACEABILITY.md`).

## 1. Ce qui est vérifié aujourd'hui

1. **Le dépôt d'une image de conversation existe déjà côté contrat et côté mobile.** Le type de média `message_image` figure dans `POST /media/upload-url` (`mobile/src/api/openapi.d.ts`, type `UploadKind`). Il accepte JPEG, PNG et WebP, 8 Mo au plus, 50 dépôts ouverts en même temps et 100 par jour (`backend/config/media.php`). Le client `uploadMedia` du mobile (`src/media/upload.ts`) et le sélecteur d'images (`src/media/picker.ts`) servent déjà aux photos de profil et au selfie.
2. **L'envoi d'un message image exige un média déjà approuvé.** `POST /conversations/{id}/messages` accepte `type: "image"` avec un `media_id` obligatoire. `MessageController` refuse le message (422, « Média invalide ou pas encore approuvé ») si le média n'appartient pas à l'expéditeur, n'est pas de type `message_image` ou n'a pas le statut `approved`.
3. **En production, un média n'est jamais approuvé tout de suite.** À la fin du dépôt (`POST /media/{id}/complete`), le média passe en `processing` et attend la revue humaine de l'administration (ADR 005). `MEDIA_AUTO_APPROVE` n'est vrai qu'en développement local, et `deploy:preflight` refuse de démarrer la production s'il est actif. Une image ne peut donc pas être envoyée juste après son dépôt.
4. **L'expéditeur ne peut pas savoir où en est sa modération.** Dans `routes/api`, les seules routes de média sont le dépôt, la fin de dépôt, la suppression et l'ordre des photos de profil. Je n'ai trouvé aucune route qui donne le statut d'un média de conversation, ni notification d'approbation.
5. **Un message ne porte que `media_id`, aucune adresse de lecture.** Les adresses signées de lecture (durée de vie 10 minutes, `media.read_ttl_minutes`) n'existent que pour les photos de profil (`ProfilePresenter`) et pour la file de modération de l'administration. Le mobile ne peut donc pas afficher une image reçue : il affiche « Photo reçue » (`conversation.media.image`).
6. **La modération reste une décision ouverte.** L'ADR 005 n'a pas choisi de prestataire de classification d'images (ni de détection de contenus d'abus d'enfants), et précise que sans prestataire la capacité dépend d'un effectif humain non budgété.

## 2. Ce que le mobile ferait

- Un bouton « joindre une image » dans la zone de saisie, qui réutilise le sélecteur et `uploadMedia` avec `kind: "message_image"`.
- Une bulle d'image avec quatre états : en cours d'envoi, en vérification, refusée, visible. Chaque état a un texte français et anglais, un libellé d'accessibilité et un test.
- L'affichage d'une image reçue, plein écran au toucher, avec une adresse qui expire : l'écran doit la redemander quand elle a expiré (10 minutes), sans casser le défilement.
- Une explication honnête quand la modération refuse (sans détailler le motif) et quand l'envoi échoue (réseau, quota de 100 par jour).
- Les gardes déjà en place continuent de s'appliquer : aucune couleur hors jetons, textes fr et en, aucun appel à une route qui n'existe pas.

Taille estimée : une à deux sessions de travail, tests Jest compris, après que le serveur a fixé son contrat.

## 3. Ce que le serveur doit offrir (non fait, hors du périmètre du mobile)

1. **Une adresse de lecture** pour une image de message : un champ dans la réponse des messages, ou une route de type `GET /media/{id}/url`. Elle ne doit répondre qu'aux deux participants de la conversation, uniquement si le média est `approved`, avec une adresse signée de courte durée.
2. **Le statut de modération côté expéditeur** : un champ `media_status` sur le message ou une route de lecture du statut, et idéalement une notification quand l'image est approuvée ou refusée.
3. **Le contrat régénéré** (`docs/openapi.json`), puis les types du mobile (`npm run api:types`).

## 4. Parcours utilisateur honnête pendant l'attente

Tant que la modération est humaine, l'expéditeur ne doit jamais croire que l'image est partie. Deux parcours sont possibles, à choisir par le propriétaire :

- **A. L'image attend avant d'être envoyée.** L'expéditeur dépose l'image, voit « En vérification, vous pourrez l'envoyer une fois l'image approuvée », et doit revenir l'envoyer. C'est le seul parcours possible avec le serveur actuel, mais il est lourd (délai humain, retour obligatoire).
- **B. Le message part tout de suite, l'image est masquée à la personne qui reçoit tant qu'elle n'est pas approuvée.** L'expéditeur voit « En vérification », le destinataire voit une bulle « Photo en cours de vérification ». Cela demande de changer la règle du serveur (accepter un média en `processing`, ne le révéler qu'après approbation).

## 5. Points à trancher avec le propriétaire et son juriste

- Chaque image de conversation passerait par la file de modération humaine : des modérateurs verraient des images privées. La politique de confidentialité et les conditions (`docs/legal/`, non touchées ici) doivent le dire, et le périmètre d'accès des modérateurs doit être validé.
- Le volume : jusqu'à 100 dépôts par jour et par personne, sans effectif de modération budgété (ADR 005).
- La procédure de signalement aux autorités selon les pays, toujours à fixer par le juriste (ADR 005).

## 6. Décision

Le propriétaire avait d'abord choisi, le 2026-11-22, de reporter avec la phase B6. Le même jour, il a demandé l'implémentation complète, a autorisé la modification de `backend/` pour cette partie et a choisi le **parcours B** (le message part tout de suite, l'image reste masquée au destinataire jusqu'à approbation).

Ce qui a été fait :
- **Serveur** : un média en revue est accepté dans un message ; `media_status` sur chaque message image ; `GET /conversations/{id}/messages/{messageId}/media` (membres seulement, approuvé seulement, adresse signée de 10 minutes, jamais mise en cache) ; signal `message.media` et notification push à l'approbation et au rejet ; contrat OpenAPI régénéré.
- **Mobile** : bouton « Joindre une photo », dépôt `message_image`, message `image`, aperçu de sa propre photo en vérification, états « en vérification » et « refusée », photo approuvée par adresse signée, plein écran, mise à jour en direct.

Le même jour, le propriétaire a aussi demandé les notes vocales et les vidéos et autorisé `infra/` : code fait, **fermé par défaut** tant que le conteneur `transcode` n'est pas déployé et essayé (`docs/runbooks/transcode.md`).

Ce qui reste (section 5 inchangée) : la modération humaine et son effectif, les textes légaux sur l'accès des modérateurs, la procédure de signalement aux autorités, et toute vérification sur appareil ou contre un vrai stockage.
