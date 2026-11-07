#!/usr/bin/env bash
# Restauration d'une sauvegarde de backup.sh dans une base JETABLE, puis comptages des tables clés
# pour le procès-verbal (docs/runbooks/restauration.md).
#
# STATUT : écrit, JAMAIS EXÉCUTÉ (ni Docker, ni pg_restore, ni shellcheck sur le poste de développement).
#
# Usage : restore.sh <fichier.dump | fichier.dump.gpg> <nom_base_jetable>
# Connexion : variables standard PGHOST, PGPORT, PGUSER, PGPASSWORD (ou, à défaut, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD).
# Garde-fous :
#   - refuse le nom de la base de production (DB_DATABASE, PRODUCTION_DB_NAME, "app", "postgres", "template0/1") ;
#   - refuse un nom qui ne se termine pas par _restore, _scratch ou _test ;
#   - refuse de toucher une base déjà existante (on la crée, on ne l'écrase jamais) ;
#   - si <fichier>.sha256 existe à côté, vérifie la somme avant de restaurer.
# La base n'est pas supprimée à la fin : l'opérateur la contrôle puis la supprime (commande affichée).
set -euo pipefail

log() { printf '%s restore: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERREUR: $*" >&2; exit 1; }

[ "$#" -eq 2 ] || fail "usage : $0 <fichier.dump|fichier.dump.gpg> <nom_base_jetable>"
FILE="$1"
TARGET="$2"

export PGHOST="${PGHOST:-${DB_HOST:-localhost}}"
export PGPORT="${PGPORT:-${DB_PORT:-5432}}"
export PGUSER="${PGUSER:-${DB_USERNAME:-postgres}}"
if [ -z "${PGPASSWORD:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

# Nom de base : lettres minuscules, chiffres, tiret bas ; il sert dans du SQL, donc validé strictement.
case "$TARGET" in
  *[!a-z0-9_]*|'') fail "nom de base invalide '$TARGET' (a-z, 0-9 et _ seulement)" ;;
esac
case "$TARGET" in
  *_restore|*_scratch|*_test) ;;
  *) fail "le nom de la base jetable doit se terminer par _restore, _scratch ou _test (reçu : '$TARGET')" ;;
esac
for protected in "${DB_DATABASE:-}" "${PRODUCTION_DB_NAME:-}" app postgres template0 template1; do
  if [ -n "$protected" ] && [ "$TARGET" = "$protected" ]; then
    fail "refus : '$TARGET' est une base protégée (production ou système)"
  fi
done

for cmd in psql pg_restore createdb sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || fail "commande introuvable : $cmd"
done
[ -f "$FILE" ] || fail "fichier introuvable : $FILE"

if [ -f "${FILE}.sha256" ]; then
  ( cd "$(dirname "$FILE")" && sha256sum --check --status -- "$(basename "${FILE}.sha256")" ) \
    || fail "somme SHA-256 non conforme : fichier corrompu ou altéré"
  log "SHA-256 conforme"
else
  log "AVERTISSEMENT : pas de fichier .sha256 à côté, intégrité non vérifiée"
fi

if psql --dbname=postgres --no-psqlrc -Atc "select 1 from pg_database where datname = '${TARGET}'" | grep -q 1; then
  fail "la base '${TARGET}' existe déjà : choisir un autre nom (ce script ne l'écrase jamais)"
fi

WORK=""
cleanup() { if [ -n "$WORK" ]; then rm -rf -- "$WORK"; fi; return 0; }
trap cleanup EXIT

DUMP="$FILE"
case "$FILE" in
  *.gpg)
    command -v gpg >/dev/null 2>&1 || fail "commande introuvable : gpg"
    WORK="$(mktemp -d)"
    DUMP="${WORK}/restore.dump"
    gpg --batch --yes --decrypt --output "$DUMP" "$FILE" || fail "déchiffrement GPG échoué (clé privée absente ?)"
    ;;
esac

START="$(date +%s)"
log "création de '${TARGET}' sur ${PGHOST}:${PGPORT}"
createdb "$TARGET" || fail "création de la base échouée"

log "pg_restore (arrêt à la première erreur)"
pg_restore --dbname="$TARGET" --no-owner --no-acl --exit-on-error "$DUMP" \
  || fail "pg_restore échoué (base '${TARGET}' laissée en l'état pour examen)"
END="$(date +%s)"
log "restauration terminée en $((END - START)) s"

q() { psql --dbname="$TARGET" --no-psqlrc -Atc "$1"; }

# Comptages pour le procès-verbal : une table absente est signalée, pas ignorée.
echo
echo "| table | lignes |"
echo "| --- | --- |"
for t in users profiles auth_identities devices media matches conversations messages call_sessions \
         subscriptions purchases credit_ledger webhook_events reports sanctions audit_logs data_exports; do
  if [ "$(q "select to_regclass('public.${t}') is not null")" = "t" ]; then
    echo "| ${t} | $(q "select count(*) from public.${t}") |"
  else
    echo "| ${t} | TABLE ABSENTE |"
  fi
done
echo
echo "Nombre de tables (schéma public) : $(q "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")"
if [ "$(q "select to_regclass('public.migrations') is not null")" = "t" ]; then
  echo "Migrations enregistrées : $(q 'select count(*) from public.migrations')"
fi
if [ "$(q "select to_regclass('public.messages') is not null")" = "t" ]; then
  echo "Dernier message : $(q "select coalesce(max(created_at)::text, 'aucun') from public.messages")"
fi
if [ "$(q "select to_regclass('public.purchases') is not null")" = "t" ]; then
  echo "Dernier achat : $(q "select coalesce(max(created_at)::text, 'aucun') from public.purchases")"
fi
echo "Durée de la restauration : $((END - START)) s"
echo
log "à supprimer après contrôle : dropdb -h '${PGHOST}' -p '${PGPORT}' -U '${PGUSER}' '${TARGET}'"
