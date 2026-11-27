#!/usr/bin/env bash
# Banc de charge jetable : construit l'application de CE dépôt, remplit une base fictive, lance k6, puis détruit tout.
# Usage : run.sh <dossier des résultats> [profils=200000] [acteurs=500] [échelle=1] [durée d'un palier=90s]
#         MEDIA_ASYNC_IMAGES=true run.sh ...   ré-encodage des images hors de la requête
#         DB_PERSISTENT=true run.sh ...        connexions PostgreSQL persistantes
#         PERF_PROFILE=1 run.sh ...            profil des routes, sans charge (PROFILE_REQUESTS=200 par route)
# Sans effet sur un autre projet compose : tout passe par « -p ayelo-perf » ; aucune commande « prune ».
set -euo pipefail

[ "$#" -ge 1 ] || { echo "usage : $0 <dossier des résultats> [profils] [acteurs] [échelle] [palier]" >&2; exit 2; }
RESULTS="$(mkdir -p "$1" && cd "$1" && pwd)"
PROFILES="${2:-200000}"; ACTORS="${3:-500}"; SCALE="${4:-1}"; STAGE="${5:-90s}"
ASYNC="${MEDIA_ASYNC_IMAGES:-false}"
PERSISTENT="${DB_PERSISTENT:-false}"
PROFILE="${PERF_PROFILE:-0}"
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
      -e "s|__ASYNC__|${ASYNC}|" -e "s|__PERSISTENT__|${PERSISTENT}|" perf.env.tpl > "$PERF_ENV" )
psql_() { dc exec -T postgres psql -U app -d app -X -v ON_ERROR_STOP=1 "$@"; }
# Connexions ouvertes depuis le démarrage de PostgreSQL : montre si l'application les réutilise.
sessions() { psql_ -At -c "select sessions from pg_stat_database where datname = 'app'"; }

log "construction de l'image (code : $(git -C ../.. log -1 --format=%h 2>/dev/null || echo inconnu))"
dc build app > "$RESULTS/build.log" 2>&1 || { tail -30 "$RESULTS/build.log"; exit 1; }
if [ "$PROFILE" = 1 ]; then
  log "image de profil (extension excimer)"
  docker build --pull=false -t ayelo-perf-app:local profil >> "$RESULTS/build.log" 2>&1 || { tail -30 "$RESULTS/build.log"; exit 1; }
fi
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
# Photo d'essai produite par photo.php (mêmes octets à chaque essai).
dc exec -T app php /srv/perf/photo.php > "$WORK/photo.jpg"
echo "photo d'essai : $(wc -c < "$WORK/photo.jpg") octets"

log "plans de la requête de découverte"
psql_ < explain.sql > "$RESULTS/explain.txt"

diagnose() {
  docker inspect "$(dc ps -q app)" --format 'application : limite processeur appliquée = {{.HostConfig.NanoCpus}} nanocpus, mémoire = {{.HostConfig.Memory}}'
  dc exec -T app sh -c 'echo "cgroup cpu.max : $(cat /sys/fs/cgroup/cpu.max) ; $(grep -E "nr_throttled|^usage_usec" /sys/fs/cgroup/cpu.stat | tr "\n" " ")"' || true
  dc exec -T app sh -c 'SCRIPT_NAME=/opcache.php SCRIPT_FILENAME=/srv/perf/opcache.php REQUEST_METHOD=GET cgi-fcgi -bind -connect 127.0.0.1:9000' | grep -a opcache || echo "diagnostic opcache indisponible"
}

log "essai à blanc"
if ! dc --profile load run --rm -T k6 run --quiet -e SMOKE=1 -e SCALE=0.1 -e STAGE=5s /scripts/load.js > "$RESULTS/smoke.txt" 2>&1; then
  echo "ERREUR : l'essai à blanc échoue, pas de charge" >&2
  dc logs --no-log-prefix app > "$RESULTS/app-smoke.log" 2>&1 || true
  tail -60 "$RESULTS/smoke.txt"
  grep -a -E "\.(ERROR|CRITICAL|WARNING):|Exception:|fin de d" "$RESULTS/app-smoke.log" "$RESULTS/smoke.txt" | cut -c1-400 | head -20
  exit 1
fi

diagnose | tee "$RESULTS/diagnostic.txt"

# Mode profil : pas de charge, une requête à la fois, puis les piles échantillonnées de chaque route.
if [ "$PROFILE" = 1 ]; then
  log "profil : ${PROFILE_REQUESTS:-200} requêtes par route, une à la fois (DB_PERSISTENT=$PERSISTENT)"
  dc run --rm -T --no-deps -u root -v "$WORK:/work:ro" app php /srv/perf/profil/requetes.php /work/actors.json "${PROFILE_REQUESTS:-200}" | tee "$RESULTS/profil-temps.txt"
  dc exec -T app php /srv/perf/profil/resume.php /tmp/profils > "$RESULTS/profil.txt"
  dc exec -T app sh -c 'cd /tmp/profils && tar -czf - .' > "$RESULTS/profils.tar.gz"
  log "profil terminé : profil.txt, profil-temps.txt, profils.tar.gz"
  exit 0
fi

log "coût à vide (une requête à la fois)"
dc --profile load run --rm -T k6 run --quiet -e IDLE=1 /scripts/load.js > "$RESULTS/idle.txt" 2>&1 || true
grep -a -F "{ name:" "$RESULTS/idle.txt" || true
dc exec -T app php /srv/perf/timing.php | tee "$RESULTS/sanitize-cost.txt"

( while true; do date -u +%H:%M:%S; docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' $(docker ps -q --filter label=com.docker.compose.project=ayelo-perf) 2>/dev/null; sleep 15; done ) > "$RESULTS/stats.txt" &
SAMPLER=$!
# Plusieurs paliers sur les mêmes données : PERF_SCALES="0.1 0.25 0.5" (sinon l'échelle donnée).
for scale in ${PERF_SCALES:-$SCALE}; do
  log "charge (échelle $scale, paliers de $STAGE, MEDIA_ASYNC_IMAGES=$ASYNC, DB_PERSISTENT=$PERSISTENT, pointe de dépôts ${UPLOAD_PEAK:-2}/s x échelle)"
  status=0; opened="$(sessions)"
  dc --profile load run --rm -T k6 run --quiet -e SCALE="$scale" -e STAGE="$STAGE" -e UPLOAD="${UPLOAD_PEAK:-2}" --summary-export="/work/summary-$scale.json" /scripts/load.js > "$RESULTS/k6-$scale.txt" 2>&1 || status=$?
  cp "$WORK/summary-$scale.json" "$RESULTS/" 2>/dev/null || true
  grep -a -E "\{ name:|http_req_duration\.|checks_succeeded|dropped_iterations\.|http_req_failed\.|http_reqs\." "$RESULTS/k6-$scale.txt" | cut -c1-200 || true
  grep -a -o "fin de d[^\"]*" "$RESULTS/k6-$scale.txt" | sed -E 's/[0-9a-f-]{36}/<id>/g' | cut -c1-200 | sort | uniq -c | sort -rn | head -3 || true
  log "palier $scale terminé, code $status (99 = un objectif n'est pas atteint)"
  sleep 20
  echo "échelle $scale : $(( $(sessions) - opened )) connexions PostgreSQL ouvertes (DB_PERSISTENT=$PERSISTENT)" | tee -a "$RESULTS/connexions.txt"
done
kill "$SAMPLER" 2>/dev/null || true; SAMPLER=""
dc logs --no-log-prefix postgres 2>/dev/null | grep -E "duration: [0-9]+" | cut -c1-400 > "$RESULTS/slow-queries.txt" || true
dc logs app worker reverb 2>/dev/null | grep -i -E "error|exception|critical" | cut -c1-300 | head -200 > "$RESULTS/errors.txt" || true
psql_ -At -c "select 'files en attente (jobs échoués) : ' || count(*) from failed_jobs" > "$RESULTS/failed-jobs.txt" || true
diagnose | tee -a "$RESULTS/diagnostic.txt"
exit 0
