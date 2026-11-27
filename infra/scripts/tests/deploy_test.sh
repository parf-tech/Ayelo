#!/usr/bin/env bash
# Test de l'ORDRE des étapes de infra/scripts/deploy.sh, avec de faux `docker`, `curl` et `git` placés en tête du PATH :
# aucune commande réelle n'est lancée. Vérifie surtout les garde-fous :
#   - la sauvegarde précède la construction et la migration ;
#   - `deploy:preflight` précède la migration, et son échec arrête le déploiement AVANT toute migration ;
#   - --first saute la sauvegarde ;
#   - un fichier d'environnement lisible par d'autres est refusé.
# Ne dit rien du comportement de Docker, de Compose ou de Caddy.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$HERE/../deploy.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin" "$WORK/infra"
LOG="$WORK/calls.log"
ENV="$WORK/infra/.env.prod"
printf 'API_DOMAIN=api.example.test\nBACKUP_GPG_RECIPIENT=x\n' > "$ENV"

# Faux docker : journalise chaque appel ; échoue si la ligne contient FAIL_ON.
cat > "$WORK/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$STUB_LOG"
if [ -n "${FAIL_ON:-}" ] && [[ "$*" == *"$FAIL_ON"* ]]; then exit 1; fi
case "$*" in
  *"ps --status running --services"*) echo backup ;;
  *"ps -q "*) echo fakeid ;;
  inspect*) echo healthy ;;
esac
exit 0
EOF
cat > "$WORK/bin/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG"
echo '{"status":"ok","db":"ok","redis":"ok","queue":"ok"}'
EOF
cat > "$WORK/bin/git" <<'EOF'
#!/usr/bin/env bash
echo v-test
EOF
# Faux stat : les droits du fichier d'environnement viennent de STUB_PERMS (le test ne dépend pas du système de fichiers).
cat > "$WORK/bin/stat" <<'EOF'
#!/usr/bin/env bash
echo "${STUB_PERMS:-600}"
EOF
chmod +x "$WORK/bin/docker" "$WORK/bin/curl" "$WORK/bin/git" "$WORK/bin/stat"

failures=0
check() { # description, condition (0 = ok)
  if [ "$2" -eq 0 ]; then echo "ok   - $1"; else echo "FAIL - $1"; failures=$((failures + 1)); fi
}
line_of() { grep -n -- "$1" "$LOG" | head -n 1 | cut -d: -f1; }

run_deploy() {
  : > "$LOG"
  set +e
  env PATH="$WORK/bin:$PATH" STUB_LOG="$LOG" STUB_PERMS="${STUB_PERMS:-600}" DEPLOY_ENV_FILE="$ENV" FAIL_ON="${FAIL_ON:-}" bash "$DEPLOY" "$@" > "$WORK/out.txt" 2>&1
  RC=$?
  set -e
}

# 1. Déploiement normal : sauvegarde < construction < preflight < migration < relance.
FAIL_ON="" run_deploy
check "déploiement normal : code 0" "$RC"
b="$(line_of 'backup /scripts/backup.sh')"; c="$(line_of ' build')"; p="$(line_of 'deploy:preflight')"
m="$(line_of 'migrate --force')"; u="$(line_of 'up -d --remove-orphans')"; k="$(line_of 'config:cache')"
check "la sauvegarde précède la construction" "$([ -n "$b" ] && [ -n "$c" ] && [ "$b" -lt "$c" ]; echo $?)"
check "la construction précède deploy:preflight" "$([ -n "$p" ] && [ "$c" -lt "$p" ]; echo $?)"
check "deploy:preflight précède la migration" "$([ -n "$m" ] && [ "$p" -lt "$m" ]; echo $?)"
check "la migration précède la relance des conteneurs" "$([ -n "$u" ] && [ "$m" -lt "$u" ]; echo $?)"
check "la mise en cache suit la relance" "$([ -n "$k" ] && [ "$u" -lt "$k" ]; echo $?)"
# Sans cache d'icônes, chaque réponse JSON rebalayait les dossiers d'icônes du panneau (profil du banc de charge).
check "composants et icônes du panneau mis en cache" "$(grep -q 'exec .* app .*filament:optimize' "$LOG"; echo $?)"
check "le contrôle de santé public est appelé" "$(grep -q 'curl .*https://api.example.test/api/v1/health' "$LOG"; echo $?)"
check "filament:assets est lancé en root" "$(grep -q -- '-u root .*filament:assets' "$LOG"; echo $?)"

# 2. Échec de deploy:preflight : aucune migration, aucune relance.
FAIL_ON="deploy:preflight" run_deploy
check "preflight en échec : code non nul" "$([ "$RC" -ne 0 ]; echo $?)"
check "preflight en échec : aucune migration lancée" "$(! grep -q 'migrate --force' "$LOG"; echo $?)"
check "preflight en échec : aucune relance des conteneurs" "$(! grep -q 'up -d --remove-orphans' "$LOG"; echo $?)"
check "l'étape en échec est nommée" "$(grep -q 'contrôle de la configuration' "$WORK/out.txt"; echo $?)"

# 3. Échec de la sauvegarde : rien n'est construit ni migré.
FAIL_ON="backup.sh" run_deploy
check "sauvegarde en échec : code non nul" "$([ "$RC" -ne 0 ]; echo $?)"
check "sauvegarde en échec : aucune construction" "$(! grep -q ' build' "$LOG"; echo $?)"
check "sauvegarde en échec : aucune migration" "$(! grep -q 'migrate --force' "$LOG"; echo $?)"

# 4. --first : pas de sauvegarde.
FAIL_ON="" run_deploy --first
check "--first : code 0" "$RC"
check "--first : aucune sauvegarde" "$(! grep -q 'backup.sh' "$LOG"; echo $?)"

# 5. Fichier d'environnement lisible par d'autres : refusé avant tout appel à docker.
FAIL_ON="" STUB_PERMS=644 run_deploy
check "droits 644 : refusé" "$([ "$RC" -ne 0 ]; echo $?)"
check "droits 644 : aucun appel à docker" "$(! grep -q '^docker' "$LOG"; echo $?)"

# 6. Option inconnue.
FAIL_ON="" run_deploy --inconnue
check "option inconnue : refusée" "$([ "$RC" -ne 0 ]; echo $?)"

if [ "$failures" -ne 0 ]; then
  echo "$failures vérification(s) en échec"
  exit 1
fi
echo "deploy_test : tout est vert"
