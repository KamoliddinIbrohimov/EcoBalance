'use client';

import { ROLE_PANEL_THEME, type Role } from '@eco/shared';
import { useEffect, type ReactNode } from 'react';

import { useAuthStore } from '@/shared/stores/auth-store';

/** 3-rol LMS: eng yuqori prioritetli rol → data-accent (blue yoki green). */
const ROLE_PRIORITY: Role[] = ['SUPER_ADMIN', 'TEACHER', 'STUDENT'];

/**
 * Picks the highest-priority role of the current user and applies the
 * matching accent (blue for super admin, green for teacher/student) to the
 * document root as `data-accent`. CSS variables in globals.css read that
 * attribute and swap accent colors for all components — no re-render needed.
 */
export function AccentProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const roles = user?.roles ?? [];
    const primaryRole = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? ('STUDENT' satisfies Role);
    const accent = ROLE_PANEL_THEME[primaryRole];
    document.documentElement.dataset.accent = accent;
  }, [user]);

  return <>{children}</>;
}
