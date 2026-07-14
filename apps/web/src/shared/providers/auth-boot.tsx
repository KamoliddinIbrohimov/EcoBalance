'use client';

import { useEffect, type ReactNode } from 'react';

import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * On first mount tries to hydrate the auth session:
 *   - Hits /auth/refresh (uses the httpOnly refresh cookie if present)
 *   - If successful, stores the fresh access token and fetches /auth/me
 *   - If refresh fails, silently stays logged out
 */
export function AuthBoot({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await apiClient.post<{
          data: { accessToken: string; expiresIn: number };
        }>('/auth/refresh', {});
        if (cancelled) return;
        setAccessToken(data.data.accessToken, data.data.expiresIn);

        const me = await apiClient.get<{ data: import('@/shared/stores/auth-store').AuthUser }>(
          '/auth/me',
        );
        if (cancelled) return;
        setUser(me.data.data);
      } catch {
        /* not logged in — that's fine */
      } finally {
        if (!cancelled) hydrate();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrate, setAccessToken, setUser]);

  return <>{children}</>;
}
