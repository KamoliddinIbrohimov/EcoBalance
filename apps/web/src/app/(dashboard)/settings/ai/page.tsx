'use client';

import { PERMISSION } from '@eco/shared';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Coins,
  Cpu,
  Key,
  Loader2,
  MessageSquare,
  Save,
  ShieldAlert,
  Users2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  useAiSettings,
  useUpdateAiSettings,
} from '@/features/platform-settings/use-ai-settings';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import type { ApiError } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

function nfmt(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(n);
}

export default function AiSettingsPage() {
  const canManage = useAuthStore((s) => s.hasPermission(PERMISSION.ROLES_MANAGE));
  const { data, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState<number>(1024);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setApiKey('');
    setModel(data.config.model);
    setMaxTokens(data.config.maxTokens);
    setSystemPrompt(data.config.systemPrompt ?? '');
  }, [data]);

  if (!canManage) {
    return (
      <UnderDevelopment description="AI sozlamalarini boshqarish uchun Super Admin ruxsati kerak." />
    );
  }

  if (isLoading || !data) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Yuklanmoqda…</Card>;
  }

  const err = update.error as ApiError | undefined;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate(
      {
        aiApiKey: apiKey.trim() || undefined,
        aiModel: model.trim() || undefined,
        aiMaxTokens: maxTokens || undefined,
        aiSystemPrompt: systemPrompt.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setApiKey('');
        },
      },
    );
  };

  const userCount = data.usage.byRole.find((r) => r.role === 'USER')?.count ?? 0;
  const assistantCount = data.usage.byRole.find((r) => r.role === 'ASSISTANT')?.count ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sozlamalar
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI sozlamalari</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chatbot API kaliti, model va tizim promptni boshqarish.
            </p>
          </div>
        </div>
      </div>

      {/* Statistika kartochkalari */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Suhbatlar</div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {nfmt(data.usage.conversations)}
              </div>
            </div>
            <Users2 className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Barcha xabarlar</div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {nfmt(data.usage.messagesTotal)}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {nfmt(userCount)} savol · {nfmt(assistantCount)} javob
              </div>
            </div>
            <MessageSquare className="h-5 w-5 text-info" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Token sarfi</div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {nfmt(data.usage.tokensTotal)}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">jami tokenlar</div>
            </div>
            <Coins className="h-5 w-5 text-warning" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Oxirgi xabar</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {data.usage.lastMessageAt
                  ? new Date(data.usage.lastMessageAt).toLocaleString('uz-UZ')
                  : '—'}
              </div>
            </div>
            <Cpu className="h-5 w-5 text-primary" />
          </div>
        </Card>
      </div>

      {/* Konfiguratsiya */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Key className="h-4 w-4" />
            Konfiguratsiya
          </h2>
          {data.config.apiKeySet ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Faol
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Kalit yo&apos;q
            </Badge>
          )}
        </div>

        {err ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{err.message}</AlertDescription>
          </Alert>
        ) : null}
        {saved ? (
          <Alert className="mb-4 border-primary/40 bg-primary/5">
            <AlertDescription className="text-primary">
              Sozlamalar saqlandi. Yangi API kalit darrov ishga tushadi.
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="aiApiKey">Anthropic API kaliti</Label>
            <Input
              id="aiApiKey"
              type="password"
              placeholder={data.config.apiKey ?? 'sk-ant-api03-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              {data.config.apiKey
                ? `Joriy kalit: ${data.config.apiKey}. Almashtirmoqchi bo'lsangiz yangi kalit kiriting.`
                : "Kalitni https://console.anthropic.com/ dan oling va kiriting."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aiModel">Model</Label>
              <Input
                id="aiModel"
                placeholder="claude-sonnet-4-5"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Masalan: claude-sonnet-4-5, claude-opus-4-7, claude-haiku-4-5
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aiMaxTokens">Javob uchun max tokenlar</Label>
              <Input
                id="aiMaxTokens"
                type="number"
                min={64}
                max={64000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Odatiy: 1024. Uzun javoblar uchun 4096 gacha oshiring.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aiSystemPrompt">Maxsus tizim prompt (ixtiyoriy)</Label>
            <textarea
              id="aiSystemPrompt"
              rows={4}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Bo'sh qoldirsangiz — default strict prompt (faqat kurs materiallariga oid javob)."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Bo&apos;sh bo&apos;lsa: chatbot faqat platformadagi kurs materiallariga oid savolga
              javob beradi. Mavzudan tashqari savolga ogohlantirish qaytaradi.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Sozlamalarni saqlash
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
