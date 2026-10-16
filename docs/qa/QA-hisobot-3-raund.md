# QA hisobot — 3-raund (to'liq qayta test)

Sana: 2026-10-16. Muhit: http://localhost:8080. Rollar: Super Admin, O'qituvchi, Talaba (API + UI).
Test yozuvlari tozalandi: faqat 4 ta haqiqiy akkaunt faol, QA guruh/kurs/test/topshiriqlar o'chirildi.

## TUZATILGAN (1-hisobotdan)

- O'qituvchi/talaba doirasi (scoping): users, groups, courses, quizzes, assignments, stats — boshqa o'qituvchi ma'lumotlari 403/404.
- Rol eskalatsiyasi yopildi; yagona SUPER_ADMIN serverda majburiy.
- Qoralama kurs talabaga ko'rinmaydi; `mustChangePassword` serverda bloklaydi.
- Muddati o'tgan topshiriq yaratish/topshirish, ball > maxScore, baholangandan keyin qayta topshirish — bloklangan.
- Bildirishnomalar ishlaydi (baho, topshiriq).
- Admin UI: guruh yaratish, a'zolar oynasi, yangi topshiriq, baholash. Talaba UI: LMS bosh sahifa, topshiriq topshirish oynasi, "Natijalarim".
- Sana formati to'g'ri; "Bosh administrator" roli foydalanuvchi oynasidan olib tashlangan; o'qituvchi `/mahalla`, `/recommendations`dan qaytariladi.

## OCHIQ — KRITIK

1. **Darslarda egalik yo'q.** Begona o'qituvchi istalgan kursga dars yarata, tahrirlay va o'chira oladi (`/lessons`). Kurs/test uchun tekshiruv bor, dars uchun yo'q.
2. **Kurs/test guruhga biriktirilmaydi.** `CourseGroup` va `GroupQuiz` jadvallari bor, lekin biriktirish endpointi va UI yo'q. Natija: talaba 0 kurs, 0 test ko'radi; `lessonsTotal=0`, progress doim 0%.
3. **UUID noto'g'ri bo'lsa 500 + Prisma yo'li sizadi** (`/lessons/:id`, `/courses/:id`). 400/404 bo'lishi kerak.

## OCHIQ — YUQORI

4. `PATCH /users/me` 500 qaytaradi.
5. Juda katta so'rov tanasi 500 (413 bo'lishi kerak).
6. Ta'lim darajasi (`educationLevel`) ixtiyoriy qiymatni qabul qiladi (validatsiya yo'q).
7. O'qituvchi talabani istalgan tashkilotga bog'lay oladi.
8. Qoralama kursga dars qo'shilganda talabalarga bildirishnoma ketadi.
9. Faolsiz (o'chirilgan) foydalanuvchilar o'qituvchi/admin tanlov ro'yxatlarida va hisoblagichlarda chiqadi.
10. Talaba bosh sahifasida "Darslarim" bo'sh (2-band sababli), `/learning` talabani `/home`ga qaytaradi.

## OCHIQ — O'RTA / UI

11. `/stats` sahifasi (talaba/admin) faqat "O'z natijalarimga o'tish" havolasi — bo'sh joy ushlagich; admin uchun statistika yo'q.
12. Baholangan topshiriqda "Qayta topshirish" tugmasi faol (server rad etadi) — tugmani o'chirish kerak; ro'yxatda holat nishoni (topshirildi/baholandi) yo'q.
13. `/student` yo'li `/teacher`ga yo'naltirilib "faqat o'qituvchilar uchun" deydi; "Bu bo'lim ishlab chiqilmoqda" ruxsat yo'q holatida ham chiqadi.
14. `/monitoring/tests` matni eski: "super adminga yetkaziladi".
15. O'qituvchida `/learning/manage` sahifasida "Yangi daraja" tugmasi bor (API 403).
16. Admin Foydalanuvchilar sahifasi: eski matn va tashkilot filtri, E2E test tashkilotlari qolgan.
17. Sidebar "Loyiha hududi" paneli statik namuna.
18. Test javob kaliti A tomonga og'ishgan (30 savoldan 26 tasi A).
19. Login limiti qattiq (5 xato → 429, IP bo'yicha).
20. HTTP sarlavhalar takrorlanadi (nosniff ×2, SAMEORIGIN ×2), CSP yo'q.
21. `docs/ARCHITECTURE.md` eskirgan; `/auth/register` yo'q, lekin loginda "Ro'yxatdan o'ting" havolasi bor.

## Tavsiya etilgan tartib

1 → 3 (xavfsizlik + 500lar), keyin 2 (guruhga kurs/test biriktirish: endpoint + o'qituvchi UI), keyin 4–10, qolganlari oxirida.
