#!/usr/bin/env bash
# Essai de l'image réelle du conteneur `transcode` (vrai ffmpeg), avec les mêmes restrictions que le compose de production :
# aucun réseau, système de fichiers en lecture seule, aucune capacité, utilisateur 82:82. Les fichiers d'entrée sont fabriqués
# dans le conteneur ; les fichiers de vrais téléphones restent à essayer sur le serveur (docs/runbooks/transcode.md).
#
# Usage : bash infra/scripts/tests/transcode_image_test.sh <image>   (code de sortie 0 = tout passe ; Docker nécessaire)
set -euo pipefail

IMAGE="${1:?usage : transcode_image_test.sh <image>}"
NAME="transcode-essai-$$"
AUDIO=11111111-1111-4111-8111-111111111111
VIDEO=22222222-2222-4222-8222-222222222222
BAD=33333333-3333-4333-8333-333333333333

cleanup() { docker rm -f -v "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

box() { docker exec "$NAME" bash -c "$1"; }
running() { [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = true ]; }
fail() {
  echo "ECHEC : $1" >&2
  docker inspect -f 'conteneur : {{.State.Status}}, code de sortie {{.State.ExitCode}}' "$NAME" >&2 || true
  docker logs "$NAME" >&2 || true
  exit 1
}
ok() { echo "ok : $1"; }

# Dépose une demande comme le fait l'application : les octets d'abord, la demande en dernier.
submit() {
  local id="$1" kind="$2" source="$3"
  box "cp ${source} /spool/in/${id}.src && printf '{\"kind\":\"${kind}\"}' > /spool/in/${id}.job"
}

wait_for() {
  local i
  for i in $(seq 1 90); do
    running || return 1
    if box "test -f $1"; then return 0; fi
    sleep 1
  done
  return 1
}

docker run -d --name "$NAME" --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --user 82:82 --pids-limit 128 --memory 768m --cpus 1.5 --tmpfs /tmp:size=64m,mode=1777 "$IMAGE" >/dev/null

box 'test "$(id -u):$(id -g)" = 82:82' || fail "le conteneur ne tourne pas en 82:82"
box 'test -w /spool/in && test -w /spool/out' || fail "/spool/in ou /spool/out non inscriptible"
ok "utilisateur 82:82, dossier partagé inscriptible"
wait_for /tmp/alive || fail "la boucle ne signale pas qu'elle tourne (/tmp/alive, utilisé par le contrôle de santé)"
ok "boucle démarrée"

box 'ffmpeg -nostdin -loglevel error -f lavfi -i sine=frequency=440:duration=3 -c:a aac /tmp/note.m4a' \
  || fail "fabrication de la note vocale d'essai"
box 'ffmpeg -nostdin -loglevel error -f lavfi -i testsrc=duration=3:size=1280x720:rate=25 -f lavfi -i sine=duration=3 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -metadata title=NE-PAS-GARDER -metadata comment=NE-PAS-GARDER /tmp/video.mp4' \
  || fail "fabrication de la vidéo d'essai"
box 'ffprobe -v error -show_entries format_tags -of default=nw=1 /tmp/video.mp4 | grep -q NE-PAS-GARDER' \
  || fail "la vidéo d'essai ne porte pas les métadonnées à effacer"
box 'echo "ceci n est pas une vidéo" > /tmp/faux.bin'

submit "$AUDIO" audio /tmp/note.m4a
submit "$VIDEO" video /tmp/video.mp4
submit "$BAD" video /tmp/faux.bin

wait_for "/spool/out/${AUDIO}.ok" || fail "note vocale non traitée"
box "grep -q '\"mime\":\"audio/mp4\"' /spool/out/${AUDIO}.json" || fail "type de la note vocale"
box "test \"\$(ffprobe -v error -show_entries stream=codec_name -of csv=p=0 /spool/out/${AUDIO}.bin)\" = aac" \
  || fail "la note vocale doit contenir un seul flux AAC"
ok "note vocale réencodée en AAC"

wait_for "/spool/out/${VIDEO}.ok" || fail "vidéo non traitée"
box "grep -q '\"mime\":\"video/mp4\"' /spool/out/${VIDEO}.json" || fail "type de la vidéo"
box "test \"\$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width -of csv=p=0 /spool/out/${VIDEO}.bin)\" = h264,854" \
  || fail "la vidéo doit sortir en H.264, 854 points de large"
box "! ffprobe -v error -show_format -show_streams /spool/out/${VIDEO}.bin | grep -q NE-PAS-GARDER" \
  || fail "des métadonnées de la source ont survécu"
ok "vidéo réencodée en H.264, réduite à 854 points, métadonnées effacées"

wait_for "/spool/out/${BAD}.err" || fail "fichier illisible non refusé"
box "test \"\$(cat /spool/out/${BAD}.err)\" = unreadable && test ! -e /spool/out/${BAD}.ok" || fail "refus mal signalé"
ok "fichier illisible refusé"

box 'test -z "$(ls -A /spool/in)"' || fail "des fichiers restent dans /spool/in"
ok "aucune source conservée"
running || fail "la boucle s'est arrêtée"
ok "boucle toujours en marche après un fichier illisible"
echo "image transcode : tout passe"
