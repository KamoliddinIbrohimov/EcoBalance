/**
 * O'zbek/rus/ingliz matnidan URL-friendly slug generatsiya qiladi.
 * - Kirillcha harflarni lotinga transliteratsiya qiladi
 * - Apostroflar butunlay olib tashlanadi (Ko'chada → kochada)
 * - Bo'shliqlar va boshqa maxsus belgilar tire'ga aylanadi
 * - Uzunligi 60 belgigacha
 */
export function makeSlug(input: string): string {
  const CYR_TO_LAT: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q',
    ғ: 'g', ҳ: 'h',
  };
  let s = input.toLowerCase().trim();
  s = s.split('').map((c) => CYR_TO_LAT[c] ?? c).join('');
  s = s.replace(/[‘’ʻʼ'`]/g, '');
  s = s.replace(/[^a-z0-9-]+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s.slice(0, 60);
}
