# PedResearch Lab — Architecture (3-rol LMS)

> Phase LMS-3-rol (2026-10). Hujjat kod bazasining joriy holatini aks ettiradi.
> Qisqa tarix: dastlab 7-rol ekologik monitoring (Eco-Balance), keyin PedResearch
> Lab brendi va 3-rol LMS modeliga qayta tuzilgan. Infrastruktura paket nomlari
> va DB nomi (`ecobalance`, `@eco/shared`) tarixiy sabablarga ko'ra saqlangan.

## System diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         User Interface                                 │
│      Next.js 15 (App Router) · Turbopack · TypeScript · TailwindCSS   │
└───────────────────────────────┬────────────────────────────────────────┘
                                │  HTTPS (JSON)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Caddy                                      │
│       Reverse proxy · TLS termination · security headers (CSP,         │
│       X-Frame-Options, Referrer-Policy)                                │
└─────────────┬───────────────────────────────────────────┬──────────────┘
              │                                           │
              │  /api/*                                   │  /*
              ▼                                           ▼
┌───────────────────────────────┐         ┌──────────────────────────────┐
│  NestJS API (port 4000)       │         │  Next.js Web (port 3000)     │
│                               │         │                              │
│  Modules:                     │         │  Routes:                     │
│   • Auth (JWT + refresh,      │◀────────┤   • (auth) login/forgot/     │
│      /register YO'Q)          │  fetch  │             reset            │
│   • Users (createdById chain) │         │   • (dashboard) 3-rol home   │
│   • Groups + GroupMember      │         │       /, /teacher, /home     │
│   • CourseGroup / GroupQuiz   │         │   • /change-password         │
│     (talaba kurs/testlari)    │         │                              │
│   • Courses + Lessons         │         │  Guards:                     │
│   • Quizzes (standalone)      │         │   • middleware (cookie)       │
│   • LMS (assignments + stats) │         │   • RouteGate (rol+parol)    │
│   • Chatbot (Anthropic+RAG)   │         │                              │
│   • Materials (MinIO)         │         │  State:                      │
│   • Notifications             │         │   • TanStack Query (server)  │
│                               │         │   • Zustand (auth, UI)       │
│  Cross-cutting:               │         │                              │
│   • ThrottlerGuard (global)   │         │  Providers:                  │
│   • JwtAuthGuard (global)     │         │   • Query · Theme · Accent · │
│   • MustChangePasswordGuard   │         │     Auth boot · next-intl    │
│   • PermissionsGuard (CASL)   │         │                              │
│   • ResponseTransform         │         │                              │
│   • GlobalExceptionFilter     │         │                              │
│     (RFC 7807 Problem+JSON)   │         │                              │
└──────┬──────────────┬────────┘         └──────────────────────────────┘
       │              │
       ▼              ▼
┌──────────────┐ ┌──────────────┐        ┌──────────────┐
│  PostgreSQL  │ │    Redis     │        │    MinIO     │
│      16      │ │      7       │        │  (S3-compat) │
│              │ │              │        │              │
│  LMS data +  │ │  • cache     │        │  • lesson    │
│  3-rol RBAC  │ │  • sessions  │        │    materials │
│  + triggers  │ │  • BullMQ    │        │  • avatars   │
└──────────────┘ └──────────────┘        └──────────────┘
```

## Rol modeli (3-rol LMS)

Faqat uchta rol: `SUPER_ADMIN`, `TEACHER`, `STUDENT`. Hech qanday "fuqaro",
"mahalla manager", "shahar admini" yo'q — eski modullar (`/mahalla`, `/news`,
`/organizations`, `/reports`, `/analytics`, `/events`, `/monitoring`) front-end
middleware'da bloklangan (307 → `/`), DB jadvallari migratsiya uchun saqlanadi.

| Rol          | Ko'rinishi                                                             | Egalik modeli                                       |
|--------------|------------------------------------------------------------------------|-----------------------------------------------------|
| SUPER_ADMIN  | tizim kesishmasi; faqat bitta (`enforce_super_admin_singleton` DB triggeri) | hamma narsani ko'radi va boshqaradi                |
| TEACHER      | o'z guruhlari, kurslari, testlari, topshiriqlari, talabalari           | `User.createdById = teacher.id`, `Group.teacherId`, `Course.ownerId`, `Quiz.ownerId` |
| STUDENT      | `GroupMember` orqali 1 ta guruhda, shu guruhga biriktirilgan kurs/test | `CourseGroup`/`GroupQuiz` yoki eski `lessonId`      |

Ro'yxatdan o'tish endpointi (`/auth/register`) 3-rol modelida olib tashlangan.
Yangi hisobni faqat `SUPER_ADMIN` (yoki o'qituvchi — talaba uchun) yarata oladi.
Yangi hisobga `mustChangePassword=true` qo'yiladi; `MustChangePasswordGuard`
foydalanuvchiga `/auth/me`, `/auth/me/change-password` va `/auth/logout`'dan
boshqa endpointlarga kirishni taqiqlaydi.

## Layers

| Qatlam                      | Qayerda                                                                        |
|-----------------------------|--------------------------------------------------------------------------------|
| User interface              | `apps/web` (Next.js 15 App Router)                                             |
| API Gateway                 | `apps/api/src/main.ts` (Nest bootstrap), Caddy (`infra/Caddyfile`)              |
| Storage                     | Prisma → Postgres 16 · MinIO buckets · Redis                                   |
| Service Layer (business)    | `apps/api/src/modules/*/*.service.ts`                                          |
| Auth & authorization        | `apps/api/src/modules/auth` (JWT) · `packages/shared/constants/permissions.ts` |
| AI (chatbot)                | `apps/api/src/modules/chatbot` — Anthropic SDK + mammoth RAG                    |
| Notifications               | `apps/api/src/modules/notifications` — per-user va broadcast                   |
| Infrastructure              | `infra/*` · `docker-compose.yml`                                               |

## Auth flow

```
   Browser                 Caddy              NestJS API
     │                       │                    │
     │ POST /auth/login       │                    │
     ├──────────────────────►│───────────────────►│
     │                       │                    │ 1. validate (Zod)
     │                       │                    │ 2. verify argon2
     │                       │                    │ 3. issue access JWT (15m)
     │                       │                    │ 4. create refresh row (7d)
     │                       │                    │ 5. Set-Cookie: refresh_token=<opaque>
     │◄──────────────────────┤◄───────────────────┤    (httpOnly, Secure, SameSite=Lax)
     │  { accessToken, user }│                    │
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
     │◄──────────────────────┤◄───────────────────┤  { accessToken, user }
```

### Reuse detection

Har bir refresh token `familyId`'ga tegishli. Rotatsiya paytida eski qator
`revoked_at` bilan belgilanadi. Agar klient *bekor qilingan* refresh token'ni
taqdim etsa — bu o'g'irlik belgisi — butun oila bekor qilinadi va foydalanuvchi
qayta kirishi kerak. `refresh_tokens` jadvalida saqlanadi va `audit_logs`'da
`TOKEN_REVOKED` sifatida auditlanadi.

### Rate limiting

Global throttle `60 req/min` (`RATE_LIMIT_DEFAULT`). Auth endpointlari uchun
`20 req/min` (`RATE_LIMIT_AUTH`), `/forgot-password` uchun soatiga `3 ta`
(`RATE_LIMIT_FORGOT_PASSWORD`).

## Rol asosida tema (accent)

| Rol                | Accent  | Bosh sahifa      |
|--------------------|---------|------------------|
| SUPER_ADMIN        | blue    | `/`              |
| TEACHER            | green   | `/teacher`       |
| STUDENT            | green   | `/home`          |

Almashish `AccentProvider`'da — re-render yo'q, faqat `<html>`'dagi CSS-oʻzgaruvchi.

## Testing strategy

| Qatlam              | Vosita                        | Qayerda                         |
|---------------------|-------------------------------|---------------------------------|
| API unit            | Vitest                        | `apps/api/src/**/*.spec.ts`     |
| API e2e             | Vitest + Supertest            | `apps/api/test/*.e2e.spec.ts`   |
| Web unit            | Vitest + Testing Library      | `apps/web/src/**/*.test.tsx`    |
| Web e2e             | Playwright (Phase 3+)         | `apps/web/e2e/`                 |
| Static              | ESLint, tsc --noEmit, Prisma  | CI                              |

## Configuration

Barcha sirlar bitta ildiz `.env` dan o'qiladi. Ikkala app shuni iste'mol qiladi
— dev'da per-app env fayllari yo'q. Prod'da env Docker Compose yoki orkestr
orqali kiritiladi.

Payload hajmi `1 MB` (NestJS `express.json({ limit: '1mb' })`). Katta so'rov
500 o'rniga `413 Payload Too Large` bilan rad etiladi.
