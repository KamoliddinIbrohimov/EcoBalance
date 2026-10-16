# QA hisobot: 3 rolli tizim (Super Admin / O'qituvchi / Talaba)

Sana: 2026-10-16. Muhit: http://localhost:8080 (Docker). Sinov: jonli UI + API (har uch rol tokeni bilan).
Sinov paytida yaratilgan barcha vaqtinchalik yozuvlar o'chirildi/faolsizlantirildi (QA foydalanuvchilar `isActive=false` holatida qoldi, chunki `DELETE /users` yumshoq o'chirish).

## KRITIK (xavfsizlik)

1. **O'qituvchi istalgan foydalanuvchini tahrirlay oladi.** `PATCH /users/:id` o'qituvchi tokeni bilan Super Adminni `isActive:false` qildi (200) va admin hisobi bloklanib qoldi. Egalik (ownership) tekshiruvi yo'q.
2. **Rol eskalatsiyasi.** O'qituvchi o'z talabasini TEACHER qila oldi, o'zining rollarini ham o'zgartirdi (TEACHER+STUDENT). SUPER_ADMIN berishga urinish 500 qaytaradi (DB cheklovi ushlaydi, lekin servis qatlamida 403 emas).
3. **O'qituvchi `GET /users` orqali hamma foydalanuvchini ko'radi** (admin, boshqa o'qituvchilar, o'ziniki bo'lmagan talabalar) va `GET /users/:id` bilan ham.
4. **O'qituvchi boshqa o'qituvchini faolsizlantira oladi** va o'ziniki bo'lmagan talabani tahrirlay oladi.
5. **Kurslar va ta'lim darajalarida egalik yo'q.** Har qanday o'qituvchi istalgan kursni tahrirlaydi (seed kursning tavsifi o'zgardi), ta'lim darajasi yarata oladi (`POST /education-levels` 201). `Course.ownerId` yo'q.
6. **Testlarda egalik yo'q.** Boshqa o'qituvchi o'qituvchining testini tahrirlay oldi; har qanday o'qituvchi hamma foydalanuvchining test natijalarini ko'radi (`GET /quizzes/:id/submissions`, adminning natijasi ham).
7. **Talaba qoralama (draft) kursni ko'radi.** `GET /courses/:id` nashr etilmagan kursni talabaga qaytaradi; `/learning/manage` sahifasi talabaga ham ochiladi (qoralama kurs ko'rinadi).
8. **500 xatolarida ichki ma'lumot sizadi.** Prisma stack va `/workspace/apps/api/...` yo'li javobda.

## YUQORI (asosiy funksiya yetishmaydi)

9. Kurslar guruhga biriktirilmagan: talaba hamma kursni ko'radi; shu sabab statistikada `lessonsTotal=0` (progress har doim 0%). Dars "tugatildi" qilish tugmasi ham yo'q.
10. Testlar guruhga biriktirilmagan (`GroupQuiz` yo'q): o'qituvchi o'z talabalariga alohida test bera olmaydi. Statistikada testlar 0/0.
11. UI: **Guruhlar sahifasi faqat o'qish uchun.** Guruh yaratish, kartani ochish, talaba qo'shish/chiqarish, guruh statistikasi tugmalari yo'q (API bor). Statistika sahifasi "Guruhlar bo'limiga o'ting" deydi, lekin kartalar bosilmaydi.
12. UI: **Topshiriqlar sahifasi faqat o'qish uchun.** O'qituvchida "Yangi topshiriq" va baholash yo'q; talabada topshirish formasi/fayl yuklash yo'q. Ya'ni topshiriq oqimi UI orqali ishlamaydi.
13. Super Admin "Foydalanuvchi qo'shish" oynasida **"Bosh administrator" roli tanlanadi** (server 403 bilan rad etadi, UI esa taklif qilaveradi). Oynada guruh tanlash va vaqtinchalik parol generatsiyasi yo'q; sahifa matni eski ("rol va tashkilot biriktirish"), tashkilot filtri qolgan.
14. Admin UI'da guruh yaratish/o'qituvchiga biriktirish yo'q; `/stats` Super Admin uchun bo'sh joy ushlagich.
15. Eski rol modullari rolsiz ochiq: o'qituvchi va talabaga `/home` (soxta "ekologik indeks 85"), `/mahalla` (soxta "81%, 1 245 aholi"), `/recommendations` ochiladi. Talaba bosh sahifasi LMS emas (progress, yaqin muddatli topshiriqlar yo'q).
16. `mustChangePassword` faqat bayroq: server API'ni bloklamaydi (token bilan hamma ma'lumot ochiq).
17. Ro'yxatdan o'tish havolasi ("Ro'yxatdan o'ting") loginda qolgan (API `/auth/register` yo'q, 404).

## O'RTA

18. Muddati o'tgan topshiriqqa topshirish qabul qilinadi; baholangandan keyin qayta topshirish mumkin; muddati o'tgan topshiriq yaratish mumkin.
19. Baho `maxScore`dan oshib ketishi mumkin (`score:1000`, maxScore 100 → 200 OK).
20. Test javob kaliti bir tomonlama: hamma javob "A" bo'lsa 87% (o'tadi). 30 savoldan 26 tasi to'g'ri javob A.
21. Talaba testni cheksiz qayta topshiradi (urinishlar soni/muddat cheklovi yo'q).
22. Bildirishnomalar yo'q: yangi topshiriq, baho, guruhga qo'shilish haqida talabaga hech narsa kelmaydi.
23. Login limiti qattiq: 5 ta noto'g'ri urinishdan keyin 429 (IP bo'yicha butun ofis uchun to'sib qo'yishi mumkin).
24. "Validation failed" xatosida maydon tafsilotlari yo'q (UI aniq xabar ko'rsatolmaydi).
25. Har sahifa yuklanishida bir qator 401 + refresh (token yangilash) so'rovlari ketadi.
26. `DELETE /users/:id` yumshoq o'chiradi va email band qoladi (qayta ishlatib bo'lmaydi).
27. Teacher `/users`ga to'g'ridan-to'g'ri URL bilan kira oladi (menyuda yo'q) va umumiy admin interfeysini ko'radi.
28. HTTP sarlavhalar ikki marta ("nosniff, nosniff", "SAMEORIGIN, SAMEORIGIN"), CSP yo'q.

## UI / matn

29. Sana formati xato: "2026 M10 15", chatbotda "M09 15 14:31" (oy nomi lokalizatsiya kaliti ko'rinib qolgan).
30. Kurs tavsiflarida apostrof tushib qolgan ("oquvchilariga", "moljallangan", "Oliy talim" o'rniga "Oliy ta'lim"). "O'quvchi" va "Talaba" atamalari aralash.
31. "Ekologik testlar" tavsifida eski matn: "natijalar super adminga yetkaziladi". Admin ro'yxatida E2E test tashkilotlari qolgan ("E2E Maktab ...").
32. "Bu bo'lim ishlab chiqilmoqda" sahifasi ruxsat yo'q holatida ham chiqadi (chalg'ituvchi); `/student` yo'li shu holda. "Loyiha hududi" paneli (sidebar) statik namuna.
33. Bosh sahifa ma'lumotlari soxta (ekologik indeks, grafik) va rolga bog'liq emas.
34. Salomlashuv "Salom, O'qituvchi!" (ism emas, rol/ism bo'lagi).

## Ishlaydigan narsalar (tasdiqlandi)

- Ikkinchi Super Admin yaratish serverda bloklangan (403).
- O'qituvchi o'qituvchi/Super Admin yarata olmaydi (403); talaba yarata oladi.
- Talaba hech qanday boshqarish amalini bajara olmaydi (users, groups, courses, assignments: 403).
- Guruh, statistika va topshiriqlarda boshqa o'qituvchi ma'lumotiga kirish bloklangan (403/404).
- O'qituvchi faqat o'zi yaratgan talabani guruhga qo'sha oladi; talaba bir vaqtda bitta guruhda.
- Guruh nomi validatsiyasi, xavfli HTML matn sifatida (XSS) chiqadi, bajarilmaydi.
- Test topshirish va baholash to'g'ri ishlaydi; boshqa talabaning natijasi yopiq.
- Admin tomonidan yaratilgan o'qituvchida `mustChangePassword=true`.

## Tavsiya etilgan tartib

Avval 1-8 (xavfsizlik: `users` modulida rol va egalik qoidalari, kurs/test `ownerId`, xato javoblarini tozalash), keyin 9-12 (kurs/test guruhga biriktirish, guruh va topshiriq UI), keyin 13-17 va qolganlari.
