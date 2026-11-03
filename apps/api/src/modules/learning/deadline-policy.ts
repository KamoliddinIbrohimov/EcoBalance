/**
 * Muddat siyosati — sof funksiyalar (DB'siz), shuning uchun bir joyda.
 *
 * Alohida uzaytirish (accommodation):
 *  - `newDueAt` — talaba uchun yangi muddat (TASK dueAt o'rniga; TIMED oynasini
 *    ham shu sanagacha kengaytiradi);
 *  - `extraMinutes` — TIMED'da urinish taymeriga, TASK'da dueAt'ga qo'shiladi.
 */
export interface Accommodation {
  extraMinutes: number | null;
  newDueAt: Date | null;
}

const MINUTE = 60_000;

export function effectiveDueAt(dueAt: Date | null, acc: Accommodation | null): Date | null {
  if (acc?.newDueAt) return acc.newDueAt;
  if (dueAt && acc?.extraMinutes) return new Date(dueAt.getTime() + acc.extraMinutes * MINUTE);
  return dueAt;
}

/** TIMED oynasining yopilish vaqti (uzaytirish hisobga olingan). */
export function timedWindowEnd(endsAt: Date, acc: Accommodation | null): Date {
  if (acc?.newDueAt && acc.newDueAt > endsAt) return acc.newDueAt;
  return endsAt;
}

/** Urinish deadline'i: taymer tugashi yoki oyna yopilishi — qaysi biri oldin. */
export function attemptDeadline(now: Date, limitMinutes: number, acc: Accommodation | null, windowEnd: Date): Date {
  const byTimer = now.getTime() + (limitMinutes + (acc?.extraMinutes ?? 0)) * MINUTE;
  return new Date(Math.min(byTimer, windowEnd.getTime()));
}

/** Kechikkan javob uchun yakuniy ball: xom balldan `percent`% kam. */
export function applyLatePenalty(raw: number, isLate: boolean, percent: number): number {
  if (!isLate || percent <= 0) return raw;
  return Math.max(0, Math.round(raw * (1 - percent / 100)));
}
