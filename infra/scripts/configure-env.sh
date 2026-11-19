#!/usr/bin/env bash
# Renseigne dans infra/.env.prod les valeurs qu'aucun script ne peut inventer : e-mail Let's Encrypt, stockage objet (R2) et
# destinataire GPG et bucket distant des sauvegardes. À lancer sur le serveur, une fois, avant infra/scripts/deploy.sh.
#
#   bash infra/scripts/configure-env.sh
#
# - Les secrets (clé d'accès, secret) sont saisis sans écho et jamais affichés, journalisés ni passés en argument de commande.
# - Entrée vide = on garde la valeur actuelle (le script peut donc être relancé pour ne changer qu'un champ).
# - Variable facultative : DEPLOY_ENV_FILE (défaut : infra/.env.prod).
#
# STATUT : écrit, essayé sur une copie de infra/.env.prod.example (test infra/scripts/tests/configure_env_test.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/infra/.env.prod}"
[ -f "$ENV_FILE" ] || { echo "ERREUR: fichier absent : $ENV_FILE" >&2; exit 1; }

current() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r'; }

# Remplace la ligne KEY=... par KEY=valeur. La valeur passe par l'environnement d'awk (pas de séquence d'échappement
# interprétée) ; seul le retour à la ligne est refusé.
set_kv() {
  local key="$1" val="$2" tmp
  case "$val" in *$'\n'*) echo "ERREUR: retour à la ligne interdit dans $key" >&2; return 1 ;; esac
  grep -q "^${key}=" "$ENV_FILE" || { echo "ERREUR: $key absent de $ENV_FILE" >&2; return 1; }
  tmp="$(mktemp)"
  CFG_VALUE="$val" awk -v k="$key" 'index($0, k "=") == 1 { print k "=" ENVIRON["CFG_VALUE"]; next } { print }' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"   # conserve les droits du fichier (600)
  rm -f "$tmp"
}

# ask KEY "question" [secret] [validation] : lit une valeur ; vide = on garde l'actuelle.
ask() {
  local key="$1" label="$2" secret="${3:-}" check="${4:-}" now val
  now="$(current "$key")"
  local hint=""; [ -n "$now" ] && hint=" [déjà renseigné, Entrée pour garder]"
  if [ "$secret" = "secret" ]; then
    read -r -s -p "$label$hint : " val || true; echo
  else
    read -r -p "$label$hint : " val || true
  fi
  [ -n "$val" ] || return 0
  case "$check" in
    https) [[ "$val" == https://* ]] || { echo "ERREUR: $key doit commencer par https://" >&2; return 1; } ;;
    email) [[ "$val" == *@*.* ]] || { echo "ERREUR: $key doit être une adresse e-mail" >&2; return 1; } ;;
  esac
  set_kv "$key" "$val"
}

echo "Fichier : $ENV_FILE"
ask ACME_EMAIL "E-mail de contact Let's Encrypt (avis d'expiration)" "" email
ask MEDIA_ENDPOINT "Stockage objet : endpoint (https://<compte>.r2.cloudflarestorage.com)" "" https
ask MEDIA_BUCKET "Stockage objet : nom du bucket (media-staging)"
ask MEDIA_ACCESS_KEY "Stockage objet : Access Key ID" secret
ask MEDIA_SECRET_KEY "Stockage objet : Secret Access Key" secret
ask BACKUP_GPG_RECIPIENT "Sauvegardes : identité de la clé GPG publique (ex. Ayelo backup <vous@exemple.fr>)"
# Envoi hors serveur des sauvegardes : jeton R2 distinct de celui des médias, limité au seul bucket des sauvegardes.
# BACKUP_BUCKET vide = aucun envoi, la copie reste sur le serveur (infra/scripts/backup.sh).
ask BACKUP_BUCKET "Sauvegardes : nom du bucket distant (backups)"
ask BACKUP_ENDPOINT "Sauvegardes : endpoint (https://<compte>.r2.cloudflarestorage.com)" "" https
ask BACKUP_AWS_ACCESS_KEY_ID "Sauvegardes : Access Key ID (jeton limité au bucket des sauvegardes)" secret
ask BACKUP_AWS_SECRET_ACCESS_KEY "Sauvegardes : Secret Access Key" secret

echo "--- état (jamais les valeurs des secrets) ---"
for key in ACME_EMAIL MEDIA_ENDPOINT MEDIA_BUCKET MEDIA_ACCESS_KEY MEDIA_SECRET_KEY BACKUP_GPG_RECIPIENT \
  BACKUP_BUCKET BACKUP_ENDPOINT BACKUP_AWS_ACCESS_KEY_ID BACKUP_AWS_SECRET_ACCESS_KEY; do
  val="$(current "$key")"
  if [ -z "$val" ]; then echo "VIDE      $key"; else echo "renseigné $key (${#val} caractères)"; fi
done
