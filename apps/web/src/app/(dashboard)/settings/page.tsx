'use client';

import { PERMISSION } from '@eco/shared';
import { Bot, Settings, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

import { Card } from '@/shared/components/ui/card';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Umumiy sozlamalar sahifasi — foydalanuvchi shu yerdan kerakli bo'limga o'tadi.
 * Kartochkalar RBAC bilan filtr qilinadi.
 */
export default function SettingsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageAi = hasPermission(PERMISSION.ROLES_MANAGE);

  const cards = [
    {
      href: '/settings/profile',
      icon: UserIcon,
      title: 'Mening profilim',
      description: "Ism, rasm, telefon, til va parolni o'zgartirish.",
      visible: true,
    },
    {
      href: '/settings/ai',
      icon: Bot,
      title: 'AI sozlamalari',
      description:
        "Chatbot API kaliti, model, token sarfini kuzatish va tizim prompt sozlamalari.",
      visible: canManageAi,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sozlamalar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Platforma va hisob sozlamalarini boshqarish.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards
          .filter((c) => c.visible)
          .map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.href} href={c.href}>
                <Card className="eco-card-hover cursor-pointer p-5 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{c.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{c.description}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
