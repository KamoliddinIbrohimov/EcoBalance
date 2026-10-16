# PROMPT 2: LMS mantiqiy QA (4-raund) natijalari bo'yicha tuzatishlar

Rol: sen PedResearch Lab (Eco-Balance) monorepo'sida ishlaydigan senior full-stack muhandissan (Next.js 15 + NestJS 11 + Prisma). UI va xabarlar o'zbekcha, zod sxemalar `packages/shared`da. Avval `docs/PROMPT-mantiq-tuzatish.md`, `docs/QA-hisobot-3-raund.md`ni va `apps/api/test/lms-logic.e2e.spec.ts`ni o'qi.

Bu raundda F0–F6 (kontent ko'rinishi, mavzu ochilishi, 3 xil topshiriq, fayl, test sozlamalari, o'qish rejimi) jonli API va UI orqali sinaldi (3 rol, 2 o'qituvchi, 3 talaba, 3 guruh). Quyida faqat QA topgan nosozliklar. Belgilar: [J] jonli tasdiqlangan, [K] kod o'qishda aniqlangan.

Ish tartibi: har bir band uchun avval e2e test yoz (nosozlikni takrorlasin), keyin tuzat. Har blokdan so'ng `docker compose up -d --build api web` va smoke test. Web konteyneri ham qayta build qilinishi shart (U1).

---

## A. KRITIK: egalik va kirish huquqi

**N1. Materiallarda egalik yo'q [J].** `POST /courses/:id/materials` — begona o'qituvchi istalgan kursga fayl yukladi (201) va u kursni ochgan talabalarga ko'rindi; `DELETE /materials/:id` — begona o'qituvchi o'chirdi (200); `GET /courses/:id/materials` va `/materials/:id/download` — boshqa guruh talabasi uchun 200. Tuzat: yuklash/o'chirish faqat kurs egasi yoki SA; talaba faqat o'z guruhidagi, nashr etilgan va ochilgan (release) dars/kurs materialini ko'radi; qulflangan dars materiali yopiq. `materials.service` actor roli va `ownerId`ni olsin.

**N2. Test savollarida egalik yo'q [J].** Begona o'qituvchi: `GET /quizzes/:id` (to'g'ri javoblar bilan) 200; `POST /quizzes/:id/questions` 201; `DELETE /quizzes/questions/:id` 204; `PATCH /quizzes/questions/:id` 404 (ruxsat emas, topilmadi deb qaytadi). Tuzat: barcha savol endpoint'lari (qo'shish, tahrir, o'chirish, tartiblash) va admin detail faqat test egasi / SA / LIBRARY testni faqat o'qish (javob kaliti bilan emas). Test o'chirilganda yoki savol o'zgarganda mavjud topshirishlar natijasi buzilmasin (savol o'chirishda submission bor bo'lsa ogohlantirish yoki soft-delete).

**N3. O'qituvchi begona PRIVATE kontentni ko'radi [J].** `GET /courses`, `GET /quizzes` boshqa o'qituvchining PRIVATE kurs/testlarini ro'yxatda qaytaradi; `GET /lessons/:id` va `/courses/:id/lessons` begona kurs nazariyasini beradi; `GET /lessons/:id/removal-impact` va `GET /assignments/:id/attachment-url` begona o'qituvchi uchun 200. Tuzat: o'qituvchi ro'yxati = o'z kontenti + `LIBRARY`; begona PRIVATE uchun 404; removal-impact va attachment-url egalik tekshirsin.

**N4. Qulflangan dars matni oshkor [J].** `GET /lessons/:id` 404 beradi, lekin `GET /courses/:id/lessons` va `GET /lessons?courseId=` qulflangan (LOCKED/SCHEDULED) va modul-release yopiq darslarning `theoryUz`, `procedureUz` maydonlarini ham qaytaradi. Heartbeat va progress ham qulflangan darsga yoziladi (200). Tuzat: ro'yxatda talaba uchun yopiq darslar faqat `{id, titleUz, orderIndex, locked:true, opensAt}` ko'rinishida (mazmunsiz) qaytsin; heartbeat/progress yopiq darsga 404.

**N5. Kutubxona mantig'i yarim [J].** 4 ta asosiy (seed) kurs `PRIVATE` va `ownerId=null`: o'qituvchilar ularni ro'yxatda ko'radi, lekin guruhga biriktirolmaydi (403) va tahrir qilolmaydi. Tuzat: seed kurs/test `LIBRARY` bo'lsin (migratsiya + seed); o'qituvchi LIBRARY'ni biriktira oladi va `clone` qila oladi (clone ishlaydi [J]); kurs formasida `visibility` tanlovi (SA uchun) va "Nusxa olish" tugmasi (U4).

## B. YUQORI: biznes mantiq

**N6. TIMED: cheksiz urinish va aylanib o'tish [J].** (a) Urinish vaqti tugagach `POST /assignments/:id/start` qayta chaqirilsa yangi taymer beradi (`attempt` o'zgarmaydi, eski javob matni qoladi va ustiga yoziladi) = muddat oynasi ichida cheksiz urinish. Qoida: bitta urinish; boshlangandan keyin `attemptDeadline` o'tgan bo'lsa `start` 409; qayta urinish faqat o'qituvchi `reopen`/accommodation orqali. (b) `POST /assignments/:id/submissions/file` TIMED tekshiruvlarini (start, deadline, endsAt) o'tkazmaydi: start'siz fayl yuklash 201. Fayl yuklash ham matnli topshirish bilan bitta servis metodidan o'tsin. (c) Boshlangach UI tugmasi "Yangilash" deb chiqadi (matn "Topshirish").

**N7. QUESTIONNAIRE amalda ishlamaydi [J].** `quizId` majburiy emas (`null` bilan 201); talaba oynasida savollar yo'q, oddiy matn maydoni chiqadi; `PENDING_REVIEW` hech qachon qo'yilmaydi, ochiq javob (`manualScore`) yo'q; o'qituvchi formasida test tanlovi yo'q. Tuzat: QUESTIONNAIRE uchun `quizId` majburiy va o'qituvchining o'z/LIBRARY testi bo'lsin; talaba assignment ichida savollarni yechadi (mavjud `take/submit` dvigateli, `GroupQuiz` bilan takrorlanmaydigan bitta servis); natija avtomatik `scorePercent → score`ga o'tadi; ochiq javob savollari bo'lsa status `PENDING_REVIEW`, o'qituvchi qo'lda baholagach yakuniy ball = avto + qo'lda; `maxAttempts`, `shuffle`, `showCorrectAnswers` sozlamalari.

**N8. Kechikish jarimasi qo'llanmaydi [J].** `allowLate=true, latePenaltyPercent=20`, kechikkan javobga 100 ball qo'yildi, natija 100 (jarimasiz). Tuzat: baholashda `isLate` bo'lsa yakuniy ball = `score * (1 - penalty/100)` (xom ball va jarima alohida saqlansin: `rawScore`, `penaltyApplied`), talaba va o'qituvchi UI'da ko'rsatilsin.

**N9. Accommodation (alohida muddat) nuqsonlari [J].** (a) TASK uchun `newDueAt` e'tiborsiz: uzaytirilgan talaba muddatdan keyin "Topshiriq muddati o'tdi" oladi; TIMED uchun `endsAt` ham `newDueAt`ni hisobga olmaydi. (b) Begona guruh talabasiga accommodation berish 200. (c) Bo'sh tana va manfiy `extraMinutes` 200. Tuzat: `submit`, `file`, `start` barchasi bitta `effectiveDeadline(assignment, student)` funksiyasidan foydalansin; talaba shu topshiriq guruhida bo'lishi shart; `extraMinutes >= 1` yoki `newDueAt` talab qilinsin (zod DTO).

**N10. Test biriktirmasi (GroupQuiz) sozlamalari [J].**
- `POST/PATCH /groups/:id/quizzes/:quizId` tanasi zod bilan tekshirilmaydi (`bindQuizSettingsSchema` ishlatilmagan). `PATCH` yuborilmagan maydonlarni `null` qiladi: `{maxAttempts:9}` yuborilganda `closesAt` o'chdi va yopilgan test yana ochildi. `maxAttempts:0` saqlanadi (cheksiz bo'lib qoladi), `closesAt < opensAt` qabul qilinadi, `opensAt:"garbage"` 500 beradi.
- `GET /groups/:id/quizzes` sozlamalarni (`opensAt, closesAt, maxAttempts, timeLimitMinutes`) qaytarmaydi.
- `timeLimitMinutes` saqlanadi, lekin hech qayerda majburlanmaydi: `GET /my-quizzes/:id/take` uni `null` qaytaradi, submit vaqtni tekshirmaydi. Tuzat: `take` chaqirilganda server `QuizSubmission(IN_PROGRESS, startedAt, deadline)` yozsin, submit `deadline`dan keyin rad etsin (TIMED bilan bir mexanizm).
- `take` test ochilishidan oldin va yopilgandan keyin ham savollarni beradi (200); window tashqarisida 403.
- Nofaol guruhda talaba testni ochadi (200) va topshiradi (201). L9 testlarni ham qamrasin.
- Talaba test kartasida yopilgan testda ham "Qayta yechish" chiqadi; qolgan urinish va muddat ko'rsatilmaydi (U6).

**N11. Test topshirishda noto'g'ri javoblar [J].** Noma'lum `questionId` yoki bir savolga takroriy javob 201 beradi va urinish sifatida sanaladi. Tuzat: noma'lum/takroriy `questionId` 400; hech bo'lmasa bitta tanilgan savolga javob bo'lmasa 400.

**N12. Dars ochilishi (release) mantig'i [J].**
- `LOCKED` + o'tgan `opensAt` darsni ochadi (status ma'nosi buziladi). Qoida: `LOCKED` har doim yopiq; `SCHEDULED` `opensAt` kelganda ochiladi; `OPEN` `closesAt` gacha.
- `closesAt` hech qachon tekshirilmaydi (OPEN + o'tgan `closesAt` hamon ochiq).
- `closesAt < opensAt` qabul qilinadi; boshqa o'qituvchining kursi yoki shu guruhga biriktirilmagan kurs darsi uchun release 200 beradi (kurs guruhga biriktirilgan bo'lishi shart).
- `CourseGroup.sequential` faqat sxemada: endpoint, mantiq va UI yo'q (spetsifikatsiya 2.A).
- Kurs kartasida "4 ta dars", progress maxraji "5" qulflangan, arxivlangan (`archivedAt`) va nashr etilmagan darslarni ham hisoblaydi; talaba ro'yxatida bor-yo'g'i 3 ta ko'rinadi. Tuzat: `lessonsTotal` va "N ta dars" = talaba hozir ko'ra oladigan (nashr, arxivsiz, ochilgan) darslar; qulflanganlar alohida `lockedCount`.
- Yopiq dars ro'yxatda umuman ko'rinmaydi; spetsifikatsiya bo'yicha kulrang kartada "Ochilish: sana" ko'rinsin (N4 bilan).

**N13. Topshiriq yaratish/tahrirlash validatsiyasi [J].**
- `moduleId` umuman tekshirilmaydi: mavjud bo'lmagan UUID, begona modul, `lessonId` bilan mos kelmaydigan modul 201. Qoida: modul `courseId`ga tegishli va kurs guruhga biriktirilgan bo'lsin; `lessonId` berilsa `moduleId` avtomatik shu darsniki.
- TASK: `startsAt > dueAt` 201; TIMED: `endsAt` o'tmishda 201; `timeLimitMinutes` oynadan uzun (`endsAt - startsAt`) 201.
- Baholangan topshiriqda `maxScore`ni baholangan balldan pastga tushirish 200 va `kind`ni o'zgartirish 200. Qoida: baholangan javob bor bo'lsa `maxScore >= max(score)`, `kind` o'zgarmas (yoki javoblar bor bo'lsa 409).
- Topshiriq yaratilganda `startsAt` kelmagan bo'lsa ham talabalarga darhol xabar ketadi (TIMED uchun `startsAt`da yuborilsin).

**N14. Modul qoidalari [J].** `isPublished=false` modulning darslari talabaga ochiq (200) va modul o'zi `GET /courses/:id/modules` da ko'rinadi. Modulni (ichida darslari bor) o'chirish 204 va sukut bilan bajariladi: darslar "Umumiy" modulga ko'chadimi, yo'qoladimi aniq emas. Tuzat: nashr etilmagan modul = ichidagi darslar yopiq; o'chirishda darslar `Umumiy` modulga o'tsin va ta'sir hisoboti qaytsin.

**N15. Fayl yuklash [J].** (a) MIME faqat `Content-Type` sarlavhasiga ishonadi: "MZ…" mazmunli `evil.exe` `application/pdf` deb yuborilsa 200. Magic-byte (`file-type`) tekshiruvi qo'shilsin, kengaytma ro'yxati ham. (b) `RETURNED` holatida fayl yuklansa `attempt` oshmaydi, revision yaratilmaydi, eski `score`/`feedback` qoladi (matnli yo'lda esa to'g'ri). (c) Presigned URL `http://localhost:9000/...` — prod uchun alohida `S3_PUBLIC_ENDPOINT` sozlamasi kerak. (d) Fayl nomi sanitizatsiyasi ishlaydi (tasdiqlandi), saqlansin.

**N16. O'qish rejimi tahlili [J].**
- Heartbeat tezlik cheklovi yo'q: 20 ta ketma-ket 60 soniyalik so'rov bir necha soniyada 20 daqiqa "o'qish vaqti" qo'shdi (talaba statistikasida 22 daq). Tuzat: server `lastHeartbeatAt` bilan solishtirsin: qo'shiladigan vaqt `min(activeSeconds, now - lastHeartbeatAt + 5s)`, so'rovlar orasida kamida ~20s; sessiya (`StudySession`) yozilsin.
- "Darsni tugatdim" minimal faol vaqtsiz (lastPosition 0 va 0 soniyada ham tugaydi): sozlanadigan minimal vaqt/pozitsiya (kurs yoki dars darajasida ixtiyoriy).
- `viewCount` doim 1 (faqat yaratilishda); `LESSON_OPEN` hodisasi yozilmaydi.
- `StudyEvent` faqat `LESSON_HEARTBEAT`; `LESSON_COMPLETE`, `QUIZ_START/SUBMIT`, `ASSIGNMENT_OPEN/SUBMIT` yozilmaydi (spetsifikatsiya 2.C), shu sabab `weeklyActivity` va timeline to'liq emas.
- `heartbeatSchema` (`position ≤ 100`, `activeSeconds ≤ 90`) amalda qo'llanmaydi: `position:101` 200, `activeSeconds:500` jimgina 60 ga kesiladi. Controller zod DTO ishlatsin.
- Yo'q endpoint'lar (404): `GET /stats/groups/:id/analytics` (dars bo'yicha tugatish voronkasi, o'rt. vaqt, faollik heatmap), `GET /stats/me/overview`.
- `GET /stats/students/:id/timeline?from=garbage` 500 (400 bo'lishi kerak).
- `progress/me` javobida `timeSpentSec`, `lastPosition`, `viewCount` yo'q (talaba "Davom etish" uchun kerak).

**N17. Guruh almashtirish statistikasi [J].** `transfer` ishlaydi, lekin keyin `stats/me`: darslar 0/0, ammo `assignmentsSubmitted=2`, `quizzesTaken=1` eski guruhdan qoladi (aralash holat). Tuzat: "joriy guruh" ko'rsatkichlari faqat joriy guruh topshiriq/testlari bo'yicha; eski tarix alohida `history` bo'limida. O'qituvchi (eski guruh) o'tkazilgan talabaning statistikasini ko'rmasligi tekshirilsin.

**N18. Boshqa mantiq kamchiliklari.** (a) Kurs o'chirishda (guruhga biriktirilgan, topshiriq/progress bor) hech qanday ogohlantirish yo'q: 200; ta'sir hisoboti (`removal-impact` analogi) va tasdiqlash kerak. (b) Qoralama kursni guruhga biriktirish 201 (talaba ko'rmaydi, o'qituvchiga ogohlantirish yo'q). (c) `PUT /courses/:id/lessons/order` to'liq bo'lmagan ro'yxatni (4 dan 2 ta) 200 bilan qabul qiladi: barcha darslar ro'yxati majburiy. (d) Kurs nashrdan olinganda unga bog'langan topshiriqlar talabaga ko'rinishda qoladi.

## C. UI

**U1. Statistika sahifalari ochilmaydi [J].** `/stats/groups/:id` (talabalar jadvali) va `/stats/students/:id` (talaba kartasi) to'liq yuklanganda "Bu bo'lim ishlab chiqilmoqda" (catch-all `[...slug]`) chiqadi, SPA ichida esa `/stats`ga qaytadi. Repoda sahifalar bor (`apps/web/src/app/(dashboard)/stats/groups/[id]`, `stats/students/[id]`), demak web konteyner eski build yoki route ro'yxati (`route-gate`, role-path, `[...slug]` ustuvorligi) ularni ushlab qolyapti. Web'ni qayta build qil, so'ng o'qituvchi uchun ikkala sahifa ochilishini e2e (Playwright) bilan tekshir. Talabalar jadvali: ism, progress, ball, oxirgi faollik, o'qish vaqti, xavf belgisi, saralash/filtr; talaba kartasi: timeline, dars kesimi, topshiriq va testlar.

**U2. Topshiriq yaratish formasi to'liq emas [J].** Dars/mavzu/kurs tanlash yo'q (mavzuga biriktirish mumkin emas), fayl biriktirish yo'q, QUESTIONNAIRE da test tanlash yo'q, TASK uchun `startsAt` yo'q. "Qaytarish/qayta ochish" va accommodation (vaqtni uzaytirish) tugmalari baholash oynasida bormi tekshirilsin va qo'shilsin. Maydon xatolari backend `Validation failed` o'rniga aniq matn bilan ko'rsatilsin.

**U3. Talaba topshiriqlar ro'yxati [J].** Tur nishoni (TASK/TIMED/QUESTIONNAIRE), holat (Ochilmagan, Topshirilmagan, Topshirilgan, Baholangan, Qaytarilgan, Kechikkan), qolgan vaqt va baho ro'yxatda ko'rinmaydi; muddati o'tgan topshiriqda "Topshirish" faol (server rad etadi); sahifalash yo'q; TIMED boshlangach "Yangilash" tugmasi. Tartib: yaqin muddat, keyin qolganlari; filtr: barchasi/topshirilmagan/baholangan.

**U4. Boshqaruv UI'dagi yetishmovchiliklar [J].**
- Guruh "Mazmuni" > "Testlar": ochilish/yopilish sanasi, urinishlar soni, taymer maydonlari yo'q (faqat API orqali).
- Guruh a'zolari oynasida "boshqa guruhga o'tkazish" yo'q.
- Kurs formasida `visibility` (PRIVATE/LIBRARY) va "Nusxa olish" yo'q; darslar ro'yxatida tartibni o'zgartirish (drag), nashr/arxiv holati va "o'chirish ta'siri" oynasi yo'q.
- Mavzu ochilish oynasida (Rejalashtirish) ketma-ket ochilish (`sequential`) tanlovi yo'q va faqat modul/dars tanlanadi, "ommaviy" amal yo'q.
- `/learning` va `/learning/manage` o'qituvchiga hamma kursni (seed + begona) ko'rsatadi (N3).

**U5. Dars sahifasida mavzu bo'yicha topshiriq/testlar yo'q [J].** Talaba darsni ochganda shu dars/modulga biriktirilgan topshiriq va testlar ko'rinmaydi (2.A talabi: mavzu sahifasida hammasi bir joyda). Qo'sh: "Shu mavzu bo'yicha topshiriqlar" va "Testlar" bloklari holat bilan.

**U6. Talaba test kartasi (`/monitoring/tests`) [J].** Yopilgan yoki urinishi tugagan testda ham "Qayta yechish"; urinishlar (n/m), muddat va taymer ko'rsatilmaydi; natija kartasi bitta urinishni ko'rsatadi.

**U7. O'qituvchi bosh sahifasi [J].** "Topshiriqlar" kartasida son o'rniga "Barchasi" so'zi chiqadi (kutilgan: tekshirilmagan topshiriqlar soni); karta bosilganda `/assignments`ga o'tsin.

**U8. Dars sahifasi.** Bog'liq nuqsonlar: kurs kartasida "N ta dars" soni haqiqiy ko'rinadigan darslar bilan mos kelmaydi (N12); begona o'qituvchi yuklagan fayl "Darslik fayllari"da talabaga ko'rinadi (N1).

---

## D. Qabul mezonlari (QA qayta o'tkazadi)

Har band uchun avtomatik test (Jest/Supertest) va 3 roldagi qo'lda tekshiruv:

1. Begona o'qituvchi/talaba: material (yuklash, o'chirish, ro'yxat, yuklab olish), test savoli (o'qish javob kaliti bilan, qo'shish, o'chirish), kurs/test ro'yxati, removal-impact, attachment-url — hammasi 403/404.
2. Qulflangan dars: ro'yxatda mazmunsiz, detail/heartbeat/progress 404; `LOCKED`+o'tgan `opensAt` yopiq; `closesAt` o'tgach yopiladi; `lessonsTotal` ko'rinadigan darslar bilan teng.
3. Seed kurslar LIBRARY: o'qituvchi biriktiradi va clone qiladi; begona PRIVATE ko'rinmaydi.
4. TIMED: ikkinchi `start` (muddat tugagach) 409; fayl yuklash start'siz/deadline'dan keyin rad; accommodation barcha yo'llarda hisobga olinadi.
5. QUESTIONNAIRE: quizId majburiy; savollar talaba oynasida; ochiq javob → `PENDING_REVIEW` → qo'lda baho → yakuniy ball.
6. Kechikkan javob jarimasi yakuniy ballda; xom ball va jarima alohida ko'rinadi.
7. GroupQuiz: qisman PATCH boshqa maydonlarni o'chirmaydi; `maxAttempts:0`, teskari oyna, noto'g'ri sana 400; `take` oynadan tashqarida 403 va taymer qaytaradi; nofaol guruhda 409.
8. Quiz submit: noma'lum/takroriy `questionId` 400.
9. Heartbeat: 20 ta tezkor so'rov ≤ ~1 daqiqa qo'shadi; barcha hodisa turlari yoziladi; `analytics` va `me/overview` ishlaydi; noto'g'ri sana 400.
10. Transfer'dan keyin `stats/me` faqat joriy guruh bo'yicha, tarix alohida.
11. Fayl: magic-byte nomuvofiqligi 400; RETURNED + fayl `attempt+1` va revision.
12. UI: `/stats/groups/:id`, `/stats/students/:id` o'qituvchi uchun ochiladi; topshiriq formasi mavzu/fayl/test tanlovi; talaba ro'yxatida holat va taymer; dars sahifasida mavzu topshiriqlari; quiz binding sozlamalari; transfer; clone.

Cheklovlar: mavjud rol/ownership qoidalarini buzma; migratsiyalar eski ma'lumot bilan ishlasin (seed kurslar → LIBRARY, `kind=TASK`, default modul); xato javoblarida ichki ma'lumot sizmasin; yangi matnlar o'zbekcha. Har faza oxirida qisqa hisobot ber: nima o'zgardi, qaysi testlar o'tdi, nima qoldi.

Boshlashdan oldin A blokini (N1–N5) alohida commit sifatida bajar va natijani ko'rsat.
