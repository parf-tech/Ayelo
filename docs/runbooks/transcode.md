# Notes vocales et vidéos de conversation : conteneur `transcode`

Écrit le 2026-11-22. Public : la personne qui déploie ou exploite le serveur.

## Ce que c'est

Une note vocale (2 minutes au plus) ou une vidéo (30 secondes et 50 Mo au plus) envoyée dans une conversation n'est **jamais servie telle que déposée**. Le parcours d'un fichier :

1. L'application dépose le fichier dans le stockage objet (URL présignée), puis confirme (`POST /media/{id}/complete`). Le serveur vérifie la taille et le type réellement déposés et passe le média à `transcoding`.
2. La tâche `TranscodeChatMedia` (file `default`, worker) lit le fichier et le dépose dans le dossier partagé `/spool/in`.
3. Le conteneur `transcode` (ffmpeg) le réencode sans métadonnées (aucune géolocalisation, aucun chapitre, aucun sous-titre), mesure la durée du résultat et dépose `/spool/out/<id>.bin`, puis la marque `.ok`.
4. La tâche contrôle le résultat (type, taille, durée), le range sous une nouvelle clé, supprime l'original et passe le média à `processing` : il entre alors dans la file de modération humaine du panneau d'administration (type « Message vocal » ou « Message vidéo »).
5. Le modérateur approuve ou refuse. Les deux membres sont prévenus en direct (signal `message.media`) et par notification push. La lecture (`GET /conversations/{id}/messages/{messageId}/media`) n'est ouverte qu'après l'approbation.

Un fichier illisible, trop long, trop lourd, du mauvais type, ou un traitement qui dépasse `MEDIA_TRANSCODE_TIMEOUT` : média refusé (`rejected`, motif interne `unreadable`), fichiers supprimés, expéditeur prévenu, motif jamais détaillé.

Le message part tout de suite (parcours « B » de la partie 6) : le destinataire voit « en cours de vérification » jusqu'à l'approbation.

## Pourquoi un conteneur à part

ffmpeg traite des fichiers envoyés par des inconnus. Le conteneur n'a **aucun réseau** (`network_mode: none`), un système de fichiers en lecture seule, aucune capacité (`cap_drop: ALL`), `no-new-privileges`, au plus 128 processus, 1,5 CPU et 768 Mo (`TRANSCODE_CPUS`, `TRANSCODE_MEMORY_LIMIT`), et ffmpeg est tué au-delà de 120 secondes par fichier. Son seul lien avec le reste est le volume `transcode-spool`. Une faille de ffmpeg ne donne donc accès ni à la base, ni aux clés du stockage, ni à Internet.

## Activer (fermé par défaut)

Tant que `MEDIA_CHAT_AV_ENABLED=false` (valeur par défaut), le serveur refuse les dépôts et les messages vocaux ou vidéo (422), et le conteneur reste au repos.

Avant d'activer, dans cet ordre :

1. Construire et démarrer le conteneur sur le serveur : `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build transcode`. Il doit devenir `healthy`. **Jamais construit ni exécuté depuis le poste de développement** (Docker absent) : c'est le premier essai réel.
2. Épingler l'image de base par condensat (`docker buildx imagetools inspect alpine:3.21`), comme les autres images, et reporter le condensat dans `infra/transcode/Dockerfile`.
3. Reconstruire l'image PHP (`app`, `worker`) : elle crée `/spool` au même propriétaire (82).
4. **Essai réel avec de vrais fichiers** : déposer une note vocale de 30 secondes et une vidéo de 20 secondes (iPhone `.mov` et Android `.mp4`), vérifier qu'elles ressortent en `.m4a` et `.mp4`, **sans métadonnées** (`ffprobe -show_format -show_streams` ne doit montrer ni `location`, ni `com.apple.*`, ni titre), de la bonne durée, et lisibles. Vérifier aussi un fichier corrompu et un fichier de 3 minutes : ils doivent être refusés.
5. Passer `MEDIA_CHAT_AV_ENABLED=true` dans `infra/.env.prod`, puis déployer. `php artisan deploy:preflight` vérifie que `/spool/in` et `/spool/out` existent.
6. Prévenir les modérateurs : ils verront des notes vocales et des vidéos privées. **Les textes légaux** (`docs/legal/`) doivent le dire avant l'ouverture au public.

## Surveiller

- `docker compose ... ps transcode` : `healthy`. Un conteneur arrêté laisse les médias en `transcoding` jusqu'au délai (`MEDIA_TRANSCODE_TIMEOUT`, 300 s), puis ils sont refusés.
- Médias bloqués : `select id, kind, created_at from media where status = 'transcoding' and created_at < now() - interval '15 minutes';`
- Dossier partagé : `docker compose ... exec worker ls /spool/in /spool/out`. Le conteneur supprime les fichiers de plus d'une heure.

## Désactiver

`MEDIA_CHAT_AV_ENABLED=false` puis déployer. Les messages déjà envoyés restent lisibles (adresse de lecture inchangée) ; seuls les nouveaux dépôts et envois sont refusés. Les médias en `transcoding` sont terminés ou refusés normalement par les workers.

## Ce qui n'est pas vérifié

L'essai du script (`infra/scripts/tests/transcode_test.sh`, en CI) utilise un **faux** ffmpeg : il prouve le protocole, les refus et les options passées à ffmpeg, pas le comportement de ffmpeg sur de vrais fichiers. Les options (`-map_metadata -1`, `-protocol_whitelist file`, plafonds de durée) sont à confirmer à l'étape 4.
