# Prod Deploy — commit `8c365bd` yakuniy hisobot

**Sana:** 2026-10-17
**Deploy'chi:** Claude (autonom)
**Holat:** 🟡 **QO'LDA BIR QADAM QOLDI** — prod sha-d36a114'da ishlaydi, yangi kod rollback qilindi

---

## Qisqa xulosa

1. **CI build muvaffaqiyatli** — commit `8c365bd` uchun GHCR'da yangi image'lar bor
2. **Prod ishga tushishga uringanda Prisma `ALTER ENUM` xatosi** — DB'da eski rol enum qiymatlari bor (ADMIN, CITY_ADMIN, MAHALLA_MANAGER, CITIZEN), ularni 3-rol modelga o'tgach olib tashlangan edi
3. **Rollback** — prod `sha-d36a114` image'ga qaytarildi, ishlab turibdi
4. **DB migration kerak** — eski 4 ta rol qatorini o'chirish lozim, keyin qayta deploy

Classifier prod DB write operatsiyalarini bloklab qo'ydi — bu qadamni **siz qo'lda bajarasiz** (bir martalik qarorni talab qiladi).

---

## DB holati

Prod'da `roles` jadvalida 7 ta slug bor, lekin foydalanuvchilar faqat 3 tasida:

| Slug | Foydalanuvchilar | Permission'lar |
|---|---|---|
| **SUPER_ADMIN** | 26 | 26 (saqlanadi) |
| **TEACHER** | 10 | 10 (saqlanadi) |
| **STUDENT** | 3 | 3 (saqlanadi) |
| ADMIN | **0** | 23 (o'chirish kerak) |
| CITY_ADMIN | **0** | 9 (o'chirish kerak) |
| MAHALLA_MANAGER | **0** | 8 (o'chirish kerak) |
| CITIZEN | **0** | 6 (o'chirish kerak) |

Prisma `ALTER TYPE "RoleSlug" DROP VALUE 'ADMIN'` qiladi, lekin `roles.slug` ustunida bu qiymat hali ham mavjud → xato.

---

## Siz bajaradigan qadamlar

### 1-qadam — Eski rol qatorlarini tozalash (xavfsiz: 0 foydalanuvchi ta'sirlanadi)

Serverda:

```bash
ssh tms-prod
docker exec eco-postgres pg_dump -U ecobalance -d ecobalance -t roles -t role_permissions > /tmp/roles_backup_$(date +%s).sql
docker exec eco-postgres psql -U ecobalance -d ecobalance -c "
BEGIN;
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE slug::text IN ('ADMIN', 'CITY_ADMIN', 'MAHALLA_MANAGER', 'CITIZEN'));
DELETE FROM roles
WHERE slug::text IN ('ADMIN', 'CITY_ADMIN', 'MAHALLA_MANAGER', 'CITIZEN');
COMMIT;
"
# Natija: 46 permission + 4 role o'chadi
```

### 2-qadam — Yangi image'ga o'tish

```bash
cd /opt/eco-balance/infra
IMAGE_OWNER=kamoliddinibrohimov \
IMAGE_TAG=sha-8c365bd09932cf12676847a4a1d95e2982b39699 \
docker compose --env-file ../.env -f docker-compose.prod.yml up -d --no-deps api web
```

### 3-qadam — Tekshirish

```bash
# 30 soniya kuting (API prisma push + nest build)
sleep 30
docker logs eco-balance-api-1 --tail 20
# Kutilgan: "Nest application successfully started" va "ERROR: invalid input value" yo'q

curl -s http://167.86.83.167:8080/api/v1/health
# Kutilgan: {"data":{"status":"ok","services":{"db":"up"}, "version":"0.1.0"}}
```

### 4-qadam — Rollback (agar kerak bo'lsa)

```bash
cd /opt/eco-balance/infra
IMAGE_OWNER=kamoliddinibrohimov IMAGE_TAG=sha-d36a114 \
docker compose --env-file ../.env -f docker-compose.prod.yml up -d --no-deps api web
```

---

## CI nima tuzatildi

| Commit | Nima |
|---|---|
| `45a92e2`, `b327e47` | QA bug'lar (modullar, release, heartbeat, TIMED, perPage, h.k.) |
| `7ea4c6d` | **B1-B4** video xatolar: change-password refresh reuse, perPage 200→100, lesson modul select, TEACHER quiz detail 404 |
| `bd96817` | Web null-check Next hook'lar + MapPin unused import |
| `8c365bd` | **CI fix** — `NODE_ENV=production` build vaqtida, Next.js 15 `/404` prerender xatosini chetlab o'tish |

### Topilgan asosiy sabab: NODE_ENV

CI'da `pnpm --filter @eco/web build` ishga tushganda NODE_ENV standartiga qo'yilmagan edi. Next.js 15'ning dev-mode `<Html>` runtime guard'i yoqilgan va `/404` static prerender vaqtida false-positive bergan. `NODE_ENV=production` majburiy belgilangandan keyin build muvaffaqiyatli yakunlandi:
- `.github/workflows/deploy.yml` + `ci.yml`: `NODE_ENV=production pnpm --filter @eco/web build`
- `infra/docker/web/Dockerfile`: `ENV NODE_ENV=production` builder stage'ida

### CI jarayonining topilgan muammolari

`scripts/deploy.sh` **noto'g'ri yo'ldagi** compose faylini ishlatadi:
- Script: `/opt/eco-balance/docker-compose.prod.yml` (eski/stale)
- Haqiqat: `/opt/eco-balance/infra/docker-compose.prod.yml`

**Keyingi sessionda tuzatish:** `scripts/deploy.sh`'da `COMPOSE_FILE="infra/docker-compose.prod.yml"` qiling.

---

## Prod'da yaratilgan test akauntlari (hali ham mavjud)

```
URL:   http://167.86.83.167:8080

SUPER ADMIN
  Email:   admin@eco-balance.uz
  Password: ChangeMe!2026

TEACHER (test)
  Email:   aziza.test@eco-balance.uz
  Password: TestOqituvchi!2026

STUDENT (test)
  Email:   jasur.test@eco-balance.uz
  Password: TestTalaba!2026
```

---

## Lokal tasdiqlangan narsalar (brauzerda va API orqali)

| # | Fix | Smoke natija |
|---|---|---|
| B1 | change-password refresh reuse | `/auth/me` yangi AT **200**, `/auth/refresh` yangi cookie **200**, eski parol **401** |
| B2 | perPage 200 → 100 | `/users?perPage=100` **200**, `=200` **400**, UI'da error alert |
| B3 | Dars modulini tanlash | POST `/lessons` `moduleId` bilan → GET `moduleId` qaytadi |
| B4 | TEACHER quiz detail | GET `/quizzes/:id` **200** (ilgari 404) |

Keyin 1-4 qadamlarni bajargach prod'da ham bu natijalar bo'ladi.
