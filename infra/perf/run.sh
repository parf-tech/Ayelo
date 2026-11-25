#!/usr/bin/env bash
# Banc de charge jetable : construit l'application de CE dépôt, remplit une base fictive, lance k6, puis détruit tout.
# Usage : run.sh <dossier des résultats> [profils=200000] [acteurs=500] [échelle=1] [durée d'un palier=90s]
#         MEDIA_ASYNC_IMAGES=true run.sh ...   ré-encodage des images hors de la requête
# Sans effet sur un autre projet compose : tout passe par « -p ayelo-perf » ; aucune commande « prune ».
set -euo pipefail

[ "$#" -ge 1 ] || { echo "usage : $0 <dossier des résultats> [profils] [acteurs] [échelle] [palier]" >&2; exit 2; }
RESULTS="$(mkdir -p "$1" && cd "$1" && pwd)"
PROFILES="${2:-200000}"; ACTORS="${3:-500}"; SCALE="${4:-1}"; STAGE="${5:-90s}"
ASYNC="${MEDIA_ASYNC_IMAGES:-false}"
for n in "$PROFILES" "$ACTORS"; do case "$n" in ''|*[!0-9]*) echo "nombre invalide : $n" >&2; exit 2 ;; esac; done
[ "$ACTORS" -ge 50 ] && [ "$PROFILES" -ge "$ACTORS" ] || { echo "il faut au moins 50 acteurs et profils >= acteurs" >&2; exit 2; }
cd "$(dirname "$0")"

if [ -n "$(docker ps -aq --filter label=com.docker.compose.project=ayelo-perf)" ]; then
  echo "ERREUR : un banc « ayelo-perf » existe déjà, rien n'est fait" >&2; exit 1
fi

WORK="$(mktemp -d)"
export PERF_ENV="$WORK/perf.env" PERF_WORK="$WORK"
dc() { docker compose -p ayelo-perf --env-file "$PERF_ENV" -f compose.yml "$@"; }
SAMPLER=""
cleanup() {
  if [ -n "$SAMPLER" ]; then kill "$SAMPLER" 2>/dev/null || true; fi
  echo "== destruction du banc"
  dc --profile load down -v --remove-orphans >/dev/null 2>&1 || true
  docker image rm ayelo-perf-app:local >/dev/null 2>&1 || true
  rm -rf -- "$WORK"
}
trap cleanup EXIT
log() { printf '== %s %s\n' "$(date -u +%H:%M:%S)" "$*"; }

secret() { head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9; }
( umask 077
  sed -e "s|__APP_KEY__|base64:$(head -c 32 /dev/urandom | base64)|" \
      -e "s|__DB_PASSWORD__|$(secret)|" -e "s|__REDIS_PASSWORD__|$(secret)|" -e "s|__REVERB_SECRET__|$(secret)|" \
      -e "s|__ASYNC__|${ASYNC}|" perf.env.tpl > "$PERF_ENV" )
psql_() { dc exec -T postgres psql -U app -d app -X -v ON_ERROR_STOP=1 "$@"; }

log "construction de l'image (code : $(git -C ../.. log -1 --format=%h 2>/dev/null || echo inconnu))"
dc build app > "$RESULTS/build.log" 2>&1 || { tail -30 "$RESULTS/build.log"; exit 1; }
log "base, files et stockage"
dc up -d --wait postgres redis redis-cache >/dev/null
dc up -d s3 >/dev/null
# Le faux stockage (Java) met plusieurs dizaines de secondes à ouvrir son port.
if ! dc run --rm -T --no-deps app sh -c 'for i in $(seq 1 240); do php -r "exit(@fsockopen(\"s3\", 9090) ? 0 : 1);" 2>/dev/null && exit 0; sleep 1; done; exit 1'; then
  echo "ERREUR : le faux stockage ne répond pas" >&2; dc logs --tail 40 s3 | cut -c1-300; exit 1
fi
dc run --rm -T --no-deps app php artisan migrate --force > "$RESULTS/migrate.log" 2>&1 || { cat "$RESULTS/migrate.log"; exit 1; }

log "données : $PROFILES profils, $ACTORS acteurs"
SECONDS=0
psql_ -q -v profiles="$PROFILES" -v actors="$ACTORS" -v convs=10 -v msgs=40 -v swipes=300 < seed.sql
log "données insérées en ${SECONDS} s"
psql_ -At < actors.sql > "$WORK/actors.json"
psql_ -At -c "select 'profils=' || (select count(*) from profiles) || ' conversations=' || (select count(*) from conversations) || ' messages=' || (select count(*) from messages) || ' base=' || pg_size_pretty(pg_database_size('app'))" | tee "$RESULTS/volume.txt"

log "application"
dc up -d --wait app >/dev/null
dc exec -T app sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache' > "$RESULTS/cache.log" 2>&1
dc up -d web worker reverb >/dev/null
# Photo d'essai (3000 x 2000, bruitée) : un ré-encodage représentatif d'un téléphone.
dc run --rm -T --no-deps app php -r '$i = imagecreatetruecolor(3000, 2000); mt_srand(1); for ($k = 0; $k < 40000; $k++) { $x = mt_rand(0, 2999); $y = mt_rand(0, 1999); imagefilledrectangle($i, $x, $y, $x + mt_rand(2, 60), $y + mt_rand(2, 60), mt_rand(0, 0xFFFFFF)); } imagejpeg($i, null, 90);' > "$WORK/photo.jpg"
echo "photo d'essai : $(wc -c < "$WORK/photo.jpg") octets"

log "plans de la requête de découverte"
psql_ < explain.sql > "$RESULTS/explain.txt"

log "essai à blanc"
if ! dc --profile load run --rm -T k6 run --quiet -e SMOKE=1 -e SCALE=0.1 -e STAGE=5s /scripts/load.js > "$RESULTS/smoke.txt" 2>&1; then
  echo "ERREUR : l'essai à blanc échoue, pas de charge" >&2
  dc logs --no-log-prefix app > "$RESULTS/app-smoke.log" 2>&1 || true
  tail -60 "$RESULTS/smoke.txt"
  grep -a -E "\.(ERROR|CRITICAL|WARNING):|Exception:|fin de d" "$RESULTS/app-smoke.log" "$RESULTS/smoke.txt" | cut -c1-400 | head -20
  exit 1
fi

log "charge (échelle $SCALE, paliers de $STAGE, MEDIA_ASYNC_IMAGES=$ASYNC)"
( while true; do date -u +%H:%M:%S; docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' $(docker ps -q --filter label=com.docker.compose.project=ayelo-perf) 2>/dev/null; sleep 15; done ) > "$RESULTS/stats.txt" &
SAMPLER=$!
status=0
dc --profile load run --rm -T k6 run --quiet -e SCALE="$SCALE" -e STAGE="$STAGE" --summary-export=/work/summary.json /scripts/load.js > "$RESULTS/k6.txt" 2>&1 || status=$?
kill "$SAMPLER" 2>/dev/null || true; SAMPLER=""
cp "$WORK/summary.json" "$RESULTS/summary.json" 2>/dev/null || true
dc logs --no-log-prefix postgres 2>/dev/null | grep -E "duration: [0-9]+" | cut -c1-400 > "$RESULTS/slow-queries.txt" || true
dc logs app worker reverb 2>/dev/null | grep -i -E "error|exception|critical" | cut -c1-300 | head -100 > "$RESULTS/errors.txt" || true
psql_ -At -c "select 'files en attente (jobs échoués) : ' || count(*) from failed_jobs" > "$RESULTS/failed-jobs.txt" || true
log "k6 terminé, code $status (99 = un objectif n'est pas atteint)"
cat "$RESULTS/k6.txt"
exit 0
