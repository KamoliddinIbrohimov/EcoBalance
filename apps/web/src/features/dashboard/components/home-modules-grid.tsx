'use client';

import {
  Bot,
  ChartColumn,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Users,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { useAuthStore } from '@/shared/stores/auth-store';

type ModuleKey =
  | 'users'
  | 'groups'
  | 'assignments'
  | 'quizzes'
  | 'stats'
  | 'chatbot'
  | 'teacherPanel'
  | 'studentPanel'
  | 'courses'
  | 'myStats';

interface ModuleItem {
  key: ModuleKey;
  href: string;
  icon: LucideIcon;
}

// Rol bo'yicha modullar — haqiqiy sidebar route'lariga mos (sidebar-nav.tsx).
const SUPER_ADMIN_MODULES: ModuleItem[] = [
  { key: 'users', href: '/users', icon: Users },
  { key: 'groups', href: '/groups', icon: UsersRound },
  { key: 'assignments', href: '/assignments', icon: ClipboardList },
  { key: 'quizzes', href: '/monitoring/tests', icon: FlaskConical },
  { key: 'stats', href: '/stats', icon: ChartColumn },
  { key: 'chatbot', href: '/chatbot', icon: Bot },
];

const TEACHER_MODULES: ModuleItem[] = [
  { key: 'teacherPanel', href: '/teacher', icon: LayoutDashboard },
  { key: 'groups', href: '/groups', icon: UsersRound },
  { key: 'assignments', href: '/assignments', icon: ClipboardList },
  { key: 'quizzes', href: '/monitoring/tests', icon: FlaskConical },
  { key: 'stats', href: '/stats', icon: ChartColumn },
  { key: 'chatbot', href: '/chatbot', icon: Bot },
];

const STUDENT_MODULES: ModuleItem[] = [
  { key: 'studentPanel', href: '/home', icon: LayoutDashboard },
  { key: 'courses', href: '/learning', icon: GraduationCap },
  { key: 'assignments', href: '/assignments', icon: ClipboardList },
  { key: 'quizzes', href: '/monitoring/tests', icon: FlaskConical },
  { key: 'myStats', href: '/stats/me', icon: ChartColumn },
  { key: 'chatbot', href: '/chatbot', icon: Bot },
];

/**
 * "Boshqaruv modullari" — SUPER_ADMIN bosh sahifasidagi tezkor nav grid.
 * Bosh sahifa (`/`) endi barcha rollarga ko'rinadi; modullar ro'yxati rolga
 * qarab tanlanadi — rolga ruxsat etilmagan bo'lim (masalan talabaga
 * "Foydalanuvchilar") umuman ko'rsatilmaydi. Haqiqiy avtorizatsiya baribir
 * backend va RouteGate'da.
 */
export function HomeModulesGrid() {
  const t = useTranslations('home');
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const modules = roles.includes('SUPER_ADMIN')
    ? SUPER_ADMIN_MODULES
    : roles.includes('TEACHER')
      ? TEACHER_MODULES
      : STUDENT_MODULES;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground">{t('modulesTitle')}</h2>
      <nav className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.key}
              href={m.href}
              className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card px-[18px] py-4 transition hover:-translate-y-px hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <b className="block text-[0.9375rem] font-semibold text-foreground">
                  {t(`modules.${m.key}.title`)}
                </b>
                <small className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`modules.${m.key}.description`)}
                </small>
              </div>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
