-- Platforma faqat oliy ta'lim uchun: maktabgacha va maktab darajalari olib tashlanadi.
-- Shu darajalardagi kurslar O'CHIRILMAYDI — API ularni ko'rsatmaydi (HIGHER_EDUCATION
-- filtri), kerak bo'lsa daraja yozuvini qayta qo'shib tiklash mumkin.
DELETE FROM "education_level_items" WHERE "slug" <> 'oliy-talim';
