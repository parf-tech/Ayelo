#!/usr/bin/env bash
# Déploiement de production sur le VPS (procédure complète et retour arrière : docs/runbooks/deploiement.md).
#
# STATUT : écrit, JAMAIS EXÉCUTÉ (ni Docker ni Caddy sur le poste de développement). Contrôlé par `bash -n` seulement.
# À essayer en préproduction (docs/14-DEPLOYMENT.md) avant la première mise en production.
#
# Usage, depuis le serveur, dans une copie du dépôt à l'étiquette voulue :
#   infra/scripts/deploy.sh [--first] [--skip-build]
#     --first       premier déploiement : pas de sauvegarde préalable (base vide, service `backup` pas encore lancé)
#     --skip-build  réutilise les images déjà construites (reprise après un échec en aval de la construction)
#
# Variables facultatives : DEPLOY_ENV_FILE (défaut : infra/.env.prod).
#
# Ordre, et pourquoi :
#   1. sauvegarde fraîche : c'est le retour arrière des données (la migration initiale refuse son `down()` en production) ;
#   2. construction des images ;
#   3. PostgreSQL et Redis seuls ;
#   4. `deploy:preflight` : une configuration incomplète arrête le déploiement AVANT toute migration ;
#   5. public/ resynchronisé depuis l'image puis ressources du panneau Filament (en root : public/ lui appartient) ;
#   6. migrations ; le code en service pendant ce temps est l'ancien : toute migration doit rester compatible avec lui
#      (ajouter d'abord, retirer dans un déploiement ultérieur) ;
#   7. relance des conteneurs puis attente de leur santé ;
#   8. caches de configuration, de routes et d'événements du conteneur `app` ;
#   9. contrôle de /api/v1/health par l'adresse publique.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/infra/.env.prod}"
COMPOSE_FILE="$ROOT/infra/docker-compose.prod.yml"
FIRST=0
BUILD=1
STEP="initialisation"

log() { printf '%s deploy: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERREUR: $*" >&2; exit 1; }

on_error() {
  local code="$1"
  log "ECHEC à l'étape « ${STEP} » (code ${code}). Rien n'est annulé automatiquement." >&2
  log "Retour arrière et reprise : docs/runbooks/deploiement.md, section « En cas d'échec »." >&2
  exit "$code"
}
trap 'on_error $?' ERR

for arg in "$@"; do
  case "$arg" in
    --first) FIRST=1 ;;
    --skip-build) BUILD=0 ;;
    *) fail "option inconnue : $arg (voir l'en-tête du script)" ;;
  esac
done

dc() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# Valeur d'une variable de infra/.env.prod, lue sans exécuter le fichier (il contient des clés et des mots de passe).
env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r"'"'"
}

# Attend qu'un service (toutes ses instances) soit « healthy ».
wait_healthy() {
  local service="$1" deadline=$((SECONDS + 180)) id status ids
  while true; do
    ids="$(dc ps -q "$service")"
    [ -n "$ids" ] || fail "le service $service n'est pas démarré"
    status="healthy"
    for id in $ids; do
      if [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")" != "healthy" ]; then
        status="pending"
      fi
    done
    [ "$status" = "healthy" ] && return 0
    [ "$SECONDS" -lt "$deadline" ] || fail "le service $service n'est pas devenu « healthy » en 180 s (docker compose logs $service)"
    sleep 3
  done
}

STEP="contrôle des préconditions"
command -v docker >/dev/null || fail "docker introuvable"
[ -f "$ENV_FILE" ] || fail "fichier d'environnement absent : $ENV_FILE (copier infra/.env.prod.example, droits 600)"
perms="$(stat -c '%a' "$ENV_FILE")"
[ "$perms" = "600" ] || fail "$ENV_FILE doit avoir les droits 600 (actuellement $perms) : il contient des secrets"
log "version déployée : $(git -C "$ROOT" describe --always --dirty 2>/dev/null || echo inconnue)"

if [ "$FIRST" -eq 0 ]; then
  STEP="sauvegarde préalable"
  running="$(dc ps --status running --services)"
  printf '%s
' "$running" | grep -qx backup || fail "le service backup ne tourne pas : pas de sauvegarde, donc pas de retour arrière des données (premier déploiement : --first)"
  dc exec -T backup /scripts/backup.sh
fi

if [ "$BUILD" -eq 1 ]; then
  STEP="construction des images"
  dc build --pull
fi

STEP="démarrage de PostgreSQL et de Redis"
dc up -d --wait postgres redis redis-cache

STEP="contrôle de la configuration (deploy:preflight)"
dc run --rm -T --no-deps app php artisan deploy:preflight

STEP="synchronisation de public/ et des ressources du panneau"
# LOG_CHANNEL=stderr : exécuté en root, un fichier de journal créé ici ne serait plus inscriptible par www-data.
dc run --rm -T --no-deps -u root -e LOG_CHANNEL=stderr app \
  sh -c 'cp -a /var/www/html/.public-dist/. /var/www/html/public/ && php artisan filament:assets'

STEP="migrations"
dc run --rm -T --no-deps app php artisan migrate --force

STEP="relance des conteneurs"
dc up -d --remove-orphans
for service in app reverb scheduler worker worker-push worker-media; do
  wait_healthy "$service"
done

STEP="mise en cache de la configuration"
# filament:optimize : composants et icônes du panneau (sans le cache d'icônes, chaque réponse JSON les rebalayait).
dc exec -T app sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache && php artisan filament:optimize'

STEP="contrôle de santé public"
API_DOMAIN="$(env_value API_DOMAIN)"
[ -n "$API_DOMAIN" ] || fail "API_DOMAIN est vide dans $ENV_FILE"
health=""
for attempt in $(seq 1 12); do
  if health="$(curl --fail --silent --show-error --max-time 10 "https://${API_DOMAIN}/api/v1/health" 2>/dev/null)" && printf '%s' "$health" | grep -q '"status":"ok"'; then
    log "santé publique : $health"
    break
  fi
  [ "$attempt" -lt 12 ] || fail "https://${API_DOMAIN}/api/v1/health ne répond pas « ok » après 12 essais (dernière réponse : ${health:-aucune})"
  sleep 5
done

STEP="terminé"
dc ps
log "Déploiement terminé. Avertissements éventuels : relire la sortie de deploy:preflight ci-dessus."
