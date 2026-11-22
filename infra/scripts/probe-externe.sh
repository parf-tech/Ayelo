#!/usr/bin/env bash
# Sonde externe de disponibilité : à lancer depuis une machine AUTRE que le serveur (une sonde interne tombe avec lui).
#
#   probe-externe.sh api  https://<API_DOMAIN>   GET /api/v1/health : 200 ET corps {"status":"ok"} (base, Redis, file)
#   probe-externe.sh site https://<WEB_DOMAIN>   GET /legal/terms   : 200 ET en-tête `X-Site-Source: app`
#
# Pourquoi deux contrôles. Le site de présentation est servi par Caddy avec un REPLI STATIQUE : si l'application est arrêtée ou
# en échec, Caddy répond quand même HTTP 200 avec les fichiers de web/ (docs/runbooks/site-public.md). Une alerte qui ne regarde
# que le code HTTP du site ne verrait donc jamais la panne. Seule la page servie par l'application porte `X-Site-Source: app` ;
# son absence = repli actif = application en panne, même si le code est 200. Le contrôle `api` est la mesure directe de
# l'application et ne dépend pas du repli.
#
# Sortie : 0 = tout va bien ; 1 = panne (une ligne `ALERTE <contrôle> <cause> : <détail>`) ; 2 = mauvais usage (aucune requête).
# Causes : api_injoignable, api_degrade (503 : composants en défaut), api_reponse_inattendue ;
#          site_injoignable, site_hors_service (code autre que 200), site_repli_statique (200 sans X-Site-Source: app).
# Seuls des GET sont envoyés ; aucun secret, aucune redirection suivie, 15 s au plus par requête.
set -uo pipefail

usage() {
  echo "usage : probe-externe.sh api|site https://<domaine>" >&2
  exit 2
}

[ $# -eq 2 ] || usage
CHECK="$1"
BASE="${2%/}"
case "$CHECK" in api | site) ;; *) usage ;; esac
case "$BASE" in
  https://*) ;;
  *) echo "adresse refusée : elle doit commencer par https://" >&2; exit 2 ;;
esac
case "$BASE" in
  *[[:space:]\"\'\\\<\>]*) echo "adresse refusée : caractère interdit" >&2; exit 2 ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { # cause, détail
  echo "ALERTE ${CHECK} ${1} : ${2}"
  exit 1
}

# fetch <url> : renseigne CODE (code HTTP, 000 si échec réseau) et CURL_RC ; corps dans $TMP/body, en-têtes dans $TMP/headers.
# Le paramètre `sonde` et l'en-tête no-cache évitent de lire une copie en cache plutôt que l'état réel.
fetch() {
  CODE="$(curl --silent --show-error --max-time 15 --output "$TMP/body" --dump-header "$TMP/headers" \
    --write-out '%{http_code}' --header 'Cache-Control: no-cache' --user-agent 'ayelo-sonde/1' \
    "$1?sonde=$(date +%s)" 2>"$TMP/err")"
  CURL_RC=$?
}

case "$CHECK" in
  api)
    fetch "$BASE/api/v1/health"
    [ "$CURL_RC" -eq 0 ] || fail api_injoignable "curl code ${CURL_RC}"
    BODY="$(head -c 400 "$TMP/body" | tr -d '\r\n')"
    if [ "$CODE" = 200 ] && [[ $BODY == *'"status":"ok"'* ]]; then
      echo "OK api : /api/v1/health répond 200, status ok"
    elif [ "$CODE" = 503 ] && [[ $BODY == *'"status":"degraded"'* ]]; then
      # Le corps ne donne que ok / error / skipped par composant (jamais de message d'exception) : sûr à afficher.
      fail api_degrade "composants en défaut : $(printf '%s' "$BODY" | grep -o '"[a-z]*":"error"' | tr '\n' ' ')"
    else
      fail api_reponse_inattendue "HTTP ${CODE}"
    fi
    ;;
  site)
    fetch "$BASE/legal/terms"
    [ "$CURL_RC" -eq 0 ] || fail site_injoignable "curl code ${CURL_RC}"
    [ "$CODE" = 200 ] || fail site_hors_service "HTTP ${CODE}"
    SOURCE="$(grep -i '^x-site-source:' "$TMP/headers" | tail -n 1 | cut -d: -f2- | tr -d ' \r')"
    if [ "$SOURCE" = app ]; then
      echo "OK site : /legal/terms répond 200, servi par l'application (X-Site-Source: app)"
    else
      fail site_repli_statique "HTTP 200 sans X-Site-Source: app : le site répond par son repli statique, l'application est arrêtée ou en échec"
    fi
    ;;
esac
