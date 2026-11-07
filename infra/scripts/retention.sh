#!/usr/bin/env bash
# Rétention des sauvegardes : fonctions pures, sans pg_dump ni réseau, chargées par backup.sh (source) et par
# tests/retention_test.sh. Ce fichier ne s'exécute pas seul.
#
# Règle (identique pour le dossier local et pour le bucket) : une archive `<base>_AAAAMMJJTHHMMSSZ.dump[.gpg]` est
# CONSERVÉE si
#   - sa date est dans les `jours` derniers jours (rétention quotidienne), ou
#   - c'est la première archive de son mois civil ET ce mois est le mois courant ou l'un des `mois` mois précédents
#     (rétention mensuelle ; `mois` = 0 la désactive).
# Sinon elle est supprimée, avec son fichier `.sha256`. Les noms qui ne suivent pas ce format ne sont jamais touchés.
# La date vient du NOM de fichier, pas de la date de modification (une copie ou un `touch` ne rajeunit rien).

# retention_cutoffs <AAAAMMJJ aujourd'hui> <jours> <mois> -> affiche « <AAAAMMJJ limite quotidienne> <AAAAMM limite mensuelle> »
retention_cutoffs() {
  local today="$1" days="$2" months="$3" cutoff_day total cy cm
  cutoff_day="$(date -u -d "${today:0:4}-${today:4:2}-${today:6:2} -${days} days" +%Y%m%d)" || return 1
  if [ "$months" -eq 0 ]; then
    printf '%s %s\n' "$cutoff_day" 999999
    return 0
  fi
  total=$(( 10#${today:0:4} * 12 + 10#${today:4:2} - 1 - months ))
  cy=$(( total / 12 ))
  cm=$(( total % 12 + 1 ))
  printf '%s %04d%02d\n' "$cutoff_day" "$cy" "$cm"
}

# retention_select <base> <AAAAMMJJ limite quotidienne> <AAAAMM limite mensuelle> : lit des noms de fichiers sur l'entrée
# standard (un par ligne) et affiche ceux à SUPPRIMER (archives seulement ; les `.sha256` suivent leur archive).
retention_select() {
  local base="$1" cutoff_day="$2" cutoff_month="$3" name rest day month seen=" " first
  local -a archives=() doomed=()
  while IFS= read -r name; do
    rest="${name#"${base}"_}"
    [ "$rest" != "$name" ] || continue
    [[ $rest =~ ^([0-9]{8})T[0-9]{6}Z\.dump(\.gpg)?$ ]] || continue
    archives+=("$name")
  done < <(LC_ALL=C sort)

  # Ordre du nom = ordre chronologique (même base, horodatage à largeur fixe) : la première vue d'un mois est la plus ancienne.
  for name in "${archives[@]+"${archives[@]}"}"; do
    rest="${name#"${base}"_}"
    day="${rest:0:8}"
    month="${day:0:6}"
    first=0
    if [[ $seen != *" ${month} "* ]]; then seen+="${month} "; first=1; fi
    if [ "$((10#$day))" -ge "$((10#$cutoff_day))" ]; then continue; fi
    if [ "$first" -eq 1 ] && [ "$((10#$month))" -ge "$((10#$cutoff_month))" ]; then continue; fi
    doomed+=("$name")
  done

  # Garde-fou (horloge déréglée) : si la règle supprimerait presque tout alors qu'il y a de quoi garder, on ne supprime rien.
  if [ "${#archives[@]}" -ge 4 ] && [ "$(( ${#archives[@]} - ${#doomed[@]} ))" -lt 2 ]; then
    printf 'retention_select: suppression refusée (%s archives sur %s ; horloge ?)\n' "${#doomed[@]}" "${#archives[@]}" >&2
    return 3
  fi
  [ "${#doomed[@]}" -eq 0 ] || printf '%s\n' "${doomed[@]}"
}

# retention_prune_dir <dossier> <base> <AAAAMMJJ aujourd'hui> <jours> <mois> : applique la règle à un dossier local.
retention_prune_dir() {
  local dir="$1" base="$2" today="$3" days="$4" months="$5" cutoffs cutoff_day cutoff_month name doomed
  cutoffs="$(retention_cutoffs "$today" "$days" "$months")" || return 1
  cutoff_day="${cutoffs% *}"
  cutoff_month="${cutoffs#* }"
  doomed="$(find "$dir" -maxdepth 1 -type f -name "${base}_*" -printf '%f\n' | retention_select "$base" "$cutoff_day" "$cutoff_month")" || return 1
  [ -n "$doomed" ] || return 0
  while IFS= read -r name; do
    rm -f -- "${dir}/${name}" "${dir}/${name}.sha256"
    printf 'supprimé (rétention %s j + %s mois) : %s\n' "$days" "$months" "$name"
  done <<< "$doomed"
}
