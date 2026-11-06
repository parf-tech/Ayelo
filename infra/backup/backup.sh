#!/bin/sh
# Sauvegarde quotidienne chiffrée de PostgreSQL vers un bucket S3 compatible (R2). Rétention : règles du bucket.
# Non exécuté sur le poste de développement : à tester sur le serveur, puis TESTER LA RESTAURATION (runbook).
set -eu
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="/tmp/ayelo-${STAMP}.sql.gz.gpg"
export PGPASSWORD="$DB_PASSWORD"

pg_dump -h "$DB_HOST" -U "$DB_USERNAME" -d "$DB_DATABASE" --no-owner --format=plain \
  | gzip -9 \
  | gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" -o "$OUT"

AWS_ACCESS_KEY_ID="$BACKUP_AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_AWS_SECRET_ACCESS_KEY" \
  aws s3 cp "$OUT" "s3://${BACKUP_BUCKET}/postgres/${STAMP}.sql.gz.gpg" --endpoint-url "$BACKUP_ENDPOINT"

rm -f "$OUT"
echo "sauvegarde ${STAMP} envoyée"
