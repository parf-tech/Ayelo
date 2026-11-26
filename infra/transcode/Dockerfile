# Conteneur de traitement des notes vocales et des vidéos de conversation (ffmpeg). Voir infra/transcode/transcode-loop.sh,
# docs/14-DEPLOYMENT.md et docs/runbooks/transcode.md.
# Construite et essayée avec le vrai ffmpeg en CI (infra/scripts/tests/transcode_image_test.sh) : l'essai avec de vrais
# fichiers de téléphone reste à faire sur le serveur avant d'activer MEDIA_CHAT_AV_ENABLED (docs/runbooks/transcode.md).
# Image de base épinglée par condensat, comme les autres images (Dependabot propose les mises à jour).
FROM alpine:3.21@sha256:bc21487101ae47172509130ee1092cc273a831968d64b617776d1f69c81e42ab

# Aucun compte créé : Alpine réserve déjà le groupe 82 (www-data), et `USER` par numéro suffit à ffmpeg et au script.
RUN apk add --no-cache bash coreutils ffmpeg \
 && mkdir -p /spool/in /spool/out \
 && chown -R 82:82 /spool

COPY infra/transcode/transcode-loop.sh /usr/local/bin/transcode-loop.sh
RUN chmod 0555 /usr/local/bin/transcode-loop.sh

# Même identifiant (82) que www-data dans l'image PHP : le dossier partagé est lisible et inscriptible des deux côtés.
USER 82:82
VOLUME ["/spool"]
CMD ["/usr/local/bin/transcode-loop.sh"]
