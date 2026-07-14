#!/usr/bin/env bash
# =============================================================================
# Eco-Balance :: One-shot server bootstrap
# -----------------------------------------------------------------------------
# Run once as root on a fresh Ubuntu 22.04/24.04 VPS:
#     ssh root@62.171.187.218 'bash -s' < infra/scripts/setup-server.sh
#
# Optionally pass an SSH public key so CI can log in as the deploy user:
#     ssh root@62.171.187.218 SSH_PUBLIC_KEY="ssh-ed25519 AAAA..." 'bash -s' \
#         < infra/scripts/setup-server.sh
#
# Idempotent — safe to re-run. Non-destructive to other Docker stacks.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
    C_RESET=$'\033[0m'
    C_BLUE=$'\033[1;34m'
    C_YELLOW=$'\033[1;33m'
    C_RED=$'\033[1;31m'
    C_GREEN=$'\033[1;32m'
else
    C_RESET=""; C_BLUE=""; C_YELLOW=""; C_RED=""; C_GREEN=""
fi

log()  { printf '%s▸ %s%s\n' "$C_BLUE"   "$*" "$C_RESET"; }
warn() { printf '%s! %s%s\n' "$C_YELLOW" "$*" "$C_RESET" >&2; }
die()  { printf '%s✗ %s%s\n' "$C_RED"    "$*" "$C_RESET" >&2; exit 1; }
ok()   { printf '%s✓ %s%s\n' "$C_GREEN"  "$*" "$C_RESET"; }

[[ "$(id -u)" -eq 0 ]] || die "This script must be run as root (try: sudo bash $0)"

# -----------------------------------------------------------------------------
# constants
# -----------------------------------------------------------------------------
APP_DIR=/opt/eco-balance
DEPLOY_USER="${DEPLOY_USER:-ecobalance}"
REPO_URL=https://github.com/KamoliddinIbrohimov/EcoBalance.git

log "Eco-Balance server bootstrap starting"
log "  APP_DIR      = $APP_DIR"
log "  DEPLOY_USER  = $DEPLOY_USER"
log "  REPO_URL     = $REPO_URL"

# -----------------------------------------------------------------------------
# 1) Docker + compose plugin
# -----------------------------------------------------------------------------
log "[1/8] Ensuring Docker Engine + Compose plugin are installed"

if ! command -v docker >/dev/null 2>&1; then
    log "docker not found — installing via https://get.docker.com"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
    systemctl enable --now docker
else
    ok "docker already installed ($(docker --version))"
fi

if ! docker compose version >/dev/null 2>&1; then
    die "'docker compose' (v2) not available. Install the plugin:
       apt-get update && apt-get install -y docker-compose-plugin"
else
    ok "docker compose OK ($(docker compose version | head -n1))"
fi

# -----------------------------------------------------------------------------
# 2) Deploy user
# -----------------------------------------------------------------------------
log "[2/8] Ensuring deploy user '$DEPLOY_USER' exists"

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
    ok "created user $DEPLOY_USER"
else
    ok "user $DEPLOY_USER already present"
fi

usermod -aG docker "$DEPLOY_USER"
ok "added $DEPLOY_USER to docker group"

DEPLOY_HOME="/home/$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
AUTHORIZED_KEYS="$DEPLOY_HOME/.ssh/authorized_keys"
touch "$AUTHORIZED_KEYS"
chmod 600 "$AUTHORIZED_KEYS"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTHORIZED_KEYS"

if [[ -n "${SSH_PUBLIC_KEY:-}" ]]; then
    if grep -qxF "$SSH_PUBLIC_KEY" "$AUTHORIZED_KEYS"; then
        ok "SSH public key already present in $AUTHORIZED_KEYS"
    else
        printf '%s\n' "$SSH_PUBLIC_KEY" >> "$AUTHORIZED_KEYS"
        ok "SSH public key appended to $AUTHORIZED_KEYS"
    fi
else
    warn "SSH_PUBLIC_KEY env var not set."
    warn "Add a public key manually to $AUTHORIZED_KEYS before GitHub Actions can SSH in:"
    warn "    echo 'ssh-ed25519 AAAA...' >> $AUTHORIZED_KEYS"
fi

# -----------------------------------------------------------------------------
# 3) UFW firewall (best-effort — never lock the user out)
# -----------------------------------------------------------------------------
log "[3/8] Configuring UFW firewall (if already installed)"

if command -v ufw >/dev/null 2>&1; then
    ufw allow OpenSSH >/dev/null 2>&1 || warn "could not allow OpenSSH profile"
    ufw allow 22/tcp   >/dev/null 2>&1 || true
    ufw allow 8890/tcp >/dev/null 2>&1 || true

    if [[ "${NGINX_HTTP_PORT:-8890}" == "80" ]]; then
        ufw allow 80/tcp >/dev/null 2>&1 || true
    fi
    if [[ "${NGINX_HTTP_PORT:-8890}" == "443" ]]; then
        ufw allow 443/tcp >/dev/null 2>&1 || true
    fi

    UFW_STATUS=$(ufw status | head -n1 || true)
    if [[ "$UFW_STATUS" == *"inactive"* ]]; then
        warn "UFW is inactive — not enabling automatically (to avoid locking you out)."
        warn "If you want it on, run manually:  ufw enable"
    else
        ok "UFW rules updated (currently: $UFW_STATUS)"
    fi
else
    warn "ufw not installed — skipping firewall configuration."
    warn "Install manually if you want a host firewall:  apt-get install -y ufw"
fi

# -----------------------------------------------------------------------------
# 4) App directory + repo checkout
# -----------------------------------------------------------------------------
log "[4/8] Preparing $APP_DIR"

mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# Ensure rsync is available (used to overlay a fresh clone onto a possibly
# non-empty $APP_DIR without touching /home or other stacks).
if ! command -v rsync >/dev/null 2>&1; then
    log "installing rsync"
    apt-get update -qq && apt-get install -y -qq rsync
fi

# Nuke leftovers from any previous failed run so we start from a known state.
find /tmp -maxdepth 1 -name 'eco-balance-clone-*' -type d -exec rm -rf {} + 2>/dev/null || true
find /tmp -maxdepth 1 -name 'tmp.*' -type d -uid 0 -mmin +5 -exec rm -rf {} + 2>/dev/null || true

if [[ -d "$APP_DIR/.git" ]]; then
    log "existing git repo detected — fetching latest main"
    sudo -u "$DEPLOY_USER" git -C "$APP_DIR" fetch --quiet origin
    sudo -u "$DEPLOY_USER" git -C "$APP_DIR" reset --hard origin/main
    ok "repo synced to origin/main"
else
    # If the repo is private, caller can pass GITHUB_TOKEN (fine-grained PAT
    # with `Contents: Read` scope) via env. If unset, we clone anonymously —
    # which only works if the repo is public.
    if [[ -n "${GITHUB_TOKEN:-}" ]]; then
        CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/KamoliddinIbrohimov/EcoBalance.git"
        log "cloning private repo with token into $APP_DIR (via staging dir)"
    else
        CLONE_URL="$REPO_URL"
        log "cloning $REPO_URL into $APP_DIR (via staging dir)"
    fi

    STAGING="/tmp/eco-balance-clone-$$-$RANDOM"
    rm -rf "$STAGING"

    if ! sudo -u "$DEPLOY_USER" git clone --quiet "$CLONE_URL" "$STAGING" 2>/dev/null; then
        rm -rf "$STAGING"
        echo
        echo '✗ Repository clone failed.'
        echo '  The repo is private and no GITHUB_TOKEN was supplied. Either:'
        echo '    a) Make the repo public'
        echo '       https://github.com/KamoliddinIbrohimov/EcoBalance/settings → Change visibility'
        echo '    b) Re-run this script with a PAT:'
        echo "       ssh root@62.171.187.218 'GITHUB_TOKEN=ghp_xxx bash -s' < infra/scripts/setup-server.sh"
        echo '       PAT: https://github.com/settings/tokens (fine-grained, Contents:Read for this repo)'
        exit 1
    fi

    # rsync copies contents (including dotfiles like .git) into $APP_DIR
    # without needing $APP_DIR to be empty.
    rsync -a "$STAGING/" "$APP_DIR/"
    rm -rf "$STAGING"

    # Scrub any token from the remote URL so it isn't stored on disk.
    if [[ -n "${GITHUB_TOKEN:-}" ]]; then
        sudo -u "$DEPLOY_USER" git -C "$APP_DIR" remote set-url origin "$REPO_URL"
    fi

    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
    ok "repository cloned"
fi

# The compose file lives under infra/ in the repo — the deploy contract expects
# it at $APP_DIR root. Symlink so both `bash scripts/deploy.sh` and
# `docker compose -f docker-compose.prod.yml` work from $APP_DIR.
if [[ -f "$APP_DIR/infra/docker-compose.prod.yml" ]] && [[ ! -e "$APP_DIR/docker-compose.prod.yml" ]]; then
    sudo -u "$DEPLOY_USER" ln -s infra/docker-compose.prod.yml "$APP_DIR/docker-compose.prod.yml"
    ok "linked docker-compose.prod.yml -> infra/docker-compose.prod.yml"
fi
if [[ -f "$APP_DIR/infra/Caddyfile" ]] && [[ ! -e "$APP_DIR/Caddyfile" ]]; then
    sudo -u "$DEPLOY_USER" ln -s infra/Caddyfile "$APP_DIR/Caddyfile"
    ok "linked Caddyfile -> infra/Caddyfile"
fi
if [[ -f "$APP_DIR/infra/scripts/deploy.sh" ]] && [[ ! -e "$APP_DIR/scripts/deploy.sh" ]]; then
    sudo -u "$DEPLOY_USER" ln -s ../infra/scripts/deploy.sh "$APP_DIR/scripts/deploy.sh"
    ok "linked scripts/deploy.sh -> infra/scripts/deploy.sh"
fi

# -----------------------------------------------------------------------------
# 5) Swapfile (2 GiB) — helps small VPS instances
# -----------------------------------------------------------------------------
log "[5/8] Ensuring 2 GiB swapfile"

if [[ -f /swapfile ]]; then
    ok "/swapfile already exists — skipping"
else
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    if ! grep -qE '^/swapfile\s+none\s+swap' /etc/fstab; then
        printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
    fi
    ok "swapfile created and activated"
fi

# -----------------------------------------------------------------------------
# 6) .env from example (with generated secrets)
# -----------------------------------------------------------------------------
log "[6/8] Preparing $APP_DIR/.env"

ENV_FILE="$APP_DIR/.env"
ENV_EXAMPLE="$APP_DIR/infra/.env.production.example"

gen_pw()     { openssl rand -base64 24 | tr -d '/=+\n' | cut -c1-24; }
gen_secret() { openssl rand -base64 48 | tr -d '\n'; }

if [[ ! -f "$ENV_FILE" ]]; then
    [[ -f "$ENV_EXAMPLE" ]] || die "Missing $ENV_EXAMPLE — did the git clone succeed?"

    cp "$ENV_EXAMPLE" "$ENV_FILE"

    POSTGRES_PW=$(gen_pw)
    REDIS_PW=$(gen_pw)
    MINIO_PW=$(gen_pw)
    JWT_ACCESS=$(gen_secret)
    JWT_REFRESH=$(gen_secret)

    # awk-based substitution keeps this working for any CHANGE_ME_* placeholder value.
    # We only replace the RHS of lines whose value starts with CHANGE_ME_.
    tmp=$(mktemp)
    awk -v pgpw="$POSTGRES_PW" \
        -v rdpw="$REDIS_PW" \
        -v mnpw="$MINIO_PW" \
        -v jwta="$JWT_ACCESS" \
        -v jwtr="$JWT_REFRESH" '
        BEGIN { FS="="; OFS="=" }
        /^POSTGRES_PASSWORD=CHANGE_ME/     { print $1, pgpw; next }
        /^REDIS_PASSWORD=CHANGE_ME/        { print $1, rdpw; next }
        /^MINIO_ROOT_PASSWORD=CHANGE_ME/   { print $1, mnpw; next }
        /^JWT_ACCESS_SECRET=CHANGE_ME/     { print $1, jwta; next }
        /^JWT_REFRESH_SECRET=CHANGE_ME/    { print $1, jwtr; next }
        { print }
    ' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"

    # Rewrite DATABASE_URL so the embedded password matches POSTGRES_PASSWORD.
    # Format: postgresql://<user>:<pw>@postgres:5432/<db>?schema=public
    sed -i -E "s|^(DATABASE_URL=postgresql://[^:]+:)[^@]+(@.*)$|\1${POSTGRES_PW}\2|" "$ENV_FILE"

    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    ok ".env generated with fresh secrets (chmod 600, owned by $DEPLOY_USER)"
else
    ok "using existing .env at $ENV_FILE"
fi

# -----------------------------------------------------------------------------
# 7) Bootstrap deploy hint
# -----------------------------------------------------------------------------
log "[7/8] First-deploy hint"
cat <<HINT
    To do the very first deploy manually (without waiting for GitHub Actions):

        sudo -u $DEPLOY_USER bash $APP_DIR/scripts/deploy.sh latest

    Or trigger the "Deploy" workflow from the GitHub Actions tab once
    the DEPLOY_ENABLED repo variable is set to "true".
HINT

# -----------------------------------------------------------------------------
# 8) Summary
# -----------------------------------------------------------------------------
log "[8/8] Summary"
LAST_KEY=$(tail -n1 "$AUTHORIZED_KEYS" 2>/dev/null || echo "(none)")

cat <<SUMMARY

────────────────────────────────────────────────────────────────────
  Eco-Balance server is ready.
────────────────────────────────────────────────────────────────────
  Deploy user     : $DEPLOY_USER
  App directory   : $APP_DIR
  Compose file    : $APP_DIR/docker-compose.prod.yml
  Env file        : $APP_DIR/.env  (600, owned by $DEPLOY_USER)
  Host HTTP port  : 8890  ->  http://62.171.187.218:8890

  Last authorized SSH key line for $DEPLOY_USER:
    $LAST_KEY

  GitHub repository secrets to configure
  (Settings → Secrets and variables → Actions → New repository secret):
    HOST      = 62.171.187.218
    USERNAME  = $DEPLOY_USER
    SSH_KEY   = <private key that pairs with the public key above>
    PORT      = 22

  GitHub repository variable to enable auto-deploy:
    DEPLOY_ENABLED = true
────────────────────────────────────────────────────────────────────
SUMMARY

ok "Bootstrap complete."
