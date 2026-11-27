# Comparaison alternée de deux versions du code sur les mêmes données (sourcé par run.sh quand PERF_REFERENCE est donné).
# La version de référence tourne à côté (ayelo-perf-ref-app et son Caddy) ; chaque tour joue chaque route sur les deux,
# dans un ordre qui s'inverse d'un tour à l'autre, pour que les variations de la machine pèsent sur les deux. Le temps
# processeur du conteneur applicatif (cgroup) est relevé en plus des durées : il dépend moins de la charge voisine.
ROUNDS="${PERF_ROUNDS:-5}"; PER_ROUND="${PROFILE_REQUESTS:-80}"
REF_APP=ayelo-perf-ref-app; REF_WEB=ayelo-perf-ref-web

log "version de référence"
docker run -d --name "$REF_APP" --network ayelo-perf_perf --network-alias app-ref --env-file "$PERF_ENV" --cpus "${PERF_APP_CPUS:-2.5}" --memory 2g \
  -v ayelo-perf_app-storage:/var/www/html/storage ayelo-perf-app:reference php-fpm > /dev/null
docker exec "$REF_APP" sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache' >> "$RESULTS/cache.log" 2>&1
printf '{\n\tauto_https off\n}\n\n:80 {\n\troot * /var/www/html/public\n\tphp_fastcgi app-ref:9000\n\tfile_server\n}\n' > "$WORK/Caddyfile.ref"
docker run -d --name "$REF_WEB" --network ayelo-perf_perf --network-alias web-ref -v "$WORK/Caddyfile.ref:/etc/caddy/Caddyfile:ro" \
  -v ayelo-perf_app-public:/var/www/html/public:ro "$(docker inspect "$(dc ps -q web)" --format '{{.Config.Image}}')" > /dev/null
sleep 5

# drive <base> <route> <nombre> : joue la route une requête à la fois, sans profil.
drive() {
  dc run --rm -T --no-deps -u root -v "$WORK:/work:ro" -v "$PWD/profil:/srv/perf/profil:ro" -e PROFIL_BASE="$1" -e PROFIL_ROUTE="$2" -e PROFIL_SANS=1 \
    app php /srv/perf/profil/requetes.php /work/actors.json "$3"
}
cpu_usec() { docker exec "$1" sh -c 'awk "/^usage_usec/ {print \$2}" /sys/fs/cgroup/cpu.stat'; }

: > "$RESULTS/comparaison.tsv"
for route in decouverte conversations fil envoi; do
  drive http://web-ref "$route" 40 > /dev/null
  drive http://web "$route" 40 > /dev/null
done
for round in $(seq 1 "$ROUNDS"); do
  log "tour $round sur $ROUNDS ($PER_ROUND requêtes par route et par version)"
  if [ $((round % 2)) -eq 1 ]; then order="reference present"; else order="present reference"; fi
  for route in decouverte conversations fil envoi; do
    for version in $order; do
      if [ "$version" = reference ]; then base=http://web-ref; container="$REF_APP"; else base=http://web; container="$(dc ps -q app)"; fi
      before="$(cpu_usec "$container")"
      line="$(drive "$base" "$route" "$PER_ROUND" | grep "^$route ")"
      after="$(cpu_usec "$container")"
      # route, version, tour, requêtes réussies, médiane ms, p95 ms, processeur ms par requête (échauffement du pilote compris)
      echo "$line" | awk -v v="$version" -v t="$round" -v cpu="$(( after - before ))" -v total="$((PER_ROUND + 20))" \
        '{printf "%s\t%s\t%s\t%s\t%s\t%s\t%.1f\n", $1, v, t, $2, $3, $4, cpu / total / 1000}' >> "$RESULTS/comparaison.tsv"
    done
  done
done

awk -F'\t' '
  { k = $1 "\t" $2; n[k]++; med[k, n[k]] = $5; p95[k, n[k]] = $6; cpu[k] += $7 }
  function middle(a, k, c,   i, j, t, s) { for (i = 1; i <= c; i++) s[i] = a[k, i] + 0; for (i = 1; i < c; i++) for (j = i + 1; j <= c; j++) if (s[j] < s[i]) { t = s[i]; s[i] = s[j]; s[j] = t } return s[int((c + 1) / 2)] }
  END {
    printf "%-14s %-10s %6s %14s %12s %18s\n", "route", "version", "tours", "médiane ms", "p95 ms", "processeur ms/req"
    split("decouverte conversations fil envoi", routes, " ")
    for (r = 1; r <= 4; r++) for (v = 1; v <= 2; v++) { name = v == 1 ? "reference" : "present"; k = routes[r] "\t" name; if (n[k]) printf "%-14s %-10s %6d %14.1f %12.1f %18.1f\n", routes[r], name, n[k], middle(med, k, n[k]), middle(p95, k, n[k]), cpu[k] / n[k] }
  }' "$RESULTS/comparaison.tsv" | tee "$RESULTS/comparaison.txt"
docker rm -f "$REF_APP" "$REF_WEB" > /dev/null
