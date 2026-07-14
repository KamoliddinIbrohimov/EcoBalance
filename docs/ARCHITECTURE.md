# Eco-Balance — Architecture

> Phase 0 — Foundation. This document reflects the state of the codebase at Phase 0.
> Future phases will add: environmental monitoring (IoT + PostGIS), education,
> AI chatbot, gamification, reports, news/events.

## System diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         User Interface                                 │
│      Next.js 15 (App Router) · TypeScript · TailwindCSS · shadcn/ui    │
└───────────────────────────────┬────────────────────────────────────────┘
                                │  HTTPS (JSON)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Nginx                                       │
│              Reverse proxy · TLS termination · security headers        │
└─────────────┬───────────────────────────────────────────┬──────────────┘
              │                                           │
              │  /api/*                                   │  /*
              ▼                                           ▼
┌───────────────────────────────┐         ┌──────────────────────────────┐
│  NestJS API (port 4000)       │         │  Next.js Web (port 3000)     │
│                               │         │                              │
│  Modules:                     │         │  Routes:                     │
│   • Auth (JWT + refresh)      │◀────────┤   • (auth)  login/register/  │
│   • Users                     │  fetch  │              forgot/reset    │
│   • Prisma (data layer)       │         │   • (dashboard)  shell +     │
│   • Health                    │         │              KPI cards       │
│   • Common: filters, guards,  │         │                              │
│     interceptors              │         │  State:                      │
│                               │         │   • TanStack Query (server)  │
│  Cross-cutting:               │         │   • Zustand (auth, UI)       │
│   • ThrottlerGuard (global)   │         │                              │
│   • JwtAuthGuard (global)     │         │  Providers:                  │
│   • ResponseTransform         │         │   • Query · Theme · Accent · │
│   • GlobalExceptionFilter     │         │     Auth boot · next-intl    │
│     (RFC 7807 Problem+JSON)   │         │                              │
└──────┬──────────────┬────────┘         └──────────────────────────────┘
       │              │
       ▼              ▼
┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │
│      16      │ │      7       │
│              │ │              │
│  • users     │ │  • cache     │
│  • roles     │ │  • sessions  │
│  • perms     │ │  • BullMQ    │
│  • orgs      │ │    queue     │
│  • audit_log │ │              │
│  • notifs    │ └──────────────┘
│  • tokens    │
└──────────────┘        ┌──────────────┐
                        │    MinIO     │
                        │  (S3-compat) │
                        │              │
                        │ ecobalance-  │
                        │  public /    │
                        │  private     │
                        └──────────────┘
```

## Layers (matching the architecture screenshot)

| Screenshot layer            | Where it lives in the codebase                                            |
|-----------------------------|---------------------------------------------------------------------------|
| Data sources (IoT, users)   | `apps/api/src/modules/*` — enters via REST/WebSocket (Phase 4)             |
| Ingest / API Gateway        | `apps/api/src/main.ts` (Nest bootstrap), Nginx (`infra/docker/nginx`)      |
| Storage                     | Prisma → Postgres 16 · MinIO buckets · Redis                              |
| AI & analytics              | `app/Support/Analytics/` reserved (Phase 7)                               |
| Service Layer (business)    | `apps/api/src/modules/*/*.service.ts`                                     |
| User interface              | `apps/web` (Next.js) + Phase 8+ mobile clients                            |
| Auth & authorization        | `apps/api/src/modules/auth` (JWT) · `packages/shared/constants/permissions.ts` |
| Infrastructure              | `infra/docker/*` · `docker-compose.yml`                                    |

## Auth flow

```
   Browser                 Nginx              NestJS API
     │                       │                    │
     │ POST /auth/login       │                    │
     ├──────────────────────►│───────────────────►│
     │                       │                    │ 1. validate (Zod)
     │                       │                    │ 2. verify argon2
     │                       │                    │ 3. issue access JWT (15m)
     │                       │                    │ 4. create refresh row (7d)
     │                       │                    │ 5. Set-Cookie: refresh_token=<opaque>
     │◄──────────────────────┤◄───────────────────┤    (httpOnly, Secure, SameSite=Lax)
     │  { accessToken }      │                    │
     │                       │                    │
     │  (later, 401)         │                    │
     │ Any request           │                    │
     ├──────────────────────►│───────────────────►│  → 401
     │  401                  │                    │
     │                       │                    │
     │ POST /auth/refresh     │                    │
     │  cookie: refresh_token │                    │
     ├──────────────────────►│───────────────────►│  rotate: revoke old, issue new
     │  Set-Cookie (new)     │                    │
     │◄──────────────────────┤◄───────────────────┤  { accessToken }
```

### Reuse detection

Every refresh token belongs to a `familyId`. On rotation, the old row is marked `revoked_at`.
If a client presents an *already-revoked* refresh token, that is a sign of theft — the whole
family is revoked and the user must log in again. This is stored in `refresh_tokens` and
audited in `audit_logs` with action `TOKEN_REVOKED`.

## Role-based theming (matches the architecture screenshot)

Three visual accents map to role groups:

| Role                          | Accent  | Where applied                                    |
|-------------------------------|---------|--------------------------------------------------|
| Citizen · Student · Teacher   | green   | `data-accent="green"` (default)                  |
| Super admin · Admin · City admin | blue | `data-accent="blue"`                             |
| Mahalla manager               | purple  | `data-accent="purple"`                           |

Swap happens in `AccentProvider` — no re-render, just a CSS-variable swap on `<html>`.

## Testing strategy

| Layer               | Tool                          | Runs in                         |
|---------------------|-------------------------------|---------------------------------|
| API unit            | Vitest                        | `apps/api/src/**/*.spec.ts`     |
| API e2e             | Vitest + Supertest            | `apps/api/test/*.e2e.spec.ts`   |
| Web unit            | Vitest + Testing Library      | `apps/web/src/**/*.test.tsx`    |
| Web e2e             | Playwright (Phase 3+)         | `apps/web/e2e/`                 |
| Static              | ESLint, tsc --noEmit, Prisma  | CI                              |

## Configuration

All secrets are read from a single root `.env`. Both apps consume it — no per-app env files
in dev. Prod deploys inject env via Docker Compose or the orchestrator.
