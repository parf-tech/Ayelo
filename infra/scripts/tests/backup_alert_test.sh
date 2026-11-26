#!/usr/bin/env bash
# Essai des alertes d'échec de backup.sh : faux pg_dump / pg_restore / curl, aucun envoi réel.
# Usage : bash infra/scripts/tests/backup_alert_test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/backup.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf -- "$ROOT"' EXIT
mkdir -p "$ROOT/bin"
failures=0

check() { # libellé, code (0 = réussi)
  if [ "$2" -eq 0 ]; then echo "ok   - $1"; else echo "ECHEC - $1"; failures=$((failures + 1)); fi
}

# Faux outils : pg_dump échoue (la sauvegarde s'arrête à l'étape pg_dump) ; curl note ses arguments, sa configuration (stdin)
# et le message envoyé, puis répond le code demandé par FAKE_CURL_RC.
cat > "$ROOT/bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
cat > "$ROOT/bin/pg_restore" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$ROOT/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_DIR/args"
cat >> "$FAKE_DIR/config"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--upload-file" ]; then cat -- "$2" >> "$FAKE_DIR/message"; fi
  shift
done
exit "${FAKE_CURL_RC:-0}"
EOF
chmod +x "$ROOT/bin/"*

SECRET='re_secret_AbC123'
# run <nom> [VAR=valeur ...] -- [arguments de backup.sh] : remplit OUT (sortie), RC et DIR (traces du faux curl).
run() {
  DIR="$ROOT/$1"; shift
  mkdir -p "$DIR/backups"
  local vars=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do vars+=("$1"); shift; done
  [ "${1:-}" = "--" ] && shift
  OUT="$(env -i PATH="$ROOT/bin:$PATH" FAKE_DIR="$DIR" BACKUP_DIR="$DIR/backups" BACKUP_ALLOW_UNENCRYPTED=1 \
    DB_DATABASE=app DB_USERNAME=app DB_PASSWORD=x "${vars[@]}" bash "$SCRIPT" "$@" 2>&1)"
  RC=$?
}
mail=(BACKUP_ALERT_EMAIL=ops@example.org MAIL_HOST=smtp.example.org MAIL_USERNAME=resend "MAIL_PASSWORD=$SECRET" MAIL_FROM_ADDRESS=no-reply@example.org)

run fail587 "${mail[@]}" MAIL_PORT=587
check "sauvegarde en échec : code de sortie non nul conservé" "$([ "$RC" -ne 0 ]; echo $?)"
check "e-mail envoyé au destinataire, depuis l'expéditeur" "$(grep -q -- '--mail-rcpt ops@example.org' "$DIR/args" && grep -q -- '--mail-from no-reply@example.org' "$DIR/args"; echo $?)"
check "port 587 : smtp avec TLS obligatoire" "$(grep -q 'smtp://smtp.example.org:587' "$DIR/args" && grep -q -- '--ssl-reqd' "$DIR/args"; echo $?)"
check "le message nomme l'étape en échec" "$(grep -q 'Subject: \[Ayelo\] Sauvegarde de la base en echec (etape : pg_dump)' "$DIR/message"; echo $?)"
check "mot de passe passé par l'entrée standard de curl" "$(grep -q "user = \"resend:$SECRET\"" "$DIR/config"; echo $?)"
check "mot de passe absent des arguments, du message et des journaux" "$(! grep -q "$SECRET" "$DIR/args" "$DIR/message" && ! printf '%s' "$OUT" | grep -q "$SECRET"; echo $?)"
check "journal : alerte envoyée" "$(printf '%s' "$OUT" | grep -q 'alerte e-mail envoyée'; echo $?)"

run fail465 "${mail[@]}" MAIL_PORT=465
check "port 465 : smtps" "$(grep -q 'smtps://smtp.example.org:465' "$DIR/args"; echo $?)"

run refused "${mail[@]}" FAKE_CURL_RC=22
check "envoi refusé : signalé, code d'origine conservé" "$(printf '%s' "$OUT" | grep -q 'alerte e-mail NON envoyée' && [ "$RC" -ne 0 ]; echo $?)"

run none
check "rien de configuré : aucun appel à curl" "$([ ! -e "$DIR/args" ]; echo $?)"

run injection "${mail[@]}" $'BACKUP_ALERT_EMAIL=ops@example.org\nBcc: x@evil.test'
check "destinataire avec saut de ligne : refusé, aucun envoi" "$([ ! -e "$DIR/args" ] && printf '%s' "$OUT" | grep -q 'BACKUP_ALERT_EMAIL invalide'; echo $?)"

run incomplete BACKUP_ALERT_EMAIL=ops@example.org
check "réglages SMTP absents : signalé, aucun envoi" "$([ ! -e "$DIR/args" ] && printf '%s' "$OUT" | grep -q 'réglages SMTP incomplets'; echo $?)"

run testok "${mail[@]}" -- --test-alert
check "--test-alert : envoie et sort en 0 sans toucher à la base" "$([ "$RC" -eq 0 ] && grep -q 'etape : essai' "$DIR/message" && [ ! -e "$DIR/backups/.last_failure" ]; echo $?)"

run testko "${mail[@]}" FAKE_CURL_RC=22 -- --test-alert
check "--test-alert : échec d'envoi signalé par le code de sortie" "$([ "$RC" -ne 0 ]; echo $?)"

run testnone -- --test-alert
check "--test-alert sans aucun canal : code non nul" "$([ "$RC" -ne 0 ]; echo $?)"

run unknown -- --autre
check "option inconnue refusée" "$([ "$RC" -ne 0 ] && [ ! -e "$DIR/args" ]; echo $?)"

if [ "$failures" -gt 0 ]; then echo "backup_alert_test : $failures échec(s)"; exit 1; fi
echo "backup_alert_test : tout est vert"
