'use client';

import {
  Award,
  BarChart3,
  Baby,
  Backpack,
  Bike,
  BookMarked,
  Bot,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Cat,
  ChevronDown,
  CircuitBoard,
  ClipboardList,
  Cloud,
  Code,
  Compass,
  Cpu,
  Droplet,
  Dumbbell,
  Feather,
  FileText,
  FlaskConical,
  Flower2,
  Gamepad2,
  GraduationCap,
  Hammer,
  Headphones,
  Heart,
  Home,
  Landmark,
  Languages,
  Leaf,
  Library,
  LineChart,
  Lightbulb,
  LogOut,
  Map as MapIcon,
  MapPin,
  Medal,
  Microscope,
  MoreHorizontal,
  Mountain,
  MousePointer2,
  Music,
  Newspaper,
  Palette,
  Paperclip,
  PawPrint,
  PenTool,
  Puzzle,
  Rocket,
  School,
  Scroll,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Telescope,
  TreeDeciduous,
  Trees,
  Trophy,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType, type SVGProps } from 'react';

import { useLogout } from '@/features/auth/hooks/use-auth';
import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { Logo } from './logo';

// Lucide icon name → component map. Custom levels can pick from these.
// Bu ro'yxat level-form-dialog.tsx ICON_OPTIONS bilan sinxron bo'lishi kerak.
const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  Award,
  Baby,
  Backpack,
  BarChart3,
  Bike,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Cat,
  CircuitBoard,
  Cloud,
  Code,
  Compass,
  Cpu,
  Droplet,
  Dumbbell,
  Feather,
  FileText,
  FlaskConical,
  Flower2,
  Gamepad2,
  GraduationCap,
  Hammer,
  Headphones,
  Heart,
  Home,
  Landmark,
  Languages,
  Leaf,
  Library,
  LineChart,
  Lightbulb,
  MapIcon,
  Medal,
  Microscope,
  MoreHorizontal,
  Mountain,
  MousePointer2,
  Music,
  Newspaper,
  Palette,
  Paperclip,
  PawPrint,
  PenTool,
  Puzzle,
  Rocket,
  School,
  Scroll,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Telescope,
  TreeDeciduous,
  Trees,
  Trophy,
  Users,
  Wrench,
};

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
  | 'aiSettings';

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

type RoleGroup = 'admin' | 'mahalla' | 'user';

function getRoleGroup(roles: string[]): RoleGroup {
  if (roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'CITY_ADMIN', 'TEACHER'].includes(r))) return 'admin';
  if (roles.includes('MAHALLA_MANAGER')) return 'mahalla';
  return 'user';
}

const MONITORING_CHILDREN: NavItem[] = [
  { href: '/monitoring', icon: Leaf, labelKey: 'monitoringPatrul' },
  { href: '/monitoring/tests', icon: ClipboardList, labelKey: 'monitoringTests' },
];

const NAV_ADMIN: NavItem[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/monitoring', icon: Leaf, labelKey: 'monitoring', children: MONITORING_CHILDREN },
  { href: '/learning', icon: GraduationCap, labelKey: 'learning', children: [] },
  { href: '/chatbot', icon: Bot, labelKey: 'chatbot' },
  { href: '/dashboard', icon: BarChart3, labelKey: 'dashboard' },
  { href: '/reports', icon: FileText, labelKey: 'reports' },
  { href: '/analytics', icon: LineChart, labelKey: 'analytics' },
  { href: '/recommendations', icon: Lightbulb, labelKey: 'recommendations' },
  { href: '/news', icon: Newspaper, labelKey: 'news' },
  { href: '/events', icon: Calendar, labelKey: 'events' },
  { href: '/users', icon: Users, labelKey: 'users' },
  { href: '/organizations', icon: Building2, labelKey: 'organizations' },
  { href: '/settings/profile', icon: UserCircle, labelKey: 'profile' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
];

const NAV_MAHALLA: NavItem[] = [
  { href: '/mahalla', icon: Home, labelKey: 'home' },
  { href: '/monitoring/tests', icon: ClipboardList, labelKey: 'monitoringTests' },
  { href: '/learning', icon: GraduationCap, labelKey: 'learning', children: [] },
  { href: '/news', icon: Newspaper, labelKey: 'news' },
  { href: '/chatbot', icon: Bot, labelKey: 'chatbot' },
  { href: '/settings/profile', icon: UserCircle, labelKey: 'profile' },
];

const NAV_USER: NavItem[] = [
  { href: '/home', icon: Home, labelKey: 'home' },
  { href: '/monitoring/tests', icon: ClipboardList, labelKey: 'monitoringTests' },
  { href: '/learning', icon: GraduationCap, labelKey: 'learning', children: [] },
  { href: '/news', icon: Newspaper, labelKey: 'news' },
  { href: '/recommendations', icon: Lightbulb, labelKey: 'recommendations' },
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
  const { data: levels } = useEducationLevels();
  const roles = useAuthStore((s) => s.user?.roles) ?? [];

  const roleGroup = getRoleGroup(roles as string[]);
  const baseNav = roleGroup === 'admin' ? NAV_ADMIN : roleGroup === 'mahalla' ? NAV_MAHALLA : NAV_USER;

  const isActive = (href: string) => {
    if (href === '/' || href === '/home' || href === '/mahalla') return pathname === href;
    return pathname.startsWith(href);
  };

  // Ta'lim darajalarini dinamik ravishda /learning bandi ostiga qo'shamiz.
  const learningChildren: NavItem[] = (levels ?? [])
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((l) => ({
      href: `/learning/level/${l.slug}`,
      icon: ICON_MAP[l.iconName] ?? GraduationCap,
      labelKey: 'learning',
      dynamicLabel: l.nameUz,
    }));

  const enrichedNav: NavItem[] = baseNav.map((item) =>
    item.href === '/learning' ? { ...item, children: learningChildren } : item,
  );

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

        <ProjectAreaBlock />
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
          <span>Chirchiq shahridagi 15-maktab</span>
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
