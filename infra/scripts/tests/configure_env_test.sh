#!/usr/bin/env bash
# Test de infra/scripts/configure-env.sh sur une copie de infra/.env.prod.example : les valeurs sont écrites, les autres lignes
# restent intactes, un secret n'apparaît jamais dans la sortie, une valeur refusée n'écrit rien, Entrée vide garde l'existant.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../configure-env.sh"
EXAMPLE="$HERE/../../.env.prod.example"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ENV="$WORK/.env.prod"
cp "$EXAMPLE" "$ENV"

failures=0
check() { if [ "$2" -eq 0 ]; then echo "ok   - $1"; else echo "FAIL - $1"; failures=$((failures + 1)); fi; }
value() { sed -n "s/^$1=//p" "$ENV" | tail -n 1; }

SECRET='S3cr&t|\avec$bizarres"'
BSECRET='B4ck&up|\secret$"'
printf '%s\n' "ops@exemple.fr" "https://abc123.r2.cloudflarestorage.com" "media-staging" "AKIAEXEMPLE" "$SECRET" "Ayelo backup <ops@exemple.fr>" \
  "backups" "https://abc123.r2.cloudflarestorage.com" "AKIABACKUP" "$BSECRET" \
  | DEPLOY_ENV_FILE="$ENV" bash "$SCRIPT" > "$WORK/out.txt" 2>&1
RC=$?
check "premier passage : code 0" "$RC"
check "ACME_EMAIL écrit" "$([ "$(value ACME_EMAIL)" = "ops@exemple.fr" ]; echo $?)"
check "MEDIA_ENDPOINT écrit" "$([ "$(value MEDIA_ENDPOINT)" = "https://abc123.r2.cloudflarestorage.com" ]; echo $?)"
check "MEDIA_BUCKET écrit" "$([ "$(value MEDIA_BUCKET)" = "media-staging" ]; echo $?)"
check "MEDIA_SECRET_KEY écrit tel quel (| & \\ \$ \" conservés)" "$([ "$(value MEDIA_SECRET_KEY)" = "$SECRET" ]; echo $?)"
check "BACKUP_GPG_RECIPIENT écrit" "$([ "$(value BACKUP_GPG_RECIPIENT)" = "Ayelo backup <ops@exemple.fr>" ]; echo $?)"
check "BACKUP_BUCKET et BACKUP_ENDPOINT écrits" "$([ "$(value BACKUP_BUCKET)" = "backups" ] && [ "$(value BACKUP_ENDPOINT)" = "https://abc123.r2.cloudflarestorage.com" ]; echo $?)"
check "BACKUP_AWS_SECRET_ACCESS_KEY écrit tel quel" "$([ "$(value BACKUP_AWS_SECRET_ACCESS_KEY)" = "$BSECRET" ] && [ "$(value BACKUP_AWS_ACCESS_KEY_ID)" = "AKIABACKUP" ]; echo $?)"
check "les secrets de sauvegarde n'apparaissent pas dans la sortie" "$(! grep -qF -e 'B4ck' -e 'AKIABACKUP' "$WORK/out.txt"; echo $?)"
check "le secret n'apparaît pas dans la sortie" "$(! grep -qF 'S3cr' "$WORK/out.txt"; echo $?)"
check "la clé d'accès n'apparaît pas dans la sortie" "$(! grep -qF 'AKIAEXEMPLE' "$WORK/out.txt"; echo $?)"
check "les autres lignes sont intactes (APP_ENV, DB_HOST)" "$([ "$(value APP_ENV)" = "production" ] && [ "$(value DB_HOST)" = "postgres" ]; echo $?)"
check "le nombre de lignes est inchangé" "$([ "$(wc -l < "$ENV")" = "$(wc -l < "$EXAMPLE")" ]; echo $?)"

# Deuxième passage : tout vide = on garde tout.
printf '\n\n\n\n\n\n\n\n\n\n' | DEPLOY_ENV_FILE="$ENV" bash "$SCRIPT" > /dev/null 2>&1
check "Entrée vide garde l'existant" "$([ "$(value MEDIA_BUCKET)" = "media-staging" ] && [ "$(value MEDIA_SECRET_KEY)" = "$SECRET" ] && [ "$(value BACKUP_BUCKET)" = "backups" ] && [ "$(value BACKUP_AWS_SECRET_ACCESS_KEY)" = "$BSECRET" ]; echo $?)"

# Endpoint non https : refusé, rien n'est écrit.
set +e
printf '\n%s\n' "http://pas-https.example" | DEPLOY_ENV_FILE="$ENV" bash "$SCRIPT" > "$WORK/out2.txt" 2>&1
RC2=$?
set -e
check "endpoint http refusé (code non nul)" "$([ "$RC2" -ne 0 ]; echo $?)"
check "endpoint http refusé : valeur inchangée" "$([ "$(value MEDIA_ENDPOINT)" = "https://abc123.r2.cloudflarestorage.com" ]; echo $?)"

# E-mail invalide.
set +e
printf '%s\n' "pas-un-email" | DEPLOY_ENV_FILE="$ENV" bash "$SCRIPT" > /dev/null 2>&1
RC3=$?
set -e
check "e-mail invalide refusé" "$([ "$RC3" -ne 0 ]; echo $?)"

# Fichier absent.
set +e
DEPLOY_ENV_FILE="$WORK/absent" bash "$SCRIPT" > /dev/null 2>&1 < /dev/null
RC4=$?
set -e
check "fichier absent : code non nul" "$([ "$RC4" -ne 0 ]; echo $?)"

if [ "$failures" -ne 0 ]; then echo "$failures vérification(s) en échec"; exit 1; fi
echo "configure_env_test : tout est vert"
