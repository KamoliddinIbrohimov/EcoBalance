'use client';

import {
  Bell,
  Check,
  ChevronDown,
  CheckCheck,
  Cloud,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  LogOut,
  MapPin,
  Moon,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { useLogout } from '@/features/auth/hooks/use-auth';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/hooks/use-notifications';
import { useChirchiqWeather, weatherLabelUz } from '@/features/weather/use-weather';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { LanguageSwitcher } from './language-switcher';
import { MobileSidebar } from './mobile-sidebar';

export function Topbar() {
  const t = useTranslations('topbar');
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [openMenu, setOpenMenu] = useState(false);

  const displayName = user ? `${user.firstName} ${user.lastName}` : '';
  const roleLabelKey = user?.roles[0] ?? 'CITIZEN';

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-2 border-b border-border/60 bg-card/80 px-3 backdrop-blur-md sm:h-[72px] sm:gap-3 sm:px-4 md:gap-4 md:px-6">
      <MobileSidebar />
      <LocationSelect />

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <LanguageSwitcher />
        <NotificationsBell />
        <WeatherWidget />

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((v) => !v)}
            className="flex items-center gap-3 rounded-xl bg-secondary/50 py-1.5 pl-2 pr-3 transition-colors hover:bg-secondary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-9 sm:w-9">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold sm:text-sm">
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
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function LocationSelect() {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary md:px-4"
    >
      <MapPin className="h-4 w-4 shrink-0 text-primary" />
      <span className="hidden sm:inline">Chirchiq shahri</span>
      <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
    </button>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: items = [], isLoading } = useNotifications(20);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const shownCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 items-center gap-2 rounded-xl px-2 transition-colors hover:bg-secondary sm:h-11 sm:px-3"
        aria-label="Bildirishnomalar"
      >
        <span className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {shownCount}
            </span>
          ) : null}
        </span>
        <span className="hidden text-sm font-medium text-foreground md:inline">
          Bildirishnomalar
        </span>
      </button>

      {open ? (
        <div
          className="fixed right-4 top-[68px] z-40 mt-2 w-[calc(100vw-2rem)] max-w-[380px] rounded-xl border border-border/60 bg-popover shadow-elevated animate-fade-in sm:absolute sm:right-0 sm:top-full sm:w-[380px]"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Bildirishnomalar</h3>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead.mutate()}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Barchasini o&apos;qilgan
              </button>
            ) : null}
          </div>

          <div className="eco-scroll max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <p className="p-6 text-center text-xs text-muted-foreground">Yuklanmoqda…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Bildirishnomalar yo&apos;q.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((n) => {
                  const isUnread = !n.readAt;
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        'flex gap-3 px-4 py-3 transition-colors',
                        isUnread ? 'bg-primary/5' : '',
                      )}
                    >
                      <div className="flex-1">
                        <p className={cn('text-sm', isUnread ? 'font-semibold' : 'font-medium', 'text-foreground')}>
                          {n.titleUz}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.bodyUz}
                        </p>
                        <time className="mt-1 block text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString('uz-UZ')}
                        </time>
                      </div>
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={() => markRead.mutate([n.id])}
                          className="shrink-0 self-start rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          title="O'qilgan deb belgilash"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pickWeatherIcon(code: number, isDay: boolean) {
  // Yomg'ir/qor/momoqaldiroq — kunduzi ham, kechasi ham bir xil
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudRain;
  if ([45, 48].includes(code)) return Cloud;

  // Ochiq/qisman bulutli — kunduzi Quyosh, kechasi Oy
  if ([0, 1].includes(code)) return isDay ? Sun : Moon;
  if ([2, 3].includes(code)) return isDay ? CloudSun : CloudMoon;
  return isDay ? CloudSun : CloudMoon;
}

function WeatherWidget() {
  const { data, isLoading } = useChirchiqWeather();
  const isDay = data?.isDay ?? true;
  const Icon = data ? pickWeatherIcon(data.weatherCode, isDay) : CloudSun;
  const temp = data ? `${Math.round(data.temperatureC)}°C` : '—';
  const label = data ? weatherLabelUz(data.weatherCode) : isLoading ? '…' : 'Ma’lumot yo‘q';

  // Kunduzi — issiq sariq; kechasi — mayin ko'k. Yomg'ir/qorda ham neytralroq.
  const isRainy = data && (data.weatherCode >= 51 && data.weatherCode <= 99);
  const iconClass = isRainy
    ? 'text-info'
    : isDay
      ? 'text-warning'
      : 'text-info';

  return (
    <div
      className="hidden items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 md:flex"
      title={`Chirchiq shahri ob-havosi${isDay ? ' (kunduzi)' : ' (kechasi)'}`}
    >
      <Icon className={`h-5 w-5 ${iconClass}`} />
      <div className="leading-tight">
        <div className="text-sm font-semibold text-foreground">{temp}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function RoleLabel({ role }: { role: string }) {
  const t = useTranslations('roles');
  const key = role as Parameters<typeof t>[0];
  try {
    return <>{t(key)}</>;
  } catch {
    return <>{role}</>;
  }
}
