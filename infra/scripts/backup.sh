#!/usr/bin/env bash
# Sauvegarde PostgreSQL : pg_dump au format custom, horodaté, avec somme de contrôle SHA-256,
# rétention locale en jours et envoi facultatif vers un bucket compatible S3 (Cloudflare R2).
#
# STATUT : écrit, JAMAIS EXÉCUTÉ (ni Docker, ni pg_dump, ni shellcheck sur le poste de développement).
#
# Variables d'environnement (jamais écrites dans le dépôt ni dans l'image) :
#   obligatoires : DB_DATABASE, DB_USERNAME, DB_PASSWORD
#   facultatives : DB_HOST (postgres), DB_PORT (5432)
#                  BACKUP_DIR (/backups), BACKUP_RETENTION_DAYS (14)
#                  BACKUP_BUCKET + BACKUP_ENDPOINT + BACKUP_AWS_ACCESS_KEY_ID + BACKUP_AWS_SECRET_ACCESS_KEY
#                    (si BACKUP_BUCKET est vide, aucun envoi : la copie reste locale)
#                  BACKUP_S3_PREFIX (postgres)
#                  BACKUP_GPG_RECIPIENT (si renseigné, le fichier est chiffré avec la clé publique correspondante,
#                    qui doit déjà être dans le trousseau, ou être importée depuis BACKUP_GPG_PUBLIC_KEY_FILE)
# Code de sortie : 0 seulement si la sauvegarde est complète (et envoyée si l'envoi est configuré), sinon non nul.
set -euo pipefail

log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERREUR: $*" >&2; exit 1; }

: "${DB_DATABASE:?DB_DATABASE manquant}"
: "${DB_USERNAME:?DB_USERNAME manquant}"
: "${DB_PASSWORD:?DB_PASSWORD manquant}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
BACKUP_BUCKET="${BACKUP_BUCKET:-}"
BACKUP_GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-}"

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*) fail "BACKUP_RETENTION_DAYS doit être un entier positif (reçu : '$BACKUP_RETENTION_DAYS')" ;;
esac
[ "$BACKUP_RETENTION_DAYS" -ge 1 ] || fail "BACKUP_RETENTION_DAYS doit être >= 1"

for cmd in pg_dump pg_restore sha256sum find date; do
  command -v "$cmd" >/dev/null 2>&1 || fail "commande introuvable : $cmd"
done
if [ -n "$BACKUP_BUCKET" ]; then
  command -v aws >/dev/null 2>&1 || fail "commande introuvable : aws (envoi demandé car BACKUP_BUCKET est renseigné)"
  : "${BACKUP_ENDPOINT:?BACKUP_ENDPOINT manquant}"
  : "${BACKUP_AWS_ACCESS_KEY_ID:?BACKUP_AWS_ACCESS_KEY_ID manquant}"
  : "${BACKUP_AWS_SECRET_ACCESS_KEY:?BACKUP_AWS_SECRET_ACCESS_KEY manquant}"
fi
if [ -n "$BACKUP_GPG_RECIPIENT" ]; then
  command -v gpg >/dev/null 2>&1 || fail "commande introuvable : gpg (chiffrement demandé)"
  if [ -n "${BACKUP_GPG_PUBLIC_KEY_FILE:-}" ]; then
    gpg --batch --quiet --import "$BACKUP_GPG_PUBLIC_KEY_FILE" || fail "import de la clé publique GPG impossible"
  fi
  gpg --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1 \
    || fail "clé publique GPG introuvable pour '$BACKUP_GPG_RECIPIENT' (jamais d'envoi en clair si le chiffrement est demandé)"
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="${DB_DATABASE}_${STAMP}.dump"
PARTIAL="${BACKUP_DIR}/${BASE}.partial"
FINAL="${BACKUP_DIR}/${BASE}"
trap 'rm -f -- "$PARTIAL" "${PARTIAL}.gpg"' EXIT

log "pg_dump de '${DB_DATABASE}' sur ${DB_HOST}:${DB_PORT}"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" --dbname="$DB_DATABASE" \
  --format=custom --compress=6 --no-owner --no-acl --file="$PARTIAL"

# Un fichier vide ou illisible n'est pas une sauvegarde : relire la table des matières de l'archive.
[ -s "$PARTIAL" ] || fail "archive vide"
pg_restore --list "$PARTIAL" >/dev/null || fail "archive illisible (pg_restore --list a échoué)"

if [ -n "$BACKUP_GPG_RECIPIENT" ]; then
  gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
    --output "${PARTIAL}.gpg" "$PARTIAL" || fail "chiffrement GPG échoué"
  rm -f -- "$PARTIAL"
  FINAL="${FINAL}.gpg"
  mv -- "${PARTIAL}.gpg" "$FINAL"
else
  mv -- "$PARTIAL" "$FINAL"
fi

# Somme de contrôle avec le nom de base seul, pour que `sha256sum -c` marche depuis le dossier du fichier.
( cd "$BACKUP_DIR" && sha256sum -- "$(basename "$FINAL")" > "$(basename "$FINAL").sha256" ) || fail "calcul SHA-256 échoué"
SIZE="$(wc -c < "$FINAL" | tr -d ' ')"
log "archive $(basename "$FINAL") : ${SIZE} octets, SHA-256 $(cut -d' ' -f1 "${FINAL}.sha256")"

if [ -n "$BACKUP_BUCKET" ]; then
  export AWS_ACCESS_KEY_ID="$BACKUP_AWS_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$BACKUP_AWS_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
  DEST="s3://${BACKUP_BUCKET}/${BACKUP_S3_PREFIX}"
  log "envoi vers ${DEST}/"
  aws s3 cp "$FINAL" "${DEST}/$(basename "$FINAL")" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors \
    || fail "envoi de l'archive échoué"
  aws s3 cp "${FINAL}.sha256" "${DEST}/$(basename "$FINAL").sha256" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors \
    || fail "envoi de la somme de contrôle échoué"
else
  log "BACKUP_BUCKET vide : pas d'envoi distant (copie locale seulement, donc PAS hors du serveur)"
fi

# Rétention locale. La rétention du bucket relève d'une règle de cycle de vie du bucket (non gérée ici).
find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_DATABASE}_*.dump*" -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete \
  | while IFS= read -r old; do log "supprimé (rétention ${BACKUP_RETENTION_DAYS} j) : $(basename "$old")"; done

# Témoin de dernière réussite, lu par la sonde de santé du conteneur.
touch "${BACKUP_DIR}/.last_success"
log "sauvegarde terminée"
