# Multi-stage production build for the Eco-Balance NestJS API.
# Emits a small runtime image; ~200 MB compared to ~1.5 GB workspace.

# ---------- deps ---------- (installs prod+dev deps for the full workspace)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ openssl \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ---------- builder ---------- (compiles shared → dist, prisma client, nest build)
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @eco/shared build \
 && pnpm --filter @eco/api exec prisma generate \
 && pnpm --filter @eco/api build

# ---------- runner ---------- (small, no source, no dev deps)
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl tini \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=4000

# Root workspace files needed for module resolution
COPY --from=builder /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=builder /workspace/node_modules ./node_modules

# Shared package (compiled JS + its own node_modules — pnpm keeps zod symlinks
# in packages/shared/node_modules so the compiled dist/*.js files can require them)
COPY --from=builder /workspace/packages/shared/package.json ./packages/shared/
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workspace/packages/shared/node_modules ./packages/shared/node_modules

# API app
COPY --from=builder /workspace/apps/api/package.json ./apps/api/
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=builder /workspace/apps/api/node_modules ./apps/api/node_modules

WORKDIR /workspace/apps/api

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
# Runs prisma db push + start on first boot (safe idempotent); switches to migrate deploy once
# the prisma/migrations/ folder is populated (Phase 1+).
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/main.js"]
