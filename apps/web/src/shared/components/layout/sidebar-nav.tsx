'use client';

import {
  BarChart3,
  Bot,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  Home,
  LogOut,
  Settings,
  UserCircle,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType, type SVGProps } from 'react';

import { useLogout } from '@/features/auth/hooks/use-auth';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { Logo } from './logo';


type LabelKey =
  | 'home'
  | 'monitoring'
  | 'monitoringPatrul'
  | 'monitoringTests'
  | 'learning'
  | 'learningPreschool'
  | 'learningSchool'
  | 'learningHigher'
  | 'learningReserved'
  | 'chatbot'
  | 'dashboard'
  | 'reports'
  | 'analytics'
  | 'recommendations'
  | 'news'
  | 'events'
  | 'users'
  | 'organizations'
  | 'settings'
  | 'profile'
  | 'aiSettings'
  | 'groups'
  | 'assignments'
  | 'statistics'
  | 'myStats'
  | 'teacher';

interface NavItem {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  labelKey: LabelKey;
  children?: NavItem[];
  /** Agar dinamik nom bo'lsa (tarjima o'rniga), buni ko'rsatamiz. */
  dynamicLabel?: string;
}

// ---------------------------------------------------------------
// Rol bo'yicha ko'rinadigan sahifalar
// ---------------------------------------------------------------

type RoleGroup = 'super_admin' | 'teacher' | 'student';

function getRoleGroup(roles: string[]): RoleGroup {
  if (roles.includes('SUPER_ADMIN')) return 'super_admin';
  if (roles.includes('TEACHER')) return 'teacher';
  return 'student';
}

/** Super Admin — tizim boshqaruvi, barcha modullar (eski + yangi). */
const NAV_SUPER_ADMIN: NavItem[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/users', icon: Users, labelKey: 'users' },
  { href: '/groups', icon: Users, labelKey: 'groups' },
  { href: '/learning', icon: GraduationCap, labelKey: 'learningHigher' },
  { href: '/assignments', icon: ClipboardList, labelKey: 'assignments' },
  { href: '/monitoring/tests', icon: ClipboardList, labelKey: 'monitoringTests' },
  { href: '/stats', icon: BarChart3, labelKey: 'statistics' },
  { href: '/chatbot', icon: Bot, labelKey: 'chatbot' },
  { href: '/settings/profile', icon: UserCircle, labelKey: 'profile' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
];

/** TEACHER — o'z guruhlari, kurslari, topshiriqlari, statistikasi. */
const NAV_TEACHER: NavItem[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/groups', icon: Users, labelKey: 'groups' },
  { href: '/learning', icon: GraduationCap, labelKey: 'learningHigher' },
  { href: '/assignments', icon: ClipboardList, labelKey: 'assignments' },
  { href: '/monitoring/tests', icon: ClipboardList, labelKey: 'monitoringTests' },
  { href: '/stats', icon: BarChart3, labelKey: 'statistics' },
  { href: '/chatbot', icon: Bot, labelKey: 'chatbot' },
  { href: '/settings/profile', icon: UserCircle, labelKey: 'profile' },
];

/** STUDENT — o'z darslari, testlari, topshiriqlari, natijalari. */
const NAV_STUDENT: NavItem[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/learning', icon: GraduationCap, labelKey: 'learningHigher' },
  { href: '/assignments', icon: ClipboardList, labelKey: 'assignments' },
  { href: '/monitoring/tests', icon: ClipboardList, labelKey: 'monitoringTests' },
  { href: '/stats/me', icon: BarChart3, labelKey: 'myStats' },
  { href: '/chatbot', icon: Bot, labelKey: 'chatbot' },
  { href: '/settings/profile', icon: UserCircle, labelKey: 'profile' },
];

/**
 * Sticky desktop sidebar (visible from `lg:` breakpoint upward).
 * The same nav is rendered inside a drawer on mobile — see MobileSidebar.
 */
export function SidebarNav() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex">
      <SidebarContent />
    </aside>
  );
}

/**
 * Inner sidebar content — logo, nav list, "Loyiha hududi" block, logout button.
 * Shared by desktop <SidebarNav /> and mobile drawer.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('sidebar');
  const pathname = usePathname();
  const logout = useLogout();
  const roles = useAuthStore((s) => s.user?.roles) ?? [];

  const roleGroup = getRoleGroup(roles as string[]);
  const baseNav =
    roleGroup === 'super_admin' ? NAV_SUPER_ADMIN : roleGroup === 'teacher' ? NAV_TEACHER : NAV_STUDENT;

  const isActive = (href: string) => {
    if (href === '/' || href === '/home' || href === '/mahalla') return pathname === href;
    return pathname?.startsWith(href) ?? false;
  };

  const enrichedNav: NavItem[] = baseNav;

  // Yig'iladigan sub-menyular uchun holat. Default — yopiq. Faqat foydalanuvchi
  // hozir kirgan sahifa qaysidir bo'limning ostidagi bo'lsa, o'sha avtomatik
  // ochiladi (masalan /learning/level/... ga o'tsa Ta'lim ochilib turadi).
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      for (const item of enrichedNav) {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((c) => pathname === c.href);
          if (hasActiveChild) next.add(item.href);
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleMenu = (href: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Logo />
      </div>

      <nav className="eco-scroll flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {enrichedNav.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const hasChildren = !!item.children && item.children.length > 0;
            const isOpen = openMenus.has(item.href);

            return (
              <li key={item.href}>
                {hasChildren ? (
                  // Ota-band — tugma (toggle only). Sub-band'lardan bosilib
                  // kerakli sahifaga o'tiladi.
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.href)}
                    aria-expanded={isOpen}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-active text-sidebar-active-foreground shadow-sm'
                        : 'text-sidebar-muted hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.dynamicLabel ?? t(item.labelKey)}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-active text-sidebar-active-foreground shadow-sm'
                        : 'text-sidebar-muted hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.dynamicLabel ?? t(item.labelKey)}</span>
                  </Link>
                )}
                {hasChildren ? (
                  <div
                    className={cn(
                      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out',
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="min-h-0">
                      <ul className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                        {item.children!.map((child) => {
                          const childActive = pathname === child.href;
                          const ChildIcon = child.icon;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={onNavigate}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                                  childActive
                                    ? 'bg-sidebar-active/70 text-sidebar-active-foreground'
                                    : 'text-sidebar-muted hover:bg-secondary hover:text-foreground',
                                )}
                              >
                                <ChildIcon className="h-3.5 w-3.5" />
                                <span>{child.dynamicLabel ?? t(child.labelKey)}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

      </nav>

      <div className="border-t border-sidebar-border p-3">
        <LogoutButton
          onLogout={() => {
            onNavigate?.();
            void logout().catch((err) => {
              // Xatoni ko'rish uchun console'ga chiqaramiz.
              // eslint-disable-next-line no-console
              console.error('Logout failed:', err);
              // Har qanday holatda ham chiqishga majbur qilamiz.
              if (typeof window !== 'undefined') window.location.href = '/login';
            });
          }}
        />
      </div>
    </div>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations('auth');
  return (
    <button
      type="button"
      onClick={onLogout}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
    >
      <LogOut className="h-4 w-4" />
      <span>{t('logout')}</span>
    </button>
  );
}

