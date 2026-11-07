# Image du service `backup` (infra/docker-compose.prod.yml). Contexte de construction : infra/scripts.
# Elle ne contient que les outils (pg_dump 16, aws, gpg) et les deux scripts : AUCUN secret n'est copié dans l'image,
# tout arrive par les variables d'environnement du conteneur au démarrage.
# Non construite sur le poste de développement (Docker absent) : à valider sur le serveur ou en CI.
# Même version majeure que le serveur PostgreSQL du compose (16) : pg_dump refuse un serveur plus récent que lui.
FROM postgres:16-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends awscli gnupg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY backup.sh restore.sh /scripts/
RUN chmod 0555 /scripts/backup.sh /scripts/restore.sh

# Le processus principal n'est pas PostgreSQL : on neutralise l'entrypoint de l'image de base.
ENTRYPOINT []
CMD ["/bin/bash", "-c", "echo 'définir la commande dans docker-compose.prod.yml' >&2; exit 1"]
