#!/usr/bin/env bash
# Test de infra/scripts/caddy-routage-test.sh avec de faux `docker` et `curl` placés en tête du PATH : aucun conteneur n'est lancé,
# aucune requête n'est envoyée. Vérifie deux choses :
#   1. le Caddyfile d'essai que le script GÉNÈRE à partir du vrai infra/caddy/Caddyfile (bloc du site seul, sur :8095, sans TLS) ;
#   2. que le rejeu des adresses attendues ÉCHOUE sur chacun des défauts qu'il doit attraper, dont celui du 2026-11-20
#      (pages en 200 mais VIDES : `php_fastcgi` ne transmettait rien).
# Ne dit rien du comportement réel de Caddy : la première exécution complète se fait sur le serveur (docs/runbooks/site-public.md).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../caddy-routage-test.sh"
REPO="$(cd "$HERE/../../.." && pwd)"
WEB="$REPO/web"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin" "$WORK/state"
LOG="$WORK/calls.log"

# Faux docker : `run` réserve une adresse 10.9.0.N (N = ordre de lancement), copie le dossier monté sur /etc/caddytest, et échoue
# si STUB_DOCKER_FAIL est posé ; `inspect` rend l'adresse ; `rm` et `logs` ne font que journaliser.
cat > "$WORK/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$STUB_LOG"
case "$1" in
  run)
    [ -z "${STUB_DOCKER_FAIL:-}" ] || { echo "erreur de lancement" >&2; exit 1; }
    n=$(( $(cat "$STUB_STATE/count" 2>/dev/null || echo 0) + 1 ))
    echo "$n" > "$STUB_STATE/count"
    name=""
    prev=""
    for a in "$@"; do
      [ "$prev" = "--name" ] && name="$a"
      if [ "$prev" = "-v" ]; then
        src="${a%%:*}"
        case "$a" in *:/etc/caddytest*) mkdir -p "$STUB_STATE/mounted-$n" && cp "$src"/* "$STUB_STATE/mounted-$n"/ ;; esac
      fi
      prev="$a"
    done
    echo "$name" > "$STUB_STATE/name-$n"
    echo "10.9.0.$n" > "$STUB_STATE/ip-$name"
    echo "fakeid$n"
    ;;
  inspect)
    cat "$STUB_STATE/ip-${@: -1}"
    ;;
esac
exit 0
EOF

# Faux curl (commandes internes de bash seulement : un processus par appel, le poste de développement est lent à en lancer).
# L'adresse porte l'IP du conteneur, qui désigne son MODE (STUB_MODES : un mot par conteneur, dans l'ordre de lancement). Un mode peut
# combiner des mots (empty+apileak) ; sans mot « static », « dead » ni « nofallback », les pages sont servies par l'application.
#   dead        : repli statique correct (pages en 200 sans X-Site-Source)
#   static      : les pages ne vont pas à l'application (pas de X-Site-Source)
#   empty       : défaut du 2026-11-20 : pages en 200 avec X-Site-Source mais SANS corps
#   apileak     : /api/v1/health répond 200 sur le domaine du site
#   noprivate   : /tools/legal-slots.json est servi
#   nofallback  : amont en échec = 502 (pas de repli)
cat > "$WORK/bin/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG"
out="" hdr="" url="" wflag=""
while [ $# -gt 0 ]; do
  case "$1" in
    --output | -o) out="$2"; shift ;;
    --dump-header | -D) hdr="$2"; shift ;;
    --write-out | -w) wflag=1; shift ;;
    --max-time | --header | -H) shift ;;
    http://*) url="$1" ;;
  esac
  shift
done
rest="${url#http://}"
ip="${rest%%:*}"
path="/${rest#*/}"
read -ra modes <<< "$STUB_MODES"
mode="${modes[$(( ${ip##*.} - 1 ))]}"

is_page() {
  local p="${path#/}" c
  [[ $p == assets/* || $p == favicon.svg || $p == robots.txt || $p == 404.html ]] && return 1
  for c in "$p" "$p.html" "${p%/}/index.html"; do
    [ -f "$STUB_WEB/$c" ] && return 0
  done
  return 1
}

code=404 src="" size=0
case "$path" in
  /en) code=301 ;;
  /assets/* | /favicon.svg | /robots.txt) code=200 size=600 ;;
  /tools/legal-slots.json) if [[ $mode == *noprivate* ]]; then code=200 size=600; fi ;;
  /api/v1/health) if [[ $mode == *apileak* ]]; then code=200 size=60; fi ;;
  /tools/* | /.git/* | /_site* | /.well-known/security.txt | /api/* | /up | /livewire/* | /admin | /index.php) ;;
  *)
    if is_page; then
      code=200 size=5000
      if [[ $mode == *nofallback* ]]; then code=502 size=0
      elif [[ $mode != *static* && $mode != dead* ]]; then src=app
      fi
      if [[ $mode == *empty* ]]; then size=0; fi
    else
      size=400 # page 404 du site
    fi
    ;;
esac
[ -z "$out" ] || printf '%*s' "$size" '' > "$out"
if [ -n "$hdr" ]; then
  {
    printf 'HTTP/1.1 %s\r\ncontent-security-policy: default-src %s\r\n' "$code" "'self'"
    [ -z "$src" ] || printf 'x-site-source: %s\r\n' "$src"
    case "$path" in
      /confirm-deletion*) printf 'cache-control: no-store\r\n' ;;
      /legal/terms*) [ "$src" != app ] || printf 'cache-control: public, max-age=300\r\n' ;;
    esac
    printf '\r\n'
  } > "$hdr"
fi
[ -z "$wflag" ] || printf '%s %s' "$code" "$size"
exit 0
EOF
chmod +x "$WORK/bin/docker" "$WORK/bin/curl"

failures=0
check() { # description, condition (0 = ok)
  if [ "$2" -eq 0 ]; then echo "ok   - $1"; else echo "FAIL - $1"; failures=$((failures + 1)); fi
}

# run_script <modes> [arguments] : RC et OUT reçoivent le code de sortie et la sortie ; l'état du faux docker est remis à zéro.
run_script() {
  local modes="$1"
  shift
  rm -rf "$WORK/state" && mkdir -p "$WORK/state"
  : > "$LOG"
  set +e
  OUT="$(env PATH="$WORK/bin:$PATH" STUB_LOG="$LOG" STUB_STATE="$WORK/state" STUB_MODES="$modes" STUB_WEB="$WEB" \
    bash "$SCRIPT" "$@" 2>&1)"
  RC=$?
  set -e
}
says() { case "$OUT" in *"$1"*) return 0 ;; *) return 1 ;; esac; }
ok_if() { if "$@"; then echo 0; else echo 1; fi; }

# --- 1. Site sain, repli correct dans les deux variantes d'amont en défaut ---
run_script "main dead dead"
check "site sain et repli correct : sortie 0" "$(ok_if [ "$RC" -eq 0 ])"
check "site sain : le résumé annonce que tout passe" "$(ok_if says 'toutes les vérifications passent')"
check "trois conteneurs d'essai lancés (normal, amont mort, amont sans script), tous sur le réseau interne, sans port publié" \
  "$([ "$(grep -c '^docker run' "$LOG")" -eq 3 ] && grep -q -- '--network ayelo_internal' "$LOG" && ! grep -q -- ' -p \|--publish' "$LOG" && echo 0 || echo 1)"
check "tous les conteneurs d'essai sont supprimés à la fin" \
  "$([ "$(grep -c '^docker rm -f' "$LOG")" -ge 3 ] && echo 0 || echo 1)"

# --- 2. Caddyfile d'essai généré depuis le vrai Caddyfile ---
M1="$WORK/state/mounted-1/Caddyfile.main"
M2="$WORK/state/mounted-2/Caddyfile.amont-mort"
M3="$WORK/state/mounted-3/Caddyfile.sans-script"
check "essai : le bloc du site est écouté sur :8095, sans TLS automatique ni interface d'administration" \
  "$(grep -q '^:8095 {' "$M1" && grep -q 'auto_https off' "$M1" && grep -q 'admin off' "$M1" && echo 0 || echo 1)"
check "essai : les modèles d'en-têtes (web_headers, security_headers) et le routage des pages sont repris" \
  "$(grep -q '^(web_headers)' "$M1" && grep -q '^(security_headers)' "$M1" && grep -q 'handle @pages' "$M1" && grep -q 'env REQUEST_URI /_site' "$M1" && echo 0 || echo 1)"
check "essai : aucun autre domaine (API, WebSocket, administration, www) ni la configuration ACME du vrai Caddyfile" \
  "$(! grep -q 'API_DOMAIN} {' "$M1" && ! grep -q 'WS_DOMAIN} {' "$M1" && ! grep -q 'ADMIN_DOMAIN} {' "$M1" && ! grep -q '^www\.' "$M1" && ! grep -q 'ACME_EMAIL' "$M1" && echo 0 || echo 1)"
check "essai : le fichier d'essai est le bloc réel, pas une réécriture (le bloc privé et le repli y sont)" \
  "$(grep -q 'handle @private' "$M1" && grep -q 'handle_errors' "$M1" && grep -q 'status 200' "$M1" && echo 0 || echo 1)"
check "variante amont mort : l'amont FastCGI est un nom d'hôte inexistant, et seulement lui" \
  "$(grep -q 'amont-inexistant.invalid:9000' "$M2" && ! grep -q 'app:9000' "$M2" && echo 0 || echo 1)"
check "variante sans script : la racine FastCGI pointe un dossier sans index.php" \
  "$(grep -q 'root /var/www/html/inexistant' "$M3" && ! grep -q 'root /var/www/html/public' "$M3" && echo 0 || echo 1)"

# --- 3. Défauts que le rejeu doit attraper (sortie 1, chaque adresse fautive nommée) ---
# Un seul rejeu cumule les défauts de l'essai 1 (pages vides, API et dossier tools/ exposés) et casse le repli des deux autres.
run_script "empty+apileak+noprivate nofallback nofallback"
check "défauts cumulés : sortie 1" "$(ok_if [ "$RC" -eq 1 ])"
check "pages en 200 mais VIDES (incident du 2026-11-20) : adresse nommée" "$(ok_if says 'FAIL - /legal/terms : attendu HTTP 200, X-Site-Source=app, corps >= 1000 octets ; obtenu HTTP 200, X-Site-Source=app, corps 0 octets')"
check "/api/v1/health servi par le domaine du site : adresse nommée" "$(ok_if says 'FAIL - /api/v1/health')"
check "/tools/legal-slots.json servi : adresse nommée" "$(ok_if says 'FAIL - /tools/legal-slots.json')"
check "amont mort sans repli (502) : variante nommée" "$(ok_if says 'amont mort')"
check "amont sans script sans repli (502) : variante nommée" "$(ok_if says 'sans script')"
check "le résumé refuse la mise en production" "$(ok_if says 'ne pas mettre ce bloc en production')"
check "aucun faux succès : le message de réussite est absent" "$(says 'toutes les vérifications passent' && echo 1 || echo 0)"

run_script "static dead dead"
check "pages non transmises à l'application (pas de X-Site-Source) : sortie 1, adresse nommée" "$([ "$RC" -eq 1 ] && says 'FAIL - /legal/terms' && echo 0 || echo 1)"

# --- 4. Usage et erreurs ---
STUB_DOCKER_FAIL=1 run_script "main dead dead"
check "conteneur d'essai qui ne démarre pas : sortie non nulle, jamais un faux succès" "$([ "$RC" -ne 0 ] && ! says 'toutes les vérifications passent' && echo 0 || echo 1)"

echo '{$WEB_DOMAIN_ABSENT} {
	respond 200
}' > "$WORK/Caddyfile.sansbloc"
run_script "main dead dead" "$WORK/Caddyfile.sansbloc"
check "Caddyfile sans bloc {\$WEB_DOMAIN} : sortie non nulle, message clair, aucun conteneur lancé" \
  "$([ "$RC" -ne 0 ] && says 'bloc' && ! grep -q '^docker run' "$LOG" && echo 0 || echo 1)"

run_script "main dead dead" "$WORK/inexistant"
check "Caddyfile introuvable : sortie non nulle, aucun conteneur lancé" "$([ "$RC" -ne 0 ] && ! grep -q '^docker run' "$LOG" && echo 0 || echo 1)"

if [ "$failures" -ne 0 ]; then
  echo "$failures vérification(s) en échec"
  exit 1
fi
echo "toutes les vérifications passent"
