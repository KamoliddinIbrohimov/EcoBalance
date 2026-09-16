'use client';

import { useEffect, type ReactNode } from 'react';

import { ApiError, refreshAuthSession } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Ilk yuklamada refresh cookie orqali sessiyani tiklaydi. Ichkarida
 * shared `refreshAuthSession` singleton'idan foydalanadi — bu bir vaqtda
 * ishga tushgan react-query hook'lari bilan bir xil in-flight promise'ni
 * o'rtoq qiladi, shu tariqa server'ga faqat 1 ta /auth/refresh yuboriladi.
 *
 * Xatolarga munosabat:
 *   • 401 — refresh cookie yaroqsiz → jimgina logged-out qoladi.
 *   • 5xx / 429 / tarmoq xatosi — tranzient. Backoff bilan qayta uramiz.
 */
const MAX_RETRIES = 4;
const BACKOFF_MS = [500, 1500, 3000, 6000];

function isTransient(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status !== 401;
}

async function sleep(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    const check = setInterval(() => {
      if (signal.cancelled) {
        clearTimeout(id);
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

export function AuthBoot({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    const signal = { cancelled: false };

    (async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (signal.cancelled) return;
        try {
          await refreshAuthSession();
          break;
        } catch (err) {
          if (signal.cancelled) return;
          if (!isTransient(err) || attempt === MAX_RETRIES) break;
          await sleep(BACKOFF_MS[attempt] ?? 6000, signal);
        }
      }
      if (!signal.cancelled) hydrate();
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [hydrate]);

  return <>{children}</>;
}
