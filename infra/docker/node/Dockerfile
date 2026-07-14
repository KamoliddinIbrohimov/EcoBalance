FROM node:20-alpine

RUN apk add --no-cache libc6-compat bash git python3 make g++ \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate \
    && rm -rf /var/cache/apk/*

WORKDIR /workspace

# NOTE: We intentionally run as root in dev containers so that Windows-mounted
# volumes and named node_modules volumes are writable regardless of host UID.
# Production images (Phase 10) will use a non-root user with matched UID.

EXPOSE 3000 4000
