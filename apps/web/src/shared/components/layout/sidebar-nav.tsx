'use client';

import {
  BarChart3,
  Bot,
  Building2,
  Calendar,
  FileText,
  GraduationCap,
  Home,
  Leaf,
  LineChart,
  Lightbulb,
  LogOut,
  MapPin,
  Newspaper,
  Settings,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';

import { useLogout } from '@/features/auth/hooks/use-auth';
import { cn } from '@/shared/lib/cn';
import { Logo } from './logo';

interface NavItem {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  labelKey: keyof typeof labelKeys;
}

const labelKeys = {
  home: 'home',
  monitoring: 'monitoring',
  learning: 'learning',
  chatbot: 'chatbot',
  dashboard: 'dashboard',
  reports: 'reports',
  analytics: 'analytics',
  recommendations: 'recommendations',
  news: 'news',
  events: 'events',
  users: 'users',
  settings: 'settings',
} as const;

const NAV: NavItem[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/monitoring', icon: Leaf, labelKey: 'monitoring' },
  { href: '/learning', icon: GraduationCap, labelKey: 'learning' },
  { href: '/chatbot', icon: Bot, labelKey: 'chatbot' },
  { href: '/dashboard', icon: BarChart3, labelKey: 'dashboard' },
  { href: '/reports', icon: FileText, labelKey: 'reports' },
  { href: '/analytics', icon: LineChart, labelKey: 'analytics' },
  { href: '/recommendations', icon: Lightbulb, labelKey: 'recommendations' },
  { href: '/news', icon: Newspaper, labelKey: 'news' },
  { href: '/events', icon: Calendar, labelKey: 'events' },
  { href: '/users', icon: Users, labelKey: 'users' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
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

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
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
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <ProjectAreaBlock />
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <LogoutButton
          onLogout={() => {
            onNavigate?.();
            void logout();
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

function ProjectAreaBlock() {
  const t = useTranslations('sidebar');
  return (
    <div className="mt-6 rounded-xl bg-secondary/70 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
        {t('projectArea')}
      </p>
      <ul className="space-y-2.5 text-xs text-sidebar-muted">
        <li className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>15 ta maktab</span>
        </li>
        <li className="flex items-center gap-2">
          <Home className="h-3.5 w-3.5 text-warning" />
          <span>1 ta bog&apos;cha</span>
        </li>
        <li className="flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5 text-[hsl(262_83%_58%)]" />
          <span>ChDPU</span>
        </li>
        <li className="pt-1">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>2 ta mahalla</span>
          </div>
          <ul className="ml-5 mt-2 space-y-2 border-l border-border/60 pl-3 text-[11px]">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span className="leading-snug">
                Kimyogar mahallasi<br />
                <span className="text-muted-foreground/80">(Chirchiq shahri)</span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
              <span className="leading-snug">
                Abay mahallasi<br />
                <span className="text-muted-foreground/80">(Bektemir tumani)</span>
              </span>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
}
