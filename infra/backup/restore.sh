#!/bin/sh
# Restauration d'une sauvegarde dans une base VIERGE. Usage : restore.sh <fichier.sql.gz.gpg> <hôte> <base> <utilisateur>
# Après restauration : rejouer les suppressions de comptes déjà traitées (voir docs/runbooks/restauration.md).
set -eu
FILE="$1"; HOST="$2"; DB="$3"; USER="$4"
gpg --batch --decrypt "$FILE" | gunzip | psql -h "$HOST" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1
echo "restauration terminée dans $DB"
