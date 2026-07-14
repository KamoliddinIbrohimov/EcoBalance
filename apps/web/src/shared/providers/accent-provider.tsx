'use client';

import { ROLE_PANEL_THEME, type Role } from '@eco/shared';
import { useEffect, type ReactNode } from 'react';

import { useAuthStore } from '@/shared/stores/auth-store';

const ROLE_PRIORITY: Role[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'CITY_ADMIN',
  'MAHALLA_MANAGER',
  'TEACHER',
  'STUDENT',
  'CITIZEN',
];

/**
 * Picks the highest-priority role of the current user and applies the
 * matching accent (green/blue/purple) to the document root as `data-accent`.
 * CSS variables in globals.css read that attribute and swap accent colors
 * for all components — no re-render needed.
 */
export function AccentProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const roles = user?.roles ?? [];
    const primaryRole =
      ROLE_PRIORITY.find((r) => roles.includes(r)) ?? ('CITIZEN' satisfies Role);
    const accent = ROLE_PANEL_THEME[primaryRole];
    document.documentElement.dataset.accent = accent;
  }, [user]);

  return <>{children}</>;
}
