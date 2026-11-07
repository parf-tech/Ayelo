#!/usr/bin/env bash
# Essai de la règle de rétention (retention.sh) sur de FAUX fichiers, dans un dossier temporaire.
# Ni pg_dump, ni réseau, ni base : seulement bash, find, date (GNU) et sort.
# Usage : bash infra/scripts/tests/retention_test.sh   (code de sortie 0 = tout passe)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../retention.sh
. "${HERE}/../retention.sh"

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
FAILS=0
ok() { printf 'ok   %s\n' "$1"; }
ko() { printf 'FAIL %s\n' "$1" >&2; FAILS=$((FAILS + 1)); }

mk() { # mk <dossier> <nom> : crée l'archive et sa somme
  : > "$1/$2"; : > "$1/$2.sha256"
}
has() { [ -e "$1/$2" ]; }

# Jour de référence : 2026-07-20 ; 14 jours -> limite quotidienne 2026-07-06 ; 6 mois -> limite mensuelle 2026-01.
TODAY=20260720
D="$TMP/a"; mkdir "$D"
for n in \
  app_20251201T021500Z.dump app_20251215T021500Z.dump \
  app_20260101T021500Z.dump app_20260102T021500Z.dump \
  app_20260201T021500Z.dump app_20260215T021500Z.dump \
  app_20260301T021500Z.dump app_20260401T021500Z.dump app_20260416T021500Z.dump \
  app_20260501T021500Z.dump app_20260601T021500Z.dump app_20260615T021500Z.dump \
  app_20260701T021500Z.dump app_20260705T021500Z.dump app_20260706T021500Z.dump \
  app_20260715T021500Z.dump.gpg app_20260720T021500Z.dump.gpg; do
  mk "$D" "$n"
done
: > "$D/notes.txt"; : > "$D/other_20200101T000000Z.dump"; : > "$D/app_bad.dump"
retention_prune_dir "$D" app "$TODAY" 14 6 >/dev/null

# Gardées : mensuelles (première du mois, mois >= 2026-01) et quotidiennes (>= 2026-07-06)
for n in app_20260101T021500Z.dump app_20260201T021500Z.dump app_20260301T021500Z.dump app_20260401T021500Z.dump \
  app_20260501T021500Z.dump app_20260601T021500Z.dump app_20260701T021500Z.dump app_20260706T021500Z.dump \
  app_20260715T021500Z.dump.gpg app_20260720T021500Z.dump.gpg; do
  if has "$D" "$n" && has "$D" "$n.sha256"; then ok "gardée $n"; else ko "devait être gardée : $n"; fi
done
# Supprimées (avec leur .sha256)
for n in app_20251201T021500Z.dump app_20251215T021500Z.dump app_20260102T021500Z.dump app_20260215T021500Z.dump \
  app_20260416T021500Z.dump app_20260615T021500Z.dump app_20260705T021500Z.dump; do
  if ! has "$D" "$n" && ! has "$D" "$n.sha256"; then ok "supprimée $n"; else ko "devait être supprimée : $n"; fi
done
# Fichiers étrangers jamais touchés
for n in notes.txt other_20200101T000000Z.dump app_bad.dump; do
  if has "$D" "$n"; then ok "intacte $n"; else ko "ne devait pas être touchée : $n"; fi
done

# Mensuelle désactivée (0) : seules les quotidiennes restent
D="$TMP/b"; mkdir "$D"
for n in app_20260101T021500Z.dump app_20260301T021500Z.dump app_20260715T021500Z.dump app_20260718T021500Z.dump app_20260720T021500Z.dump; do mk "$D" "$n"; done
retention_prune_dir "$D" app "$TODAY" 14 0 >/dev/null
if ! has "$D" app_20260101T021500Z.dump && ! has "$D" app_20260301T021500Z.dump && has "$D" app_20260715T021500Z.dump; then
  ok "mensuelle = 0 : seules les quotidiennes restent"; else ko "mensuelle = 0"; fi

# Garde-fou : horloge très en avance (tout semblerait périmé) -> rien n'est supprimé
D="$TMP/c"; mkdir "$D"
for n in app_20260710T021500Z.dump app_20260711T021500Z.dump app_20260712T021500Z.dump app_20260713T021500Z.dump; do mk "$D" "$n"; done
if retention_prune_dir "$D" app 20300101 14 0 >/dev/null 2>&1; then ko "garde-fou : code de sortie attendu non nul"; else ok "garde-fou : refus"; fi
[ "$(find "$D" -name '*.dump' | wc -l)" -eq 4 ] && ok "garde-fou : rien supprimé" || ko "garde-fou : fichiers supprimés"

# Dossier vide : pas d'erreur
D="$TMP/d"; mkdir "$D"
retention_prune_dir "$D" app "$TODAY" 14 6 >/dev/null && ok "dossier vide" || ko "dossier vide"

# Limites de calcul (changement d'année)
[ "$(retention_cutoffs 20260115 14 6)" = "20260101 202507" ] && ok "limites janvier" || ko "limites janvier : $(retention_cutoffs 20260115 14 6)"
[ "$(retention_cutoffs 20260720 14 0)" = "20260706 999999" ] && ok "limites mois=0" || ko "limites mois=0"

# Sélection par liste (cas du bucket) : même règle, entrée standard
doomed="$(printf '%s\n' app_20260102T021500Z.dump app_20260101T021500Z.dump app_20260720T021500Z.dump | retention_select app 20260706 202601)"
[ "$doomed" = "app_20260102T021500Z.dump" ] && ok "sélection bucket (ordre indifférent)" || ko "sélection bucket : '$doomed'"

if [ "$FAILS" -eq 0 ]; then echo "TOUT PASSE"; else echo "$FAILS échec(s)" >&2; exit 1; fi
