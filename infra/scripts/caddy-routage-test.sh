#!/usr/bin/env bash
# Essai du routage du site de présentation dans un Caddy ISOLÉ, à lancer SUR LE SERVEUR avant tout changement du bloc
# `{$WEB_DOMAIN}` de infra/caddy/Caddyfile (docs/runbooks/site-public.md, « Essayer un changement du bloc Caddy »).
#
#   bash infra/scripts/caddy-routage-test.sh [chemin/vers/Caddyfile]      (défaut : infra/caddy/Caddyfile du dépôt)
#
# Pourquoi. `caddy validate` accepte un bloc dont le routage est faux : le 2026-11-20, `php_fastcgi` a servi toutes les pages en
# 200 mais VIDES en production. Ce script lance un Caddy jetable (aucun port publié, trafic réel intact) sur le même réseau Docker
# que l'application, avec le bloc du site extrait du Caddyfile, et rejoue la liste des adresses attendues. Sortie 0 seulement si
# TOUT est conforme ; sinon une ligne `FAIL - <adresse>` par écart et sortie 1. Il ne modifie rien : ni le Caddy de production,
# ni les fichiers du dépôt. Les conteneurs d'essai sont supprimés à la fin, même en cas d'erreur.
#
# Trois essais : (1) l'application en marche : pages servies par elle (en-tête X-Site-Source: app, corps non vide), ressources par
# Caddy, adresses privées en 404 ; (2) amont mort (nom d'hôte inexistant) et (3) amont qui répond 404 (racine sans index.php) :
# repli statique en 200, sans X-Site-Source, avec le corps de la page.
#
# Variables (valeurs par défaut = installation décrite dans docs/runbooks/deploiement.md) :
#   CADDY_TEST_NETWORK (ayelo_internal), CADDY_TEST_PUBLIC_VOLUME (ayelo_app-public : public/ de l'application),
#   CADDY_TEST_WEB_DIR (<dépôt>/web), CADDY_TEST_IMAGE (l'image de caddy dans infra/docker-compose.prod.yml).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
CADDYFILE="${1:-$REPO/infra/caddy/Caddyfile}"
WEB_DIR="${CADDY_TEST_WEB_DIR:-$REPO/web}"
NETWORK="${CADDY_TEST_NETWORK:-ayelo_internal}"
PUBLIC_VOLUME="${CADDY_TEST_PUBLIC_VOLUME:-ayelo_app-public}"
PORT=8095

die() { echo "erreur : $*" >&2; exit 1; }

[ -f "$CADDYFILE" ] || die "Caddyfile introuvable : $CADDYFILE"
[ -d "$WEB_DIR" ] || die "dossier du site introuvable : $WEB_DIR"
IMAGE="${CADDY_TEST_IMAGE:-$(awk '/^  caddy:/ {f = 1; next} f && /^    image:/ {print $2; exit}' "$REPO/infra/docker-compose.prod.yml" 2>/dev/null || true)}"
[ -n "$IMAGE" ] || die "image de Caddy introuvable (CADDY_TEST_IMAGE)"

WORK="$(mktemp -d)"
RUN_ID="$$"
CONTAINERS=()
cleanup() {
  local c
  for c in "${CONTAINERS[@]+"${CONTAINERS[@]}"}"; do docker rm -f "$c" >/dev/null 2>&1 || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT

# Caddyfile d'essai : l'en-tête global (TLS, administration) est remplacé par `auto_https off` + `admin off`, les modèles
# (snippets) sont repris tels quels, seul le bloc {$WEB_DOMAIN} est gardé et il écoute sur :8095. Les autres domaines (API,
# WebSocket, administration, www) sont écartés. Les accolades des lignes de commentaire ne comptent pas ; celles des espaces
# réservés ({path}, {$VAR}) sont équilibrées sur leur ligne.
awk -v port="$PORT" '
  BEGIN { depth = 0; mode = ""; found = 0 }
  {
    line = $0
    first = 0
    if (depth == 0) {
      first = 1
      if (line ~ /^[{][ \t]*$/) mode = "global"
      else if (line ~ /^[(]/) mode = "snippet"
      else if (line ~ /^[{][$]WEB_DOMAIN[}][ \t]*[{][ \t]*$/) { mode = "web"; found = 1 }
      else if (line ~ /[{][ \t]*$/) mode = "skip"
      else mode = ""
    }
    t = line
    sub(/^[ \t]+/, "", t)
    d = 0
    if (t !~ /^#/) { o = gsub(/[{]/, "{", t); c = gsub(/[}]/, "}", t); d = o - c }
    if (mode == "global" && first) printf "{\n\tauto_https off\n\tadmin off\n}\n\n"
    else if (mode == "snippet") print line
    else if (mode == "web") print (first ? ":" port " {" : line)
    depth += d
    if (depth == 0) { if (mode == "snippet" || mode == "web") print ""; mode = "" }
  }
  END { if (!found) exit 3 }
' "$CADDYFILE" > "$WORK/Caddyfile.main" || die "bloc {\$WEB_DOMAIN} introuvable dans $CADDYFILE"

# Variantes : l'application injoignable, puis l'application qui répond 404 (PHP-FPM sans script à exécuter).
sed 's/app:9000/amont-inexistant.invalid:9000/' "$WORK/Caddyfile.main" > "$WORK/Caddyfile.amont-mort"
sed 's#root /var/www/html/public#root /var/www/html/inexistant#' "$WORK/Caddyfile.main" > "$WORK/Caddyfile.sans-script"
cmp -s "$WORK/Caddyfile.main" "$WORK/Caddyfile.amont-mort" && die "variante amont mort : aucune ligne app:9000 à remplacer (le bloc a changé, adapter ce script)"
cmp -s "$WORK/Caddyfile.main" "$WORK/Caddyfile.sans-script" && die "variante sans script : aucune ligne « root /var/www/html/public » à remplacer (le bloc a changé, adapter ce script)"

FAILS=0
IP=""

# start_caddy <fichier du dossier d'essai> <nom court> : lance le Caddy jetable et renseigne IP.
start_caddy() {
  local file="$1" name="caddy-routage-test-$2-$RUN_ID" i
  CONTAINERS+=("$name")
  docker run -d --rm --name "$name" --network "$NETWORK" -e API_DOMAIN=api.test.invalid \
    -v "$WORK:/etc/caddytest:ro" -v "$WEB_DIR:/srv/web:ro" -v "$PUBLIC_VOLUME:/var/www/html/public:ro" \
    "$IMAGE" caddy run --config "/etc/caddytest/$file" --adapter caddyfile >/dev/null || die "le conteneur d'essai ne démarre pas ($file)"
  IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$name")"
  [ -n "$IP" ] || die "adresse du conteneur d'essai introuvable ($name)"
  for ((i = 0; i < 30; i++)); do
    curl -s -o /dev/null --max-time 3 "http://$IP:$PORT/robots.txt" && return 0
    sleep 1
  done
  docker logs "$name" 2>&1 | tail -n 20 >&2 || true
  die "le Caddy d'essai ne répond pas sur $IP:$PORT ($file)"
}

CODE="" SRC="" SIZE=0
# probe <chemin> : renseigne CODE, SIZE (octets du corps) et SRC (valeur de X-Site-Source) ; en-têtes dans $WORK/hdr.
# Commandes internes de bash seulement (un seul processus, curl, par adresse) : l'essai reste rapide même sur un poste lent.
probe() {
  : > "$WORK/hdr"
  curl -s --max-time 10 -o "$WORK/body" -D "$WORK/hdr" -w '%{http_code} %{size_download}' "http://$IP:$PORT$1" > "$WORK/wo" || echo "000 0" > "$WORK/wo"
  # `curl -w` n'ajoute pas de saut de ligne : `read` renvoie alors un code d'erreur tout en renseignant les variables.
  CODE="" SIZE=""
  read -r CODE SIZE < "$WORK/wo" || true
  [ -n "$CODE" ] || CODE=000
  [ -n "$SIZE" ] || SIZE=0
  SRC=""
  local line
  while IFS= read -r line; do
    line="${line%$'\r'}"
    if [[ ${line,,} == x-site-source:* ]]; then SRC="${line#*:}"; SRC="${SRC// /}"; fi
  done < "$WORK/hdr"
}
header_has() { # regex en minuscules, comparée aux en-têtes de la dernière réponse
  local line
  while IFS= read -r line; do
    [[ ${line,,} =~ $1 ]] && return 0
  done < "$WORK/hdr"
  return 1
}
report() { # chemin, ok (0/1), attendu, obtenu
  if [ "$2" -eq 0 ]; then echo "ok   - $1"; else echo "FAIL - $1 : attendu $3 ; obtenu $4"; FAILS=$((FAILS + 1)); fi
}
expect() { # chemin, code, source (app|none), taille minimale du corps
  local ok=0
  probe "$1"
  [ "$CODE" = "$2" ] || ok=1
  case "$3" in
    app) [ "$SRC" = app ] || ok=1 ;;
    none) [ -z "$SRC" ] || ok=1 ;;
  esac
  [ "$SIZE" -ge "$4" ] || ok=1
  report "$1" "$ok" "HTTP $2, X-Site-Source=$3, corps >= $4 octets" "HTTP $CODE, X-Site-Source=${SRC:-aucun}, corps $SIZE octets"
}
expect_header() { # chemin, regex (en-tête attendu, en minuscules), description
  probe "$1"
  if header_has "$2"; then report "$1 ($3)" 0 "" ""; else report "$1 ($3)" 1 "en-tête $3" "absent"; fi
}
expect_no_header() { # chemin, regex (en minuscules), description
  probe "$1"
  if header_has "$2"; then report "$1 ($3)" 1 "aucun en-tête $3" "présent"; else report "$1 ($3)" 0 "" ""; fi
}

PAGES=()
while IFS= read -r f; do PAGES+=("${f#"$WEB_DIR"/}"); done < <(find "$WEB_DIR" -name '*.html' ! -name 404.html ! -path "$WEB_DIR/tools/*" | LC_ALL=C sort)
[ "${#PAGES[@]}" -gt 0 ] || die "aucune page HTML dans $WEB_DIR"

echo "== essai 1 : application en marche =="
start_caddy Caddyfile.main normal
expect / 200 app 1000
expect /en/ 200 app 1000
expect /en 301 none 0
for p in "${PAGES[@]}"; do
  expect "/$p" 200 app 1000
  expect "/${p%.html}" 200 app 1000
done
expect /assets/site.css 200 none 100
expect /favicon.svg 200 none 100
expect /robots.txt 200 none 10
expect /inconnue 404 none 200
expect /en/inconnue 404 none 200
expect /legal/terms/ 404 none 200
for p in /tools/legal-slots.json /tools/build.py /.git/config /_site /_site/legal/terms /.well-known/security.txt \
  /api/v1/health /up /livewire/update /admin /index.php; do
  expect "$p" 404 none 0
done
expect_header /legal/terms 'cache-control:.*max-age=300' 'Cache-Control max-age=300'
expect_no_header /legal/terms '^set-cookie:' 'Set-Cookie'
expect_header /legal/terms '^content-security-policy:' 'Content-Security-Policy'
expect_header /confirm-deletion 'cache-control:.*no-store' 'Cache-Control no-store'

repli() { # fichier, nom court, libellé : repli statique attendu (200, sans X-Site-Source, page complète)
  echo "== essai $4 : $3 =="
  start_caddy "$1" "$2"
  expect / 200 none 1000
  expect /legal/terms 200 none 1000
  expect /legal/terms.html 200 none 1000
  expect /en/legal/terms 200 none 1000
  expect_header /confirm-deletion 'cache-control:.*no-store' 'Cache-Control no-store'
  expect /assets/site.css 200 none 100
  expect /inconnue 404 none 200
  expect /api/v1/health 404 none 0
  expect /tools/legal-slots.json 404 none 0
}
repli Caddyfile.amont-mort amont-mort "amont mort (repli statique)" 2
repli Caddyfile.sans-script sans-script "amont sans script, PHP-FPM répond 404 (repli statique)" 3

if [ "$FAILS" -ne 0 ]; then
  echo "$FAILS vérification(s) en échec : ne pas mettre ce bloc en production"
  exit 1
fi
echo "toutes les vérifications passent"
