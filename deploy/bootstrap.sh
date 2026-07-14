#!/usr/bin/env bash
# ============================================================================
# Eco-Balance — one-shot VPS bootstrap
#
# Run once via:
#   ssh root@62.171.187.218 'bash -s' < deploy/bootstrap.sh
#
# What it does (all idempotent — safe to re-run):
#   1. Installs Docker + Compose plugin if missing
#   2. Clones the repo into ~/eco-balance (skips if already there)
#   3. Generates strong secrets and writes .env from .env.production.example
#   4. Creates a dedicated deploy SSH key pair and prints the private key
#      (paste that into GitHub secret DEPLOY_SSH_KEY)
#   5. Pulls the latest GHCR images
#   6. Starts the stack (nginx on port 8890, everything else internal)
#   7. Waits until /api/v1/health returns 200 and prints a summary
#
# All existing docker containers on the box are left completely alone —
# only host port 8890 is bound, everything else lives on the internal
# `eco` bridge network.
# ============================================================================

set -euo pipefail

REPO_URL="https://github.com/KamoliddinIbrohimov/EcoBalance.git"
REPO_DIR="$HOME/eco-balance"
HOST_PORT="${HOST_PORT:-8890}"
DEPLOY_KEY="$HOME/.ssh/eco_balance_deploy"

log() { printf '\033[1;32m▸\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 1. Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker via official convenience script"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already present: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin is missing — install docker-compose-plugin"
fi

DC_VER=$(docker compose version --short 2>/dev/null || echo "0.0.0")
log "Docker Compose $DC_VER"

# ---------- 2. Repo ----------
if [ -d "$REPO_DIR/.git" ]; then
  log "Repo already cloned — pulling latest"
  git -C "$REPO_DIR" fetch --quiet
  git -C "$REPO_DIR" checkout --quiet main
  git -C "$REPO_DIR" reset --hard origin/main
else
  log "Cloning $REPO_URL"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"

# ---------- 3. .env ----------
if [ ! -f .env ]; then
  log "Generating .env with strong secrets"
  cp .env.production.example .env

  rand_pw() { openssl rand -base64 24 | tr -d '/=+' | cut -c1-24; }
  rand_secret() { openssl rand -base64 48 | tr -d '\n'; }

  POSTGRES_PW=$(rand_pw)
  MINIO_PW=$(rand_pw)
  ADMIN_PW=$(rand_pw)
  JWT_ACCESS=$(rand_secret)
  JWT_REFRESH=$(rand_secret)

  # sed with '|' as delimiter to avoid conflict with base64 '/'
  sed -i "s|CHANGE_ME_STRONG_POSTGRES_PASSWORD|${POSTGRES_PW}|g" .env
  sed -i "s|CHANGE_ME_STRONG_MINIO_PASSWORD|${MINIO_PW}|g" .env
  sed -i "s|CHANGE_ME_STRONG_ADMIN_PASSWORD|${ADMIN_PW}|" .env

  # Two different JWT secrets — replace each occurrence separately
  # Use awk to replace first + second occurrences distinctly
  awk -v acc="$JWT_ACCESS" -v ref="$JWT_REFRESH" '
    /^JWT_ACCESS_SECRET=/  { print "JWT_ACCESS_SECRET="  acc; next }
    /^JWT_REFRESH_SECRET=/ { print "JWT_REFRESH_SECRET=" ref; next }
    { print }
  ' .env > .env.tmp && mv .env.tmp .env

  # Rewrite DATABASE_URL to include the new postgres password
  sed -i "s|:CHANGE_ME_STRONG_POSTGRES_PASSWORD@|:${POSTGRES_PW}@|" .env

  # Public URL should point to this box
  IPV4=$(curl -s -4 ifconfig.me || echo "62.171.187.218")
  sed -i "s|62.171.187.218|${IPV4}|g" .env

  log "  ADMIN password: ${ADMIN_PW}   ← write this down"
  echo
else
  log ".env already present — leaving it alone"
fi

# ---------- 4. Deploy SSH key ----------
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ ! -f "$DEPLOY_KEY" ]; then
  log "Generating deploy SSH key at $DEPLOY_KEY"
  ssh-keygen -t ed25519 -C "eco-balance-github-actions" -f "$DEPLOY_KEY" -N "" >/dev/null

  # Trust the same key for future github-actions logins
  cat "$DEPLOY_KEY.pub" >> "$HOME/.ssh/authorized_keys"
  sort -u "$HOME/.ssh/authorized_keys" -o "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
else
  log "Deploy SSH key already present"
fi

# ---------- 5. Pull + up ----------
log "Pulling GHCR images (may take a minute on first run)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull 2>&1 | tail -10 || {
  warn "Image pull failed. If the packages are private, run once:"
  warn "  echo <GHCR_PAT> | docker login ghcr.io -u <username> --password-stdin"
  warn "  Or make the packages public in GitHub → your profile → Packages."
  warn "Continuing anyway; the compose up will try to build if images can't be pulled."
}

log "Starting the stack (docker compose up -d)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

# ---------- 6. Health check ----------
log "Waiting for /api/v1/health …"
HEALTH_URL="http://localhost:${HOST_PORT}/api/v1/health"
for i in $(seq 1 60); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    log "API is healthy: $(curl -s "$HEALTH_URL")"
    break
  fi
  [ "$i" = 60 ] && warn "API did not become healthy in 4 min — check 'docker compose logs api'"
  sleep 4
done

# ---------- 7. Summary ----------
echo
echo "============================================================"
echo "  Eco-Balance is up on this server."
echo "============================================================"
echo
echo "  Web UI:    http://$(curl -s -4 ifconfig.me 2>/dev/null || echo 62.171.187.218):${HOST_PORT}"
echo "  API:       http://$(curl -s -4 ifconfig.me 2>/dev/null || echo 62.171.187.218):${HOST_PORT}/api/v1/health"
echo "  Swagger:   http://$(curl -s -4 ifconfig.me 2>/dev/null || echo 62.171.187.218):${HOST_PORT}/api/docs"
echo
echo "  Superadmin: admin@eco-balance.uz"
echo "  Password:   $(grep '^SUPER_ADMIN_PASSWORD=' .env | cut -d= -f2)"
echo
echo "  ---- FINISH GITHUB SETUP (one-time) ----"
echo
echo "  1) Copy this SSH private key to GitHub secret DEPLOY_SSH_KEY:"
echo "     Settings → Secrets and variables → Actions → New secret"
echo "     Name:  DEPLOY_SSH_KEY"
echo "     Value: (the block below, including BEGIN/END lines)"
echo
echo "-----BEGIN COPY-PASTE BELOW THIS LINE-----"
cat "$DEPLOY_KEY"
echo "-----END COPY-PASTE ABOVE THIS LINE-----"
echo
echo "  2) Add another GitHub secret:"
echo "     Name:  DEPLOY_HOST"
echo "     Value: 62.171.187.218"
echo
echo "  3) Enable continuous deploy:"
echo "     Settings → Secrets and variables → Actions → Variables → New"
echo "     Name:  DEPLOY_ENABLED"
echo "     Value: true"
echo
echo "  From now on, every push to main auto-deploys here."
echo "============================================================"
