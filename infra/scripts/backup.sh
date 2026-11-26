#!/usr/bin/env bash
# Sauvegarde PostgreSQL : pg_dump au format custom, horodaté, avec somme de contrôle SHA-256,
# rétention (quotidienne + mensuelle, en local et dans le bucket) et envoi facultatif vers un bucket compatible S3
# (Cloudflare R2). Alertes facultatives (webhook, e-mail) en cas d'échec et fichier témoin pour la sonde de santé.
# Usage : backup.sh              une sauvegarde
#         backup.sh --test-alert  envoie une alerte d'essai par les canaux configurés, sans toucher à la base
#                                 (sortie 0 seulement si tous les envois configurés ont réussi)
#
# STATUT : écrit, JAMAIS EXÉCUTÉ (ni Docker, ni pg_dump, ni shellcheck sur le poste de développement).
# Seule la logique de rétention (retention.sh) a été essayée, sur de faux fichiers (tests/retention_test.sh).
#
# Variables d'environnement (jamais écrites dans le dépôt ni dans l'image) :
#   obligatoires : DB_DATABASE, DB_USERNAME, DB_PASSWORD
#   facultatives : DB_HOST (postgres), DB_PORT (5432)
#                  BACKUP_DIR (/backups), BACKUP_RETENTION_DAYS (14)
#                  BACKUP_MONTHLY_RETENTION_MONTHS (6) : en plus des sauvegardes quotidiennes, la première sauvegarde
#                    de chaque mois est gardée pour le mois courant et les N mois précédents (0 = pas de mensuelle).
#                    Règle détaillée dans retention.sh ; elle vaut pour le dossier local ET pour le bucket.
#                  BACKUP_ALERT_WEBHOOK_URL (vide = pas d'alerte) : en cas d'échec, POST JSON
#                    {"host","timestamp","step"} (nom d'hôte, heure UTC, étape en échec ; ni secret ni chemin).
#                  BACKUP_ALERT_EMAIL (vide = pas d'e-mail) : en cas d'échec, e-mail par SMTP (TLS obligatoire) avec les
#                    réglages de l'application : MAIL_HOST, MAIL_PORT (587 ; 465 = TLS implicite), MAIL_USERNAME,
#                    MAIL_PASSWORD ; expéditeur BACKUP_ALERT_EMAIL_FROM, sinon MAIL_FROM_ADDRESS.
#                  BACKUP_BUCKET + BACKUP_ENDPOINT + BACKUP_AWS_ACCESS_KEY_ID + BACKUP_AWS_SECRET_ACCESS_KEY
#                    (si BACKUP_BUCKET est vide, aucun envoi : la copie reste locale)
#                  BACKUP_S3_PREFIX (postgres)
#                  BACKUP_GPG_RECIPIENT (OBLIGATOIRE : vide = échec, sauf BACKUP_ALLOW_UNENCRYPTED=1 pour un essai local ; le fichier est chiffré avec la clé publique correspondante,
#                    qui doit déjà être dans le trousseau, ou être importée depuis BACKUP_GPG_PUBLIC_KEY_FILE)
# Témoins dans BACKUP_DIR : `.last_success` (« <secondes epoch> <date ISO> », écrit seulement en fin de sauvegarde
# complète, lu par la sonde de santé du compose) et `.last_failure` (idem + étape, effacé au succès suivant).
# Code de sortie : 0 seulement si la sauvegarde est complète (et envoyée si l'envoi est configuré), sinon non nul.
# Un échec d'alerte ou de rétention ne change jamais le code de sortie d'origine.
set -euo pipefail

log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERREUR: $*" >&2; exit 1; }

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_MONTHLY_RETENTION_MONTHS="${BACKUP_MONTHLY_RETENTION_MONTHS:-6}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
BACKUP_BUCKET="${BACKUP_BUCKET:-}"
BACKUP_GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-}"
BACKUP_ALERT_WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"
PARTIAL=""
STEP="configuration"

ALERT_SENT=0
ALERT_FAILED=0
alert_problem() { ALERT_FAILED=$((ALERT_FAILED + 1)); log "$1" >&2; }
alert_host() { hostname 2>/dev/null | tr -cd 'A-Za-z0-9._-' || true; }

# Alerte webhook. Ne renvoie jamais d'erreur. L'URL (qui peut contenir un jeton) passe par l'entrée standard de curl :
# elle n'apparaît ni dans la liste des processus ni dans les journaux. Le corps ne contient que l'hôte, l'heure et l'étape.
alert_webhook() {
  local host payload
  [ -n "$BACKUP_ALERT_WEBHOOK_URL" ] || return 0
  case "$BACKUP_ALERT_WEBHOOK_URL" in
    *[[:space:]\"\\]*)
      alert_problem "alerte non envoyée : BACKUP_ALERT_WEBHOOK_URL contient un caractère interdit"
      return 0
      ;;
    http://* | https://*) ;;
    *)
      alert_problem "alerte non envoyée : BACKUP_ALERT_WEBHOOK_URL doit commencer par http:// ou https://"
      return 0
      ;;
  esac
  command -v curl >/dev/null 2>&1 || { alert_problem "alerte non envoyée : curl introuvable"; return 0; }
  host="$(alert_host)"
  payload="$(printf '{"host":"%s","timestamp":"%s","step":"%s"}' "${host:-inconnu}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$STEP")"
  if printf 'url = "%s"\n' "$BACKUP_ALERT_WEBHOOK_URL" \
    | curl -K - --silent --fail --output /dev/null --max-time 15 --request POST \
        --header 'Content-Type: application/json' --data "$payload" 2>/dev/null; then
    ALERT_SENT=$((ALERT_SENT + 1))
    log "alerte envoyée (étape : ${STEP})"
  else
    alert_problem "alerte NON envoyée (webhook injoignable ou refusé)"
  fi
  return 0
}

# Alerte e-mail par SMTP. Ne renvoie jamais d'erreur. TLS obligatoire. Le mot de passe passe par l'entrée standard de curl (ni liste
# des processus ni journaux). Adresses et serveur sont validés strictement (pas d'injection d'en-tête). Message sans secret.
alert_email() {
  local to="${BACKUP_ALERT_EMAIL:-}" from="${BACKUP_ALERT_EMAIL_FROM:-${MAIL_FROM_ADDRESS:-}}" port="${MAIL_PORT:-587}"
  local address='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' url message host
  [ -n "$to" ] || return 0
  if ! [[ "$to" =~ $address ]]; then alert_problem "alerte e-mail non envoyée : BACKUP_ALERT_EMAIL invalide"; return 0; fi
  if [ -z "${MAIL_HOST:-}" ] || [ -z "${MAIL_USERNAME:-}" ] || [ -z "${MAIL_PASSWORD:-}" ] || [ -z "$from" ]; then
    alert_problem "alerte e-mail non envoyée : réglages SMTP incomplets (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS)"
    return 0
  fi
  if ! [[ "$from" =~ $address ]] || ! [[ "$MAIL_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || ! [[ "$port" =~ ^[0-9]+$ ]]; then
    alert_problem "alerte e-mail non envoyée : expéditeur, serveur ou port SMTP invalide"
    return 0
  fi
  case "${MAIL_USERNAME}${MAIL_PASSWORD}" in
    *[\"\\]* | *$'\n'*) alert_problem "alerte e-mail non envoyée : identifiant ou mot de passe SMTP contient un caractère interdit"; return 0 ;;
  esac
  command -v curl >/dev/null 2>&1 || { alert_problem "alerte e-mail non envoyée : curl introuvable"; return 0; }
  if [ "$port" = "465" ]; then url="smtps://${MAIL_HOST}:${port}"; else url="smtp://${MAIL_HOST}:${port}"; fi
  message="$(mktemp)" || { alert_problem "alerte e-mail non envoyée : fichier temporaire impossible"; return 0; }
  host="$(alert_host)"
  printf 'From: Ayelo sauvegardes <%s>\r\nTo: <%s>\r\nSubject: [Ayelo] Sauvegarde de la base en echec (etape : %s)\r\nDate: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nLa sauvegarde de la base a échoué.\r\n\r\nMachine : %s\r\nHeure (UTC) : %s\r\nÉtape : %s\r\n\r\nVoir le journal du service backup.\r\n' \
    "$from" "$to" "$STEP" "$(date -u -R)" "${host:-inconnu}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$STEP" > "$message"
  if printf 'user = "%s:%s"\n' "$MAIL_USERNAME" "$MAIL_PASSWORD" \
    | curl -K - --silent --ssl-reqd --max-time 30 --url "$url" --mail-from "$from" --mail-rcpt "$to" --upload-file "$message" >/dev/null 2>&1; then
    ALERT_SENT=$((ALERT_SENT + 1))
    log "alerte e-mail envoyée (étape : ${STEP})"
  else
    alert_problem "alerte e-mail NON envoyée (serveur SMTP injoignable ou envoi refusé)"
  fi
  rm -f -- "$message"
  return 0
}

alert_failure() {
  alert_webhook || true
  alert_email || true
  return 0
}

case "${1:-}" in
  '') ;;
  --test-alert)
    STEP="essai"
    log "essai des alertes : la base n'est pas touchée"
    alert_failure
    [ "$ALERT_SENT" -ge 1 ] && [ "$ALERT_FAILED" -eq 0 ] || fail "essai non concluant : ${ALERT_SENT} envoi(s) réussi(s), ${ALERT_FAILED} en échec"
    exit 0
    ;;
  *) fail "option inconnue : $1 (seule --test-alert existe)" ;;
esac

# Sortie : supprime les fichiers partiels et, si la sauvegarde a échoué, écrit le témoin d'échec puis alerte.
# Le code de sortie d'origine est toujours rendu tel quel.
on_exit() {
  local rc=$?
  if [ -n "$PARTIAL" ]; then rm -f -- "$PARTIAL" "${PARTIAL}.gpg" || true; fi
  if [ "$rc" -ne 0 ]; then
    if [ -d "$BACKUP_DIR" ]; then
      printf '%s %s %s\n' "$(date -u +%s)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$STEP" > "${BACKUP_DIR}/.last_failure" 2>/dev/null || true
    fi
    alert_failure || true
  fi
  exit "$rc"
}
trap on_exit EXIT

: "${DB_DATABASE:?DB_DATABASE manquant}"
: "${DB_USERNAME:?DB_USERNAME manquant}"
: "${DB_PASSWORD:?DB_PASSWORD manquant}"

case "$BACKUP_RETENTION_DAYS" in
  '' | *[!0-9]*) fail "BACKUP_RETENTION_DAYS doit être un entier positif (reçu : '$BACKUP_RETENTION_DAYS')" ;;
esac
[ "$BACKUP_RETENTION_DAYS" -ge 1 ] || fail "BACKUP_RETENTION_DAYS doit être >= 1"
case "$BACKUP_MONTHLY_RETENTION_MONTHS" in
  '' | *[!0-9]*) fail "BACKUP_MONTHLY_RETENTION_MONTHS doit être un entier >= 0 (reçu : '$BACKUP_MONTHLY_RETENTION_MONTHS')" ;;
esac

# shellcheck source=retention.sh
. "$(dirname "${BASH_SOURCE[0]}")/retention.sh"

STEP="preflight"
for cmd in pg_dump pg_restore sha256sum find date; do
  command -v "$cmd" >/dev/null 2>&1 || fail "commande introuvable : $cmd"
done
if [ -n "$BACKUP_BUCKET" ]; then
  command -v aws >/dev/null 2>&1 || fail "commande introuvable : aws (envoi demandé car BACKUP_BUCKET est renseigné)"
  : "${BACKUP_ENDPOINT:?BACKUP_ENDPOINT manquant}"
  : "${BACKUP_AWS_ACCESS_KEY_ID:?BACKUP_AWS_ACCESS_KEY_ID manquant}"
  : "${BACKUP_AWS_SECRET_ACCESS_KEY:?BACKUP_AWS_SECRET_ACCESS_KEY manquant}"
fi
# Chiffrement obligatoire (revue CTO n°1) : sans destinataire GPG, aucune archive (toutes les données personnelles) ne part en clair.
# BACKUP_ALLOW_UNENCRYPTED=1 existe uniquement pour un essai local jetable ; jamais en production.
if [ -z "$BACKUP_GPG_RECIPIENT" ] && [ "${BACKUP_ALLOW_UNENCRYPTED:-}" != "1" ]; then
  fail "BACKUP_GPG_RECIPIENT vide : le chiffrement des sauvegardes est obligatoire (voir docs/runbooks/sauvegardes-chiffrement.md)"
fi
if [ -n "$BACKUP_GPG_RECIPIENT" ]; then
  command -v gpg >/dev/null 2>&1 || fail "commande introuvable : gpg (chiffrement demandé)"
  if [ -n "${BACKUP_GPG_PUBLIC_KEY_FILE:-}" ]; then
    gpg --batch --quiet --import "$BACKUP_GPG_PUBLIC_KEY_FILE" || fail "import de la clé publique GPG impossible"
  fi
  gpg --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1 \
    || fail "clé publique GPG introuvable pour '$BACKUP_GPG_RECIPIENT' (jamais d'envoi en clair si le chiffrement est demandé)"
fi

STEP="preparation"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="${DB_DATABASE}_${STAMP}.dump"
PARTIAL="${BACKUP_DIR}/${BASE}.partial"
FINAL="${BACKUP_DIR}/${BASE}"

STEP="pg_dump"
log "pg_dump de '${DB_DATABASE}' sur ${DB_HOST}:${DB_PORT}"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" --dbname="$DB_DATABASE" \
  --format=custom --compress=6 --no-owner --no-acl --file="$PARTIAL"

STEP="verification"
# Un fichier vide ou illisible n'est pas une sauvegarde : relire la table des matières de l'archive.
[ -s "$PARTIAL" ] || fail "archive vide"
pg_restore --list "$PARTIAL" >/dev/null || fail "archive illisible (pg_restore --list a échoué)"

STEP="chiffrement"
if [ -n "$BACKUP_GPG_RECIPIENT" ]; then
  gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
    --output "${PARTIAL}.gpg" "$PARTIAL" || fail "chiffrement GPG échoué"
  rm -f -- "$PARTIAL"
  FINAL="${FINAL}.gpg"
  mv -- "${PARTIAL}.gpg" "$FINAL"
else
  mv -- "$PARTIAL" "$FINAL"
fi

STEP="somme_de_controle"
# Somme de contrôle avec le nom de base seul, pour que `sha256sum -c` marche depuis le dossier du fichier.
( cd "$BACKUP_DIR" && sha256sum -- "$(basename "$FINAL")" > "$(basename "$FINAL").sha256" ) || fail "calcul SHA-256 échoué"
SIZE="$(wc -c < "$FINAL" | tr -d ' ')"
log "archive $(basename "$FINAL") : ${SIZE} octets, SHA-256 $(cut -d' ' -f1 "${FINAL}.sha256")"

STEP="envoi"
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

# Rétention (quotidienne + mensuelle, règle dans retention.sh). Une erreur ici n'invalide PAS la sauvegarde déjà faite
# et envoyée : elle est journalisée en avertissement et la sauvegarde reste un succès.
STEP="retention_locale"
if ! retention_prune_dir "$BACKUP_DIR" "$DB_DATABASE" "$(date -u +%Y%m%d)" "$BACKUP_RETENTION_DAYS" "$BACKUP_MONTHLY_RETENTION_MONTHS" \
  | while IFS= read -r line; do log "$line"; done; then
  log "AVERTISSEMENT: rétention locale non appliquée" >&2
fi

# Rétention du bucket : même règle, appliquée à la liste réellement présente. La clé d'envoi peut ne pas avoir le droit de
# supprimer (recommandé) : `aws s3 rm` échoue alors, on le journalise et la règle de cycle de vie du bucket prend le relais.
bucket_prune() {
  local cutoffs listing doomed name
  cutoffs="$(retention_cutoffs "$(date -u +%Y%m%d)" "$BACKUP_RETENTION_DAYS" "$BACKUP_MONTHLY_RETENTION_MONTHS")" || return 1
  listing="$(aws s3 ls "${DEST}/" --endpoint-url "$BACKUP_ENDPOINT" | awk '{print $NF}')" || return 1
  [ -n "$listing" ] || return 1
  doomed="$(printf '%s\n' "$listing" | retention_select "$DB_DATABASE" "${cutoffs% *}" "${cutoffs#* }")" || return 1
  [ -n "$doomed" ] || return 0
  while IFS= read -r name; do
    aws s3 rm "${DEST}/${name}" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors || return 1
    aws s3 rm "${DEST}/${name}.sha256" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors || true
    log "supprimé du bucket (rétention) : ${name}"
  done <<< "$doomed"
}
if [ -n "$BACKUP_BUCKET" ]; then
  STEP="retention_bucket"
  bucket_prune || log "AVERTISSEMENT: rétention du bucket non appliquée (droit de suppression absent ? prévoir une règle de cycle de vie)" >&2
fi

# Témoin de dernière réussite, lu par la sonde de santé du conteneur (écriture atomique).
STEP="temoin"
printf '%s %s\n' "$(date -u +%s)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${BACKUP_DIR}/.last_success.tmp"
mv -f -- "${BACKUP_DIR}/.last_success.tmp" "${BACKUP_DIR}/.last_success"
rm -f -- "${BACKUP_DIR}/.last_failure"
log "sauvegarde terminée"
