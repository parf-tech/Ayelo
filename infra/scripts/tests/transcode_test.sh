#!/usr/bin/env bash
# Essai du traitement des notes vocales et vidéos (infra/transcode/transcode-loop.sh) avec de FAUX ffmpeg et ffprobe, dans un
# dossier temporaire. Ni ffmpeg, ni Docker, ni réseau : seulement bash, awk, sed, find (GNU) et timeout.
# Ce que l'essai prouve : le protocole du dossier partagé, les refus (durée, poids, flux, type, nom) et les options de sécurité
# passées à ffmpeg. Ce qu'il ne prouve PAS : le comportement de ffmpeg sur de vrais fichiers (à essayer sur le serveur).
# Usage : bash infra/scripts/tests/transcode_test.sh   (code de sortie 0 = tout passe)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
FAILS=0
ok() { printf 'ok   %s\n' "$1"; }
ko() { printf 'FAIL %s\n' "$1" >&2; FAILS=$((FAILS + 1)); }
check() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }

# --- faux ffprobe : durée de la source (FAKE_DURATION) ou du résultat (FAKE_OUT_DURATION), flux selon FAKE_AUDIO / FAKE_VIDEO
BIN="$TMP/bin"; mkdir -p "$BIN"
cat > "$BIN/ffprobe" <<'EOF'
#!/usr/bin/env bash
last="${@: -1}"
# Comme le vrai : sort en erreur sur un fichier qu'il ne sait pas lire.
if grep -q ILLISIBLE "$last" 2>/dev/null; then exit 1; fi
if printf '%s' "$*" | grep -q 'format=duration'; then
  case "$last" in *.bin.tmp) printf '%s\n' "${FAKE_OUT_DURATION:-12.4}" ;; *) printf '%s\n' "${FAKE_DURATION-12.4}" ;; esac
elif printf '%s' "$*" | grep -q -- '-select_streams a'; then
  for _ in $(seq 1 "${FAKE_AUDIO:-1}"); do echo audio; done
elif printf '%s' "$*" | grep -q -- '-select_streams v'; then
  for _ in $(seq 1 "${FAKE_VIDEO:-1}"); do echo video; done
fi
exit 0
EOF
# --- faux ffmpeg : journalise ses arguments, écrit le fichier de sortie (dernier argument)
cat > "$BIN/ffmpeg" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_LOG"
[ "${FAKE_FFMPEG_FAIL:-0}" = 1 ] && exit 1
last="${@: -1}"
if [ "${FAKE_FFMPEG_EMPTY:-0}" = 1 ]; then : > "$last"; else printf '%s' "${FAKE_FFMPEG_OUTPUT:-RESULT}" > "$last"; fi
exit 0
EOF
chmod +x "$BIN/ffprobe" "$BIN/ffmpeg"

export SPOOL="$TMP/spool" FFMPEG="$BIN/ffmpeg" FFPROBE="$BIN/ffprobe" FAKE_LOG="$TMP/ffmpeg.log"
# shellcheck source=../../transcode/transcode-loop.sh
. "${HERE}/../../transcode/transcode-loop.sh"

fresh() { rm -rf -- "$SPOOL"; mkdir -p "$SPOOL/in" "$SPOOL/out"; : > "$FAKE_LOG"; unset FAKE_DURATION FAKE_OUT_DURATION FAKE_AUDIO FAKE_VIDEO FAKE_FFMPEG_FAIL FAKE_FFMPEG_EMPTY FAKE_FFMPEG_OUTPUT; }
ID1="11111111-1111-4111-8111-111111111111"
ID2="22222222-2222-4222-8222-222222222222"
submit() { # submit <id> <kind> [taille] : dépose la source puis la demande, comme l'application
  head -c "${3:-100}" /dev/zero > "$SPOOL/in/$1.src"
  printf '{"kind":"%s"}' "$2" > "$SPOOL/in/$1.job"
}
refused() { [ -f "$SPOOL/out/$1.err" ] && [ ! -f "$SPOOL/out/$1.ok" ] && [ ! -f "$SPOOL/out/$1.bin" ] && [ "$(cat "$SPOOL/out/$1.err")" = unreadable ] && [ ! -f "$SPOOL/in/$1.src" ] && [ ! -f "$SPOOL/in/$1.run" ]; }
ran() { [ -s "$FAKE_LOG" ]; }

# 1. note vocale correcte
fresh; submit "$ID1" audio
transcode_pass
check "voix : résultat, durée et type écrits, marque « ok » posée" '[ -f "$SPOOL/out/$ID1.ok" ] && [ "$(cat "$SPOOL/out/$ID1.bin")" = RESULT ] && [ "$(cat "$SPOOL/out/$ID1.json")" = "{\"mime\":\"audio/mp4\",\"duration_ms\":12400}" ]'
check "voix : source et demande supprimées" '[ ! -f "$SPOOL/in/$ID1.src" ] && [ ! -f "$SPOOL/in/$ID1.run" ] && [ ! -f "$SPOOL/in/$ID1.job" ]'
check "voix : aucun fichier temporaire laissé" '[ -z "$(ls "$SPOOL/out" | grep "\.tmp$" || true)" ]'
check "voix : ni métadonnées, ni chapitres, ni réseau, ni vidéo, ni sous-titres" 'grep -q -- "-map_metadata -1" "$FAKE_LOG" && grep -q -- "-map_chapters -1" "$FAKE_LOG" && grep -q -- "-protocol_whitelist file" "$FAKE_LOG" && grep -q -- "-vn" "$FAKE_LOG" && grep -q -- "-sn" "$FAKE_LOG" && grep -q -- "-dn" "$FAKE_LOG"'
check "voix : sortie AAC mono, durée plafonnée" 'grep -q -- "-c:a aac" "$FAKE_LOG" && grep -q -- "-ac 1" "$FAKE_LOG" && grep -q -- "-t 125" "$FAKE_LOG"'

# 2. vidéo correcte
fresh; submit "$ID1" video
transcode_pass
check "vidéo : résultat mp4 avec sa durée" '[ -f "$SPOOL/out/$ID1.ok" ] && [ "$(cat "$SPOOL/out/$ID1.json")" = "{\"mime\":\"video/mp4\",\"duration_ms\":12400}" ]'
check "vidéo : H.264, 854 pt au plus, sans métadonnées ni réseau, durée plafonnée" 'grep -q -- "libx264" "$FAKE_LOG" && grep -q -- "min(iw" "$FAKE_LOG" && grep -q -- "854" "$FAKE_LOG" && grep -q -- "-map_metadata -1" "$FAKE_LOG" && grep -q -- "-protocol_whitelist file" "$FAKE_LOG" && grep -q -- "-t 33" "$FAKE_LOG"'

# 3. refus
fresh; submit "$ID1" audio; FAKE_DURATION=300 transcode_pass
check "voix trop longue : refusée sans lancer ffmpeg" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" video; FAKE_DURATION=40 transcode_pass
check "vidéo trop longue : refusée sans lancer ffmpeg" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" audio; FAKE_DURATION="" transcode_pass
check "durée illisible : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" audio; FAKE_DURATION="abc" transcode_pass
check "durée non numérique : refusée" 'refused "$ID1"'

fresh; submit "$ID1" audio 7000000; transcode_pass
check "voix trop lourde (plus de 6 Mio) : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" video 60000000; transcode_pass
check "vidéo trop lourde (plus de 55 Mio) : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" audio 0; transcode_pass
check "source vide : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" audio; FAKE_AUDIO=0 transcode_pass
check "sans flux audio : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" video; FAKE_VIDEO=0 transcode_pass
check "vidéo sans flux vidéo : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" subtitle; transcode_pass
check "type inconnu : refusé sans lancer ffmpeg" 'refused "$ID1" && ! ran'

fresh; printf '{"kind":"audio"}' > "$SPOOL/in/$ID1.job"; transcode_pass
check "source absente : refusée" 'refused "$ID1" && ! ran'

fresh; submit "$ID1" audio; FAKE_FFMPEG_FAIL=1 transcode_pass
check "ffmpeg en échec : refusée, aucun résultat laissé" 'refused "$ID1" && [ ! -f "$SPOOL/out/$ID1.bin.tmp" ]'

fresh; submit "$ID1" audio; FAKE_FFMPEG_EMPTY=1 transcode_pass
check "résultat vide : refusé" 'refused "$ID1"'

fresh; submit "$ID1" audio; FAKE_OUT_DURATION=500 transcode_pass
check "résultat de durée hors limite : refusé" 'refused "$ID1"'

# ffprobe en échec : la passe tourne ici dans un bash à part, avec « set -e » actif comme dans le conteneur. Un fichier
# illisible doit être refusé sans arrêter la boucle ni les demandes suivantes.
pass_alone() { bash -c '. "$1"; transcode_pass' _ "${HERE}/../../transcode/transcode-loop.sh"; }

fresh; submit "$ID1" audio; submit "$ID2" audio; printf 'ILLISIBLE' > "$SPOOL/in/$ID1.src"
status=0; pass_alone || status=$?
check "fichier illisible : la passe ne s'arrête pas" '[ "$status" -eq 0 ]'
check "fichier illisible : refusé sans lancer ffmpeg dessus" 'refused "$ID1" && ! grep -q -- "$ID1" "$FAKE_LOG"'
check "fichier illisible : la demande suivante est traitée" '[ -f "$SPOOL/out/$ID2.ok" ]'

fresh; submit "$ID1" audio
status=0; FAKE_FFMPEG_OUTPUT=ILLISIBLE pass_alone || status=$?
check "résultat illisible : refusé, la passe ne s'arrête pas" '[ "$status" -eq 0 ] && refused "$ID1" && [ ! -f "$SPOOL/out/$ID1.bin.tmp" ]'

# 4. noms et reprise
fresh; head -c 10 /dev/zero > "$SPOOL/in/../evil.src" 2>/dev/null || true
printf '{"kind":"audio"}' > "$SPOOL/in/not-a-uuid.job"; printf '{"kind":"audio"}' > "$SPOOL/in/x y.job"
transcode_pass
check "nom qui n'est pas un UUID : demande supprimée, rien lancé, rien écrit" '[ ! -f "$SPOOL/in/not-a-uuid.job" ] && [ ! -f "$SPOOL/in/x y.job" ] && ! ran && [ -z "$(ls "$SPOOL/out")" ]'

fresh; submit "$ID1" audio; submit "$ID2" video
transcode_pass
check "deux demandes dans la même passe : les deux traitées" '[ -f "$SPOOL/out/$ID1.ok" ] && [ -f "$SPOOL/out/$ID2.ok" ]'

fresh; submit "$ID1" audio; mv "$SPOOL/in/$ID1.job" "$SPOOL/in/$ID1.run"
transcode_pass
check "demande déjà prise en charge (.run) : ignorée" '! ran && [ ! -f "$SPOOL/out/$ID1.ok" ]'

# 5. nettoyage des orphelins
fresh; submit "$ID1" audio; touch -d '3 hours ago' "$SPOOL/in/$ID1.src" "$SPOOL/in/$ID1.job"; : > "$SPOOL/out/$ID2.bin"
ORPHAN_MINUTES=60 transcode_sweep
check "nettoyage : les fichiers de plus d'une heure sont supprimés, les récents gardés" '[ ! -f "$SPOOL/in/$ID1.src" ] && [ ! -f "$SPOOL/in/$ID1.job" ] && [ -f "$SPOOL/out/$ID2.bin" ]'

if [ "$FAILS" -gt 0 ]; then
  printf '\n%d vérification(s) en échec.\n' "$FAILS" >&2
  exit 1
fi
printf '\nToutes les vérifications passent.\n'
