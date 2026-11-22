# Conteneur de traitement des notes vocales et des vidéos de conversation (ffmpeg). Voir infra/transcode/transcode-loop.sh,
# docs/14-DEPLOYMENT.md et docs/runbooks/transcode.md.
# Non construit ni testé sur le poste de développement (Docker absent) : à valider sur le serveur avant d'activer
# MEDIA_CHAT_AV_ENABLED. L'image de base doit être épinglée par condensat au premier build (comme les autres images) :
#   docker buildx imagetools inspect alpine:3.21
FROM alpine:3.21

RUN apk add --no-cache bash coreutils ffmpeg \
 && addgroup -g 82 -S transcode \
 && adduser -u 82 -S -G transcode -H -s /sbin/nologin transcode \
 && mkdir -p /spool/in /spool/out \
 && chown -R 82:82 /spool

COPY infra/transcode/transcode-loop.sh /usr/local/bin/transcode-loop.sh
RUN chmod 0555 /usr/local/bin/transcode-loop.sh

# Même identifiant (82) que www-data dans l'image PHP : le dossier partagé est lisible et inscriptible des deux côtés.
USER 82:82
VOLUME ["/spool"]
CMD ["/usr/local/bin/transcode-loop.sh"]
