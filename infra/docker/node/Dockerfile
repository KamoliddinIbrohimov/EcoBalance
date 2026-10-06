FROM node:20-alpine

RUN apk add --no-cache libc6-compat bash git python3 make g++ icu-data-full \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate \
    && rm -rf /var/cache/apk/*

# Alpine's Node build ships with "small-icu" (English-only locale data), which
# made next-intl render Uzbek dates differently on the server (SSR) than in
# the browser (full ICU) -> React hydration mismatch on the home page date.
# icu-data-full + NODE_ICU_DATA gives Node the complete ICU dataset so
# Intl.DateTimeFormat('uz', ...) matches between server and client.
ENV NODE_ICU_DATA=/usr/share/icu

WORKDIR /workspace

# NOTE: We intentionally run as root in dev containers so that Windows-mounted
# volumes and named node_modules volumes are writable regardless of host UID.
# Production images (Phase 10) will use a non-root user with matched UID.

EXPOSE 3000 4000
