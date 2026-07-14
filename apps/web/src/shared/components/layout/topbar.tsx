'use client';

import { Bell, ChevronDown, CloudSun, LogOut, Settings, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useLogout } from '@/features/auth/hooks/use-auth';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { MobileSidebar } from './mobile-sidebar';

export function Topbar() {
  const t = useTranslations('topbar');
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [openMenu, setOpenMenu] = useState(false);

  const displayName = user ? `${user.firstName} ${user.lastName}` : '';
  const roleLabelKey = user?.roles[0] ?? 'CITIZEN';

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border/60 bg-card/80 px-4 backdrop-blur-md md:gap-4 md:px-6">
      <MobileSidebar />
      <LocationSelect />

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <NotificationsBell />
        <WeatherWidget />

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((v) => !v)}
            className="flex items-center gap-3 rounded-xl bg-secondary/50 py-1.5 pl-2 pr-3 transition-colors hover:bg-secondary"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
              )}
            </div>
            <div className="hidden text-left leading-tight md:block">
              <div className="text-sm font-semibold text-foreground">{displayName}</div>
              <div className="text-xs text-muted-foreground">
                <RoleLabel role={roleLabelKey} />
              </div>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
          </button>

          {openMenu ? (
            <div
              className={cn(
                'absolute right-0 top-full mt-2 w-56 rounded-xl border border-border/60 bg-popover p-1 shadow-elevated animate-fade-in',
              )}
              onMouseLeave={() => setOpenMenu(false)}
            >
              <MenuItem icon={User} label={t('myProfile')} href="/settings/profile" />
              <MenuItem icon={Settings} label={t('settings')} href="/settings" />
              <div className="my-1 border-t border-border/60" />
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof User;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
}

function LocationSelect() {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl bg-secondary/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
    >
      <span className="text-primary">📍</span>
      <span>Chirchiq shahri</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function NotificationsBell() {
  return (
    <button
      type="button"
      className="relative flex h-11 items-center gap-2 rounded-xl px-3 transition-colors hover:bg-secondary"
      aria-label="Bildirishnomalar"
    >
      <span className="relative">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          8
        </span>
      </span>
      <span className="hidden text-sm font-medium text-foreground md:inline">Bildirishnomalar</span>
    </button>
  );
}

function WeatherWidget() {
  return (
    <div className="hidden items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 md:flex">
      <CloudSun className="h-5 w-5 text-warning" />
      <div className="leading-tight">
        <div className="text-sm font-semibold text-foreground">24°C</div>
        <div className="text-[11px] text-muted-foreground">Yaxshi</div>
      </div>
    </div>
  );
}

function RoleLabel({ role }: { role: string }) {
  const t = useTranslations('roles');
  // next-intl throws if the key does not exist; guard defensively.
  const key = role as Parameters<typeof t>[0];
  try {
    return <>{t(key)}</>;
  } catch {
    return <>{role}</>;
  }
}
