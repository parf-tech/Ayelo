#!/usr/bin/env bash
# Traitement des notes vocales et des vidéos de conversation (conteneur `transcode`, docs/14-DEPLOYMENT.md).
#
# Ce conteneur n'a AUCUN réseau, un système de fichiers en lecture seule, aucune capacité, des plafonds de CPU, de mémoire et
# de processus : il traite des fichiers déposés par des inconnus. Son seul lien avec le reste est le dossier partagé /spool :
#   in/<id>.src  octets reçus (écrits par l'application)        in/<id>.job  demande {"kind":"audio|video"}, créée en dernier
#   in/<id>.run  demande prise en charge (ce script)            out/<id>.bin résultat ; out/<id>.json {"mime","duration_ms"}
#   out/<id>.ok  résultat complet (créé en dernier)             out/<id>.err fichier refusé (le mot « unreadable », rien d'autre)
# L'application (backend/app/Services/Media/SpoolTranscoder.php) applique le même protocole.
#
# Ce que fait le réencodage : un seul flux audio (ou un flux vidéo et un flux audio), aucune métadonnée, aucun chapitre, aucun
# sous-titre, aucune donnée annexe (`-map_metadata -1`, `-map_chapters -1`), aucun protocole réseau (`-protocol_whitelist file`),
# durée plafonnée, sortie en m4a (AAC mono) ou mp4 (H.264 / AAC, 854 pt au plus). La durée et le type du RÉSULTAT sont mesurés ici ;
# l'application les revérifie.
#
# Usage : transcode-loop.sh        (boucle sans fin) ; sourcé par infra/scripts/tests/transcode_test.sh (fonctions seulement).
set -euo pipefail

SPOOL="${SPOOL:-/spool}"
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"
# Plafonds de durée en secondes : un peu au-dessus de ceux de l'application (120 s, 30 s), qui garde le dernier mot.
MAX_SECONDS_AUDIO="${MAX_SECONDS_AUDIO:-125}"
MAX_SECONDS_VIDEO="${MAX_SECONDS_VIDEO:-33}"
# Poids maximal de la source en octets (celui de l'application, avec une marge).
MAX_BYTES_AUDIO="${MAX_BYTES_AUDIO:-6291456}"
MAX_BYTES_VIDEO="${MAX_BYTES_VIDEO:-57671680}"
# Durée maximale d'un traitement, en secondes (ffmpeg est tué au-delà).
JOB_TIMEOUT="${JOB_TIMEOUT:-120}"
# Fichiers orphelins (application arrêtée avant de les récupérer) supprimés après ce nombre de minutes.
ORPHAN_MINUTES="${ORPHAN_MINUTES:-60}"

UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

# Marque un média refusé : un seul mot, jamais d'extrait du fichier ni du message d'erreur de ffmpeg.
transcode_fail() {
  local id="$1"
  rm -f -- "${SPOOL}/out/${id}.bin" "${SPOOL}/out/${id}.bin.tmp" "${SPOOL}/out/${id}.json" "${SPOOL}/out/${id}.json.tmp" "${SPOOL}/out/${id}.ok"
  printf 'unreadable' > "${SPOOL}/out/${id}.err.tmp"
  mv -- "${SPOOL}/out/${id}.err.tmp" "${SPOOL}/out/${id}.err"
  rm -f -- "${SPOOL}/in/${id}.src" "${SPOOL}/in/${id}.run" "${SPOOL}/in/${id}.job"
}

# Durée d'un fichier en secondes (décimal), vide si illisible.
probe_duration() {
  # `|| true` : ffprobe sort en erreur sur un fichier illisible ; sous `set -e`, cela arrêterait toute la boucle.
  timeout 20 "$FFPROBE" -v error -protocol_whitelist file -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1" 2>/dev/null | head -n 1 || true
}

# Nombre de flux d'un type (a ou v) ; 0 si illisible.
probe_streams() {
  local count
  count="$(timeout 20 "$FFPROBE" -v error -protocol_whitelist file -select_streams "$2" -show_entries stream=codec_type -of csv=p=0 "$1" 2>/dev/null | grep -c . || true)"
  printf '%s' "${count:-0}"
}

# vrai si $1 (décimal) est un nombre positif et <= $2
duration_within() {
  awk -v d="$1" -v max="$2" 'BEGIN { if (d ~ /^[0-9]+(\.[0-9]+)?$/ && d + 0 > 0 && d + 0 <= max + 0) exit 0; exit 1 }'
}

# Traite UNE demande. Ne retourne jamais d'erreur : tout échec devient « refusé ».
transcode_job() {
  local id="$1" src job run kind mime max_seconds max_bytes size dur out_dur ms
  src="${SPOOL}/in/${id}.src" job="${SPOOL}/in/${id}.job" run="${SPOOL}/in/${id}.run"

  # Prise en charge atomique : si la demande a déjà été prise (ou retirée), on ne fait rien.
  mv -- "$job" "$run" 2>/dev/null || return 0

  # L'application peut retirer ses fichiers à tout moment (délai dépassé) : une lecture ratée vaut « refusé », jamais un arrêt.
  kind="$(sed -n 's/.*"kind" *: *"\([a-z]*\)".*/\1/p' "$run" 2>/dev/null | head -n 1 || true)"
  case "$kind" in
    audio) mime="audio/mp4"; max_seconds="$MAX_SECONDS_AUDIO"; max_bytes="$MAX_BYTES_AUDIO" ;;
    video) mime="video/mp4"; max_seconds="$MAX_SECONDS_VIDEO"; max_bytes="$MAX_BYTES_VIDEO" ;;
    *) transcode_fail "$id"; return 0 ;;
  esac

  [ -f "$src" ] || { transcode_fail "$id"; return 0; }
  size="$(wc -c < "$src" 2>/dev/null | tr -d ' ' || true)"
  { [ "${size:-0}" -ge 1 ] && [ "$size" -le "$max_bytes" ]; } || { transcode_fail "$id"; return 0; }

  dur="$(probe_duration "$src")"
  duration_within "${dur:-}" "$max_seconds" || { transcode_fail "$id"; return 0; }
  [ "$(probe_streams "$src" a)" -ge 1 ] || { transcode_fail "$id"; return 0; }
  if [ "$kind" = video ] && [ "$(probe_streams "$src" v)" -lt 1 ]; then transcode_fail "$id"; return 0; fi

  local tmp="${SPOOL}/out/${id}.bin.tmp"
  local common=(-nostdin -hide_banner -loglevel error -y -protocol_whitelist file -i "$src" -sn -dn -map_metadata -1 -map_chapters -1 -t "$max_seconds" -movflags +faststart -f mp4)
  if [ "$kind" = audio ]; then
    timeout "$JOB_TIMEOUT" "$FFMPEG" "${common[@]}" -map 0:a:0 -vn -c:a aac -b:a 64k -ac 1 -ar 44100 "$tmp" >/dev/null 2>&1 || { transcode_fail "$id"; return 0; }
  else
    timeout "$JOB_TIMEOUT" "$FFMPEG" "${common[@]}" -map 0:v:0 -map '0:a:0?' \
      -vf 'scale=w=min(iw\,854):h=min(ih\,854):force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p' \
      -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 96k -ac 2 "$tmp" >/dev/null 2>&1 || { transcode_fail "$id"; return 0; }
  fi

  # Le résultat est mesuré ici, pas supposé : un fichier vide ou de durée inattendue est refusé.
  [ -s "$tmp" ] || { transcode_fail "$id"; return 0; }
  out_dur="$(probe_duration "$tmp")"
  duration_within "${out_dur:-}" "$max_seconds" || { transcode_fail "$id"; return 0; }
  ms="$(awk -v d="$out_dur" 'BEGIN { printf "%d", d * 1000 + 0.5 }')"

  mv -- "$tmp" "${SPOOL}/out/${id}.bin"
  printf '{"mime":"%s","duration_ms":%s}' "$mime" "$ms" > "${SPOOL}/out/${id}.json.tmp"
  mv -- "${SPOOL}/out/${id}.json.tmp" "${SPOOL}/out/${id}.json"
  : > "${SPOOL}/out/${id}.ok"
  rm -f -- "$src" "$run"
}

# Une passe : toutes les demandes en attente, dans l'ordre. Un nom qui n'est pas un UUID est supprimé sans être lu.
transcode_pass() {
  local job id
  shopt -s nullglob
  for job in "${SPOOL}"/in/*.job; do
    id="$(basename -- "$job" .job)"
    if [[ ! "$id" =~ $UUID_RE ]]; then
      rm -f -- "$job"
      continue
    fi
    transcode_job "$id"
  done
  shopt -u nullglob
}

# Supprime les fichiers que l'application n'a pas récupérés (arrêtée, rejouée, supprimée).
transcode_sweep() {
  find "${SPOOL}/in" "${SPOOL}/out" -maxdepth 1 -type f -mmin "+${ORPHAN_MINUTES}" -delete 2>/dev/null || true
}

transcode_main() {
  local pass=0
  mkdir -p "${SPOOL}/in" "${SPOOL}/out"
  while true; do
    transcode_pass
    : > /tmp/alive
    pass=$((pass + 1))
    if [ $((pass % 60)) -eq 0 ]; then transcode_sweep; fi
    sleep 2
  done
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  transcode_main
fi
