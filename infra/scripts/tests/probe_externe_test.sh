#!/usr/bin/env bash
# Test de infra/scripts/probe-externe.sh avec un faux `curl` placé en tête du PATH : aucune requête réelle n'est envoyée.
# Vérifie surtout que le repli statique du site (HTTP 200 sans l'en-tête `X-Site-Source: app`) n'est JAMAIS pris pour un site
# en bonne santé, et que chaque panne a son propre diagnostic (API, site hors service, site en repli statique).
# Ne dit rien du réseau, de Caddy ni de l'application réelle.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE="$HERE/../probe-externe.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin"
LOG="$WORK/calls.log"

# Faux curl : journalise les arguments, écrit le corps (STUB_BODY) et les en-têtes (STUB_HEADERS) dans les fichiers demandés,
# affiche le code HTTP (STUB_CODE) comme `--write-out '%{http_code}'`. STUB_EXIT non nul : échec réseau (code 000, sortie de curl).
cat > "$WORK/bin/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG"
out="" hdr=""
while [ $# -gt 0 ]; do
  case "$1" in
    --output) out="$2"; shift ;;
    --dump-header) hdr="$2"; shift ;;
  esac
  shift
done
if [ "${STUB_EXIT:-0}" -ne 0 ]; then printf '000'; exit "$STUB_EXIT"; fi
[ -z "$out" ] || printf '%s' "${STUB_BODY:-}" > "$out"
[ -z "$hdr" ] || printf '%b' "${STUB_HEADERS:-}" > "$hdr"
printf '%s' "${STUB_CODE:-200}"
EOF
chmod +x "$WORK/bin/curl"

failures=0
check() { # description, condition (0 = ok)
  if [ "$2" -eq 0 ]; then echo "ok   - $1"; else echo "FAIL - $1"; failures=$((failures + 1)); fi
}

# run_probe <contrôle> <base> : STUB_* viennent de l'environnement de l'appelant ; RC et OUT reçoivent le code de sortie et la sortie.
run_probe() {
  : > "$LOG"
  set +e
  OUT="$(env PATH="$WORK/bin:$PATH" STUB_LOG="$LOG" bash "$PROBE" "$@" 2>&1)"
  RC=$?
  set -e
}
says() { case "$OUT" in *"$1"*) return 0 ;; *) return 1 ;; esac; }

HEALTH_OK='{"status":"ok","db":"ok","redis":"ok","queue":"ok"}'
HEALTH_KO='{"status":"degraded","db":"error","redis":"ok","queue":"ok"}'
APP_HEADERS='HTTP/2 200\r\ncontent-type: text/html; charset=UTF-8\r\nx-site-source: app\r\n\r\n'
STATIC_HEADERS='HTTP/2 200\r\ncontent-type: text/html; charset=utf-8\r\ncache-control: public, max-age=60\r\n\r\n'

# --- API ---
STUB_CODE=200 STUB_BODY="$HEALTH_OK" run_probe api https://api.example.test
check "api : 200 et status ok -> sortie 0" "$([ "$RC" -eq 0 ] && says 'OK api' && echo 0 || echo 1)"
check "api : l'adresse sondée est /api/v1/health, sans suivre de redirection, avec un délai maximal" \
  "$(grep -q 'https://api.example.test/api/v1/health?sonde=' "$LOG" && grep -q -- '--max-time' "$LOG" && ! grep -q -- '--location\| -L' "$LOG" && echo 0 || echo 1)"

STUB_CODE=503 STUB_BODY="$HEALTH_KO" run_probe api https://api.example.test
check "api : 503 dégradé -> sortie 1, panne nommée api_degrade avec le composant en défaut" \
  "$([ "$RC" -eq 1 ] && says 'ALERTE api api_degrade' && says '"db":"error"' && echo 0 || echo 1)"

STUB_EXIT=7 run_probe api https://api.example.test
check "api : injoignable -> sortie 1, panne nommée api_injoignable" "$([ "$RC" -eq 1 ] && says 'ALERTE api api_injoignable' && echo 0 || echo 1)"

STUB_CODE=200 STUB_BODY='<html>page quelconque</html>' run_probe api https://api.example.test
check "api : 200 mais corps inattendu -> sortie 1 (un 200 ne suffit pas)" "$([ "$RC" -eq 1 ] && says 'ALERTE api api_reponse_inattendue' && echo 0 || echo 1)"

STUB_CODE=502 STUB_BODY='Bad Gateway' run_probe api https://api.example.test
check "api : 502 -> sortie 1" "$([ "$RC" -eq 1 ] && says 'api_reponse_inattendue' && says 'HTTP 502' && echo 0 || echo 1)"

# --- Site ---
STUB_CODE=200 STUB_HEADERS="$APP_HEADERS" run_probe site https://example.test
check "site : 200 avec X-Site-Source: app -> sortie 0" "$([ "$RC" -eq 0 ] && says 'OK site' && echo 0 || echo 1)"
check "site : l'adresse sondée est /legal/terms" "$(grep -q 'https://example.test/legal/terms?sonde=' "$LOG" && echo 0 || echo 1)"

STUB_CODE=200 STUB_HEADERS='HTTP/1.1 200 OK\r\nX-Site-Source:   app  \r\n\r\n' run_probe site https://example.test
check "site : en-tête reconnu sans tenir compte de la casse ni des espaces" "$([ "$RC" -eq 0 ] && echo 0 || echo 1)"

STUB_CODE=200 STUB_HEADERS="$STATIC_HEADERS" run_probe site https://example.test
check "site : 200 SANS X-Site-Source = repli statique -> sortie 1, panne nommée site_repli_statique" \
  "$([ "$RC" -eq 1 ] && says 'ALERTE site site_repli_statique' && says 'repli' && echo 0 || echo 1)"

STUB_CODE=200 STUB_HEADERS='HTTP/2 200\r\nx-site-source: static\r\n\r\n' run_probe site https://example.test
check "site : X-Site-Source d'une autre valeur que app -> sortie 1" "$([ "$RC" -eq 1 ] && says 'site_repli_statique' && echo 0 || echo 1)"

STUB_CODE=502 STUB_HEADERS='HTTP/2 502\r\n\r\n' run_probe site https://example.test
check "site : 502 -> sortie 1, panne nommée site_hors_service" "$([ "$RC" -eq 1 ] && says 'ALERTE site site_hors_service' && says 'HTTP 502' && echo 0 || echo 1)"

STUB_CODE=301 STUB_HEADERS='HTTP/2 301\r\nx-site-source: app\r\n\r\n' run_probe site https://example.test
check "site : une redirection n'est pas un succès (X-Site-Source: app ne suffit pas sans le 200)" "$([ "$RC" -eq 1 ] && says 'site_hors_service' && echo 0 || echo 1)"

STUB_EXIT=28 run_probe site https://example.test
check "site : délai dépassé -> sortie 1, panne nommée site_injoignable" "$([ "$RC" -eq 1 ] && says 'ALERTE site site_injoignable' && echo 0 || echo 1)"

# --- Usage ---
run_probe
check "sans argument -> sortie 2 (usage), aucune requête" "$([ "$RC" -eq 2 ] && [ ! -s "$LOG" ] && echo 0 || echo 1)"
run_probe api http://api.example.test
check "adresse sans https -> sortie 2, aucune requête" "$([ "$RC" -eq 2 ] && [ ! -s "$LOG" ] && echo 0 || echo 1)"
run_probe inconnu https://example.test
check "contrôle inconnu -> sortie 2, aucune requête" "$([ "$RC" -eq 2 ] && [ ! -s "$LOG" ] && echo 0 || echo 1)"
run_probe site 'https://example.test/ x'
check "adresse avec espace -> sortie 2, aucune requête" "$([ "$RC" -eq 2 ] && [ ! -s "$LOG" ] && echo 0 || echo 1)"
STUB_CODE=200 STUB_HEADERS="$APP_HEADERS" run_probe site https://example.test/
check "barre finale de l'adresse ignorée (pas de //)" "$(grep -q 'https://example.test/legal/terms?sonde=' "$LOG" && ! grep -q 'test//legal' "$LOG" && echo 0 || echo 1)"

if [ "$failures" -ne 0 ]; then
  echo "$failures vérification(s) en échec"
  exit 1
fi
echo "toutes les vérifications passent"
