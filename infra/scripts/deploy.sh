#!/usr/bin/env bash
# =============================================================================
# Eco-Balance :: Deploy runner
# -----------------------------------------------------------------------------
# Called by GitHub Actions (over SSH) and by humans on the server.
#
# Usage:
#     bash scripts/deploy.sh                 # deploys :latest
#     bash scripts/deploy.sh sha-<full-sha>  # deploys a specific tag
#
# Expects to be run from /opt/eco-balance (or via 'bash scripts/deploy.sh' —
# the script cd's to its own parent directory so relative paths always resolve).
# =============================================================================

set -euo pipefail

# Resolve to the app directory (parent of scripts/) regardless of caller.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

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
ok()   { printf '%s✓ %s%s\n' "$C_GREEN"  "$*" "$C_RESET"; }
die()  { printf '%s✗ %s%s\n' "$C_RED"    "$*" "$C_RESET" >&2; exit 1; }

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

[[ -f "$COMPOSE_FILE" ]] || die "Missing $APP_DIR/$COMPOSE_FILE"
[[ -f "$ENV_FILE"     ]] || die "Missing $APP_DIR/$ENV_FILE (did setup-server.sh run?)"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

# -----------------------------------------------------------------------------
# on-failure diagnostics
# -----------------------------------------------------------------------------
dump_logs_on_fail() {
    local ec=$?
    if [[ $ec -ne 0 ]]; then
        warn "deploy failed (exit $ec) — dumping last 40 log lines per app service"
        for svc in api web; do
            printf '\n%s--- %s ---%s\n' "$C_YELLOW" "$svc" "$C_RESET" >&2
            "${COMPOSE[@]}" logs --tail=40 "$svc" 2>&1 || true
        done
    fi
    exit $ec
}
trap dump_logs_on_fail EXIT

# -----------------------------------------------------------------------------
# 1) IMAGE_TAG
# -----------------------------------------------------------------------------
IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"
export IMAGE_TAG
log "deploying tag: $IMAGE_TAG"
log "app dir      : $APP_DIR"

# -----------------------------------------------------------------------------
# 2) Optional GHCR login (only if creds supplied; harmless for public images)
# -----------------------------------------------------------------------------
if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
    log "logging into ghcr.io as $GHCR_USERNAME"
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
    ok "ghcr.io login succeeded"
else
    log "skipping ghcr.io login (GHCR_USERNAME / GHCR_TOKEN not set — assuming public packages)"
fi

# -----------------------------------------------------------------------------
# 3) Pull all images referenced by the compose file
# -----------------------------------------------------------------------------
log "pulling images"
"${COMPOSE[@]}" pull
ok "images up to date"

# -----------------------------------------------------------------------------
# 4) Start / update infra services first (they don't depend on new app images)
# -----------------------------------------------------------------------------
log "starting infra services: caddy, postgres, redis, minio"
"${COMPOSE[@]}" up -d caddy postgres redis minio
ok "infra services running"

# -----------------------------------------------------------------------------
# 5) Wait for postgres to become healthy (up to 60s)
# -----------------------------------------------------------------------------
log "waiting for postgres to report healthy (max 60s)"
HEALTHY=0
for i in $(seq 1 30); do
    # ps output includes the health status when the healthcheck is configured.
    STATUS=$("${COMPOSE[@]}" ps postgres --format '{{.Status}}' 2>/dev/null || true)
    if [[ "$STATUS" == *"(healthy)"* ]]; then
        HEALTHY=1
        break
    fi
    sleep 2
done
if [[ "$HEALTHY" -eq 1 ]]; then
    ok "postgres is healthy"
else
    die "postgres did not become healthy within 60s. Last status: ${STATUS:-<unknown>}"
fi

# -----------------------------------------------------------------------------
# 6) Prisma schema sync
# -----------------------------------------------------------------------------
# Phase 0: no migrations/ directory yet, so db push is the source of truth.
# When migrations/ appears, switch this to `npx prisma migrate deploy`.
log "syncing Prisma schema (prisma db push --accept-data-loss)"
"${COMPOSE[@]}" run --rm api npx prisma db push --accept-data-loss --skip-generate
ok "database schema synced"

# -----------------------------------------------------------------------------
# 7) Roll out the app containers with the new image tag
# -----------------------------------------------------------------------------
log "rolling out web + api at tag $IMAGE_TAG"
"${COMPOSE[@]}" up -d --remove-orphans web api
ok "app containers running the new image"

# -----------------------------------------------------------------------------
# 8) Prune dangling images to reclaim disk
# -----------------------------------------------------------------------------
log "pruning dangling images"
docker image prune -f >/dev/null
ok "prune complete"

# Success — disable the trap so we don't print logs on a clean exit.
trap - EXIT
ok "deploy finished — tag $IMAGE_TAG is live"
