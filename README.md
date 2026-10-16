# PedResearch Lab Platform

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
├── docs/             # ARCHITECTURE.md, DB-SCHEMA.md, materials/ (reference content)
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
make up              # boots Postgres, Redis, MinIO, Mailpit, api, web, caddy
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

## O'zgartirishdan keyin qayta build

Dev stack `nest start --watch` + Next.js Turbopack bilan ishlaydi, lekin
TypeScript turlari o'zgarsa yoki Prisma schema tahrirlansa, konteynerni
qayta ishga tushurish kerak:

```bash
docker restart eco-api              # API hot-reload: src/ dan dist/ ga qayta kompil
docker restart eco-web              # Web Turbopack rebuild
# Prisma schema o'zgarsa:
docker exec -w /workspace/apps/api eco-api sh -c "pnpm exec prisma db push"
docker exec -w /workspace/apps/api eco-api sh -c "pnpm exec prisma generate"
```

Lokal typecheck:

```bash
docker exec -w /workspace/apps/api eco-api sh -c "pnpm exec tsc --noEmit"
docker exec -w /workspace/apps/web eco-web sh -c "pnpm exec tsc --noEmit"
```

## Delivery phases

| Phase | Scope |
|---|---|
| **0** | **Foundation** — monorepo, Docker, Auth, RBAC, shell |
| LMS 3-rol | SUPER_ADMIN/TEACHER/STUDENT, Groups, CourseGroup/GroupQuiz bindings |
| F1 | Lessons egalik, progress + L1-L9 xavfsizlik |
| F2 | Visibility+clone, RETURNED oqimi, transfer, lesson reorder/archive, quiz release settings |
| F3 | Module (bo'limlar) + GroupLessonRelease (dars/mavzu ochilish rejasi) |
| F4 | Assignment turlari (TASK/TIMED/QUESTIONNAIRE) + fayl upload (L14) |
| F5 | Study tracking (heartbeat, timeline, aggregates) |
| F6 | L18 anonymization, pagination unify, README update |

## Reference materials

`docs/materials/ekologiya/` — 15 ta "Ekologiya" fanidan amaliy/laboratoriya mashg'uloti
hujjati (`.docx`), Phase 5 (Education/E-learning) uchun kelajakdagi kurs kontenti manbai
sifatida saqlanmoqda. Hozircha kodga bog'lanmagan — faqat arxiv. Shu papkadagi
`PROMPT.md` — ularni platformaga (Course/Lesson modellari, seed, CRUD, UI) qanday
kiritish kerakligi bo'yicha keyingi AI sessiyasiga to'g'ridan-to'g'ri berish mumkin
bo'lgan tayyor topshiriq matni.

## License

Proprietary. All rights reserved.
