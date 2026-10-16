'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { getRoleHomePath } from '@/shared/lib/role-path';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Dashboard ichidagi barcha sahifalar uchun client-side gate:
 *  1. `mustChangePassword=true` bo'lsa — faqat `/change-password` sahifasi ochiq.
 *  2. STUDENT `/` yoki admin-only sahifalarga tushsa — o'z home sahifasiga.
 *  3. TEACHER `/` ga tushsa — `/teacher` ga.
 *
 * Haqiqiy avtorizatsiya backend tomondan amalga oshiriladi; bu — faqat UX uchun.
 */

const STUDENT_FORBIDDEN_PREFIXES = [
  '/learning/manage',
  '/users',
  '/dashboard',
  '/settings/ai',
];

const TEACHER_FORBIDDEN_PREFIXES = ['/users', '/settings/ai'];

export function RouteGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated || !user) return;

    // 1) Majburiy parol almashtirish
    if (user.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password');
      return;
    }
    if (!user.mustChangePassword && pathname === '/change-password') {
      // Parol allaqachon almashtirilgan — profilga qaytar.
      router.replace(getRoleHomePath(user.roles));
      return;
    }

    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
    const isTeacher = user.roles.includes('TEACHER') && !isSuperAdmin;
    const isStudent = user.roles.includes('STUDENT') && !isSuperAdmin && !isTeacher;

    // 2) Admin-only sahifalar — talaba va o'qituvchi uchun bosh sahifaga
    if (isStudent && STUDENT_FORBIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      router.replace('/home');
      return;
    }
    if (isTeacher && TEACHER_FORBIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      router.replace('/teacher');
      return;
    }

    // 3) `/` — SA bo'lmaganlarni o'z sahifasiga
    if (pathname === '/' && !isSuperAdmin) {
      router.replace(getRoleHomePath(user.roles));
      return;
    }
  }, [hydrated, user, pathname, router]);

  return <>{children}</>;
}
