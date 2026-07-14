# Eco-Balance Platform

Government-grade ecological monitoring, education and analytics platform for Uzbekistan.

## Stack

- **Backend:** NestJS 11 · TypeScript · Prisma 5 · PostgreSQL 16 · Redis 7 · BullMQ · MinIO (S3)
- **Frontend:** Next.js 15 (App Router) · TypeScript strict · TailwindCSS · shadcn/ui
- **Auth:** JWT (access 15m in-memory, refresh 7d rotating httpOnly cookie, Redis blacklist)
- **RBAC:** CASL abilities + custom Guards
- **Shared:** `packages/shared` — Zod schemas + DTO types used by both apps
- **Monorepo:** pnpm workspaces + Turborepo
- **Infra:** Docker Compose · Nginx reverse proxy · GitHub Actions CI

## Monorepo layout

```
Eco-Balance/
├── apps/
│   ├── api/          # NestJS 11 (TypeScript)
│   └── web/          # Next.js 15 (TypeScript)
├── packages/
│   └── shared/       # Zod schemas, DTOs, constants (imported by both apps)
├── infra/
│   └── docker/       # Dockerfiles + nginx
├── docs/             # ARCHITECTURE.md, DB-SCHEMA.md
├── docker-compose.yml
├── Makefile
├── package.json      # workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Getting started

```bash
cp .env.example .env
make up              # boots Postgres, Redis, MinIO, Mailpit, api, web, nginx
make install         # pnpm install at the root
make migrate         # Prisma migrate + seed
```

Then open:
- Web app:      http://localhost
- API:          http://localhost/api/v1/health
- Swagger UI:   http://localhost/api/docs
- MinIO UI:     http://localhost:9001
- Mailpit:      http://localhost:8025

Default super admin (from Prisma seed):
- email: `admin@eco-balance.uz`
- pass:  `ChangeMe!2026`

## Commands

| Target | What it does |
|---|---|
| `make up` | Boots all containers |
| `make down` | Stops containers |
| `make install` | Runs `pnpm install` at the workspace root |
| `make migrate` | Runs Prisma migrations |
| `make seed` | Runs Prisma seed |
| `make fresh` | Drops DB, remigrates, reseeds |
| `make test` | Runs Vitest across all workspaces |
| `make lint` | ESLint + typecheck for all workspaces |
| `make fmt` | Prettier auto-format |
| `make sh-api` | Shell into the API container |
| `make sh-web` | Shell into the Web container |
| `make logs` | Tail all container logs |

## Delivery phases

| Phase | Scope |
|---|---|
| **0** | **Foundation** — monorepo, Docker, Auth, RBAC, shell (this release) |
| 1 | Users & Organizations CRUD |
| 2 | Notifications (real-time WebSocket + email + audit) |
| 3 | Dashboard content (KPI, charts, map) |
| 4 | Environmental monitoring (IoT ingest + PostGIS) |
| 5 | Education (E-learning, courses, tests, certificates) |
| 6 | Gamification (points, badges, missions) |
| 7 | AI Chatbot + predictive analytics |
| 8 | Reports & exports (PDF/CSV/PNG) |
| 9 | News & Events |
| 10 | Hardening (perf, caching, load test, security audit) |

## License

Proprietary. All rights reserved.
